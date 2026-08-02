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
    const patch = file.patch
      ? file.patch.slice(0, PER_FILE_CHAR_BUDGET)
      : "(بلا فرق نصّي — ملف ثنائي أو أكبر من أن يُعرض)";
    const block = `--- ${file.path} (${file.status}) ---\n${patch}`.slice(0, budget);
    blocks.push(block);
    budget -= block.length;
  }

  return `${header}\n${blocks.join("\n\n")}`;
}
