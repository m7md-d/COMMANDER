import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { scanBlockerKey } from "@commander/shared";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { useToast } from "@/shared/hooks/useToast";
import { ApiError } from "@/shared/api/client";
import {
  useDeleteRepository,
  useRepositories,
  useScanRepository,
  useSendDigest,
  useTestDelivery,
  useUpdateRepository,
} from "@/features/repositories/hooks";
import { usePrompts } from "@/features/prompts/hooks";
import { useSettings } from "@/features/settings/hooks";
import { Card } from "@/shared/components/Card";
import { EmptyState } from "@/shared/components/EmptyState";
import { QueryState } from "@/shared/components/QueryState";
import { FileSkeleton } from "@/features/repositories/components/FileSkeleton";
import { FrontFile } from "@/features/repositories/components/FrontFile";
import { FrontDialogs, type FrontDialog } from "@/features/repositories/components/FrontDialogs";

/**
 * One front's file. Composition only — the draft, the tabs and the save bar all
 * live in FrontFile, which is mounted per id so switching fronts cannot carry
 * an edit across.
 */
export function FrontPage() {
  const t = useTranslate();
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { notify } = useToast();
  // Dialog visibility only — deleting a front must still name it before it goes
  // (docs/UI-AUDIT.md §2), and that confirmation must not be lost in the move
  // from the card to the file.
  const [dialog, setDialog] = useState<FrontDialog>(null);

  const repositories = useRepositories();
  const prompts = usePrompts();
  const settings = useSettings();
  const update = useUpdateRepository();
  const remove = useDeleteRepository();
  const test = useTestDelivery();
  const digest = useSendDigest();
  const scan = useScanRepository();

  const fail = (error: unknown) =>
    notify(t(error instanceof ApiError ? error.i18nKey : "error.unknown"), "error");

  const all = repositories.data?.repositories ?? [];
  const index = all.findIndex((repository) => repository.id === id);
  const front = index === -1 ? undefined : all[index];

  return (
    <>
      <QueryState
        pending={repositories.isPending}
        error={repositories.error}
        onRetry={() => void repositories.refetch()}
        skeleton={<FileSkeleton />}
      >
        {!front ? (
          <Card>
            <EmptyState
              message={t("front.missing")}
              action={
                <Link className="btn" to="/repositories">
                  {t("front.back")}
                </Link>
              }
            />
          </Card>
        ) : (
          <FrontFile
            key={front.id}
            repository={front}
            serial={String(index + 1).padStart(2, "0")}
            promptOptions={(prompts.data?.prompts ?? []).map((prompt) => ({
              value: prompt.id,
              label: prompt.name,
            }))}
            webhookUrl={repositories.data?.webhookUrl ?? ""}
            timezoneOffset={settings.data?.timezoneOffset ?? 0}
            saving={update.isPending}
            scanning={scan.isPending}
            digesting={digest.isPending}
            onSave={(patch) =>
              update.mutate(
                { id: front.id, patch },
                { onSuccess: () => notify(t("state.saved")), onError: fail },
              )
            }
            onDelete={() => setDialog("delete")}
            onTest={() =>
              test.mutate(front.id, {
                onSuccess: () => notify(t("repos.testSent")),
                onError: fail,
              })
            }
            onDigest={() => setDialog("digest")}
            onScan={() =>
              scan.mutate(front.id, {
                // A blocked scan names its own cause. "Unavailable" was true and
                // useless: four different faults produced it, each with a
                // different fix, and the server knew which one every time.
                onSuccess: (result) =>
                  notify(
                    result.available
                      ? t("repos.scanDone", {
                          members: result.membersImported,
                          files: result.filesSeen,
                          areas: result.areas,
                        })
                      : t(result.blocker ? scanBlockerKey(result.blocker) : "repos.scanUnavailable"),
                    result.available ? "success" : "error",
                  ),
                onError: fail,
              })
            }
          />
        )}
      </QueryState>

      <FrontDialogs
        open={dialog}
        onClose={() => setDialog(null)}
        subject={front?.fullName ?? ""}
        deleting={remove.isPending}
        digesting={digest.isPending}
        onDelete={() => {
          if (!front) return;
          setDialog(null);
          remove.mutate(front.id, { onSuccess: () => navigate("/repositories"), onError: fail });
        }}
        onDigest={() => {
          if (!front) return;
          setDialog(null);
          digest.mutate(front.id, {
            onSuccess: () => notify(t("repos.digestQueued")),
            onError: fail,
          });
        }}
      />
    </>
  );
}
