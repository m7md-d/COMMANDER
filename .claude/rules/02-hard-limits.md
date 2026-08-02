# 02 — What gets code rejected

Every row is automated. The point of naming the guard is that you can find out you broke a rule
without asking anybody — and that a rule with no guard beside it is visibly unenforced.

## Limits (CONSTITUTION.md §4)

| Limit | Value | Guard |
|---|---|---|
| File length | 200 lines | `tests/constitution/size.test.ts` |
| React component | 150 lines | `tests/constitution/size.test.ts` |
| Function length | 40 lines | eslint `max-lines-per-function` |
| Nesting depth | 3 | eslint `max-depth` |
| Parameters | 3 — pass a named object | eslint `max-params` |
| `useEffect` per file | 1 | `tests/constitution/size.test.ts` |

Split by responsibility. **Do not raise a limit** to fit code through it; the limit is the
signal that the file is doing two jobs. The one recorded exception is `errorHandler`, which
keeps four parameters because Express identifies an error handler by `fn.length === 4` and by
nothing else — dropping `_next` does not shorten the function, it unregisters it as an error
handler. It carries an inline disable with that reason.

## Types

- **No `any`, anywhere.** `unknown` plus a zod parse is the replacement. Guard:
  `tests/constitution/purity.test.ts`.
- **No `as unknown as` outside [apps/api/src/core/json.ts](../../apps/api/src/core/json.ts).**
  Prisma's `Json` columns do not describe our shapes, so the narrowing lives in two named,
  greppable functions (`toJson` / `fromJson`) instead of being scattered until it stops being
  visible.

## Text

**No user-facing string in code. None.** Every label, API error and violation name is a key in
[packages/shared/src/i18n/](../../packages/shared/src/i18n/). `ar.ts` is the reference
dictionary and its key set *is* the `TranslationKey` type, so a key missing from `en.ts` is a
compile error rather than a runtime surprise. API errors return `{ ok: false, error:
"repos.duplicate" }`, never a sentence.

The only exception is `logger.*` output, which is for the operator, not the user.

Guards: `tests/constitution/purity.test.ts` (Arabic literals in code), `tests/coverage/i18n.test.ts`
(parity, dead keys, and keys the code asks for that do not exist — that one caught a live defect
where zod emitted `repo.branchEmpty` against a dictionary defining `repos.branchEmpty`).

## Styling

- **No colour, font or raw px outside
  [apps/web/src/styles/tokens.css](../../apps/web/src/styles/tokens.css).** Components consume
  `var(--color-*)` semantics. Reaching for a `--palette-*` primitive breaks light mode — that is
  the entire reason the two layers exist.
- **No `[dir="rtl"]` rules.** Logical properties only: `margin-inline-start`, `inset-block-end`,
  `text-align: start`. One stylesheet serves both directions. The single exception is the
  `--flip` variable for the toggle thumb.

Guard: `tests/constitution/identity.test.ts`.

## Layering

- **A controller calls exactly one service.** No Prisma query, no validation, no `try/catch`.
  `asyncHandler` and `errorHandler` own the error path.
- **`domain/` is pure.** No Express, no Prisma, no logger. When the rule engine needs to report
  a rule that threw, it takes an injected `onRuleError` callback rather than importing a logger —
  see `evaluateRules`.
- **No `../../../`.** Aliases: `@/` for the app, `@shared/` for the package.
- **No barrel file inside `modules/`.** It creates dependency cycles and hides real dependencies.
  Allowed in `packages/shared` only.

Guard: `tests/constitution/layering.test.ts`.

## Errors

- **Never swallow one.** An empty `catch {}` is rejected; handle it or log and rethrow.
- **External integrations do not throw.** The OpenRouter and Discord clients return an explicit
  `Result`, because their failure is expected rather than exceptional.
- **Every error response has the same shape**: `{ ok: false, error: <i18nKey>, details?: [] }`.

## Security — not negotiable

| Rule | Why |
|---|---|
| GitHub's signature is verified on the **raw bytes**, before any parse | Re-serialising a parsed object produces different bytes; the signature could never match |
| Every secret comparison uses `timingSafeEqual` | `===` returns at the first differing byte and leaks timing |
| No secret in any API response | "present" or "missing", never the value |
| Commit messages are hostile input | Truncated, stripped of tag-breaking characters, wrapped in `<untrusted_data>` |
| Session cookie is `HttpOnly` + `SameSite=Strict` + `Secure` outside development | Blocks XSS from stealing it and CSRF from using it |
| Env vars are validated with zod at boot | Failing at start beats failing obscurely a week later |
