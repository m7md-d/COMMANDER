/**
 * What a member's record can hold.
 *
 * The record was called `violation_events` and held one kind of entry, which
 * decided more than a name: a system whose only durable memory is a list of
 * accusations can only ever accuse. `judgeCheck` has always returned `improved`
 * — someone bringing a file back under its limit — and that verdict had nowhere
 * to be written, so it was computed and discarded on every push.
 *
 * Both kinds cite the same `ViolationId` and carry the same `RuleDetail`,
 * because crossing a limit and coming back under it are one measurement read
 * twice. Only the direction differs, and `kind` is where the direction lives.
 */

import type { RuleDetail, ViolationId } from "./violations.js";

export const LEDGER_KINDS = ["violation", "commendation"] as const;

export type LedgerKind = (typeof LEDGER_KINDS)[number];

/**
 * Earned, not awarded: every commendation names the metric it was measured on
 * and the numbers that prove it, exactly as a violation does. Praise that cannot
 * be re-derived is flattery, and flattery in a record is worse than silence —
 * it devalues the entries that were measured.
 *
 * Structurally identical to `ViolationHit` on purpose, and never merged with it:
 * which kind a row gets is decided by *which writer you call*, not by a field
 * that can be left at its default. See dossier.ledger.ts.
 */
export interface Commendation {
  ruleId: ViolationId;
  detail: RuleDetail;
}
