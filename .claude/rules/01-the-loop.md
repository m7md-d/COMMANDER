# 01 — The loop

Every change goes through this. It is short on purpose: a checklist nobody finishes is a
checklist nobody starts.

## Before

| Step | Why |
|---|---|
| Read the constitution section your change touches | The rule is usually already decided, and the reason is usually written next to it |
| Check [05-do-not-simplify.md](05-do-not-simplify.md) if the code looks wrong | Several things here look like mistakes and are not. That file exists because they were "fixed" once |
| `npm run build -w @commander/shared` after editing `packages/shared` | Both apps import its `dist`. Skipping this makes the next typecheck lie to you |

## During

**A change to behaviour changes a test in the same edit.** Not the next commit, not a follow-up.

| What you changed | What must change with it |
|---|---|
| A pure function in `domain/` | Its test. Enforced: `tests/coverage/domain-tests.test.ts` fails on any exported domain function no test names |
| A rule's behaviour | The test that pinned the old behaviour, rewritten to pin the new one. Deleting it instead is how a rule silently reverts |
| How a push is judged — a rule, a gate, the mapper, the enrichment, who is charged | The scenario reference in [apps/api/src/scenarios/](../../apps/api/src/scenarios/): delete the `defect` record your change fixes, update the one it moves, and add the git shape it did not cover. It fails if a fixed defect is left on file. Then [docs/DEFECTS.md](../../docs/DEFECTS.md): move the fixed entry with its cause and fix, or add the one you found |
| A defect you found, or are about to fix | **The test comes first**, and is seen working before any fix: break the suspected cause and watch it flip, then restore. After the fix, remove the fix and watch the test fail, then restore. The order and the log entry are in [docs/DEFECTS.md](../../docs/DEFECTS.md) |
| A UI defect | The same order, logged in [docs/UI-DEFECTS.md](../../docs/UI-DEFECTS.md). Its test sits beside the code in `apps/web/src/` (`npm run test -w @commander/web`, Node's runner, no DOM — so pull the logic into a pure function the component calls), or is a guard in `tests/` when the rule is repo-wide. Then see the fix in a real browser: a test once passed on a W-11 fix that did not work |
| A repo-wide invariant | A guard in `tests/`. Read [tests/README.md](../../tests/README.md) first — the five rules for writing one are there |
| A number: limit, budget, threshold | [tests/lib/budgets.ts](../../tests/lib/budgets.ts) and nowhere else, so raising one is a reviewable diff on a single file |
| A user-visible string | A key in `packages/shared/src/i18n/`, in **both** dictionaries: `ar.ts` and `en.ts` for what the panel shows, `ar.server.ts` and `en.server.ts` for what only the server reads — the model's instructions and the facts it is handed, which no browser downloads (ROADMAP 4.1) |

If a guard fails, fix the code. Weaken a guard only when it is demonstrably wrong, and write
the reason inside it. A guard turned off to make a diff green is worse than never having
written it — it now certifies something it no longer checks.

## After

```bash
npm run verify        # typecheck + lint + build + test — the whole gate
```

`verify` builds before it tests, deliberately: the page-weight budget measures built output,
and a guard that silently finds nothing to measure must not pass.

Then report honestly. What ran, what passed, what was skipped and why. Two guards skip when no
stack is reachable and say so out loud — that is a skip, not a pass, and it is reported as one.

## Commands

| Command | Use |
|---|---|
| `npm run verify` | The gate. Before claiming anything is done |
| `npm run test:guards` | The repo-wide guards alone — the fast loop after a structural change |
| `npm run typecheck` | All three workspaces; API test files go through `tsconfig.test.json` |
| `npm run dev` | Compose with the dev overlay: both apps hot-reload, Postgres on host port 5433 |
| `npm run up` / `down` / `logs` | Production compose. Never `down -v` — that deletes the volume |

Every compose command goes through [scripts/compose.sh](../../scripts/compose.sh), which resolves
Podman first and Docker second (`COMPOSE_ENGINE` overrides). **Do not write `docker compose` in a
script** — `tests/coverage/tooling.test.ts` fails on it, because a command that only works on the
author's machine is `command not found` on the server it was written for.

**Prisma:** edit `apps/api/prisma/schema.prisma`, then
`npm run prisma:dev -w @commander/api -- --name <description>`. Never `prisma db push` outside a
local experiment — it drifts the schema away from the migration history, and the next deploy
finds out.

## Git

**The repository is the owner's to manage.** Prepare files; do not commit, push, branch, or
otherwise mutate git state unless asked in that turn. Read-only inspection (`git log`,
`git status`, `git ls-files`) is fine and often the fastest way to answer a question.
