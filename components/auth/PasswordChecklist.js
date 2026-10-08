import { MaterialIcons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { useI18n } from "../../lib/i18n";
import { PASSWORD_MIN_LENGTH, PASSWORD_RULES } from "../../lib/validation";
import { AUTH_COLORS as C } from "./authColors";

/** Live list of the password rules: green when met, grey while still missing. */
export default function PasswordChecklist({ password }) {
  const { t } = useI18n();
  return (
    <View style={styles.list} accessibilityRole="summary">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password);
        return (
          <View key={rule.key} style={styles.item}>
            <MaterialIcons
              name={met ? "check-circle" : "radio-button-unchecked"}
              size={16}
              color={met ? C.success : C.textSecondary}
            />
            <Text style={[styles.text, met && styles.textMet]}>
              {t(`auth.passwordRules.${rule.key}`, { count: PASSWORD_MIN_LENGTH })}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 14,
    rowGap: 6,
    marginTop: 10,
    marginLeft: 4,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  text: {
    color: C.textSecondary,
    fontSize: 13,
  },
  textMet: {
    color: C.success,
  },
});
