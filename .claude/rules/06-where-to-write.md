# 06 — Where to write what

An idea, a decision and a rule have different lifespans. Mixing them in one document makes it
contradict itself within months, and then nobody can tell which line is still true.

| What you have | Where it goes |
|---|---|
| An idea, not yet decided | [docs/proposals/](../../docs/proposals/) — a file from `TEMPLATE.md`. It answers "what measurement backs this?" or it is refused |
| An accepted item, not yet built | a row in [docs/ROADMAP.md](../../docs/ROADMAP.md) |
| Something just built, and how it departed from the plan | [docs/CHECKS-ROADMAP.md](../../docs/CHECKS-ROADMAP.md) (engine) or [docs/UI-AUDIT.md](../../docs/UI-AUDIT.md) (panel) |
| A UI observation | [docs/UI-AUDIT.md](../../docs/UI-AUDIT.md), **at the moment you meet it** — not gathered later from memory |
| A rule binding all future code | the constitution, amended under §9 |
| A number: limit, budget, threshold | [tests/lib/budgets.ts](../../tests/lib/budgets.ts), and nowhere else |
| A deployment step | [docs/DEPLOY.md](../../docs/DEPLOY.md) |
| Guidance for a model working here | these files |

## The design journals

[CHECKS-ROADMAP.md](../../docs/CHECKS-ROADMAP.md) and [UI-AUDIT.md](../../docs/UI-AUDIT.md) are
not usage guides. They record what was built, why, and **where it departed from the plan** — that
last part being the most useful thing in either of them. They are written when the decision is
taken, not reconstructed afterwards.

The guards cite them by clause: a failure reading `docs/CHECKS-ROADMAP.md §3` means the reason is
written there rather than left to be guessed.

## Paths are part of the contract

Because the guards cite documents, a moved or deleted document turns every citation into a dead
end that nothing else would notice — the code compiles, the tests pass, the reader is sent
nowhere. [tests/coverage/references.test.ts](../../tests/coverage/references.test.ts) fails on any
cited path that no longer resolves, including the `@` imports in
[CLAUDE.md](../../CLAUDE.md) that load these rule files.

## What does not go in a document

State that a query can answer. Row counts, whether a container is running, what is in the
database — read it, do not write it down. A document that records live state is wrong by the time
someone reads it, and this project's whole argument is that a confident wrong answer is worse than
an honest gap ([docs/VISION.md](../../docs/VISION.md)).
