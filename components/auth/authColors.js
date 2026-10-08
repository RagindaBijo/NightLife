import { DARK_COLORS } from "../../lib/theme";

// The auth screens are always dark (branded), whatever the theme setting is
export const AUTH_COLORS = {
  ...DARK_COLORS,
  backgroundTop: "#1A1030",
  inputBackground: "rgba(26, 22, 38, 0.85)",
  inputBorderFocused: DARK_COLORS.accent,
  brandGradient: ["#7C3AED", "#C026D3", "#F472B6"],
};
