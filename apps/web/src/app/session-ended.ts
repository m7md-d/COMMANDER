/**
 * Whether an error means the session ended under the panel (docs/UI-DEFECTS.md
 * W-22): a 401 while it believed it was signed in. A visitor on the public
 * headquarters gets 401s by design — nothing ended there.
 */
export function sessionEnded(input: { status: number | undefined; signedIn: boolean }): boolean {
  return input.signedIn && input.status === 401;
}
