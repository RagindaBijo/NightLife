import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { api, getSession, saveSession } from "../../../lib/api";
import { useI18n } from "../../../lib/i18n";
import { makeStyles, useTheme } from "../../../lib/theme-context";
import { PASSWORD_MIN_LENGTH, PASSWORD_RULES, isStrongPassword } from "../../../lib/validation";

function PasswordField({ label, value, onChangeText, error, autoComplete }) {
  const { colors: COLORS } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  const [hidden, setHidden] = useState(true);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputBox, !!error && styles.inputBoxError]}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={hidden}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={autoComplete}
          placeholderTextColor={COLORS.placeholder}
          selectionColor={COLORS.accent}
        />
        <Pressable
          onPress={() => setHidden((h) => !h)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={hidden ? t("auth.showPassword") : t("auth.hidePassword")}
        >
          <MaterialIcons name={hidden ? "visibility-off" : "visibility"} size={20} color={COLORS.textSecondary} />
        </Pressable>
      </View>
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

/**
 * Change password: needs the current one. Afterwards every other device is
 * logged out; this phone gets a fresh login token and stays signed in.
 */
export default function ChangePassword() {
  const { colors: COLORS } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const strong = isStrongPassword(next);
  const matches = repeat.length > 0 && repeat === next;
  const canSave = current.length > 0 && strong && matches && next !== current && !saving;

  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      const session = await getSession();
      const result = await api(`/api/login/${session.userId}`, {
        method: "PUT",
        body: { password: next, current_password: current },
      });
      // Keep this phone logged in with the new token
      if (result.token) await saveSession({ ...session, token: result.token });
      Alert.alert(t("changePassword.doneTitle"), t("changePassword.doneText"));
      router.back();
    } catch (err) {
      if (err.code === "wrong_password") setErrors({ current: t("changePassword.wrongCurrent") });
      else if (err.code === "weak_password") setErrors({ next: t("auth.weakPassword") });
      else Alert.alert(t("common.saveError"), err.status === 0 ? t("common.cantConnect") : err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>{t("changePassword.intro")}</Text>

        <PasswordField
          label={t("changePassword.current")}
          value={current}
          onChangeText={(value) => {
            setCurrent(value);
            setErrors((e) => ({ ...e, current: undefined }));
          }}
          error={errors.current}
          autoComplete="current-password"
        />
        <PasswordField
          label={t("changePassword.new")}
          value={next}
          onChangeText={(value) => {
            setNext(value);
            setErrors((e) => ({ ...e, next: undefined }));
          }}
          error={errors.next ?? (next && next === current ? t("changePassword.sameAsOld") : null)}
          autoComplete="new-password"
        />
        <View style={styles.rules}>
          {PASSWORD_RULES.map((rule) => {
            const met = rule.test(next);
            return (
              <View key={rule.key} style={styles.rule}>
                <MaterialIcons
                  name={met ? "check-circle" : "radio-button-unchecked"}
                  size={16}
                  color={met ? COLORS.success : COLORS.textSecondary}
                />
                <Text style={[styles.ruleText, met && styles.ruleMet]}>
                  {t(`auth.passwordRules.${rule.key}`, { count: PASSWORD_MIN_LENGTH })}
                </Text>
              </View>
            );
          })}
        </View>
        <PasswordField
          label={t("auth.repeatPassword")}
          value={repeat}
          onChangeText={setRepeat}
          error={repeat.length >= next.length && repeat.length > 0 && !matches ? t("auth.passwordsDontMatch") : null}
          autoComplete="new-password"
        />

        <Pressable
          onPress={save}
          disabled={!canSave}
          style={({ pressed }) => [styles.button, !canSave && styles.disabled, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          {saving ? (
            <ActivityIndicator color={COLORS.onAccent} />
          ) : (
            <Text style={styles.buttonText}>{t("changePassword.save")}</Text>
          )}
        </Pressable>
        <Text style={styles.hint}>{t("changePassword.otherDevices")}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((COLORS) => ({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  intro: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  field: {
    gap: 6,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 4,
  },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 52,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  inputBoxError: {
    borderColor: COLORS.danger,
  },
  input: {
    flex: 1,
    height: "100%",
    color: COLORS.text,
    fontSize: 16,
  },
  error: {
    color: COLORS.danger,
    fontSize: 13,
    marginLeft: 4,
  },
  rules: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 14,
    rowGap: 6,
    marginTop: -6,
    marginLeft: 4,
  },
  rule: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  ruleText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  ruleMet: {
    color: COLORS.success,
  },
  button: {
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.accent,
    marginTop: 8,
  },
  buttonText: {
    color: COLORS.onAccent,
    fontSize: 16,
    fontWeight: "700",
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.7,
  },
  hint: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: "center",
  },
}));
