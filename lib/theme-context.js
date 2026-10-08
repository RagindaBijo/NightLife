import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { StyleSheet, useColorScheme } from "react-native";
import { useI18n } from "./i18n";
import { DARK_COLORS, LIGHT_COLORS, gradientsFor } from "./theme";

const STORAGE_KEY = "themePreference";
const PREFERENCES = ["system", "light", "dark"];

const ThemeContext = createContext(null);

/**
 * Provides the active colours. The user picks "system", "light" or "dark"
 * in Settings; "system" follows the phone. The choice is remembered.
 */
export function AppThemeProvider({ children }) {
  const systemScheme = useColorScheme(); // "light" | "dark" | null
  const [preference, setPreferenceState] = useState("system");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (PREFERENCES.includes(saved)) setPreferenceState(saved);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const value = useMemo(() => {
    const scheme =
      preference === "system" ? (systemScheme === "light" ? "light" : "dark") : preference;
    const colors = scheme === "light" ? LIGHT_COLORS : DARK_COLORS;
    return {
      scheme,
      preference,
      colors,
      gradients: gradientsFor(colors),
      setPreference: (next) => {
        setPreferenceState(next);
        AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
      },
    };
  }, [preference, systemScheme]);

  // Wait for the saved choice so the app doesn't flash the wrong theme
  if (!loaded) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** { scheme, preference, colors, gradients, setPreference } */
export const useTheme = () => useContext(ThemeContext);

/**
 * Builds a styles hook from a function of the colours. Styles are created
 * once per theme and reused.
 *   const useStyles = makeStyles((COLORS) => ({ box: { backgroundColor: COLORS.surface } }));
 *   const styles = useStyles();
 */
export function makeStyles(factory) {
  const cache = new Map();
  return function useStyles() {
    const { scheme, colors } = useTheme();
    // Georgian has no lowercase/uppercase pair in everyday text: uppercasing turns
    // it into Mtavruli capitals, which many fonts can't show
    const keepCase = useI18n().language === "ka";
    const key = `${scheme}-${keepCase}`;
    if (!cache.has(key)) {
      const styles = factory(colors);
      cache.set(key, StyleSheet.create(keepCase ? withoutUppercase(styles) : styles));
    }
    return cache.get(key);
  };
}

function withoutUppercase(styles) {
  return Object.fromEntries(
    Object.entries(styles).map(([name, style]) => {
      if (style?.textTransform !== "uppercase") return [name, style];
      const { textTransform, ...rest } = style;
      return [name, rest];
    }),
  );
}
