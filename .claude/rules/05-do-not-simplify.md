# 05 — Do not simplify these

Each of these looks like an oversight and is not. Several were "cleaned up" once and had to be
put back. If one seems wrong, the reason is written here — argue with the reason, not with the
code.

## Detection

- **The rules judge the event, not the commits** (`classifyPush`, 0009 §2). A merge is two
  parents, never a `^Merge` title — squash and rebase merges have none, and anyone can type one;
  `isMergeCommit` is gone so that no second definition can come back. `web-flow` as committer says
  GitHub made the commit, not which button: the pencil carries it too, so a pull request's landing
  is GitHub's own answer, asked of the head (`readPull`). Off the default branch that answer lists
  only open pull requests, and a squash onto a release line read as the pencil — a direct push
  charged to whoever merged — so the branch's closed pull requests are asked as well, and a full
  page without the landing is `unknown`, not "no pull request".
- **An event that cannot be told weighs nothing.** Without the App, GitHub's own commit is a
  landing or the pencil and nobody can say which: `unknown` — no direct push, no size rule — and
  the communiqué says it could not tell rather than letting the model guess.
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
- **Checks judge what the push changed on its own branch, never the stored snapshot.**
  `readChanges` lists the push's two trees (`pushSpan`, `pushChanges`) — four requests when the
  snapshot is already in the database, which looks like waste. It is not: the snapshot follows
  one branch and moves with whatever landed there, and judging its movements charged pushes with
  other branches' work (measured in `apps/api/src/scenarios/checks.test.ts`). The snapshot is the
  project's state and never evidence. And a crossing's **author** is charged for new work only
  (`weight.work`): a file carried by commits already on record was judged when they arrived.
- **Every finding carries who answers for it** (`ViolationHit.login`, `RULE_ANSWERER`), and
  nothing after `judgePush` picks a person. Whoever pushed answers for what the push did; the
  author answers for what a commit holds — its message, its hour, a crossing, a merge's residue.
  One `login` for the whole push looks simpler and is how a maintainer was charged with the
  commits of whoever they pushed for (`apps/api/src/scenarios/attribution.test.ts`).
- **Landing is a share, not a transfer** (`landed_unfixed`). Whoever lands a crossing someone
  else wrote on a main line — the default branch, or one a watcher guards — and leaves it
  standing answers for landing it, beside its author, never instead of them: the author for
  writing it (once, when first seen), the lander for merging it unfixed. It is its own charge
  because "made this file too long" would be false of the merger. Two limits hold it: it reads
  the measurements only — a message or an hour is how the author worked, not what the merge left
  in the code — and it fires on a main line only, so pulling main into a feature charges nobody
  for what main already held.
- **"New" has two answers, and each rule reads its own.** The size rules count what the push
  *brought* — GitHub's `distinct` and not on record — so landing a branch pushed elsewhere first
  is not a heap dumped at once. Everything else reads what the record has *not judged yet*, so a
  commit is judged once, when it first arrives, on whatever branch. Collapsing them either
  charges whoever merged for the branch, or never judges work first seen at its landing.
- **A finding the evidence names nobody for is charged to nobody** (`unattributed`): an author
  address tied to no account, a file two people changed in one push, the pusher of a recovered
  push. Falling back to whoever pushed is a guess, and it lands on the person nearest the button.
- **Every rule declares where it applies** (`RULE_SCOPE`, 0009 §3). The rules about how work
  lands — direct push, force push, deletion, landing unfixed — hold on a main line only: the
  default branch, or one a watcher marks guarded or critical (`isTrunk`). Pushing straight to a
  personal branch is how a pull request is opened, and rebasing it is how it is kept current;
  judging those as trunk offences charged every ordinary day's work. Everything else, the size
  rules included (the developer's call), holds on every branch. A release line is a main line
  only when a watcher says so — the platform does not guess which branches matter.
- **A charge keeps its branch and whether that was a main line** (`ledger_events.branch`,
  `main_line`), and weighs double there in the dossier (`MAIN_LINE_WEIGHT`). The role is stored,
  not recomputed: the default branch is not kept anywhere else, and a watcher added later must not
  reweigh what was charged before it. A row without one keeps the weight it always had.
- **A recovered push names no pusher** (`recovered`). Git records who wrote and who committed a
  commit, never who pushed it; grouping by author invented a push per author and charged them
  with pushes someone else made.
- **A landing merge is judged against its own parents** (`landing.ts`), which costs a compare
  call and two more listings and looks redundant beside the push's own two trees. Between the
  push's ends alone, a branch adding 20 lines while main added 40 — each under the limit, joined
  over it — charged the branch's author with a crossing nobody made. So the branch is judged from
  its fork, the merge against what git makes of its parents unaided (where one side left the file
  alone, the other side's version; anything else is the merger's own work), and the crossing that
  remains is landed. A landing that cannot be read judges nothing: falling back to the two ends is
  the false charge again.
- **A moved file keeps the blob it had at its old path** (`pushChanges`). Read as created at the
  new path, a file moved while already over its limit is a crossing charged to whoever moved it.
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
