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

/** `up` as a subcommand, not as part of a filename. */
const UP = /(?:^|\s)up(?:\s|$)/;

function scriptsOf(text: string): [string, string][] {
  const scripts: unknown = (JSON.parse(text) as { scripts?: unknown }).scripts;
  if (typeof scripts !== "object" || scripts === null) return [];
  return Object.entries(scripts).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  );
}

const lineOfScript = (text: string, name: string): number =>
  text.split("\n").findIndex((row) => row.includes(`"${name}"`)) + 1;

test("no npm script hard-codes a container engine", () => {
  const findings: Finding[] = [];

  for (const path of MANIFESTS) {
    const text = readFileSync(join(ROOT, path), "utf8");
    for (const [name, command] of scriptsOf(text)) {
      if (!ENGINE.test(command)) continue;
      findings.push({
        path,
        line: lineOfScript(text, name),
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

/**
 * Building an image is not deploying it.
 *
 * `up -d --build` builds, tags, and then — if a container of that name is
 * already there — starts the one that exists. Compose is free to consider the
 * service up to date; podman-compose does exactly this. The build log scrolls
 * past green, the image is genuinely new, and the old code keeps serving.
 *
 * It cost a live debugging session: a fix was committed, pulled, built on the
 * server and still absent from the running container, because nothing in the
 * command ever said *replace*. `--force-recreate` is what says it. The Postgres
 * volume is named, so recreating its container costs a restart and no data.
 */
test("a script that rebuilds also replaces the running containers", () => {
  const findings: Finding[] = [];

  for (const path of MANIFESTS) {
    const text = readFileSync(join(ROOT, path), "utf8");
    for (const [name, command] of scriptsOf(text)) {
      if (!UP.test(command) || !command.includes("--build")) continue;
      if (command.includes("--force-recreate")) continue;
      findings.push({
        path,
        line: lineOfScript(text, name),
        detail: `"${name}" builds a new image but may start the old container`,
      });
    }
  }

  assert.equal(
    findings.length,
    0,
    `${report(findings, "docs/DEPLOY.md §5")}\n\nAdd \`--force-recreate\`. Without it a deploy can rebuild everything and change nothing.`,
  );
});
