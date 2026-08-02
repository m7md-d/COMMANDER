import { GRAVITY_LEVELS, RULE_IDS, type Gravity, type RuleConfigMap, type Watcher } from "@commander/shared";

/**
 * Pure readings taken off a front for its letterhead and its slot on the board.
 * No React and no network — the same rule the API's `domain/` layer follows.
 */

/**
 * The heaviest standing any branch of this front carries.
 *
 * The letterhead reports the maximum rather than a count, because what an
 * operator needs at a glance is whether this front touches a critical branch at
 * all — five routine watchers and one critical watcher is a critical front.
 */
export function highestGravity(watchers: Watcher[]): Gravity {
  return watchers.reduce<Gravity>(
    (worst, watcher) =>
      GRAVITY_LEVELS.indexOf(watcher.gravity) > GRAVITY_LEVELS.indexOf(worst)
        ? watcher.gravity
        : worst,
    GRAVITY_LEVELS[0],
  );
}

/** How many rules of engagement are actually in force. */
export function activeRuleCount(rules: RuleConfigMap): number {
  return RULE_IDS.filter((ruleId) => rules[ruleId].enabled).length;
}

export const TOTAL_RULES = RULE_IDS.length;
