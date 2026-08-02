import { FALLBACK_GLYPH, PROVIDER_GLYPHS } from "./provider-glyphs";

interface ProviderInsigniaProps {
  provider: string;
}

/**
 * A provider's real logo, drawn in currentColor so it inherits the khaki of
 * whatever it sits inside. An unknown provider falls back to a stencil star
 * rather than an empty box.
 */
export function ProviderInsignia({ provider }: ProviderInsigniaProps) {
  const glyph = PROVIDER_GLYPHS[provider] ?? FALLBACK_GLYPH;

  return (
    <svg
      className="insignia-glyph"
      viewBox={glyph.box ?? "0 0 24 24"}
      aria-hidden="true"
      focusable="false"
    >
      {glyph.paths.map((path) =>
        path.stroke ? (
          <path
            key={path.d}
            d={path.d}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <path key={path.d} d={path.d} fill="currentColor" fillRule={path.fillRule} />
        ),
      )}
    </svg>
  );
}
