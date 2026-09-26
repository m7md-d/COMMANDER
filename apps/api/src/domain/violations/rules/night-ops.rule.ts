import type { TimeWindowRuleConfig } from "@commander/shared";
import type { RuleEvaluator } from "../types.js";
import { hourInWindow, localHour } from "../time.js";

export const nightOpsRule: RuleEvaluator<TimeWindowRuleConfig> = ({ commits, timezoneOffset }, config) => {
  for (const commit of commits) {
    const hour = localHour(commit.timestamp, timezoneOffset);
    if (hour === null) continue;
    if (hourInWindow(hour, config.startHour, config.endHour)) return { hour };
  }

  return null;
};
