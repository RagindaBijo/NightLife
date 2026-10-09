import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { useI18n } from "../lib/i18n";
import { MAX_PREFERENCES, MIN_PREFERENCES } from "../lib/preferences";
import { makeStyles, useTheme } from "../lib/theme-context";

/**
 * Pick-several chips with a counter, e.g. music styles or kinds of places.
 *   options: [{ key, icon }], label(key) → text
 *   selected: array of keys, onChange(nextKeys)
 */
export default function PreferencePicker({ title, hint, options, label, selected, onChange }) {
  const { colors: COLORS } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  const enough = selected.length >= MIN_PREFERENCES;
  const full = selected.length >= MAX_PREFERENCES;

  const toggle = (key) =>
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <View style={[styles.counter, enough && styles.counterDone]}>
          <Text style={[styles.counterText, enough && styles.counterTextDone]}>
            {t("preferences.counter", { count: selected.length, min: MIN_PREFERENCES })}
          </Text>
        </View>
      </View>
      {!!hint && <Text style={styles.hint}>{hint}</Text>}
      <View style={styles.chips}>
        {options.map((option) => {
          const active = selected.includes(option.key);
          const disabled = !active && full;
          return (
            <Pressable
              key={option.key}
              onPress={() => toggle(option.key)}
              disabled={disabled}
              style={[styles.chip, active && styles.chipActive, disabled && styles.chipDisabled]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active, disabled }}
            >
              <MaterialCommunityIcons
                name={option.icon}
                size={15}
                color={active ? COLORS.onAccent : COLORS.accent}
              />
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{label(option.key)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = makeStyles((COLORS) => ({
  section: {
    marginTop: 22,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  title: {
    flex: 1,
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "800",
  },
  counter: {
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 10,
    backgroundColor: COLORS.surfacePressed,
  },
  counterDone: {
    backgroundColor: COLORS.accentSoft,
  },
  counterText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },
  counterTextDone: {
    color: COLORS.accent,
  },
  hint: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  chipActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  chipDisabled: {
    opacity: 0.4,
  },
  chipText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
  },
  chipTextActive: {
    color: COLORS.onAccent,
  },
}));
