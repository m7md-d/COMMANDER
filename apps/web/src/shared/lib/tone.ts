/**
 * A tone shift, said in words rather than as a signed integer.
 *
 * Lives in shared/ because two features read it — a front's calibration ladder
 * and the manual's shift table — and apps/web/CONSTITUTION.md §1 says what two
 * features share moves up rather than being imported across.
 *
 * The number is the mechanism; the consequence is what an operator needs, and
 * "one step softer" needs no legend where "-1" does. Callers pass the value from
 * the exported STAGE_SHIFT/GRAVITY_SHIFT tables, never a restated copy.
 */
export function shiftKey(shift: number): string {
  if (shift < 0) return "tone.shiftDown";
  if (shift === 0) return "tone.shiftNone";
  return shift === 1 ? "tone.shiftUp" : "tone.shiftUp2";
}
