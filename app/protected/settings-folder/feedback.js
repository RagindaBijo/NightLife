import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api } from "../../../lib/api";
import { useI18n } from "../../../lib/i18n";
import { makeStyles, useTheme } from "../../../lib/theme-context";

const MAX_LENGTH = 2000;
const MIN_LENGTH = 5;

const CATEGORIES = [
  { key: "bug", labelKey: "feedback.categoryBug", icon: "bug-report" },
  { key: "idea", labelKey: "feedback.categoryIdea", icon: "lightbulb-outline" },
  { key: "venue", labelKey: "feedback.categoryVenue", icon: "storefront" },
  { key: "other", labelKey: "feedback.categoryOther", icon: "chat-bubble-outline" },
];

export default function Feedback() {
  const { colors: COLORS } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  const router = useRouter();
  const [category, setCategory] = useState("idea");
  const [message, setMessage] = useState("");
  const [focused, setFocused] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  const trimmedLength = message.trim().length;
  const canSend = trimmedLength >= MIN_LENGTH && !sending;

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      await api("/api/feedback", {
        method: "POST",
        body: { category, message: message.trim() },
      });
      setSent(true);
    } catch (err) {
      console.error("Send feedback failed:", err.message);
      setError(
        err.status === 0
          ? t("feedback.connectError")
          : err.message || t("feedback.sendError"),
      );
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <View style={styles.centered}>
        <View style={styles.successIcon}>
          <MaterialIcons name="check" size={40} color={COLORS.onAccent} />
        </View>
        <Text style={styles.successTitle}>{t("feedback.thanks")}</Text>
        <Text style={styles.successText}>
          {t("feedback.thanksText")}
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.primaryButton, styles.doneButton, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.primaryButtonText}>{t("common.done")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t("feedback.title")}</Text>
        <Text style={styles.subtitle}>
          {t("feedback.subtitle")}
        </Text>

        <Text style={styles.label}>{t("feedback.category")}</Text>
        <View style={styles.categories}>
          {CATEGORIES.map((item) => {
            const active = item.key === category;
            return (
              <Pressable
                key={item.key}
                onPress={() => setCategory(item.key)}
                style={[styles.category, active && styles.categoryActive]}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
              >
                <MaterialIcons
                  name={item.icon}
                  size={18}
                  color={active ? COLORS.onAccent : COLORS.accent}
                />
                <Text style={[styles.categoryText, active && styles.categoryTextActive]}>
                  {t(item.labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>{t("feedback.message")}</Text>
        <View style={[styles.inputBox, focused && styles.inputBoxFocused]}>
          <TextInput
            style={styles.input}
            value={message}
            onChangeText={setMessage}
            placeholder={t("feedback.placeholder")}
            placeholderTextColor={COLORS.placeholder}
            selectionColor={COLORS.accent}
            multiline
            maxLength={MAX_LENGTH}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />
          <Text style={styles.counter}>
            {message.length} / {MAX_LENGTH}
          </Text>
        </View>

        {!!error && (
          <View style={styles.errorBox}>
            <MaterialIcons name="error-outline" size={18} color={COLORS.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={send}
          disabled={!canSend}
          style={({ pressed }) => [
            styles.primaryButton,
            !canSend && styles.primaryButtonDisabled,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
        >
          {sending ? (
            <ActivityIndicator color={COLORS.onAccent} />
          ) : (
            <>
              <MaterialIcons name="send" size={18} color={COLORS.onAccent} />
              <Text style={styles.primaryButtonText}>{t("settings.sendFeedback")}</Text>
            </>
          )}
        </Pressable>
      </View>
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
    paddingBottom: 24,
  },
  pressed: {
    opacity: 0.7,
  },
  title: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: "800",
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 24,
    marginBottom: 10,
  },
  categories: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  category: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  categoryActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  categoryText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
  },
  categoryTextActive: {
    color: COLORS.onAccent,
  },
  inputBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "transparent",
    padding: 12,
  },
  inputBoxFocused: {
    borderColor: COLORS.accent,
  },
  input: {
    color: COLORS.text,
    fontSize: 16,
    lineHeight: 22,
    minHeight: 160,
    textAlignVertical: "top",
  },
  counter: {
    alignSelf: "flex-end",
    color: COLORS.placeholder,
    fontSize: 12,
    marginTop: 6,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(248, 113, 113, 0.12)",
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  errorText: {
    flex: 1,
    color: COLORS.danger,
    fontSize: 14,
  },
  footer: {
    padding: 16,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    paddingVertical: 14,
  },
  primaryButtonDisabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    color: COLORS.onAccent,
    fontSize: 16,
    fontWeight: "800",
  },
  centered: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.success,
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "800",
    marginTop: 20,
    textAlign: "center",
  },
  successText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 8,
  },
  doneButton: {
    alignSelf: "stretch",
    marginTop: 28,
  },
}));
