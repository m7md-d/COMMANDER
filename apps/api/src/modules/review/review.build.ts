/**
 * Assembles the reviewer's user prompt from a commit's diff. Kept apart from the
 * service so the size bound — the one thing that stops a giant refactor from
 * blowing the free-tier context window — stays small and testable in isolation.
 */

import type { StructureDigest } from "@commander/shared";
import type { CommitDetail } from "@/integrations/github/github.client.js";

/** The layout in one line — enough to place a file, short enough to spend on. */
function describeStructure(structure: StructureDigest): string {
  const areas = structure.areas.map((area) => `${area.path} (${area.files})`).join("، ");
  return `${structure.totalFiles} ملف؛ المناطق: ${areas}`;
}

/** A review judges a change's character, not every line; these bounds keep even
 *  a 5k-line diff inside a small context window. */
const DIFF_CHAR_BUDGET = 12_000;
const PER_FILE_CHAR_BUDGET = 3_000;

/**
 * Marks the cut, in the text the model reads.
 *
 * A silently sliced patch is not a shorter patch — it is a different one, and it
 * reads as a file that stops mid-function. The reviewer then reports exactly
 * what it was shown: "incomplete code", "functions left hanging". The accusation
 * is manufactured by the truncation, not by the model, and it lands on somebody
 * whose file was complete.
 *
 * Measured on a real report: a 311-line C file arrived as a 8,933-character
 * patch, of which the reviewer saw 3,000 — 33%, ending mid-identifier inside a
 * loop, with no closing brace and no `main`. Both invented findings followed
 * from that and only that. An honest gap beats a confident wrong answer
 * (docs/VISION.md); this is the line where the gap is made honest.
 */
function clip(patch: string, limit: number): string {
  if (patch.length <= limit) return patch;
  return `${patch.slice(0, limit)}\n… [اقتُطع الفرق: عُرض ${limit} حرفاً من ${patch.length}. ما بعد هذا الموضع لم يُعرض عليك.]`;
}

export function buildReviewPrompt(input: {
  title: string;
  authorLogin: string;
  detail: CommitDetail;
  /** The project's layout, when it has been scanned. Lets the reviewer judge
   *  *where* a file landed and whether its name matches its neighbours — the
   *  one judgement a diff alone can never support. */
  structure?: StructureDigest | null;
}): string {
  const { title, authorLogin, detail, structure } = input;

  const header = [
    `العنوان: ${title}`,
    `الكاتب: ${authorLogin || "غير معروف"}`,
    `الملفات: ${detail.files.length} (+${detail.additions} / -${detail.deletions})`,
    ...(structure ? [`هيكلة المشروع: ${describeStructure(structure)}`] : []),
    "",
    "الفرق (diff):",
  ].join("\n");

  let budget = DIFF_CHAR_BUDGET;
  const blocks: string[] = [];

  for (const file of detail.files) {
    if (budget <= 0) {
      blocks.push("… (بقية الملفات محذوفة لتجاوز الحد)");
      break;
    }
    // The remaining budget clips too, so it goes through `clip` as well — a cut
    // made by the running total is just as invisible as a cut made by the
    // per-file bound, and was the second silent one here.
    const head = `--- ${file.path} (${file.status}) ---\n`;
    const allowance = Math.min(PER_FILE_CHAR_BUDGET, Math.max(budget - head.length, 0));
    const patch = file.patch
      ? clip(file.patch, allowance)
      : "(بلا فرق نصّي — ملف ثنائي أو أكبر من أن يُعرض)";
    const block = head + patch;
    blocks.push(block);
    budget -= block.length;
  }

  return `${header}\n${blocks.join("\n\n")}`;
}
