import { DELIVERY_STATUSES, type DeliveryScope } from "@commander/shared";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { Field } from "@/shared/components/Field";
import { Select } from "@/shared/components/Select";
import type { DispatchSort } from "@/features/deliveries/sort";

const ALL = "__all__";

interface DispatchToolbarProps {
  scope: DeliveryScope;
  onScope: (scope: DeliveryScope) => void;
  front: string;
  onFront: (front: string) => void;
  fronts: { id: string; fullName: string }[];
  status: string;
  onStatus: (status: string) => void;
  sort: DispatchSort;
  onSort: (sort: DispatchSort) => void;
  compact: boolean;
  onCompact: (compact: boolean) => void;
}

/** The dispatch filter bar. Every control is the project's own Select. */
export function DispatchToolbar(props: DispatchToolbarProps) {
  const t = useTranslate();

  return (
    <div className="filter-bar">
      <Field label={t("dispatch.scope")}>
        {(id) => (
          <Select
            id={id}
            value={props.scope}
            onValueChange={(v) => props.onScope(v as DeliveryScope)}
            options={[
              { value: "active", label: t("dispatch.active") },
              { value: "archived", label: t("dispatch.archived") },
            ]}
          />
        )}
      </Field>
      <Field label={t("dispatch.front")}>
        {(id) => (
          <Select
            id={id}
            value={props.front}
            onValueChange={props.onFront}
            options={[
              { value: ALL, label: t("dispatch.allFronts") },
              ...props.fronts.map((repo) => ({ value: repo.id, label: repo.fullName })),
            ]}
          />
        )}
      </Field>
      <Field label={t("dispatch.state")}>
        {(id) => (
          <Select
            id={id}
            value={props.status}
            onValueChange={props.onStatus}
            options={[
              { value: ALL, label: t("dispatch.allStates") },
              ...DELIVERY_STATUSES.map((value) => ({ value, label: t(`delivery.status.${value}`) })),
            ]}
          />
        )}
      </Field>
      <Field label={t("dispatch.sort")}>
        {(id) => (
          <Select
            id={id}
            value={props.sort}
            onValueChange={(v) => props.onSort(v as DispatchSort)}
            options={[
              { value: "newest", label: t("dispatch.sortNewest") },
              { value: "oldest", label: t("dispatch.sortOldest") },
              { value: "attempts", label: t("dispatch.sortAttempts") },
            ]}
          />
        )}
      </Field>
      <Field label={t("dispatch.view")}>
        {(id) => (
          <Select
            id={id}
            value={props.compact ? "compact" : "detailed"}
            onValueChange={(v) => props.onCompact(v === "compact")}
            options={[
              { value: "detailed", label: t("dispatch.viewDetailed") },
              { value: "compact", label: t("dispatch.viewCompact") },
            ]}
          />
        )}
      </Field>
    </div>
  );
}
