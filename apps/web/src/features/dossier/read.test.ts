import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { MemberDossier } from "@commander/shared";
import { readDossier } from "./read";

const OPENED = { login: "lina-dev" } as MemberDossier;

test("opening a dossier refreshes the roster beside it (W-03)", async () => {
  // The server recomputes a dossier when it is opened and stores the new score;
  // the roster had read the stored row before that. Left as it was, the list
  // said "0 · exemplary" beside an open file saying "15 · on probation".
  const refreshed: string[] = [];

  const dossier = await readDossier(
    { fetch: async () => OPENED, refreshList: (repositoryId) => refreshed.push(repositoryId) },
    { repositoryId: "front-1", login: "lina-dev" },
  );

  assert.equal(dossier, OPENED);
  assert.deepEqual(refreshed, ["front-1"]);
});

test("a dossier that fails to open refreshes nothing", async () => {
  const refreshed: string[] = [];

  await assert.rejects(
    readDossier(
      { fetch: async () => Promise.reject(new Error("dossier.empty")), refreshList: (id) => refreshed.push(id) },
      { repositoryId: "front-1", login: "nobody" },
    ),
  );
  assert.deepEqual(refreshed, []);
});

test("the dossier query opens through readDossier, so the refresh cannot be bypassed", () => {
  const hooks = readFileSync(new URL("./hooks.ts", import.meta.url), "utf8");
  const query = hooks.slice(hooks.indexOf("export function useDossier("));

  assert.match(query.slice(0, query.indexOf("\n}\n")), /readDossier\(/);
});
