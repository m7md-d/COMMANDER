/**
 * The situation screens' text is readable against the tube it is drawn on.
 *
 * The screens are theme-independent (themes.css): one dark tube, one phosphor,
 * several alphas of it. An alpha is a contrast ratio in disguise, and the
 * labels' 45% came to 2.73 : 1 — "the fronts", "dispatches" beside their
 * figures, barely there (docs/UI-DEFECTS.md W-10). axe did not report it: it
 * cannot judge text over a composited background, so the ratio is computed here
 * from the tokens themselves. Only colours text is drawn in are held to it —
 * the tube's lines, glow and edge are decoration.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../lib/sources.js";
import { TEXT_CONTRAST_MIN } from "../lib/budgets.js";

type Rgb = [number, number, number];

const TEXT_TOKENS = ["--color-screen-text", "--color-screen-bright", "--color-screen-dim"];

const css = (file: string): string => readFileSync(join(ROOT, "apps/web/src/styles", file), "utf8");

function hex(value: string): Rgb {
  const digits = /#([0-9a-f]{6})/i.exec(value)?.[1] ?? "000000";
  return [0, 2, 4].map((at) => parseInt(digits.slice(at, at + 2), 16)) as Rgb;
}

/** A token's colour over the tube: a palette hex, or an `rgb(r g b / a%)` composited onto it. */
function drawn(value: string, palette: string, tube: Rgb): Rgb {
  const alias = /var\((--palette-[\w-]+)\)/.exec(value)?.[1];
  if (alias) return hex(new RegExp(`${alias}:\\s*([^;]+);`).exec(palette)?.[1] ?? "");
  const rgba = /rgb\((\d+) (\d+) (\d+) \/ (\d+)%\)/.exec(value);
  assert.ok(rgba, `cannot read the colour "${value}" — extend this guard to its form`);
  const alpha = Number(rgba[4]) / 100;
  return [1, 2, 3].map((index) => Number(rgba[index]) * alpha + tube[index - 1]! * (1 - alpha)) as Rgb;
}

function luminance([r, g, b]: Rgb): number {
  const channel = (value: number) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

const ratio = (a: Rgb, b: Rgb): number => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
};

test("every colour the situation screens draw text in reads against the tube", () => {
  const palette = css("tokens.css");
  const themes = css("themes.css");
  const tube = hex(/--palette-screen:\s*([^;]+);/.exec(palette)?.[1] ?? "");

  const faint = TEXT_TOKENS.map((token) => {
    const value = new RegExp(`${token}:\\s*([^;]+);`).exec(themes)?.[1];
    assert.ok(value, `themes.css: no ${token}`);
    return { token, contrast: ratio(drawn(value, palette, tube), tube) };
  }).filter((entry) => entry.contrast < TEXT_CONTRAST_MIN);

  assert.deepEqual(
    faint.map((entry) => `${entry.token}: ${entry.contrast.toFixed(2)} : 1`),
    [],
    `below ${TEXT_CONTRAST_MIN} : 1 against --palette-screen. Raise the alpha in themes.css; it is a contrast ratio.`,
  );
});
