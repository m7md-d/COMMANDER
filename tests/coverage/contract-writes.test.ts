/**
 * Every field a repository accepts is a field it writes.
 *
 * The create and update calls list their columns by hand. That is the right
 * shape — an explicit list is greppable and a spread of unvalidated input is
 * not — but a hand-kept list loses entries, and losing one here is invisible:
 * the PATCH still returns 200 carrying the *old* value, so the panel says
 * "saved" and the operator believes it. Only the next time they open the page
 * does the setting appear to have reverted on its own.
 *
 * It has happened twice. `projectBrief` and `projectStage` were missing until
 * somebody noticed project awareness never changed; `schedules` was missing
 * until an operator set a weekly slot, saved, and watched it snap back to
 * Monday 09:00. Both were found by a person, which is not a control.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { codeOnly, report, ROOT, type Finding } from "../lib/sources.js";

const CONTRACT = "packages/shared/src/contracts/repository.ts";
const SERVICE = "apps/api/src/modules/repositories/repositories.service.ts";

/**
 * The whole function, not the `data:` object inside it. `members` is not a column
 * — the update hands it to `replaceMembers` before the row is touched at all —
 * and a check aimed at the object would call that omission a bug. The question is
 * whether the path handles the field, not where.
 */
const WRITERS = ["createRepository", "updateRepository"];

/** Top-level keys of `repositoryInputSchema = z.object({ … })`, read from source
 *  rather than imported: a guard that needs a build to run is a guard that gets
 *  skipped when the build is what broke. */
function contractFields(text: string): string[] {
  const start = text.indexOf("export const repositoryInputSchema = z.object({");
  assert.notEqual(start, -1, `${CONTRACT} no longer declares repositoryInputSchema`);

  const body = text.slice(start, text.indexOf("\n});", start));
  return [...body.matchAll(/^ {2}(\w+):/gm)].map((match) => match[1]!);
}

/** A function's body, brace-matched from its signature. */
function functionBody(text: string, name: string): { body: string; at: number } {
  const at = text.indexOf(`export async function ${name}`);
  assert.notEqual(at, -1, `${SERVICE} no longer exports ${name}`);

  let depth = 0;
  for (let i = text.indexOf("{", at); i < text.length; i += 1) {
    if (text[i] === "{") depth += 1;
    else if (text[i] === "}" && (depth -= 1) === 0) return { body: text.slice(at, i), at };
  }
  return { body: text.slice(at), at };
}

test("every repository input field is persisted by create and update", () => {
  const contract = readFileSync(join(ROOT, CONTRACT), "utf8");
  const service = readFileSync(join(ROOT, SERVICE), "utf8");

  const fields = contractFields(contract);
  assert.ok(fields.length >= 10, `only ${fields.length} fields parsed — the reader is broken`);

  const findings: Finding[] = [];

  for (const name of WRITERS) {
    const { body, at } = functionBody(service, name);
    // Comments blanked: a field named in the note explaining why it was once
    // missing would otherwise satisfy the check that it is no longer missing.
    const code = codeOnly(body);

    for (const field of fields) {
      if (new RegExp(`\\b${field}\\b`).test(code)) continue;
      findings.push({
        path: SERVICE,
        line: service.slice(0, at).split("\n").length,
        detail: `${name} never writes "${field}" — the request would be accepted and dropped`,
      });
    }
  }

  assert.equal(
    findings.length,
    0,
    `${report(findings, `${CONTRACT} — accepted means persisted`)}\n\nAdd the field to the data object. If it genuinely must not be stored, remove it from repositoryInputSchema — accepting input you discard is worse than rejecting it.`,
  );
});
