/**
 * No npm script names a container engine.
 *
 * Podman is what this project is deployed on and Docker is what it is usually
 * developed on, so every script goes through `scripts/compose.sh`, which picks
 * one. Hard-coding either brings back the failure this replaced: a command that
 * works on the author's machine and is `command not found` on the server.
 *
 * It rots silently, too — nothing else notices `npm run logs` being unusable in
 * production, because nobody runs production scripts in CI.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { report, ROOT, type Finding } from "../lib/sources.js";

/**
 * `docker compose` / `podman-compose` as a *command*. The negative lookahead
 * keeps `-f docker-compose.yml` out of it: that is a filename, and the files are
 * named that way because both engines read them.
 */
const ENGINE = /\b(?:docker|podman)(?:\s+compose\b|-compose(?![\w.-]))/;

const MANIFESTS = [
  "package.json",
  "apps/api/package.json",
  "apps/web/package.json",
  "packages/shared/package.json",
];

test("no npm script hard-codes a container engine", () => {
  const findings: Finding[] = [];

  for (const path of MANIFESTS) {
    const text = readFileSync(join(ROOT, path), "utf8");
    const scripts: unknown = (JSON.parse(text) as { scripts?: unknown }).scripts;
    if (typeof scripts !== "object" || scripts === null) continue;

    for (const [name, command] of Object.entries(scripts)) {
      if (typeof command !== "string" || !ENGINE.test(command)) continue;
      findings.push({
        path,
        line: text.split("\n").findIndex((row) => row.includes(`"${name}"`)) + 1,
        detail: `"${name}" calls an engine directly — go through scripts/compose.sh`,
      });
    }
  }

  assert.equal(
    findings.length,
    0,
    `${report(findings, "docs/DEPLOY.md — Podman first, Docker supported")}\n\nReplace the engine with \`sh scripts/compose.sh\`. It resolves Podman, then Docker, and honours COMPOSE_ENGINE.`,
  );
});
