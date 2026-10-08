import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import AuthInput from "../components/auth/AuthInput";
import AuthScreen from "../components/auth/AuthScreen";
import { AUTH_COLORS as C } from "../components/auth/authColors";
import GradientButton from "../components/auth/GradientButton";
import { api, saveSession } from "../lib/api";
import { APP_INFO } from "../lib/appInfo";
import { useI18n } from "../lib/i18n";
import { normalizeEmail } from "../lib/validation";

export const options = {
  headerShown: false,
};

const LOGO = require("../assets/images/logo-glow.png");

// What the app is about (fills the space under the logo)
const HIGHLIGHTS = [
  { icon: "place", key: "highlightVenues" },
  { icon: "event", key: "highlightEvents" },
  { icon: "forum", key: "highlightPeople" },
];

export default function Login() {
  const router = useRouter();
  const { t } = useI18n();
  const passwordRef = useRef(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !loading;

  const handleLogin = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError("");
    try {
      const data = await api("/api/login", {
        method: "POST",
        body: { email: normalizeEmail(email), password },
        auth: false,
      });
      await saveSession(data);
      router.replace("/protected/home");
    } catch (err) {
      setError(
        err.status === 0
          ? t("auth.networkError")
          : err.status === 401
            ? t("auth.invalidCredentials")
            : err.message || t("auth.loginFailed"),
      );
      setLoading(false);
    }
  };

  return (
    <AuthScreen contentStyle={styles.content}>
      {/* Brand */}
      <View style={styles.hero}>
        <Image source={LOGO} style={styles.logo} contentFit="contain" />
        <Text style={styles.appName}>{APP_INFO.name}</Text>
        <Text style={styles.tagline}>{t("auth.tagline")}</Text>
      </View>

      <View style={styles.highlights}>
        {HIGHLIGHTS.map((item) => (
          <View key={item.key} style={styles.highlight}>
            <View style={styles.highlightIcon}>
              <MaterialIcons name={item.icon} size={20} color={C.accent} />
            </View>
            <Text style={styles.highlightText} numberOfLines={2}>
              {t(`auth.${item.key}`)}
            </Text>
          </View>
        ))}
      </View>

      {/* Form */}
      <View style={styles.form}>
        <Text style={styles.formTitle}>{t("auth.welcomeBack")}</Text>
        <AuthInput
          icon="mail-outline"
          placeholder={t("auth.email")}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <AuthInput
          ref={passwordRef}
          icon="lock-outline"
          placeholder={t("auth.password")}
          value={password}
          onChangeText={setPassword}
          secure
          autoCapitalize="none"
          autoComplete="password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={handleLogin}
        />

        {!!error && (
          <View style={styles.errorBox}>
            <MaterialIcons name="error-outline" size={18} color={C.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <GradientButton
          label={t("auth.logIn")}
          onPress={handleLogin}
          disabled={!canSubmit}
          loading={loading}
          style={styles.submit}
        />
      </View>

      {/* Sign up */}
      <View style={styles.footer}>
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t("auth.newHere")}</Text>
          <View style={styles.dividerLine} />
        </View>
        <Pressable
          onPress={() => router.push("/account-type")}
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryButtonText}>{t("auth.createAccount")}</Text>
        </Pressable>
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: "center",
  },
  hero: {
    alignItems: "center",
  },
  logo: {
    width: 120,
    height: 120,
  },
  appName: {
    color: C.text,
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginTop: 4,
  },
  tagline: {
    color: C.textSecondary,
    fontSize: 16,
    textAlign: "center",
    marginTop: 6,
  },
  highlights: {
    flexDirection: "row",
    gap: 10,
    marginTop: 28,
  },
  highlight: {
    flex: 1,
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: 18,
    backgroundColor: "rgba(26, 22, 38, 0.7)",
    borderWidth: 1,
    borderColor: C.border,
  },
  highlightIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.accentSoft,
  },
  highlightText: {
    color: C.text,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  form: {
    gap: 12,
    marginTop: 32,
  },
  formTitle: {
    color: C.text,
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 4,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(248, 113, 113, 0.12)",
  },
  errorText: {
    flex: 1,
    color: C.danger,
    fontSize: 14,
  },
  submit: {
    marginTop: 4,
  },
  footer: {
    marginTop: 28,
    gap: 16,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.border,
  },
  dividerText: {
    color: C.textSecondary,
    fontSize: 13,
  },
  secondaryButton: {
    height: 54,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: C.accent,
    fontSize: 17,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.6,
  },
});
