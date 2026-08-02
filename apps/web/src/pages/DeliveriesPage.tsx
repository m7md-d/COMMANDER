import { useState } from "react";
import type { Delivery, DeliveryScope, DeliveryStatus } from "@commander/shared";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { useToast } from "@/shared/hooks/useToast";
import { ApiError } from "@/shared/api/client";
import {
  useArchiveDelivery,
  useDeliveries,
  useRestoreDelivery,
  useRetryDelivery,
} from "@/features/deliveries/hooks";
import { useRepositories } from "@/features/repositories/hooks";
import { SlipsSkeleton } from "@/features/deliveries/components/SlipsSkeleton";
import { DeliveryCard } from "@/features/deliveries/components/DeliveryCard";
import { DispatchToolbar } from "@/features/deliveries/components/DispatchToolbar";
import { DispatchBulkDialogs, type BulkAction } from "@/features/deliveries/components/DispatchBulkDialogs";
import { sortDeliveries, type DispatchSort } from "@/features/deliveries/sort";
import { PageHeader } from "@/shared/components/PageHeader";
import { Card } from "@/shared/components/Card";
import { EmptyState } from "@/shared/components/EmptyState";
import { QueryState } from "@/shared/components/QueryState";
import { Button } from "@/shared/components/Button";

const ALL = "__all__";

export function DeliveriesPage() {
  const t = useTranslate();
  const { notify } = useToast();
  const [front, setFront] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [sort, setSort] = useState<DispatchSort>("newest");
  const [compact, setCompact] = useState(false);
  const [scope, setScope] = useState<DeliveryScope>("active");
  const [bulk, setBulk] = useState<BulkAction>(null);

  const repositories = useRepositories();
  const filters = {
    ...(status !== ALL && { status: status as DeliveryStatus }),
    ...(front !== ALL && { repositoryId: front }),
  };
  const deliveries = useDeliveries({ ...filters, scope });

  const retry = useRetryDelivery();
  const archive = useArchiveDelivery();
  const restore = useRestoreDelivery();
  const busy = archive.isPending || restore.isPending || retry.isPending;

  const items: Delivery[] = sortDeliveries(deliveries.data?.items ?? [], sort);
  const fail = (error: unknown) =>
    notify(t(error instanceof ApiError ? error.i18nKey : "error.unknown"), "error");

  return (
    <>
      <PageHeader
        eyebrow={t("nav.groupRecords")}
        title={t("delivery.title")}
        subtitle={t("delivery.subtitle")}
        actions={
          scope === "active" ? (
            <Button onClick={() => setBulk("archiveAll")}>{t("dispatch.archiveAll")}</Button>
          ) : (
            <Button variant="danger" onClick={() => setBulk("purge")}>
              {t("dispatch.purge")}
            </Button>
          )
        }
      />

      <DispatchToolbar
        scope={scope}
        onScope={setScope}
        front={front}
        onFront={setFront}
        fronts={repositories.data?.repositories ?? []}
        status={status}
        onStatus={setStatus}
        sort={sort}
        onSort={setSort}
        compact={compact}
        onCompact={setCompact}
      />

      <QueryState
        pending={deliveries.isPending}
        error={deliveries.error}
        onRetry={() => void deliveries.refetch()}
        skeleton={<SlipsSkeleton />}
      >
        {items.length === 0 ? (
          <Card>
            <EmptyState message={t("delivery.empty")} />
          </Card>
        ) : (
          <div className={compact ? "dispatch-grid dispatch-grid-compact" : "dispatch-grid"}>
            {items.map((delivery) => (
              <DeliveryCard
                key={delivery.id}
                delivery={delivery}
                compact={compact}
                busy={busy}
                onRetry={(id) => retry.mutate(id, { onError: fail })}
                onArchive={(id) =>
                  archive.mutate(id, { onSuccess: () => notify(t("dispatch.archivedToast")), onError: fail })
                }
                onRestore={(id) =>
                  restore.mutate(id, { onSuccess: () => notify(t("dispatch.restoredToast")), onError: fail })
                }
              />
            ))}
          </div>
        )}
      </QueryState>

      <DispatchBulkDialogs
        action={bulk}
        onClose={() => setBulk(null)}
        count={items.length}
        filters={filters}
      />
    </>
  );
}
