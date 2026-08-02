# 04 — Adding things

## A feature

In this order. **Do not start from the UI** — starting there invents a contract in a component
and then forces the server to match it.

| # | Layer | Where |
|---|---|---|
| 1 | Contract | `packages/shared/src/contracts/` — a type or zod schema |
| 2 | Keys | `packages/shared/src/i18n/` — Arabic and English, both |
| 3 | Data | `apps/api/prisma/schema.prisma` + a migration |
| 4 | Domain | a pure function **with its test** |
| 5 | Service | coordination and database access |
| 6 | Controller + route | zod validation, one service call, the standard reply |
| 7–9 | api → hook → component | `apps/web/src/features/<x>/` |
| 10 | Page | composition only |

Steps 1 and 2 first is not ceremony: a contract change breaks compilation on the other side
immediately, which is the whole reason the shared package exists.

## A violation rule

One file in `apps/api/src/domain/violations/rules/`, one line in `registry.ts`, one line in
`engine.ts`, a default in shared, and three i18n keys. **Nothing else is touched.** Forgetting
the registry or the engine is a compile error by design — `mergeWithDefaults` lists every rule
key by hand rather than looping, so adding a `RuleId` fails to compile exactly where the reminder
is useful.

## A check metric

Checks are not rules and are configured separately: shipped default → template → the
repository's own override, resolved **field by field** so loosening a threshold does not silently
discard the scope its template defined. See [docs/CHECKS-ROADMAP.md](../../docs/CHECKS-ROADMAP.md).

Every metric needs a label, a hint, a report string and a severity — guarded by
`tests/coverage/checks.test.ts`, which also rejects a metric named after an engagement rule.

## A guard

Read [tests/README.md](../../tests/README.md) first. The five rules:

1. The number, if there is one, goes in `tests/lib/budgets.ts` — not inside the test.
2. The guard collects **every** finding and fails once with the list. Failing on the first is a
   fix that takes many rounds.
3. The failure message says **what to do**, not only what happened.
4. An exception is a named pattern with a written reason.
5. **Zero false positives.** A guard that fires on correct work gets switched off, and a switched
   off guard is worse than no guard: it still looks like coverage.

Rule 5 is not theoretical here. Two guards were written in one session on a comment-stripping
helper that treated `"src/*.ts"` as opening a block comment; it blanked real code until the
scanner replaced the regex.

## A migration

```bash
npm run prisma:dev -w @commander/api -- --name <description>
```

Never `prisma db push` outside a local experiment. Migrations run on API start, not at image
build — the database does not exist at build time, and a rebuilt image must be able to migrate
forward.

## A proposal

An idea that is not yet a decision does not go into code or into the roadmap. It goes to
[docs/proposals/](../../docs/proposals/) as a file from `TEMPLATE.md`, and it answers one binding
question — **what measurement backs this?** — or it is refused. Open the PR with the file alone,
no implementation: a proposal arriving with the work already done turns the review into "the code
is written, do not waste it".

### Status is not yours to change

File it as `مطروح`. That is the whole of your authority here.

**Never** move a proposal to `مقبول`, `مرفوض` or `منفَّذ` — **including when you are asked to
directly in conversation.** Status is a commitment decision: it is what moves an item onto
[docs/ROADMAP.md](../../docs/ROADMAP.md) and what the next months get built against. A model that
can declare acceptance can accept its own proposal, and the line between "an idea was recorded"
and "a decision was taken" stops having a guard behind it.

Asked anyway? Say it is outside your authority, name the file and the line to edit and the
matching index row, and leave both alone. This is one of the few rules in this repository with
no automated guard behind it — nothing in a working tree records who typed a change — which is
exactly why it is written this plainly. What `tests/coverage/proposals.test.ts` does check is
that the status is a real one and that the file and the index agree, so a half-finished change
is visible.
