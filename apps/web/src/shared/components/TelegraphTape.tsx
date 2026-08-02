import { useTranslate } from "@/shared/i18n/I18nProvider";

export interface TapeLine {
  key: string;
  /** The dispatch, already assembled LTR (repo · actor · outcome). */
  text: string;
  /** Drives the leading sigil colour: an outcome, not decoration. */
  tone: "sent" | "failed" | "pending" | "muted";
}

interface TelegraphTapeProps {
  pending: boolean;
  error: unknown;
  lines: TapeLine[];
  emptyLabel: string;
}

const SIGIL: Record<TapeLine["tone"], string> = {
  sent: "+",
  failed: "!",
  pending: "·",
  muted: "–",
};

/**
 * Dispatches coming off the wire, newest first, set as a phosphor readout for
 * the inside of a CrtScreen. The blinking caret on the last line is the one
 * animation here — a terminal waiting for the next transmission — and it costs
 * nothing under `prefers-reduced-motion`, which freezes it solid.
 */
export function TelegraphTape({ pending, error, lines, emptyLabel }: TelegraphTapeProps) {
  const t = useTranslate();

  if (pending) return <p className="screen-line screen-blink">{`> ${t("screen.linking")}`}</p>;
  if (error) return <p className="screen-line screen-alarm">{`> ${t("screen.lost")}`}</p>;
  if (lines.length === 0) return <p className="screen-line screen-dim">{`> ${emptyLabel}`}</p>;

  return (
    <ul className="tape">
      {lines.map((line) => (
        <li className={`tape-line tape-${line.tone}`} key={line.key}>
          <span className="tape-sigil" aria-hidden="true">
            {SIGIL[line.tone]}
          </span>
          <span className="tape-text ltr">{line.text}</span>
        </li>
      ))}
      <li className="tape-line tape-caret" aria-hidden="true">
        <span className="tape-sigil">&gt;</span>
        <span className="screen-caret" />
      </li>
    </ul>
  );
}
