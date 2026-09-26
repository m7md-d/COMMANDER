import type { WeekdayRuleConfig } from "@commander/shared";
import type { RuleEvaluator } from "../types.js";
import { localWeekday } from "../time.js";

export const weekendOpsRule: RuleEvaluator<WeekdayRuleConfig> = ({ commits, timezoneOffset }, config) => {
  for (const commit of commits) {
    const day = localWeekday(commit.timestamp, timezoneOffset);
    if (day !== null && config.days.includes(day)) return { day };
  }

  return null;
};
