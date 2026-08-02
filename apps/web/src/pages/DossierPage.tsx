import { useState } from "react";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { useRepositories } from "@/features/repositories/hooks";
import { useDossierList } from "@/features/dossier/hooks";
import { DossierDetail } from "@/features/dossier/components/DossierDetail";
import { DossierSkeleton } from "@/features/dossier/components/DossierSkeleton";
import { RosterSkeleton } from "@/features/dossier/components/RosterSkeleton";
import { DossierRoster } from "@/features/dossier/components/DossierRoster";
import { PageHeader } from "@/shared/components/PageHeader";
import { Card } from "@/shared/components/Card";
import { EmptyState } from "@/shared/components/EmptyState";
import { QueryState } from "@/shared/components/QueryState";
import { RepositoryPicker, resolveSelected } from "@/shared/components/RepositoryPicker";

export function DossierPage() {
  const t = useTranslate();
  const [repositoryId, setRepositoryId] = useState<string | null>(null);
  const [login, setLogin] = useState<string | null>(null);

  const repositories = useRepositories();
  const selected = resolveSelected(repositories.data?.repositories ?? [], repositoryId);
  const roster = useDossierList(selected?.id ?? null);

  const members = roster.data ?? [];
  // Nothing is auto-opened: the roster is the point of the page, and jumping
  // straight into whoever sorts first would hide it.
  const open = members.some((member) => member.login === login) ? login : null;

  return (
    <>
      <PageHeader
        eyebrow={t("nav.groupRecords")}
        title={t("dossier.title")}
        subtitle={t("dossier.subtitle")}
        actions={
          <RepositoryPicker
            repositories={repositories.data?.repositories ?? []}
            value={selected?.id ?? null}
            onChange={(id) => {
              setRepositoryId(id);
              setLogin(null);
            }}
          />
        }
      />

      <QueryState
        pending={repositories.isPending}
        error={repositories.error}
        onRetry={() => void repositories.refetch()}
        skeleton={<DossierSkeleton />}
      >
        {!selected ? (
          <Card>
            <EmptyState message={t("dossier.selectRepository")} />
          </Card>
        ) : (
          <div className="grid grid-aside">
            <Card>
              <QueryState
                pending={roster.isPending}
                error={roster.error}
                onRetry={() => void roster.refetch()}
                skeleton={<RosterSkeleton />}
              >
                <DossierRoster members={members} selected={open} onSelect={setLogin} />
              </QueryState>
            </Card>

            {open ? (
              <DossierDetail repositoryId={selected.id} login={open} />
            ) : (
              <Card>
                <EmptyState message={t("dossier.selectMember")} />
              </Card>
            )}
          </div>
        )}
      </QueryState>
    </>
  );
}
