import { useRef, type KeyboardEvent } from "react";
import type { DossierSummary } from "@commander/shared";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { Badge } from "@/shared/components/Badge";
import { EmptyState } from "@/shared/components/EmptyState";
import { roundScore, tierTone } from "../tier";

interface DossierRosterProps {
  members: DossierSummary[];
  selected: string | null;
  onSelect: (login: string) => void;
}

/**
 * A single-select listbox (docs/UI-AUDIT.md §8). The open record is
 * `aria-selected`; exactly one option holds the tab stop, and Up/Down/Home/End
 * move between records — so a twenty-strong roster is one arrow away, not twenty
 * Tab presses. Selection follows focus, which is cheap: it only swaps the detail
 * shown alongside.
 */
export function DossierRoster({ members, selected, onSelect }: DossierRosterProps) {
  const t = useTranslate();
  const listRef = useRef<HTMLDivElement>(null);

  if (members.length === 0) return <EmptyState message={t("dossier.empty")} />;

  // The tab stop sits on the open record, or the first when none is open yet.
  const activeIndex = Math.max(
    0,
    members.findIndex((member) => member.login === selected),
  );

  const focusOption = (index: number) => {
    const wrapped = (index + members.length) % members.length;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${wrapped}"]`)?.focus();
    const target = members[wrapped];
    if (target) onSelect(target.login);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const steps: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };
    if (event.key in steps) {
      event.preventDefault();
      focusOption(activeIndex + (steps[event.key] ?? 0));
    } else if (event.key === "Home") {
      event.preventDefault();
      focusOption(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusOption(members.length - 1);
    }
  };

  return (
    <div
      ref={listRef}
      className="pick-list"
      role="listbox"
      aria-label={t("dossier.title")}
      onKeyDown={onKeyDown}
    >
      {members.map((member, index) => (
        <button
          key={member.login}
          type="button"
          data-index={index}
          role="option"
          aria-selected={member.login === selected}
          tabIndex={index === activeIndex ? 0 : -1}
          className="pick-item"
          onClick={() => onSelect(member.login)}
        >
          <span className="stack-sm">
            <strong>{member.displayName || member.login}</strong>
            <span className="hint ltr">{member.login}</span>
          </span>
          <span className="spacer" />
          <span className="meter-value">{roundScore(member.riskScore)}</span>
          <Badge tone={tierTone(member.tier)}>{t(`tier.${member.tier}`)}</Badge>
        </button>
      ))}
    </div>
  );
}
