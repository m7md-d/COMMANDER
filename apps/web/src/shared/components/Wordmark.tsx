import { useTranslate } from "@/shared/i18n/I18nProvider";

interface WordmarkProps {
  /** Compact drops the designation strip — for tight headers. */
  compact?: boolean;
}

/**
 * The platform mark. The name IS the logo: there is no separate glyph standing
 * in for it, only an insignia that sits beside it.
 *
 * Everything is drawn with `currentColor` and type, never an image file. That
 * keeps the mark correct in both themes and crisp at any density — a PNG or a
 * coloured SVG asset would be a second source of truth for the brand colour,
 * and would go stale the moment the accent token changes.
 *
 * The letterforms carry one horizontal bridge cut through them (see
 * `.wordmark-name`), which is what a stencil actually is. It is a single
 * deliberate cut rather than a repeating pattern, because repeating bands stop
 * reading as a stencil and start reading as a rendering fault.
 */
export function Wordmark({ compact = false }: WordmarkProps) {
  const t = useTranslate();

  return (
    <div className={compact ? "wordmark wordmark-compact" : "wordmark"}>
      <span className="wordmark-insignia" aria-hidden="true">
        <svg viewBox="0 0 24 28" role="presentation" focusable="false">
          {/* Shield outline: the frame the rank sits in. */}
          <path
            d="M12 1 22 5v11c0 5.2-4.1 9.4-10 11C6.1 25.4 2 21.2 2 16V5Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          {/* Three chevrons — the rank. Drawn, not lettered, so it never
              collides with the Arabic or Latin text beside it. */}
          <path
            d="M6.5 11.5 12 8l5.5 3.5M6.5 15.5 12 12l5.5 3.5M6.5 19.5 12 16l5.5 3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="square"
          />
        </svg>
      </span>

      <span className="wordmark-body">
        <span className="wordmark-name">{t("app.brand")}</span>
        {compact ? null : (
          <span className="wordmark-designation">
            <span className="wordmark-rule" aria-hidden="true" />
            {t("app.designation")}
          </span>
        )}
      </span>
    </div>
  );
}
