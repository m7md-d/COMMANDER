import { test } from "node:test";
import assert from "node:assert/strict";
import type { Member, Repository } from "@commander/shared";
import { resolveSelected } from "./defaultFront";

const member = (login: string): Member => ({ id: login, repositoryId: "", login, displayName: "", avatarUrl: "", rank: "", note: "" });

const front = (id: string, enabled: boolean, members: number) =>
  ({ id, fullName: id, enabled, members: Array.from({ length: members }, (_, index) => member(`m${index}`)) }) as Repository;

const EMPTY_DISABLED = front("acme/empty-front", false, 0);
const WATCHED = front("m7md-d/SelfLab", true, 4);
const QUIET = front("m7md-d/quiet", true, 0);

test("with nothing chosen, a page opens on a front that is watched and has people (W-08)", () => {
  // The first front alphabetically was a disabled one with nobody in it: the
  // operations room opened on "nothing here yet" and the dossiers on "no files
  // yet", while the data sat under the next front in the list.
  assert.equal(resolveSelected([EMPTY_DISABLED, WATCHED, QUIET], null), WATCHED);
});

test("a watched front with nobody comes before a disabled one", () => {
  assert.equal(resolveSelected([EMPTY_DISABLED, QUIET], null), QUIET);
});

test("what was chosen is shown, whatever it holds", () => {
  assert.equal(resolveSelected([EMPTY_DISABLED, WATCHED], EMPTY_DISABLED.id), EMPTY_DISABLED);
});

test("with nothing but disabled fronts the first is shown, and with none nothing is", () => {
  assert.equal(resolveSelected([EMPTY_DISABLED], null), EMPTY_DISABLED);
  assert.equal(resolveSelected([], null), null);
});
