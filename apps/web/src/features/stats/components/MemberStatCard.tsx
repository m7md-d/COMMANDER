import type { MemberStat } from "@commander/shared";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { formatDateTime } from "@/shared/lib/format";

/**
 * One member's standing as a service record rather than a table row: rank as an
 * eyebrow, name and handle stacked, and a rubber-stamped verdict — a clean sheet
 * or a violation count. The left edge inks green or red so the state reads
 * before a word does. Cards reflow on narrow screens, so no sideways scroll
 * (docs/UI-AUDIT.md §9).
 */
export function MemberStatCard({ member }: { member: MemberStat }) {
  const t = useTranslate();
  const clean = member.violationTotal === 0;

  return (
    <article className={`roster-card ${clean ? "roster-clean" : "roster-flagged"}`}>
      <header className="roster-head">
        <div className="roster-id">
          {member.rank ? <span className="roster-rank">{member.rank}</span> : null}
          <span className="roster-name">{member.displayName || member.login}</span>
          <span className="roster-login ltr">@{member.login}</span>
        </div>
        <span className={`stamp ${clean ? "stamp-on" : "stamp-alert"}`}>
          {clean ? t("stats.cleanRecord") : `${member.violationTotal} ${t("stats.violations")}`}
        </span>
      </header>

      <dl className="roster-figures">
        <div>
          <dt>{t("stats.commits")}</dt>
          <dd>{member.totalCommits}</dd>
        </div>
        <div>
          <dt>{t("stats.pushes")}</dt>
          <dd>{member.totalPushes}</dd>
        </div>
        <div>
          <dt>{t("stats.lastSeen")}</dt>
          <dd className="roster-when">{formatDateTime(member.lastSeenAt, t("state.never"))}</dd>
        </div>
      </dl>
    </article>
  );
}
