import { useTranslate } from "@/shared/i18n/I18nProvider";
import { useOverviewStats } from "@/features/stats/hooks";
import { useDeliveries } from "@/features/deliveries/hooks";
import { CrtScreen } from "@/shared/components/CrtScreen";
import { ScreenReadout, type ReadoutRow } from "@/shared/components/ScreenReadout";
import { TelegraphTape, type TapeLine } from "@/shared/components/TelegraphTape";
import { ConsoleButton } from "@/shared/components/ConsoleButton";
import { Clock } from "@/shared/components/Clock";
import { toReadout, toTape } from "@/features/command-post/present";
import { CONSOLE_STATIONS } from "@/app/nav-items";

/**
 * The command post. The landing screen IS the headquarters: a masthead, the two
 * situation screens, and the console.
 *
 * It is composition only, per the frontend constitution — the two mappers that
 * turn feature data into screen rows live in features/command-post/present, so
 * this file never touches a delivery field or a stat name directly.
 */
export function HeadquartersPage() {
  const t = useTranslate();
  const stats = useOverviewStats();
  const dispatches = useDeliveries({});

  const rows: ReadoutRow[] = toReadout(stats.data, t);
  const lines: TapeLine[] = toTape(dispatches.data?.items ?? []);

  return (
    <div className="hq">
      <header className="hq-masthead">
        {/* The wordmark already sits in the command bar; here the post names
            itself in words instead of repeating the mark. */}
        <div>
          <h1 className="page-title">{t("app.name")}</h1>
          <p className="page-subtitle">{t("app.designation")}</p>
        </div>
        <span className="hq-masthead-clock">
          <Clock />
        </span>
      </header>

      <div className="hq-screens">
        <CrtScreen title={t("board.status")}>
          <ScreenReadout
            pending={stats.isPending}
            error={stats.error}
            onRetry={() => void stats.refetch()}
            rows={rows}
          />
        </CrtScreen>

        <CrtScreen title={t("hq.comms")}>
          <TelegraphTape
            pending={dispatches.isPending}
            error={dispatches.error}
            lines={lines}
            emptyLabel={t("delivery.empty")}
          />
        </CrtScreen>
      </div>

      <section className="hq-console" aria-label={t("hq.console")}>
        <h2 className="stencil">{t("hq.console")}</h2>
        <div className="console-grid">
          {CONSOLE_STATIONS.map((station, index) => (
            <ConsoleButton
              key={station.key}
              to={station.to}
              code={String(index + 1).padStart(2, "0")}
              label={t(`nav.${station.key}`)}
              description={t(`navDesc.${station.key}`)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
