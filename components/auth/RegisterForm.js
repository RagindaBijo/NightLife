import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { api, saveSession } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import {
  EMAIL_RE,
  MIN_AGE,
  USERNAME_RE,
  ageFromIso,
  birthDateToIso,
  isStrongPassword,
  maskBirthDate,
  normalizeEmail,
} from "../../lib/validation";
import AuthInput from "./AuthInput";
import AuthScreen from "./AuthScreen";
import { AUTH_COLORS as C } from "./authColors";
import GradientButton from "./GradientButton";
import PasswordChecklist from "./PasswordChecklist";
import TermsCheckbox from "./TermsCheckbox";

// Server error codes → which field shows them and the translated text
const SERVER_ERRORS = {
  email_taken: { field: "email", key: "auth.emailTaken" },
  invalid_email: { field: "email", key: "auth.invalidEmail" },
  username_taken: { field: "username", key: "auth.usernameTaken" },
  invalid_username: { field: "username", key: "auth.usernameRules" },
  weak_password: { field: "password", key: "auth.weakPassword" },
  terms_required: { field: "general", key: "auth.termsRequired" },
  missing_fields: { field: "general", key: "auth.allFieldsRequired" },
  invalid_birth_date: { field: "birthDate", key: "auth.birthDateInvalid" },
  too_young: { field: "birthDate", key: "auth.tooYoung" },
};

/**
 * One-step sign-up for both account types.
 * accountType: 1 = personal (username, first and last name), 2 = venue (venue name, username)
 */
export default function RegisterForm({ accountType }) {
  const router = useRouter();
  const { t } = useI18n();
  const isVenue = accountType === 2;
  const usernameRef = useRef(null);
  const firstNameRef = useRef(null);
  const lastNameRef = useRef(null);
  const birthDateRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);

  const [form, setForm] = useState({
    title: "",
    username: "",
    firstName: "",
    lastName: "",
    birthDate: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [touched, setTouched] = useState({});
  const [availability, setAvailability] = useState({ value: null, available: null });
  const [serverErrors, setServerErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const setField = (name) => (value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setServerErrors((prev) => ({ ...prev, [name]: undefined, general: undefined }));
  };
  const touch = (name) => () => setTouched((prev) => ({ ...prev, [name]: true }));

  // Ask the server whether the username is free, shortly after typing stops
  const username = form.username.trim();
  const usernameValid = USERNAME_RE.test(username);
  useEffect(() => {
    if (!usernameValid) return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      api(`/api/username-available?username=${encodeURIComponent(username)}`, { auth: false })
        .then((result) => !cancelled && setAvailability({ value: username, available: result.available }))
        .catch(() => !cancelled && setAvailability({ value: username, available: null }));
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [username, usernameValid]);

  // ── Field states ──

  let usernameStatus;
  let usernameMessage = t("auth.usernameRules");
  if (serverErrors.username) {
    usernameStatus = "error";
    usernameMessage = serverErrors.username;
  } else if (username && !usernameValid) {
    usernameStatus = touched.username || username.length >= 3 ? "error" : undefined;
  } else if (usernameValid) {
    if (availability.value !== username) {
      usernameStatus = "checking";
      usernameMessage = t("auth.usernameChecking");
    } else if (availability.available === false) {
      usernameStatus = "error";
      usernameMessage = t("auth.usernameTaken");
    } else if (availability.available) {
      usernameStatus = "ok";
      usernameMessage = t("auth.usernameAvailable");
    }
  }

  const email = normalizeEmail(form.email);
  const emailValid = EMAIL_RE.test(email);
  const emailError =
    serverErrors.email ?? (touched.email && form.email && !emailValid ? t("auth.invalidEmail") : null);

  const passwordStrong = isStrongPassword(form.password);
  const confirmMatches = form.confirm.length > 0 && form.confirm === form.password;
  const confirmError =
    form.confirm.length > 0 && !confirmMatches && (touched.confirm || form.confirm.length >= form.password.length)
      ? t("auth.passwordsDontMatch")
      : null;

  // Date of birth (personal accounts): DD.MM.YYYY, at least MIN_AGE years old
  const birthIso = birthDateToIso(form.birthDate);
  const birthComplete = form.birthDate.length === 10;
  const tooYoung = birthIso !== null && ageFromIso(birthIso) < MIN_AGE;
  const birthInvalid = birthComplete && (birthIso === null || ageFromIso(birthIso) > 120);
  const birthDateError =
    serverErrors.birthDate ??
    (birthInvalid
      ? t("auth.birthDateInvalid")
      : tooYoung
        ? t("auth.tooYoung", { age: MIN_AGE })
        : touched.birthDate && form.birthDate && !birthComplete
          ? t("auth.birthDateInvalid")
          : null);
  const birthDateValid = isVenue || (birthIso !== null && !tooYoung && !birthInvalid);

  const namesFilled = isVenue
    ? form.title.trim().length > 0
    : form.firstName.trim().length > 0 && form.lastName.trim().length > 0;

  const canSubmit =
    namesFilled &&
    birthDateValid &&
    usernameValid &&
    availability.value === username &&
    availability.available !== false &&
    emailValid &&
    passwordStrong &&
    confirmMatches &&
    acceptedTerms &&
    !loading;

  // ── Submit ──

  const handleRegister = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setServerErrors({});
    try {
      const data = await api("/api/register", {
        method: "POST",
        auth: false,
        body: {
          user_type: accountType,
          email,
          password: form.password,
          username,
          accepted_terms: true,
          ...(isVenue
            ? { title: form.title.trim() }
            : {
                first_name: form.firstName.trim(),
                last_name: form.lastName.trim(),
                birth_date: birthIso,
              }),
        },
      });
      await saveSession(data);
      router.replace("/protected/home");
    } catch (err) {
      const known = SERVER_ERRORS[err.code];
      setServerErrors(
        known
          ? { [known.field]: t(known.key, { age: MIN_AGE }) }
          : {
              general:
                err.status === 0 ? t("auth.networkError") : err.message || t("auth.registrationFailed"),
            },
      );
      setLoading(false);
    }
  };

  return (
    <AuthScreen showBack>
      <View style={styles.header}>
        <LinearGradient
          colors={isVenue ? ["#C026D3", "#F472B6"] : ["#7C3AED", "#A78BFA"]}
          style={styles.headerIcon}
        >
          <MaterialIcons name={isVenue ? "storefront" : "person"} size={24} color="#FFFFFF" />
        </LinearGradient>
        <Text style={styles.title}>
          {t(isVenue ? "auth.createVenueAccount" : "auth.createUserAccount")}
        </Text>
        <Text style={styles.subtitle}>
          {t(isVenue ? "auth.createVenueSubtitle" : "auth.createUserSubtitle")}
        </Text>
      </View>

      {/* Profile */}
      <Text style={styles.sectionLabel}>{t("auth.sectionProfile")}</Text>
      <View style={styles.fields}>
        {isVenue && (
          <AuthInput
            icon="storefront"
            placeholder={t("auth.venueName")}
            value={form.title}
            onChangeText={setField("title")}
            autoCapitalize="words"
            maxLength={80}
            returnKeyType="next"
            onSubmitEditing={() => usernameRef.current?.focus()}
          />
        )}
        <AuthInput
          ref={usernameRef}
          icon="alternate-email"
          placeholder={t("auth.username")}
          value={form.username}
          onChangeText={(value) => setField("username")(value.replace(/\s/g, ""))}
          onBlur={touch("username")}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={30}
          status={usernameStatus}
          message={usernameMessage}
          returnKeyType="next"
          onSubmitEditing={() => (isVenue ? emailRef : firstNameRef).current?.focus()}
        />
        {!isVenue && (
          <View style={styles.row}>
            <AuthInput
              ref={firstNameRef}
              style={styles.rowItem}
              icon="badge"
              placeholder={t("auth.firstName")}
              value={form.firstName}
              onChangeText={setField("firstName")}
              autoCapitalize="words"
              autoComplete="given-name"
              maxLength={50}
              returnKeyType="next"
              onSubmitEditing={() => lastNameRef.current?.focus()}
            />
            <AuthInput
              ref={lastNameRef}
              style={styles.rowItem}
              icon="badge"
              placeholder={t("auth.lastName")}
              value={form.lastName}
              onChangeText={setField("lastName")}
              autoCapitalize="words"
              autoComplete="family-name"
              maxLength={50}
              returnKeyType="next"
              onSubmitEditing={() => birthDateRef.current?.focus()}
            />
          </View>
        )}
        {!isVenue && (
          <AuthInput
            ref={birthDateRef}
            icon="cake"
            placeholder={t("auth.birthDatePlaceholder")}
            value={form.birthDate}
            onChangeText={(value) => setField("birthDate")(maskBirthDate(value))}
            onBlur={touch("birthDate")}
            keyboardType="number-pad"
            maxLength={10}
            status={birthDateError ? "error" : birthDateValid ? "ok" : undefined}
            message={birthDateError ?? t("auth.birthDateHint")}
            returnKeyType="next"
            onSubmitEditing={() => emailRef.current?.focus()}
          />
        )}
      </View>

      {/* Account */}
      <Text style={styles.sectionLabel}>{t("auth.sectionAccount")}</Text>
      <View style={styles.fields}>
        <AuthInput
          ref={emailRef}
          icon="mail-outline"
          placeholder={t("auth.email")}
          value={form.email}
          onChangeText={setField("email")}
          onBlur={touch("email")}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          maxLength={254}
          status={emailError ? "error" : emailValid ? "ok" : undefined}
          message={emailError}
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <View>
          <AuthInput
            ref={passwordRef}
            icon="lock-outline"
            placeholder={t("auth.password")}
            value={form.password}
            onChangeText={setField("password")}
            secure
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            status={serverErrors.password ? "error" : passwordStrong ? "ok" : undefined}
            message={serverErrors.password}
            returnKeyType="next"
            onSubmitEditing={() => confirmRef.current?.focus()}
          />
          <PasswordChecklist password={form.password} />
        </View>
        <AuthInput
          ref={confirmRef}
          icon="lock-outline"
          placeholder={t("auth.repeatPassword")}
          value={form.confirm}
          onChangeText={setField("confirm")}
          onBlur={touch("confirm")}
          secure
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          status={confirmError ? "error" : confirmMatches ? "ok" : undefined}
          message={confirmError}
          returnKeyType="done"
        />
      </View>

      <View style={styles.terms}>
        <TermsCheckbox checked={acceptedTerms} onChange={setAcceptedTerms} />
      </View>

      {!!serverErrors.general && (
        <View style={styles.errorBox}>
          <MaterialIcons name="error-outline" size={18} color={C.danger} />
          <Text style={styles.errorText}>{serverErrors.general}</Text>
        </View>
      )}

      <GradientButton
        label={t("auth.createAccount")}
        onPress={handleRegister}
        disabled={!canSubmit}
        loading={loading}
        style={styles.submit}
      />
      {!canSubmit && !loading && <Text style={styles.hint}>{t("auth.completeToContinue")}</Text>}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 8,
  },
  headerIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    color: C.text,
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    color: C.textSecondary,
    fontSize: 16,
    marginTop: 6,
  },
  sectionLabel: {
    color: C.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.6,
    marginTop: 24,
    marginBottom: 10,
    marginLeft: 4,
  },
  fields: {
    gap: 12,
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  rowItem: {
    flex: 1,
  },
  terms: {
    marginTop: 24,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginTop: 16,
    backgroundColor: "rgba(248, 113, 113, 0.12)",
  },
  errorText: {
    flex: 1,
    color: C.danger,
    fontSize: 14,
  },
  submit: {
    marginTop: 24,
  },
  hint: {
    color: C.textSecondary,
    fontSize: 13,
    textAlign: "center",
    marginTop: 10,
  },
});
