import {
  DELIVERY_STATUSES,
  MAX_RETRY_ATTEMPTS,
  NON_RETRYABLE_REASONS,
  retryDelayMs,
} from "@commander/shared";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { Article } from "./Article";
import { FactTable } from "./FactTable";

/** The ladder as the worker actually walks it, not as anyone remembers it. */
function attempts(): number[] {
  return Array.from({ length: MAX_RETRY_ATTEMPTS }, (_, index) => index + 1);
}

/**
 * What happens to a push, from the moment GitHub knocks.
 *
 * Every article here is a decision that looks like a mistake until you know
 * why — the parser that must not run, the answer sent before the work, the
 * processor forbidden to throw. Those are exactly the things a manual is for.
 */
export function PathArticles() {
  const t = useTranslate();
  const minutes = (ms: number) => t("manual.unit.minutes", { n: Math.round(ms / 60_000) });
  const seconds = (ms: number) => t("manual.unit.seconds", { n: Math.round(ms / 1_000) });

  return (
    <>
      <Article title={t("manual.path.rawBytes.title")} body={t("manual.path.rawBytes.body")} />
      <Article title={t("manual.path.accepted.title")} body={t("manual.path.accepted.body")} />
      <Article title={t("manual.path.claim.title")} body={t("manual.path.claim.body")} />
      <Article title={t("manual.path.neverThrows.title")} body={t("manual.path.neverThrows.body")} />

      <Article title={t("manual.path.states.title")} body={t("manual.path.states.body")}>
        <FactTable
          head={[t("manual.col.state"), t("manual.col.meaning")]}
          rows={DELIVERY_STATUSES.map((status) => [
            t(`delivery.status.${status}`),
            t(`manual.state.${status}`),
          ])}
        />
      </Article>

      <Article title={t("manual.path.retry.title")} body={t("manual.path.retry.body")}>
        <FactTable
          head={[t("manual.col.attempt"), t("manual.col.wait")]}
          rows={attempts().map((attempt) => {
            const delay = retryDelayMs(attempt);
            return [String(attempt), delay < 60_000 ? seconds(delay) : minutes(delay)];
          })}
        />
      </Article>

      <Article title={t("manual.path.terminal.title")} body={t("manual.path.terminal.body")}>
        <FactTable
          head={[t("manual.col.reason"), t("manual.col.meaning")]}
          rows={NON_RETRYABLE_REASONS.map((reason) => [
            t(`delivery.reason.${reason}`),
            t(`manual.terminal.${reason}`),
          ])}
        />
      </Article>

      <Article title={t("manual.path.resume.title")} body={t("manual.path.resume.body")} />
      <Article title={t("manual.path.reconcile.title")} body={t("manual.path.reconcile.body")} />
    </>
  );
}
