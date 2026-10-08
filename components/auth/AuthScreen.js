import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../../lib/i18n";
import { AUTH_COLORS as C } from "./authColors";

// Soft white radial glow, tinted per use
const GLOW = require("../../assets/images/auth-glow.png");

/**
 * Frame for the login / sign-up screens: always dark and branded (it doesn't
 * follow the light/dark setting), with soft colour glows and keyboard handling.
 */
export default function AuthScreen({ children, showBack = false, contentStyle }) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[C.backgroundTop, C.background, C.background]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Soft glows: a violet one top-left and a pink one on the right */}
      <Image
        source={GLOW}
        tintColor={C.accentStrong}
        style={[styles.glow, styles.glowViolet]}
        pointerEvents="none"
      />
      <Image
        source={GLOW}
        tintColor={C.accentPink}
        style={[styles.glow, styles.glowPink]}
        pointerEvents="none"
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + (showBack ? 56 : 24), paddingBottom: insets.bottom + 24 },
            contentStyle,
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>

      {showBack && (
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => [styles.back, { top: insets.top + 8 }, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t("common.goBack")}
        >
          <MaterialIcons name="arrow-back" size={24} color={C.text} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  glow: {
    position: "absolute",
  },
  glowViolet: {
    width: 520,
    height: 520,
    top: -220,
    left: -200,
    opacity: 0.55,
  },
  glowPink: {
    width: 440,
    height: 440,
    top: 140,
    right: -240,
    opacity: 0.3,
  },
  back: {
    position: "absolute",
    left: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  pressed: {
    opacity: 0.6,
  },
});
