import type { MemberInput } from "@commander/shared";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { Button } from "@/shared/components/Button";
import { EmptyState } from "@/shared/components/EmptyState";
import { PanelSection } from "@/shared/components/PanelSection";
import { MemberRecord } from "@/features/repositories/components/MemberRecord";
import type { FrontDraft } from "@/features/repositories/useFrontDraft";

const BLANK: MemberInput = { login: "", displayName: "", avatarUrl: "", rank: "", note: "" };

interface RosterPanelProps {
  draft: FrontDraft;
}

/**
 * The front's people. Enlistment is by hand here and in bulk from the project
 * scan — the empty state points at the scan rather than at the add button,
 * because typing a roster a repository already knows is the slow way round.
 */
export function RosterPanel({ draft }: RosterPanelProps) {
  const t = useTranslate();
  const { value, patch } = draft;
  const members = value.members;

  const replace = (next: MemberInput[]) => patch("members", next);

  return (
    <PanelSection label={t("nav.members")} hint={t("member.subtitle")}>
      {members.length === 0 ? (
        <EmptyState message={t("member.empty")} />
      ) : (
        <div className="stack">
          {members.map((member, index) => (
            <MemberRecord
              // No stable id: an unsaved row has none, and the login is the
              // field being typed. Position is the identity while editing.
              key={`member-${index}`}
              member={member}
              onChange={(key, next) =>
                replace(
                  members.map((entry, position) =>
                    position === index ? { ...entry, [key]: next } : entry,
                  ),
                )
              }
              onRemove={() => replace(members.filter((_, position) => position !== index))}
            />
          ))}
        </div>
      )}

      <div className="row row-wrap">
        <Button onClick={() => replace([...members, BLANK])}>+ {t("member.add")}</Button>
      </div>
    </PanelSection>
  );
}
