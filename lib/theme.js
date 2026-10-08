// App colour palettes. Both have the same keys, so screens just read
// `colors.surface`, `colors.text`, … from useTheme() (see lib/theme-context.js).

export const DARK_COLORS = {
  background: "#0E0B16", // screen background
  backgroundElevated: "#15111F", // headers, tab bar
  surface: "#1A1626", // cards, inputs
  surfacePressed: "#262036", // pressed cards, subtle fills
  border: "#2E2742", // hairlines, outlines
  text: "#FFFFFF",
  textSecondary: "#A59FBA",
  placeholder: "#6B6482",
  accent: "#A78BFA", // main accent (buttons, active states)
  accentStrong: "#7C3AED",
  accentPink: "#F472B6",
  accentSoft: "rgba(167, 139, 250, 0.14)", // tinted backgrounds
  onAccent: "#0E0B16", // text / icons on accent-coloured buttons
  onImage: "#FFFFFF", // text / icons drawn on photos or dark overlays
  gold: "#FBBF24", // stars / ratings
  success: "#34D399",
  danger: "#F87171",
  like: "#F43F5E",
};

export const LIGHT_COLORS = {
  background: "#F6F4FB",
  backgroundElevated: "#FFFFFF",
  surface: "#FFFFFF",
  surfacePressed: "#EFEBF7",
  border: "#E3DDEE",
  text: "#17121F",
  textSecondary: "#6B6480",
  placeholder: "#A39DB5",
  accent: "#7C3AED",
  accentStrong: "#6D28D9",
  accentPink: "#DB2777",
  accentSoft: "rgba(124, 58, 237, 0.10)",
  onAccent: "#FFFFFF",
  onImage: "#FFFFFF",
  gold: "#F59E0B",
  success: "#059669",
  danger: "#DC2626",
  like: "#E11D48",
};

export const gradientsFor = (colors) => ({
  brand: [colors.accent, colors.accentPink],
});
