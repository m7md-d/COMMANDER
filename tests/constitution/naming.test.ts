/**
 * CONSTITUTION.md §5 — naming conventions.
 *
 * Naming is not decoration here: `*.service.ts` and `*.controller.ts` are how
 * the layering guard finds what to check, so a file that ignores the convention
 * quietly opts itself out of every other rule in this folder.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { report, sources, under, type Finding } from "../lib/sources.ts";

const basename = (path: string) => path.slice(path.lastIndexOf("/") + 1);

test("every directory is kebab-case", () => {
  const findings: Finding[] = [];
  const seen = new Set<string>();

  for (const file of sources()) {
    const parts = file.path.split("/").slice(0, -1);
    for (let i = 0; i < parts.length; i += 1) {
      const dir = parts.slice(0, i + 1).join("/");
      const name = parts[i] ?? "";
      if (seen.has(dir) || name.startsWith(".")) continue;
      seen.add(dir);
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
        findings.push({ path: dir, line: 1, detail: `directory "${name}" is not kebab-case` });
      }
    }
  }

  assert.equal(findings.length, 0, report(findings, "CONSTITUTION.md §5"));
});

test("a module file declares its role in its name", () => {
  const findings: Finding[] = [];
  // The registry of known roles. Adding one is deliberate — and it has to be,
  // because the layering guards find their subjects by these suffixes.
  // `judge` earns its place for the same reason `measure` did: measuring a file
  // and deciding what the measurement means are separately wrong-able, and the
  // one that decides is the one worth finding by name.
  const roles =
    /\.(service|controller|routes|mapper|build|client|signature|ledger|read|write|measure|judge|maintenance)\.ts$/;

  for (const file of under("apps/api/src/modules/")) {
    if (file.path.includes(".test.")) continue;
    if (!roles.test(file.path)) {
      findings.push({
        path: file.path,
        line: 1,
        detail: "no role suffix — the layering guards match on these",
      });
    }
  }

  assert.equal(findings.length, 0, report(findings, "CONSTITUTION.md §5"));
});

test("components are PascalCase and hooks are use<Name>", () => {
  const findings: Finding[] = [];

  for (const file of under("apps/web/src/")) {
    const name = basename(file.path);
    if (file.path.includes("/hooks/") && name.endsWith(".ts") && !name.includes(".test.")) {
      if (!/^use[A-Z][A-Za-z0-9]*\.ts$/.test(name)) {
        findings.push({ path: file.path, line: 1, detail: `hook file "${name}" is not use<Name>.ts` });
      }
    }
    if (file.path.includes("/components/") && name.endsWith(".tsx")) {
      if (!/^[A-Z][A-Za-z0-9]*\.tsx$/.test(name)) {
        findings.push({ path: file.path, line: 1, detail: `component "${name}" is not PascalCase` });
      }
    }
  }

  assert.equal(findings.length, 0, report(findings, "CONSTITUTION.md §5"));
});

test("every translation key reads domain.thing.state", () => {
  const findings: Finding[] = [];
  const dictionary = sources().find((file) => file.path.endsWith("i18n/ar.ts"));
  assert.ok(dictionary, "the reference dictionary must exist");

  const pattern = /^\s*"([^"]+)":/gm;
  for (let m = pattern.exec(dictionary.text); m; m = pattern.exec(dictionary.text)) {
    const key = m[1] ?? "";
    if (!/^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9_]+)+$/.test(key)) {
      findings.push({ path: dictionary.path, line: 1, detail: `key "${key}"` });
    }
  }

  assert.equal(findings.length, 0, report(findings, "CONSTITUTION.md §5 (i18n keys)"));
});
