import { useNavigate } from "react-router-dom";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { useToast } from "@/shared/hooks/useToast";
import { ApiError } from "@/shared/api/client";
import { useCreateRepository, useRepositories } from "@/features/repositories/hooks";
import { blankRepository } from "@/features/repositories/defaults";
import { PageHeader } from "@/shared/components/PageHeader";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { EmptyState } from "@/shared/components/EmptyState";
import { QueryState } from "@/shared/components/QueryState";
import { BoardSkeleton } from "@/features/repositories/components/BoardSkeleton";
import { FrontSlot } from "@/features/repositories/components/FrontSlot";

/**
 * The situation board. Composition only: every front is a slot, and opening one
 * navigates to its file — the settings that used to be fanned out across four
 * screens now live behind this one click.
 */
export function RepositoriesPage() {
  const t = useTranslate();
  const navigate = useNavigate();
  const { notify } = useToast();

  const repositories = useRepositories();
  const create = useCreateRepository();

  // A new front opens straight into its file: an empty slot on the board says
  // nothing, and the first thing anyone needs to do is name it.
  const addFront = () =>
    create.mutate(blankRepository(), {
      onSuccess: (created) => navigate(`/repositories/${created.id}`),
      onError: (error) =>
        notify(t(error instanceof ApiError ? error.i18nKey : "error.unknown"), "error"),
    });

  const items = repositories.data?.repositories ?? [];

  return (
    <>
      <PageHeader
        eyebrow={t("nav.groupOperations")}
        title={t("repos.title")}
        subtitle={t("repos.subtitle")}
        actions={
          <Button variant="primary" onClick={addFront} loading={create.isPending}>
            + {t("repos.add")}
          </Button>
        }
      />

      <QueryState
        pending={repositories.isPending}
        error={repositories.error}
        onRetry={() => void repositories.refetch()}
        skeleton={<BoardSkeleton />}
      >
        {items.length === 0 ? (
          <Card>
            <EmptyState
              message={t("repos.empty")}
              action={
                <Button variant="primary" onClick={addFront} loading={create.isPending}>
                  + {t("repos.add")}
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="board">
            {items.map((repository, index) => (
              <FrontSlot
                key={repository.id}
                repository={repository}
                serial={String(index + 1).padStart(2, "0")}
              />
            ))}
          </div>
        )}
      </QueryState>
    </>
  );
}
