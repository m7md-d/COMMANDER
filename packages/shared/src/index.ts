/**
 * Public surface of @commander/shared.
 *
 * A barrel is permitted here and only here (CONSTITUTION.md §5.1): this package
 * is a leaf with no internal cycles, and both apps consume it as one unit.
 */

export * from "./domain/check-scope.js";
export * from "./domain/measure.js";
export * from "./domain/markers.js";
export * from "./domain/checks.js";
export * from "./domain/violations.js";
export * from "./domain/ledger.js";
export * from "./domain/delivery.js";
export * from "./domain/push.js";
export * from "./domain/occasion.js";
export * from "./domain/digest.js";
export * from "./domain/schedule.js";
export * from "./domain/prompt.js";
export * from "./domain/dossier.js";
export * from "./domain/achievements.js";
export * from "./domain/review.js";
export * from "./domain/project.js";
export * from "./domain/report-tone.js";
export * from "./domain/watcher.js";
export * from "./domain/structure.js";
export * from "./domain/tree.js";

export * from "./contracts/common.js";
export * from "./contracts/auth.js";
export * from "./contracts/repository.js";
export * from "./contracts/prompt.js";
export * from "./contracts/settings.js";
export * from "./contracts/model.js";
export * from "./contracts/delivery.js";
export * from "./contracts/dossier.js";
export * from "./contracts/check.js";
export * from "./contracts/tree.js";
export * from "./contracts/scan.js";

export * from "./i18n/index.js";
