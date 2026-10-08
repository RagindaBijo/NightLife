import { Pressable, StyleSheet, Text, View } from "react-native";
import { makeStyles } from "../lib/theme-context";

/**
 * Pill-style switcher for sections of a page, e.g. Status / Events / About.
 */
export default function SegmentedTabs({ tabs, value, onChange }) {
  const styles = useStyles();
  return (
    <View style={styles.container} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const isActive = tab.key === value;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            style={[styles.tab, isActive && styles.tabActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
          >
            <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((COLORS) => ({
  container: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 4,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 9,
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: COLORS.accent,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
  labelActive: {
    color: COLORS.onAccent,
    fontWeight: "700",
  },
}));
