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
6. **You may file a proposal as `مطروح`. You may never change its status.** Not to accepted,
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

@.claude/rules/01-the-loop.md
@.claude/rules/02-hard-limits.md
@.claude/rules/03-architecture.md
@.claude/rules/04-adding-things.md
@.claude/rules/05-do-not-simplify.md
@.claude/rules/06-where-to-write.md

Written in English, like the guards' failure messages. The governance a human reads is Arabic:
the three constitutions and [CONTRIBUTING.md](CONTRIBUTING.md).
