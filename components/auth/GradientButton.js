import { LinearGradient } from "expo-linear-gradient";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { AUTH_COLORS as C } from "./authColors";

/** Big brand-gradient button. Faded and not pressable while disabled or loading. */
export default function GradientButton({ label, onPress, disabled, loading, style }) {
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [styles.wrap, style, (pressed || inactive) && styles.dim]}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
    >
      <LinearGradient
        colors={C.brandGradient}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.gradient}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.label}>{label}</Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#A855F7",
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  gradient: {
    height: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  dim: {
    opacity: 0.55,
  },
});
