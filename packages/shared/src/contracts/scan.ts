/**
 * Why a reconnaissance pass could not run.
 *
 * The pass used to return `available: false` and nothing else, so the panel said
 * "unavailable" and the operator had four candidate causes and no way to choose
 * between them — the App unconfigured, the installation id missing, the key in
 * the wrong format, the App not installed on that particular repository. Every
 * one of those is a different fix, and the platform knew which it was.
 *
 * That is the same failure this project refuses everywhere else: not saying what
 * it has measured. An honest gap must still be a *specific* gap.
 */

export const SCAN_BLOCKERS = [
  /** GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY is empty in the environment. */
  "appNotConfigured",
  /** The App is set up, but this front carries no installation id. Per front. */
  "noInstallationId",
  /** GitHub refused the signed JWT: wrong key, or a PEM body without its headers. */
  "keyRejected",
  /** No such installation for this App — a wrong installation id, or an App id
   *  that is really an installation id. */
  "installationNotFound",
  /** The token is valid and the repository is not in what it may read: the App
   *  is installed on the account but not on this repository. */
  "repoNotInInstallation",
  /** GitHub could not be reached at all — network, DNS, timeout. */
  "githubUnreachable",
  /** Any other refusal, carried with its status so the log and the panel agree. */
  "githubRefused",
] as const;

export type ScanBlocker = (typeof SCAN_BLOCKERS)[number];

/** The i18n key a blocker is displayed through. */
export const scanBlockerKey = (blocker: ScanBlocker): string => `scan.blocked.${blocker}`;

/** What one reconnaissance pass found, or why it could not look. */
export interface ScanResult {
  /** False when a blocker stopped the pass before it reached GitHub's data. */
  available: boolean;
  /** Null exactly when `available` is true. */
  blocker: ScanBlocker | null;
  membersImported: number;
  filesSeen: number;
  areas: number;
  truncated: boolean;
}
