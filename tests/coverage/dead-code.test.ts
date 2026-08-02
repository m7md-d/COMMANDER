/**
 * Nothing exists without a use.
 *
 * A restructure leaves debris: a page that no route renders, a stylesheet class
 * nobody applies, a dictionary key for a screen that was deleted. None of it
 * breaks a build, so none of it is ever noticed — it is simply carried forward
 * and read by the next person as if it mattered.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  isStyle,
  isTest,
  lineOf,
  report,
  ROOT,
  sources,
  type Finding,
  type SourceFile,
} from "../lib/sources.ts";

/** Files that are entered rather than imported. */
const ENTRY_POINTS = [
  /^apps\/web\/src\/main\.tsx$/,
  /^apps\/api\/src\/(main|server)\.ts$/,
  /^packages\/shared\/src\/index\.ts$/,
  /\.config\.(ts|js|mjs)$/,
  /^eslint\.config\./,
];

const code = () => sources().filter((file) => !isStyle(file) && !isTest(file));

/** How a module would be named in an import: no extension, no /index. */
function moduleNames(path: string): string[] {
  const bare = path.replace(/\.(tsx?|jsx?)$/, "");
  const names = [bare];
  if (bare.endsWith("/index")) names.push(bare.slice(0, -"/index".length));
  return names.map((name) => name.slice(name.lastIndexOf("/") + 1));
}

test("every module is reachable — no orphaned files", () => {
  const files = code();
  const findings: Finding[] = [];

  for (const file of files) {
    if (ENTRY_POINTS.some((entry) => entry.test(file.path))) continue;

    // Matched by module name rather than by resolved path: the repo mixes alias
    // imports (`@/x/y.js`), relative ones and workspace ones, and the API writes
    // the `.js` extension ESM requires while the web app omits it. Resolving all
    // of that would be a bundler. A name collision can only produce a false
    // *pass*, never a false failure — the right way round for a guard whose
    // remedy is deleting someone's file.
    const others = files.filter((other) => other.path !== file.path);
    const referenced = moduleNames(file.path).some((name) => {
      const pattern = new RegExp(`(/|["'])${name}(\\.jsx?|\\.tsx?)?["']`);
      return others.some((other) => pattern.test(other.text));
    });

    if (!referenced) {
      findings.push({ path: file.path, line: 1, detail: "imported by nothing" });
    }
  }

  assert.equal(
    findings.length,
    0,
    `${report(findings, "dead code")}\n\nDelete it, or wire it up. An unreachable module is a lie about the shape of the app.`,
  );
});

/**
 * A dependency nobody imports is worse than unused weight: it reads as a
 * decision the project made, and under apps/web/CONSTITUTION.md §8 adopting a
 * library *is* a decision. Carrying one that was never adopted misrepresents
 * the architecture to whoever reads package.json next.
 */
test("every declared dependency is actually imported", () => {
  const findings: Finding[] = [];
  const corpus = code().map((file) => file.text).join("\n");
  const manifests = ["apps/web", "apps/api", "packages/shared"];

  for (const workspace of manifests) {
    const manifest = JSON.parse(
      readFileSync(join(ROOT, workspace, "package.json"), "utf8"),
    ) as { dependencies?: Record<string, string> };

    for (const name of Object.keys(manifest.dependencies ?? {})) {
      // Workspace links resolve by name; a subpath import counts as a use.
      const pattern = new RegExp(`["']${name.replace(/[/@-]/g, "\\$&")}(/[^"']*)?["']`);
      if (!pattern.test(corpus)) {
        findings.push({ path: `${workspace}/package.json`, line: 1, detail: `${name} is never imported` });
      }
    }
  }

  assert.equal(findings.length, 0, report(findings, "unused dependency"));
});

/**
 * The mirror of the rule above, and the one that actually bit.
 *
 * Removing a dependency from package.json does not remove it from node_modules,
 * so a stale reference in a build config still resolves locally and the build
 * passes — then fails in the container, where install is clean. The guard has to
 * read the config, because the compiler never will.
 */
test("no build config names a package that is not a dependency", () => {
  const findings: Finding[] = [];
  const configs = sources().filter((file) => /\.config\.(ts|js|mjs)$/.test(file.path));

  for (const config of configs) {
    const workspace = config.path.slice(0, config.path.lastIndexOf("/"));
    const manifestPath = join(ROOT, workspace, "package.json");
    if (!existsSync(manifestPath)) continue;

    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const declared = new Set([
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.devDependencies ?? {}),
    ]);

    // Bare package specifiers only: a scoped or plain name, never a path.
    const pattern = /"(@[a-z0-9-]+\/[a-z0-9-]+|[a-z][a-z0-9-]{2,})"/g;
    for (let m = pattern.exec(config.text); m; m = pattern.exec(config.text)) {
      const name = m[1] ?? "";
      if (!name.includes("/") && !declared.has(name)) continue; // a plain word, not a package
      if (!declared.has(name)) {
        findings.push({
          path: config.path,
          line: lineOf(config.text, m.index),
          detail: `"${name}" is referenced but not declared in ${workspace}/package.json`,
        });
      }
    }
  }

  assert.equal(findings.length, 0, report(findings, "stale build config"));
});

test("every CSS class defined is applied somewhere", () => {
  const styles = sources().filter(isStyle);
  const markup = code()
    .filter((file) => file.path.startsWith("apps/web/"))
    .map((file) => file.text)
    .join("\n");

  const findings: Finding[] = [];
  const declared = new Map<string, SourceFile>();
  // A class only where a selector can be: followed by a combinator, a brace or
  // another selector part. Comments, `@import` lines and `url(…)` payloads are
  // removed first — an embedded SVG carries `www.w3.org`, which is otherwise
  // read as two class names.
  const pattern = /\.([a-z][a-z0-9-]*)(?=[\s,{:.[>)]|$)/gi;

  for (const file of styles) {
    const css = file.text
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/^\s*@import[^\n]*/gm, " ")
      .replace(/url\([^)]*\)/g, " ");
    for (let m = pattern.exec(css); m; m = pattern.exec(css)) {
      const name = m[1] ?? "";
      if (!declared.has(name)) declared.set(name, file);
    }
  }

  for (const [name, file] of declared) {
    // Class names are built by template too (`stamp-${state}`), so a suffix
    // match counts: `stamp-on` is used when "stamp-" appears with a binding.
    const used =
      new RegExp(`["'\\s\`{]${name}[\\s"'\`}]|\\$\\{[^}]*\\}${name}\\b`).test(markup) ||
      new RegExp(`["'\\s\`]${name.replace(/-[a-z0-9]+$/, "-")}\\$\\{`).test(markup);
    if (!used) findings.push({ path: file.path, line: 1, detail: `.${name} is never applied` });
  }

  assert.equal(findings.length, 0, report(findings, "dead CSS"));
});
