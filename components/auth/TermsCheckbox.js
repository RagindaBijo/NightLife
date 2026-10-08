import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useI18n } from "../../lib/i18n";
import { AUTH_COLORS as C } from "./authColors";

/** Required "I agree to the Terms of Use and Privacy Policy" checkbox with links. */
export default function TermsCheckbox({ checked, onChange }) {
  const { t } = useI18n();
  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => onChange(!checked)}
        hitSlop={10}
        style={[styles.box, checked && styles.boxChecked]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={t("auth.acceptTermsLabel")}
      >
        {checked && <MaterialIcons name="check" size={16} color={C.onAccent} />}
      </Pressable>
      <Text style={styles.text} onPress={() => onChange(!checked)}>
        {t("auth.acceptTermsStart")}
        <Text style={styles.link} onPress={() => router.push("/terms")}>
          {t("settings.termsOfUse")}
        </Text>
        {t("auth.acceptTermsMiddle")}
        <Text style={styles.link} onPress={() => router.push("/privacy")}>
          {t("settings.privacyPolicy")}
        </Text>
        {t("auth.acceptTermsEnd")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  box: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: C.textSecondary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  boxChecked: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
  text: {
    flex: 1,
    color: C.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  link: {
    color: C.accent,
    fontWeight: "700",
  },
});
