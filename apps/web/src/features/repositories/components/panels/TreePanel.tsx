import { useState } from "react";
import { resolveChecks } from "@commander/shared";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { Button } from "@/shared/components/Button";
import { EmptyState } from "@/shared/components/EmptyState";
import { QueryState } from "@/shared/components/QueryState";
import { useCheckTemplates, useTree } from "@/features/repositories/hooks";
import { TreeChart } from "../tree/TreeChart";
import { FileRecord } from "../tree/FileRecord";
import { TreeSkeleton } from "../tree/TreeSkeleton";

interface TreePanelProps {
  repositoryId: string;
  /** The front's template choice and overrides, read from the open draft so the
   *  chart re-marks as limits are edited rather than only after a save. */
  templateId: string | null;
  overrides: Parameters<typeof resolveChecks>[1];
  onScan: () => void;
  scanning: boolean;
}

/**
 * The tree section of a front's file.
 *
 * There is no build button of its own: reconnaissance is what reads GitHub's
 * listing, and the tree is one of the two things it stores. A second button
 * that did the same call under a different name would be two names for one act.
 */
export function TreePanel({ repositoryId, templateId, overrides, onScan, scanning }: TreePanelProps) {
  const t = useTranslate();
  const [selected, setSelected] = useState<string | null>(null);
  const tree = useTree(repositoryId);
  const templates = useCheckTemplates();

  const template = templates.data?.templates.find((entry) => entry.id === templateId);
  const checks = resolveChecks(template?.checks ?? null, overrides);

  const snapshot = tree.data;
  const file = snapshot?.files.find((entry) => entry.path === selected) ?? null;

  return (
    <QueryState
      pending={tree.isPending}
      error={tree.error}
      onRetry={() => void tree.refetch()}
      skeleton={<TreeSkeleton />}
    >
      {/* Never synced and synced-but-empty are different facts, and only the
          first one is something the operator can act on. */}
      {!snapshot || snapshot.syncedAt === null ? (
        <EmptyState
          message={t("tree.neverHint")}
          action={
            <Button variant="primary" loading={scanning} onClick={onScan}>
              {t("repos.scan")}
            </Button>
          }
        />
      ) : snapshot.files.length === 0 ? (
        <EmptyState message={t("tree.empty")} />
      ) : (
        <div className="grid grid-aside">
          <TreeChart
            snapshot={snapshot}
            selected={selected}
            onSelect={setSelected}
            checks={checks}
            actions={
              <Button size="sm" loading={scanning} onClick={onScan}>
                {t("recon.rescan")}
              </Button>
            }
          />
          {file ? (
            <FileRecord file={file} checks={checks} />
          ) : (
            <EmptyState message={t("tree.selectFile")} />
          )}
        </div>
      )}
    </QueryState>
  );
}
