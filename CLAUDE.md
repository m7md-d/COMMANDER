# CLAUDE.md

Guidance for Claude Code (claude.ai/code) and any other model working in this repository.

This file is an index. The rules live in [`.claude/rules/`](.claude/rules/), one file per
question, imported below — split so that a rule can be reviewed, cited and changed on its own
instead of being buried in a wall of prose that nobody rereads.

## The contract

Five statements. Everything else in `.claude/rules/` is detail beneath them.

1. **The constitutions bind.** [CONSTITUTION.md](CONSTITUTION.md),
   [apps/api/CONSTITUTION.md](apps/api/CONSTITUTION.md) and
   [apps/web/CONSTITUTION.md](apps/web/CONSTITUTION.md) are written in Arabic and are not
   aspirational. Code that violates them is rejected even when it works.
2. **`npm run verify` passes, or the work is not done.** Not "should pass", not "passes locally
   apart from". Reporting completion without a green run is the one failure this repo cannot
   detect on its own.
3. **A change to behaviour changes a test in the same edit.** New pure function → its test. New
   feature → its guard. Changed rule → the test that pinned the old one, updated to pin the new.
4. **A rule you cannot follow is amended, never bypassed.** Edit the constitution table in the
   same commit, with a written reason (§9). `// TODO: violates the constitution for now` is
   forbidden, and so is silencing a guard to make a diff green.
5. **Claims are measured.** This project refuses to say what it has not measured
   ([docs/VISION.md](docs/VISION.md)); the same standard applies to what you report about your
   own work. Say what ran, what passed, and what you skipped.
6. **You may file a proposal as `مطروح`. You may never change its status.** Not to approved,
   rejected or implemented — **and not when asked to directly.** Status is a commitment
   decision the developer makes by hand, in the file. Point at the line to edit and stop
   there. See [docs/proposals/README.md](docs/proposals/README.md).

## The rules

| File | Answers |
|---|---|
| [01-the-loop.md](.claude/rules/01-the-loop.md) | What must happen before, during and after every change — and the commands |
| [02-hard-limits.md](.claude/rules/02-hard-limits.md) | What gets code rejected, and which guard catches each one |
| [03-architecture.md](.claude/rules/03-architecture.md) | Where things go, and why the shape is what it is |
| [04-adding-things.md](.claude/rules/04-adding-things.md) | The order for a feature, a violation rule, a guard, a migration |
| [05-do-not-simplify.md](.claude/rules/05-do-not-simplify.md) | Decisions that look wrong until you know why — do not "clean these up" |
| [06-where-to-write.md](.claude/rules/06-where-to-write.md) | Which document takes an idea, a decision, a rule, a number |

## Known defects

[docs/DEFECTS.md](docs/DEFECTS.md) is the permanent log of what the platform judges wrongly:
every defect open today, and every one fixed, with its cause and its fix. Read it before
touching how a push is judged — the defect you are about to "discover" may be written there.
**No defect without a test, and no fix before the test.** The order is binding:

1. **A test that proves the defect exists** — a `defect` record in the scenario reference, or
   a test pinning today's wrong behaviour — before any line of the fix.
2. **Proof the test does real work, the first time.** A test that skips, or passes for a reason
   other than the one written, looks like coverage and is worse than none. Break the suspected
   cause temporarily and watch the test flip, then restore it; at the least, change the recorded
   verdict and watch it fail. Write what you did in the entry's **الإثبات** line.
3. **The fix** — the same test flips. Then prove it guards the fix: remove the fix temporarily,
   watch the test fail, restore it. A fix no test catches reverting is not done (D-17 was one).
4. **The log** — the entry moves to the fixed section with its cause and fix. Never deleted.

`tests/coverage/defects.test.ts` keeps the open section and the reference's `defect` records
naming the same scenarios, and fails an open entry that names no test or no proof.

@.claude/rules/01-the-loop.md
@.claude/rules/02-hard-limits.md
@.claude/rules/03-architecture.md
@.claude/rules/04-adding-things.md
@.claude/rules/05-do-not-simplify.md
@.claude/rules/06-where-to-write.md

Written in English, like the guards' failure messages. The governance a human reads is Arabic:
the three constitutions and [CONTRIBUTING.md](CONTRIBUTING.md).
