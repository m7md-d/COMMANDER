# 05 — Do not simplify these

Each of these looks like an oversight and is not. Several were "cleaned up" once and had to be
put back. If one seems wrong, the reason is written here — argue with the reason, not with the
code.

## Detection

- **`direct_push` keys on `committer.username === "web-flow"`**, not a `^Merge` message prefix.
  Squash and rebase merges produce ordinary commits; matching the message flags nearly every push
  and the reports become noise nobody reads.
- **`lazy_message` strips Conventional Commit prefixes** before the length check, so `fix: x` is
  judged on `x`.
- **`function_lines` and `nesting_depth` are measured with TypeScript's own parser**
  (`domain/checks/syntax.ts`), not by counting braces: an AST knows that a JSX expression
  container and an object literal are not nesting levels. A file that does not parse is not
  measured. `brace_depth` remains the fallback for languages the parser does not read.

## Judgement

- **Checks violate on the CROSSING, never on the state** (`judgeCheck`). 190 → 210 lines is a
  violation; inheriting a file at 400 and leaving it at 405 is not; 400 → 350 is praise. Without
  this the first mid-life repository drowns its team in charges for last year's code — the
  `direct_push` lesson again. **A file whose *before* was never measured is never charged:**
  accusation on a guess is the one output this subsystem must not produce.
- **The record is `ledger_events`, not `violation_events`, and every query names its `kind`.** A
  record that can only hold accusations produces a system that can only accuse, so `improved` is
  written as a `commendation` beside the charge — never netted against it, never in place of it.
  `kind` is an ordinary optional Prisma filter, so omitting it compiles and silently returns both
  halves; a guard in `tests/constitution/layering.test.ts` fails any `prisma.ledgerEvent.*` that
  does not mention it. Which kind a row gets is chosen by *calling* `recordViolations` or
  `recordCommendations` — a kind you pass is a kind you can forget, and the forgotten one defaults
  to `violation`.
- **A check finding on a file that did not exist carries no `before`.** `violationLabel` picks
  `rule.<id>.reportNew` from the absence; interpolating a zero would claim a measurement nobody
  took. The choice is gated on `isCheckMetric`, because an engagement rule has no `before` either
  and would otherwise reach a key that does not exist.
- **`lines: null` means "not measured"**, never zero. Line counting arrives with the first check;
  until then the panel says so. Substituting a zero turns an honest gap into a confident wrong
  answer.

## Reports

- **The weekly digest's assessment may only cite measured evidence.**
  `assessment.pipeline.ts` enumerates every fact a suggestion is allowed to rest on — worst files
  with their limits and baselines, notes with their ages, repeated review findings, the repo's own
  rules — and the prompt's binding rule is that a suggestion quotes one verbatim or is not
  written, even if that leaves the section empty. Suggestions that could apply to any repository
  are the failure mode, and they come from missing evidence, not from insufficiently polite
  prompting. `renderAssessment` returns `""` when there is nothing, dropping the instruction
  rather than asking for an assessment of nothing.
- **The structure digest is derived from the stored tree rows**, not from a second GitHub call.
  Two readings of one repository that can disagree are worse than one reading.
- **TODO ages live in `todo_markers`, not on the blob.** `blob_metrics.markers` describes a piece
  of *content* and is keyed by its hash; editing the line above a note changes that hash without
  changing the note, so age cannot live there. A marker's identity is its path plus its normalised
  text, deliberately not its line number. `first_seen_at` means "since we started watching", never
  "since it was written", and the report says which.

## Scheduling

- **A manual digest reads the window; only a scheduled one closes it.** Both go through
  `queueDigest`, and `DigestOccasion.trigger` is the whole difference: `manual` touches neither
  `last_run_at` nor `last_state`, so the weekly report still goes out on time covering the same
  period, and still measures its change against last week rather than against whenever somebody
  pressed the button. It also ignores `silentWhenClean` — somebody asked and is waiting for an
  answer. A payload with no `trigger` is read as `schedule`, which is what those rows were.
- **The digest fires at a named slot, not one period after the last send.**
  `repositories.schedules` holds a weekday and an hour in the operator's timezone; `last_run_at`
  records *which slot has been served*, which is what stops the hour drifting later every time a
  tick runs late. Several missed slots collapse into one report rather than a burst, and a
  disabled schedule neither sends nor advances — so re-enabling covers the gap instead of
  swallowing it. The panel computes its "next slot" with the same `lastScheduledAt` the worker
  uses, so it cannot promise an hour the worker disagrees with.
- **The outbox payload is an `Occasion`**, not a push: `push | weekly_digest`. `readOccasion`
  still accepts a bare push, because rows written before occasions existed are in the queue at
  deploy time. Scheduling reads `report_schedules.last_run_at` — never a `setInterval` — so a
  restart can neither skip a week nor send it twice.

## Types and endpoints

- **Rule configs in `packages/shared/src/domain/violations.ts` are `type` aliases, not
  interfaces.** Only aliases get an implicit index signature, which lets the panel read optional
  fields generically without a cast.
- **`mergeWithDefaults` in `engine.ts` lists every rule key by hand** rather than looping. A loop
  forces a cast; the explicit list makes adding a `RuleId` a compile error exactly where the
  reminder is useful.
- **`/api/deliveries/test` and `/api/deliveries/digest` take only a repository id.** Accepting
  config from the body would let a session holder make the server POST anywhere — and, for the
  digest, choose the window it summarises.
- **Settings and rules are JSON columns** validated by zod on read, because their shapes vary and
  adding a knob should not need a migration.
- **API test files are type-checked through `apps/api/tsconfig.test.json`.** `tsconfig.json` must
  keep excluding them, so the build does not emit test code into the shipped image.
