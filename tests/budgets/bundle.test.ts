/**
 * What the panel costs to load.
 *
 * A dashboard gets heavier one convenient import at a time, and nobody sees it
 * because every individual addition is small. A budget turns that into a
 * decision: exceeding it is not a bug to be fixed silently but a trade to be
 * argued for, in a diff on tests/lib/budgets.ts.
 *
 * Measured gzipped, because that is what actually crosses the wire.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";
import { BUNDLE_GZIP_KB, WEB_DIST } from "../lib/budgets.ts";
import { ROOT } from "../lib/sources.ts";

const ASSETS = join(ROOT, WEB_DIST, "assets");

/** Vite names chunks `<name>-<hash>.<ext>`; the budget is keyed by the name. */
function chunkName(file: string): string {
  return file.endsWith(".css") ? "css" : (file.split("-")[0] ?? file);
}

function measure(): { name: string; kb: number }[] {
  return readdirSync(ASSETS)
    .filter((file) => file.endsWith(".js") || file.endsWith(".css"))
    .map((file) => ({
      name: chunkName(file),
      kb: gzipSync(readFileSync(join(ASSETS, file))).byteLength / 1024,
    }));
}

test("the built panel exists to be measured", () => {
  assert.ok(
    existsSync(ASSETS),
    `${WEB_DIST} is missing. Run \`npm run build\` — the budget cannot be checked against nothing, and skipping it quietly is how a budget stops being one.`,
  );
});

test("no chunk exceeds its weight budget", () => {
  const over = measure()
    .map((chunk) => ({
      ...chunk,
      limit: BUNDLE_GZIP_KB[chunk.name as keyof typeof BUNDLE_GZIP_KB],
    }))
    .filter((chunk) => chunk.limit !== undefined && chunk.kb > chunk.limit);

  assert.equal(
    over.length,
    0,
    over
      .map((c) => `${c.name}: ${c.kb.toFixed(1)}kB gzipped, budget ${c.limit}kB`)
      .join("\n"),
  );
});

test("first load stays under the total budget", () => {
  const total = measure().reduce((sum, chunk) => sum + chunk.kb, 0);

  assert.ok(
    total <= BUNDLE_GZIP_KB.total,
    `first load is ${total.toFixed(1)}kB gzipped, budget ${BUNDLE_GZIP_KB.total}kB`,
  );
});

/**
 * Splitting is what keeps the fixed costs out of the part that changes. If the
 * whole app collapsed into one chunk, every deploy would re-download React.
 */
test("vendor code stays split from ours", () => {
  const names = new Set(measure().map((chunk) => chunk.name));

  for (const expected of ["index", "vendor", "css"]) {
    assert.ok(names.has(expected), `expected a "${expected}" chunk, saw: ${[...names].join(", ")}`);
  }
});
