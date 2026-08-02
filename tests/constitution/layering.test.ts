/**
 * CONSTITUTION.md §2 (dependency rule) and apps/web/CONSTITUTION.md §1.
 *
 * Dependencies point inward. Every rule here is one that a passing typecheck
 * will happily let through — TypeScript has no opinion about which layer may
 * import which — so this file is the only thing standing between the
 * architecture and a convenient import.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { codeOnly, lineOf, report, sources, under, type Finding } from "../lib/sources.ts";

/** Every `from "..."` in a file, with the line it sits on. */
function imports(text: string): { spec: string; line: number }[] {
  const found: { spec: string; line: number }[] = [];
  const code = codeOnly(text);
  const pattern = /from\s+["']([^"']+)["']/g;
  for (let match = pattern.exec(code); match; match = pattern.exec(code)) {
    found.push({ spec: match[1] ?? "", line: lineOf(code, match.index) });
  }
  return found;
}

test("the api domain layer imports no framework and no database", () => {
  const banned = /^(express|@prisma\/client)$|\/db\/prisma|core\/logger/;
  const findings: Finding[] = [];

  for (const file of under("apps/api/src/domain/")) {
    for (const { spec, line } of imports(file.text)) {
      if (banned.test(spec)) {
        findings.push({ path: file.path, line, detail: `domain imports ${spec}` });
      }
    }
  }

  assert.equal(findings.length, 0, report(findings, "CONSTITUTION.md §2 (pure domain)"));
});

test("services take data, not requests", () => {
  const findings: Finding[] = [];

  for (const file of sources()) {
    if (!file.path.includes(".service.")) continue;
    for (const { spec, line } of imports(file.text)) {
      if (spec === "express" || spec.startsWith("express/")) {
        findings.push({ path: file.path, line, detail: "a service imports express" });
      }
    }
  }

  assert.equal(findings.length, 0, report(findings, "CONSTITUTION.md §2 (no HTTP in services)"));
});

test("controllers query no database directly", () => {
  const findings: Finding[] = [];

  for (const file of sources()) {
    if (!file.path.includes(".controller.")) continue;
    const code = codeOnly(file.text);
    const match = /\bprisma\./.exec(code);
    if (match) {
      findings.push({
        path: file.path,
        line: lineOf(code, match.index),
        detail: "a controller reaches past its service to Prisma",
      });
    }
  }

  assert.equal(findings.length, 0, report(findings, "CONSTITUTION.md §2 (controllers call one service)"));
});

test("no feature imports another feature", () => {
  const findings: Finding[] = [];
  const owner = /^apps\/web\/src\/features\/([^/]+)\//;

  for (const file of under("apps/web/src/features/")) {
    const self = owner.exec(file.path)?.[1];
    for (const { spec, line } of imports(file.text)) {
      const other = /^@\/features\/([^/]+)\//.exec(spec)?.[1];
      if (other && other !== self) {
        findings.push({ path: file.path, line, detail: `features/${self} imports features/${other}` });
      }
    }
  }

  assert.equal(
    findings.length,
    0,
    `${report(findings, "apps/web/CONSTITUTION.md §1")}\n\nWhat two features share moves up to shared/.`,
  );
});

test("shared never depends on a feature or a page", () => {
  const findings: Finding[] = [];

  for (const file of under("apps/web/src/shared/")) {
    for (const { spec, line } of imports(file.text)) {
      if (spec.startsWith("@/features/") || spec.startsWith("@/pages/")) {
        findings.push({ path: file.path, line, detail: `shared imports ${spec}` });
      }
    }
  }

  assert.equal(findings.length, 0, report(findings, "apps/web/CONSTITUTION.md §1 (direction)"));
});

test("styling libraries and CSS are imported only where the design system lives", () => {
  const findings: Finding[] = [];
  const external = /^(@radix-ui\/|framer-motion)/;

  /**
   * The design system, plus the one app-level file that configures motion for
   * the whole tree. `MotionConfig reducedMotion="user"` is not a component and
   * has no component to live in — it is a provider, and wrapping it in one
   * purely to satisfy the folder rule would be ceremony, not isolation.
   */
  const MAY_IMPORT = [
    "apps/web/src/shared/components/",
    "apps/web/src/shared/hooks/",
    "apps/web/src/app/providers.tsx",
  ];

  for (const file of under("apps/web/src/")) {
    const inDesignSystem = MAY_IMPORT.some((allowed) => file.path.startsWith(allowed));
    for (const { spec, line } of imports(file.text)) {
      if (external.test(spec) && !inDesignSystem) {
        findings.push({ path: file.path, line, detail: `${spec} imported outside shared/components` });
      }
      if (spec.endsWith(".css") && !file.path.endsWith("main.tsx")) {
        findings.push({ path: file.path, line, detail: "a module imports CSS" });
      }
    }
  }

  assert.equal(findings.length, 0, report(findings, "apps/web/CONSTITUTION.md §1 and §8"));
});

/**
 * Who a tree row *is* belongs to the tree module; what it *measures* does not.
 *
 * Two invariants sit in `modules/tree/tree.write.ts` and nowhere else. One the
 * database also enforces — a blob's metric row exists before a tree row points
 * at it — and one it cannot: a moved file is updated, never replaced, so its
 * `firstSeenAt` survives. That column anchors the baseline, and resetting it
 * re-dates code that predates the platform as work somebody did today.
 *
 * So the line is drawn at **row lifecycle and the blob pointer**, not at every
 * column. `modules/checks/` legitimately fills in `lines` and `baselineLines`:
 * those are measurements of a row, not decisions about whether it exists.
 */
test("tree rows are created, deleted and re-pointed by their own module only", () => {
  const findings: Finding[] = [];
  const lifecycle =
    /\b\w+\.(treeFile|blobMetric)\.(create|createMany|upsert|delete|deleteMany)\b/g;
  // `blobSha: true` is a Prisma *selection*; anything else assigns the pointer.
  // Reading which blob a row points at is every module's business — moving it is
  // not, and the boolean is what tells the two apart without parsing the query.
  // The whitespace sits *inside* the lookahead, as in the font-family guard: put
  // `\s*` before it and it can match nothing, landing the lookahead on the space
  // and passing every line it was meant to catch.
  const repoint = /\bblobSha\s*:(?!\s*(?:true|false)\b)/g;

  for (const file of under("apps/api/src/")) {
    if (file.path.startsWith("apps/api/src/modules/tree/")) continue;
    if (file.path.startsWith("apps/api/src/domain/tree/")) continue;

    const code = codeOnly(file.text);
    for (let match = lifecycle.exec(code); match; match = lifecycle.exec(code)) {
      findings.push({
        path: file.path,
        line: lineOf(code, match.index),
        detail: `creates or removes ${match[1]} rows from outside modules/tree/`,
      });
    }
    for (let match = repoint.exec(code); match; match = repoint.exec(code)) {
      findings.push({
        path: file.path,
        line: lineOf(code, match.index),
        detail: "moves a tree row's blob pointer from outside modules/tree/",
      });
    }
  }

  assert.equal(
    findings.length,
    0,
    `${report(findings, "docs/CHECKS-ROADMAP.md §3")}\n\nGo through modules/tree/tree.write.ts — the write order and firstSeenAt are its invariants. Filling in a measurement is fine; deciding a row exists is not.`,
  );
});

/**
 * A general table only stays honest if every query says which half it means.
 *
 * `ledger_events` was `violation_events`, and every read of it was implicitly a
 * read of violations. Now that it also holds commendations, a query that forgets
 * to say so does not fail — it silently returns both, and a risk score built
 * from that would rise when somebody improved the code. The compiler cannot see
 * this: `kind` is an ordinary optional filter, and leaving it out is valid
 * Prisma. So it is checked here.
 *
 * Naming it is enough; naming it *wrongly* is a code review's job. Passing
 * `{ in: [...LEDGER_KINDS] }` is a legitimate answer — it means "any entry", and
 * the point is that somebody decided.
 */
test("every query against the ledger names the kind it means", () => {
  const findings: Finding[] = [];
  const call = /\.ledgerEvent\.(\w+)\(/g;

  for (const file of under("apps/api/src/")) {
    const code = codeOnly(file.text);
    for (let match = call.exec(code); match; match = call.exec(code)) {
      const args = callArguments(code, match.index + match[0].length - 1);
      if (/\bkind\b/.test(args)) continue;

      findings.push({
        path: file.path,
        line: lineOf(code, match.index),
        detail: `ledgerEvent.${match[1]}() does not say which kind it means`,
      });
    }
  }

  assert.equal(
    findings.length,
    0,
    `${report(findings, "docs/CHECKS-ROADMAP.md §14")}\n\nAdd kind: "violation" | "commendation", or { in: [...LEDGER_KINDS] } if the query genuinely wants both.`,
  );
});

/** The text between a call's parentheses, by balancing them. */
function callArguments(code: string, openIndex: number): string {
  let depth = 0;

  for (let index = openIndex; index < code.length; index += 1) {
    if (code[index] === "(") depth += 1;
    else if (code[index] === ")") {
      depth -= 1;
      if (depth === 0) return code.slice(openIndex + 1, index);
    }
  }

  return code.slice(openIndex + 1);
}

test("no import climbs more than one level, and modules expose no barrel", () => {
  const findings: Finding[] = [];

  for (const file of sources()) {
    for (const { spec, line } of imports(file.text)) {
      if (spec.includes("../../")) {
        findings.push({ path: file.path, line, detail: `deep relative import: ${spec}` });
      }
    }
    if (/\/modules\/[^/]+\/index\.ts$/.test(file.path)) {
      findings.push({ path: file.path, line: 1, detail: "barrel file inside modules/" });
    }
  }

  assert.equal(findings.length, 0, report(findings, "CONSTITUTION.md §5.1"));
});
