# 03 — Architecture, and why

Two paths, deliberately separate: `webhook → persist → 202`, and `worker → claim → process →
deliver`. Nothing in the first waits on the second.

## The request path

1. **[apps/api/src/app.ts](../../apps/api/src/app.ts) mounts the webhook route *before*
   `express.json()`.** GitHub's HMAC covers the raw bytes; letting the global parser consume the
   stream first makes the signature unverifiable. This ordering is correctness, not style —
   moving it breaks authentication silently, in a way that still returns 200.
2. **[webhook.controller.ts](../../apps/api/src/modules/webhook/webhook.controller.ts)
   authenticates, writes a `deliveries` row, returns `202`. Nothing else.** GitHub abandons a
   delivery at roughly ten seconds, and one LLM call alone can exceed that.
3. **[queue/worker.ts](../../apps/api/src/queue/worker.ts) polls.**
   [outbox.service.ts](../../apps/api/src/queue/outbox.service.ts) claims rows with raw-SQL
   `FOR UPDATE SKIP LOCKED` so replicas take disjoint batches instead of racing.
   [delivery.processor.ts](../../apps/api/src/queue/delivery.processor.ts) **never throws** — a
   throw strands its row in `processing` forever. **It makes no decision either.** Which pushes
   are read and judged, what each is charged with, who answers for it, and whether it is
   sent are `admitPush` and `judgePush` in
   [domain/judgement/](../../apps/api/src/domain/judgement/): pure, and called as they are by
   the scenario reference. A gate added to the processor instead is one the reference cannot
   see. Every judged push is recorded, sent or not (0009 §5): the one order the processor keeps
   is `record` before the `withheld` return.
4. **Retry policy lives in `packages/shared/src/domain/delivery.ts`.** `NON_RETRYABLE_REASONS`
   exists because retrying a deleted webhook or an unregistered repo cannot change the outcome.
5. **[report.pipeline.ts](../../apps/api/src/queue/report.pipeline.ts) is shared** by the worker
   and the panel's preview, so what you preview is what gets sent. **Nothing in it may write** —
   a preview that changes stored state is not a preview.
6. **[modules/tree/](../../apps/api/src/modules/tree/) holds the stored file snapshot.** One
   recursive listing per push — a single request whatever the project's size — written
   differentially. Measurements live in `blob_metrics` keyed by **content hash, not path**, so a
   rename or a revert costs nothing. `tree_files.first_seen_at` is the anchor a check's baseline
   is drawn from, which is why a moved file is `update`d and never replaced. The snapshot is the
   project's *state* — the panel, the digest and the notes read it — and never the evidence a
   check charges on: that is the push's own two trees
   ([domain/judgement/changes.ts](../../apps/api/src/domain/judgement/changes.ts)), and for a
   push that lands a merge, the merge's parents and their fork as well
   ([domain/judgement/landing.ts](../../apps/api/src/domain/judgement/landing.ts)).
7. **[reconciler.ts](../../apps/api/src/queue/reconciler.ts) pulls what push missed.** Nothing
   guarantees the host was awake, and GitHub gives up after a few retries. It asks the GitHub App
   for commits newer than the last on record and replays each branch's gap through the same
   pipeline as one recovered push, which names no pusher: git records who wrote a commit, never
   who pushed it, so only what a commit holds is charged, to its author. The
   default branch is read by its history; any other watched branch only for what it has beyond
   the default, because its history also holds everything it inherited when it was cut — read by
   date, that came back as pushes nobody made. Which branches and how is `branchesToReconcile`,
   pure and called as it is by the scenario reference. Gated on the App: with no installation
   token it is a no-op, and it is `best-effort` by nature — it cannot see a branch deleted during
   downtime, nor history a force push overwrote, and a front that watches every branch is read on
   its default branch alone.

## The dependency rule

Dependencies point inward. The inner layer does not know the outer one exists.

```
transport    routes · controllers          ← Express, HTTP, req/res
application  services · use-cases          ← coordination, transactions
domain       rules · entities · maths      ← pure functions, zero I/O
             ↑ infrastructure (prisma, axios, fs) is injected inward, never imported from inside
```

A service receives data, never a `req` or a `res`. A controller unpacks the request, calls one
service, wraps the reply — nothing else.

## The frontend

`pages/` compose only. Data flows `features/<name>/hooks.ts` (TanStack Query) →
`features/<name>/api.ts` → the single axios instance in
[shared/api/client.ts](../../apps/web/src/shared/api/client.ts), which normalises every failure
into an `ApiError` carrying an i18n key.

Server state is not application state: cache, retry and invalidation live in TanStack Query, not
in a `useEffect` per page.

## The layout

```
packages/shared/     contracts (zod) · domain (rules, checks, ledger, schedule, markers) · i18n
apps/api/src/
  config/            env validated at boot, constants
  core/              errors · responses · logger · crypto · the JSON boundary
  domain/            judgement · violation rules · prompt builder · sanitizer   (pure, no I/O)
  integrations/      openrouter · discord · github                              (return Results)
  modules/           auth · repositories · prompts · settings · models · stats
                     deliveries · webhook · tree · checks · todos · digest · dossier
  queue/             outbox · worker · processor · reconciler · report + digest pipelines
apps/web/src/
  styles/            tokens · base · layout · components · forms · patterns · shell
  shared/            api client · design system · i18n · theme · toast
  features/          per-feature api + hooks + components
  pages/             composition only
docs/                vision · roadmap · proposals · deploy · design journals
tests/               repo-wide guards: constitution · coverage · budgets
```
