import { z } from "zod";
import type { ViolationId } from "../domain/violations.js";
import type { ToleranceTier } from "../domain/dossier.js";
import type { Achievement } from "../domain/achievements.js";
import type { ReviewVerdict } from "../domain/review.js";

export interface DossierEvent {
  ruleId: ViolationId;
  occurredAt: string;
  /** Severity × decay × anomaly discount, as computed by scoreDossier. */
  weight: number;
  /** Part of a cluster that never recurred — history, not a live pattern. */
  anomaly: boolean;
}

export interface DossierFile {
  path: string;
  linesAdded: number;
  linesRemoved: number;
  commitCount: number;
  lastTouchedAt: string;
}

export interface DossierNote {
  id: string;
  body: string;
  kind: "manual" | "auto";
  createdAt: string;
  /** Null means permanent; a date means the note lapses on its own. */
  expiresAt: string | null;
}

/** One reviewed commit: the LLM's verdict on the diff plus its remark. */
export interface DossierReview {
  sha: string;
  title: string;
  committedAt: string;
  verdict: ReviewVerdict;
  remark: string;
  findings: string[];
}

export interface MemberDossier {
  login: string;
  displayName: string;
  rank: string;

  tier: ToleranceTier;
  riskScore: number;
  cleanStreakDays: number;
  anomalyCount: number;
  scoreByRule: Partial<Record<ViolationId, number>>;

  totalCommits: number;
  totalPushes: number;
  totalViolations: number;
  /** Lifetime credits. Undecayed like the violation count, and never netted
   *  against it: the two are separate facts about the same person. */
  totalCommendations: number;

  events: DossierEvent[];
  files: DossierFile[];
  notes: DossierNote[];
  /** Decay-free medals and marks earned from the record (see computeAchievements). */
  achievements: Achievement[];
  /** Most recent per-commit code reviews, newest first. Empty without the App. */
  reviews: DossierReview[];

  narrative: string | null;
  narrativeUpdatedAt: string | null;
  /** True when the GitHub App has supplied line-level data for this repo. */
  enriched: boolean;
  computedAt: string;
}

export interface DossierSummary {
  login: string;
  displayName: string;
  tier: ToleranceTier;
  riskScore: number;
  cleanStreakDays: number;
  totalViolations: number;
  totalCommendations: number;
}

export const noteInputSchema = z.object({
  body: z.string().trim().min(1, "dossier.noteRequired").max(500),
  /** Days until the note lapses. Omit for a permanent mark. */
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

export type NoteInput = z.infer<typeof noteInputSchema>;

export const dossierRefreshSchema = z.object({
  /** Rewrite the narrative even when the facts fingerprint has not moved. */
  force: z.boolean().default(false),
});

export type DossierRefresh = z.infer<typeof dossierRefreshSchema>;
