/**
 * The sanctioned JSON boundary (CONSTITUTION.md §2).
 *
 * Prisma's Json columns are typed as JsonValue, which cannot describe our
 * domain shapes. Rather than scattering `as unknown as` at every call site —
 * which the constitution forbids precisely because such casts become invisible —
 * every crossing goes through these two named functions. They are greppable,
 * documented, and the only place the narrowing happens.
 *
 * `fromJson` is unchecked by design: the writer and reader are the same
 * process and the same version. Where a stored document may predate the
 * current shape (rules, settings) the caller ALSO runs it through zod or a
 * merge-with-defaults — see engine.mergeWithDefaults and settings.reconcile.
 */

import type { Prisma } from "@prisma/client";

/** Domain object → Prisma Json column. */
export function toJson<T>(value: T): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

/** Prisma Json column → domain object. Validate afterwards if the shape can drift. */
export function fromJson<T>(value: Prisma.JsonValue): T {
  return value as unknown as T;
}
