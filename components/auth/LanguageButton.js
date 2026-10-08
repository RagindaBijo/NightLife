import { MaterialIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LANGUAGES, useI18n } from "../../lib/i18n";
import { AUTH_COLORS as C } from "./authColors";

/**
 * Globe button for the auth screens, so people can switch language before
 * they have an account. Uses the same saved setting as Settings → Language.
 */
export default function LanguageButton({ style }) {
  const { t, language, preference, setPreference } = useI18n();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const options = [{ key: "system", label: t("settings.languageSystem") }, ...LANGUAGES];

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={8}
        style={({ pressed }) => [styles.button, style, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={t("settings.language")}
      >
        <MaterialIcons name="language" size={18} color={C.text} />
        <Text style={styles.code}>{language.toUpperCase()}</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.handle} />
            <Text style={styles.title}>{t("settings.language")}</Text>
            {options.map((option) => {
              const active = option.key === preference;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => {
                    setPreference(option.key);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>
                    {option.label}
                  </Text>
                  {active && <MaterialIcons name="check" size={22} color={C.accent} />}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 21,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  code: {
    color: C.text,
    fontSize: 14,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.6,
  },
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  sheet: {
    backgroundColor: C.backgroundElevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderColor: C.border,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.border,
    marginTop: 10,
    marginBottom: 8,
  },
  title: {
    color: C.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 6,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 15,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  optionPressed: {
    backgroundColor: C.surfacePressed,
  },
  optionText: {
    color: C.text,
    fontSize: 16,
  },
  optionTextActive: {
    color: C.accent,
    fontWeight: "700",
  },
});
