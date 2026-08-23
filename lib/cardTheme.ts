export type CardTheme = {
  bg: string;
  ink: string;
  muted: string;
  accent: string; // used to derive the 4-step intensity scale
};

export const THEME_PRESETS: Record<string, CardTheme> = {
  light: { bg: "#FAFAF7", ink: "#14171A", muted: "#6B7280", accent: "#216E39" },
  dark: { bg: "#14171A", ink: "#FAFAF7", muted: "#9CA3AF", accent: "#39D353" },
  dracula: { bg: "#282A36", ink: "#F8F8F2", muted: "#6272A4", accent: "#BD93F9" }
};

const HEX_RE = /^#?[0-9a-fA-F]{6}$/;

function normalizeHex(hex: string): string | null {
  if (!HEX_RE.test(hex)) return null;
  return hex.startsWith("#") ? hex : `#${hex}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: [number, number, number], b: [number, number, number], t: number): string {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

/** Resolves the theme for a card request: a named preset, optionally overridden by validated custom hex colors. */
export function resolveTheme(searchParams: URLSearchParams): CardTheme {
  const presetName = searchParams.get("theme");
  const preset = (presetName && THEME_PRESETS[presetName]) || THEME_PRESETS.light!;

  const bgOverride = searchParams.get("bg");
  const accentOverride = searchParams.get("accent");

  const bg = (bgOverride && normalizeHex(bgOverride)) || preset.bg;
  const accent = (accentOverride && normalizeHex(accentOverride)) || preset.accent;

  // ink/muted stay tied to the preset (not user-overridable) — this is what
  // keeps a custom accent from producing an unreadable card, e.g. a bright
  // yellow accent on a white background with no forced contrast anywhere.
  return { bg, ink: preset.ink, muted: preset.muted, accent };
}

/** A 5-step intensity scale (0 = no contributions) blended from the theme's background toward its accent. */
export function levelColors(theme: CardTheme): string[] {
  const bgRgb = hexToRgb(theme.bg);
  const accentRgb = hexToRgb(theme.accent);
  return [
    mix(bgRgb, accentRgb, 0.12), // empty cell — a faint hint of the accent, not fully invisible
    mix(bgRgb, accentRgb, 0.35),
    mix(bgRgb, accentRgb, 0.58),
    mix(bgRgb, accentRgb, 0.8),
    mix(bgRgb, accentRgb, 1)
  ];
}
