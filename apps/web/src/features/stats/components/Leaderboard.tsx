import type { MemberStat } from "@commander/shared";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { EmptyState } from "@/shared/components/EmptyState";
import { MemberStatCard } from "./MemberStatCard";

/** The standings as a roster of service records — replaces the old data table. */
export function Leaderboard({ rows }: { rows: MemberStat[] }) {
  const t = useTranslate();

  if (rows.length === 0) return <EmptyState message={t("state.empty")} />;

  return (
    <div className="roster">
      {rows.map((row) => (
        <MemberStatCard key={row.login} member={row} />
      ))}
    </div>
  );
}
