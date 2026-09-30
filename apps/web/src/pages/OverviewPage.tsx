import { useState } from "react";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { useRepositories } from "@/features/repositories/hooks";
import { useMemberStats, useOverviewStats, useResetStats } from "@/features/stats/hooks";
import { useSettings } from "@/shared/hooks/useSettings";
import { useToast } from "@/shared/hooks/useToast";
import { StatsSkeleton } from "@/features/stats/components/StatsSkeleton";
import { RosterSkeleton } from "@/features/stats/components/RosterSkeleton";
import { PageHeader } from "@/shared/components/PageHeader";
import { StatTile } from "@/shared/components/StatTile";
import { Card } from "@/shared/components/Card";
import { Button } from "@/shared/components/Button";
import { Badge } from "@/shared/components/Badge";
import { QueryState } from "@/shared/components/QueryState";
import { RepositoryPicker } from "@/shared/components/RepositoryPicker";
import { resolveSelected } from "@/shared/lib/defaultFront";
import { Leaderboard } from "@/features/stats/components/Leaderboard";

export function OverviewPage() {
  const t = useTranslate();
  const { notify } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const repositories = useRepositories();
  const overview = useOverviewStats();
  const settings = useSettings();

  const selected = resolveSelected(repositories.data?.repositories ?? [], selectedId);
  const stats = useMemberStats(selected?.id ?? null);
  const reset = useResetStats();

  const handleReset = () => {
    if (!selected) return;
    reset.mutate(selected.id, {
      onSuccess: (result) => notify(t("overview.resetDone", { count: result.deleted })),
    });
  };

  return (
    <>
      <PageHeader
        eyebrow={t("nav.groupOperations")}
        title={t("overview.title")}
        subtitle={t("overview.subtitle")}
      />

      {settings.data?.paused ? (
        <Card accent>
          <Badge tone="accent">{t("overview.pausedBanner")}</Badge>
        </Card>
      ) : null}

      <div className="stack-gap">
        <QueryState pending={overview.isPending} error={overview.error} onRetry={() => void overview.refetch()} skeleton={<StatsSkeleton />}>
          <div className="grid grid-stats">
            <StatTile value={overview.data?.repositoryCount ?? 0} label={t("overview.repositoryCount")} />
            <StatTile value={overview.data?.memberCount ?? 0} label={t("overview.memberCount")} />
            <StatTile value={overview.data?.pushCount ?? 0} label={t("overview.pushCount")} />
            <StatTile value={overview.data?.violationCount ?? 0} label={t("overview.violationCount")} />
            <StatTile value={overview.data?.pendingDeliveries ?? 0} label={t("overview.pendingDeliveries")} />
            <StatTile value={overview.data?.failedDeliveries ?? 0} label={t("overview.failedDeliveries")} />
          </div>
        </QueryState>
      </div>

      <Card
        title={t("overview.leaderboard")}
        actions={
          // The picker filters this board alone: the tiles above count every
          // front, and in the page header it read as their scope (W-09).
          <div className="row row-wrap">
            <RepositoryPicker
              repositories={repositories.data?.repositories ?? []}
              value={selected?.id ?? null}
              onChange={setSelectedId}
            />
            {selected ? (
              <Button size="sm" variant="danger" onClick={handleReset} loading={reset.isPending}>
                {t("overview.resetStats")}
              </Button>
            ) : null}
          </div>
        }
      >
        {selected ? (
          <QueryState pending={stats.isPending} error={stats.error} onRetry={() => void stats.refetch()} skeleton={<RosterSkeleton />}>
            <Leaderboard rows={stats.data ?? []} />
          </QueryState>
        ) : (
          <p className="empty-state">{t("overview.selectRepository")}</p>
        )}
      </Card>
    </>
  );
}
