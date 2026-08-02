/**
 * Every image reference names its registry.
 *
 * Docker resolves a bare `postgres:16-alpine` to Docker Hub silently. Podman
 * does not: it consults the host's `unqualified-search-registries`, and where
 * that lists more than one — Fedora ships three — it stops and asks which. On a
 * server, with no terminal attached, that is not a prompt but a hang.
 *
 * `docker.io/library/postgres:16-alpine` is what both engines resolve to anyway,
 * so qualifying costs nothing and removes the host's configuration from the
 * answer. Which is the real point: the image a deploy pulls should not depend on
 * a file nobody in this repository can see.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lineOf, report, ROOT, type Finding } from "../lib/sources.js";

const FILES = [
  "docker-compose.yml",
  "docker-compose.dev.yml",
  "docker-compose.public.yml",
  "docker-compose.tunnel.yml",
  "apps/api/Dockerfile",
  "apps/web/Dockerfile",
];

/** `image: x` in compose, `FROM x` in a Dockerfile. */
const REFERENCE = /^\s*(?:image:\s*|FROM\s+)(\S+)/gm;

/**
 * A registry host has a dot or a colon before the first slash — `docker.io/…`,
 * `localhost:5000/…`. Build stages (`FROM build`, `COPY --from=deps`) have no
 * slash at all and are not images.
 */
const isQualified = (ref: string): boolean => {
  const head = ref.split("/")[0]!;
  return ref.includes("/") && (head.includes(".") || head.includes(":") || head === "localhost");
};

/** `${VAR}` resolves at run time; there is nothing here to check. */
const isInterpolated = (ref: string): boolean => ref.includes("$");

test("every container image names its registry", () => {
  const findings: Finding[] = [];

  for (const path of FILES) {
    const text = readFileSync(join(ROOT, path), "utf8");

    for (const match of text.matchAll(REFERENCE)) {
      const ref = match[1]!;
      if (isInterpolated(ref) || !ref.includes(":") || isQualified(ref)) continue;
      findings.push({
        path,
        line: lineOf(text, match.index),
        detail: `"${ref}" is unqualified — Podman will ask which registry, and a deploy has nobody to ask`,
      });
    }
  }

  assert.equal(
    findings.length,
    0,
    `${report(findings, "docs/DEPLOY.md — Podman first, Docker supported")}\n\nPrefix it: docker.io/library/<name> for official images, docker.io/<owner>/<name> otherwise.`,
  );
});
