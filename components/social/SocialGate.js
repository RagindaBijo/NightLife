import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { api } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { makeStyles, useTheme } from "../../lib/theme-context";
import { MIN_AGE, birthDateToIso, maskBirthDate } from "../../lib/validation";

/**
 * Shows Discover / Chat only to 18+ personal accounts:
 *  • no date of birth yet (older accounts) → asks for it once
 *  • under 18 → explains that these features are 18+
 *  • otherwise → children
 */
export default function SocialGate({ children }) {
  const { colors: COLORS } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  const [access, setAccess] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(
    () =>
      api("/api/me/social").then(
        (data) => {
          setAccess(data);
          setError(null);
        },
        (err) => setError(err.status === 0 ? t("common.cantConnect") : err.message),
      ),
    [t],
  );

  // Checked again whenever the tab is opened
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!access) {
    return (
      <View style={styles.centered}>
        {error ? (
          <>
            <MaterialIcons name="cloud-off" size={44} color={COLORS.textSecondary} />
            <Text style={styles.text}>{error}</Text>
            <Pressable onPress={load} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
              <Text style={styles.buttonText}>{t("common.tryAgain")}</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator size="large" color={COLORS.accent} />
        )}
      </View>
    );
  }

  if (!access.is_user) {
    return (
      <Notice icon="storefront" title={t("socialGate.venuesTitle")} text={t("socialGate.venuesText")} />
    );
  }
  if (!access.has_birth_date) {
    return <BirthDatePrompt onDone={(result) => setAccess((prev) => ({ ...prev, ...result }))} />;
  }
  if (!access.is_adult) {
    return <Notice icon="lock-outline" title={t("socialGate.adultsTitle")} text={t("socialGate.adultsText")} />;
  }
  return children;
}

function Notice({ icon, title, text }) {
  const { colors: COLORS } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.centered}>
      <View style={styles.iconCircle}>
        <MaterialIcons name={icon} size={34} color={COLORS.accent} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

/** One-time date of birth for accounts created before sign-up asked for it. */
function BirthDatePrompt({ onDone }) {
  const { colors: COLORS } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const iso = birthDateToIso(value);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      onDone(await api("/api/me/birth-date", { method: "PUT", body: { birth_date: iso } }));
    } catch (err) {
      setError(err.code === "invalid_birth_date" ? t("auth.birthDateInvalid") : err.message);
      setSaving(false);
    }
  };

  return (
    <View style={styles.centered}>
      <View style={styles.iconCircle}>
        <MaterialIcons name="cake" size={34} color={COLORS.accent} />
      </View>
      <Text style={styles.title}>{t("socialGate.birthTitle")}</Text>
      <Text style={styles.text}>{t("socialGate.birthText")}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={(text) => setValue(maskBirthDate(text))}
        placeholder={t("auth.birthDatePlaceholder")}
        placeholderTextColor={COLORS.placeholder}
        keyboardType="number-pad"
        maxLength={10}
      />
      {value.length === 10 && !iso && <Text style={styles.error}>{t("auth.birthDateInvalid")}</Text>}
      {!!error && <Text style={styles.error}>{error}</Text>}
      <Pressable
        onPress={save}
        disabled={!iso || saving}
        style={({ pressed }) => [styles.button, styles.primary, (!iso || saving) && styles.disabled, pressed && styles.pressed]}
      >
        {saving ? (
          <ActivityIndicator color={COLORS.onAccent} />
        ) : (
          <Text style={[styles.buttonText, styles.primaryText]}>{t("common.save")}</Text>
        )}
      </Pressable>
      <Text style={styles.hint}>{t("socialGate.birthHint", { age: MIN_AGE })}</Text>
    </View>
  );
}

const useStyles = makeStyles((COLORS) => ({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    backgroundColor: COLORS.background,
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.accentSoft,
  },
  title: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 16,
  },
  text: {
    color: COLORS.textSecondary,
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 8,
  },
  input: {
    alignSelf: "stretch",
    height: 52,
    marginTop: 20,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    fontSize: 17,
    textAlign: "center",
  },
  error: {
    color: COLORS.danger,
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  button: {
    marginTop: 16,
    minWidth: 140,
    height: 46,
    paddingHorizontal: 22,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
  },
  primary: {
    alignSelf: "stretch",
    backgroundColor: COLORS.accent,
  },
  buttonText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "700",
  },
  primaryText: {
    color: COLORS.onAccent,
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
    marginTop: 12,
  },
}));
