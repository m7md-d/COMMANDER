import { DEFAULT_SCHEDULE, lastScheduledAt, type ScheduleConfig } from "@commander/shared";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { Field } from "@/shared/components/Field";
import { Select } from "@/shared/components/Select";
import { Toggle } from "@/shared/components/Toggle";
import { formatDateTime } from "@/shared/lib/format";

interface ScheduleFieldsProps {
  value: ScheduleConfig;
  onChange: (next: ScheduleConfig) => void;
  /** The hours the operator's day is shifted by, from headquarters. The slot is
   *  meaningless without it, so it is shown rather than assumed. */
  timezoneOffset: number;
}

const DAYS = [0, 1, 2, 3, 4, 5, 6];
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

/**
 * When this front's weekly harvest goes out.
 *
 * The next slot is computed and shown as a date, not described. "Monday at 09:00"
 * is a rule; the thing an operator actually wants to know is whether that means
 * tomorrow or in six days, and only a date answers it.
 */
export function ScheduleFields({ value, onChange, timezoneOffset }: ScheduleFieldsProps) {
  const t = useTranslate();
  const set = (patch: Partial<ScheduleConfig>) => onChange({ ...value, ...patch });

  // The slot after the most recent one — the same arithmetic the scheduler runs,
  // imported rather than re-implemented, so the panel cannot promise an hour the
  // worker disagrees with.
  const previous = lastScheduledAt(new Date(), value, timezoneOffset);
  const next = new Date(previous.getTime() + 7 * 24 * 3_600_000);

  return (
    <>
      <Toggle
        label={t("schedule.enabled")}
        checked={value.enabled}
        onChange={(enabled) => set({ enabled })}
      />

      <div className="grid grid-2">
        <Field label={t("schedule.day")}>
          {(id) => (
            <Select
              id={id}
              disabled={!value.enabled}
              value={String(value.dayOfWeek)}
              onValueChange={(day) => set({ dayOfWeek: Number(day) })}
              options={DAYS.map((day) => ({
                value: String(day),
                label: t(`day.${day}`),
              }))}
            />
          )}
        </Field>

        <Field label={t("schedule.hour")}>
          {(id) => (
            <Select
              id={id}
              disabled={!value.enabled}
              value={String(value.hour)}
              onValueChange={(hour) => set({ hour: Number(hour) })}
              options={HOURS.map((hour) => ({
                value: String(hour),
                label: `${String(hour).padStart(2, "0")}:00`,
              }))}
            />
          )}
        </Field>
      </div>

      <p className="hint">
        {value.enabled
          ? `${t("schedule.next")}: ${formatDateTime(next.toISOString(), "—")}`
          : t("schedule.offHint")}
      </p>
    </>
  );
}

/** The stored config, or the shipped one. Kept beside the editor so the panel and
 *  the API agree on what an absent setting means. */
export function scheduleOf(schedules: { weekly_digest?: ScheduleConfig } | undefined) {
  return schedules?.weekly_digest ?? DEFAULT_SCHEDULE;
}
