import { MaterialIcons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../lib/api";
import { useI18n } from "../lib/i18n";
import { makeStyles, useTheme } from "../lib/theme-context";

// Same list as REPORT_REASONS in the worker
export const REPORT_REASONS = ["fake_account", "harassment", "sexual_content", "other"];

/**
 * Report a user, post or venue: pick a reason, optionally add details, send.
 * target: { type: "user" | "post" | "venue", id, name }  (null = closed)
 */
export default function ReportSheet({ target, onClose }) {
  const { colors: COLORS } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState(null);
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  const close = () => {
    onClose();
    // Reset after the fade-out
    setTimeout(() => {
      setReason(null);
      setDetails("");
      setSent(false);
      setError(null);
    }, 250);
  };

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      await api("/api/reports", {
        method: "POST",
        body: {
          target_type: target.type,
          target_id: target.id,
          reason,
          details: details.trim() || undefined,
        },
      });
      setSent(true);
    } catch (err) {
      setError(err.status === 0 ? t("common.cantConnect") : err.message || t("report.error"));
    } finally {
      setSending(false);
    }
  };

  const title =
    target?.type === "post"
      ? t("report.titlePost")
      : target?.type === "venue"
        ? t("report.titleVenue", { name: target?.name ?? "" })
        : t("report.titleUser", { name: target?.name ?? "" });

  return (
    <Modal visible={!!target} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.handle} />

            {sent ? (
              <View style={styles.done}>
                <View style={styles.doneIcon}>
                  <MaterialIcons name="check" size={34} color={COLORS.onAccent} />
                </View>
                <Text style={styles.doneTitle}>{t("report.thanks")}</Text>
                <Text style={styles.doneText}>{t("report.thanksText")}</Text>
                <Pressable
                  onPress={close}
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
                  accessibilityRole="button"
                >
                  <Text style={styles.primaryText}>{t("common.done")}</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Text style={styles.title} numberOfLines={1}>
                  {title}
                </Text>
                <Text style={styles.subtitle}>{t("report.why")}</Text>

                <ScrollView
                  style={styles.list}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  {REPORT_REASONS.map((key) => {
                    const active = key === reason;
                    return (
                      <Pressable
                        key={key}
                        onPress={() => setReason(key)}
                        style={({ pressed }) => [
                          styles.reason,
                          active && styles.reasonActive,
                          pressed && styles.reasonPressed,
                        ]}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                      >
                        <Text style={[styles.reasonText, active && styles.reasonTextActive]}>
                          {t(`report.reasons.${key}`)}
                        </Text>
                        <MaterialIcons
                          name={active ? "radio-button-checked" : "radio-button-unchecked"}
                          size={22}
                          color={active ? COLORS.accent : COLORS.textSecondary}
                        />
                      </Pressable>
                    );
                  })}

                  {!!reason && (
                    <TextInput
                      style={styles.details}
                      value={details}
                      onChangeText={setDetails}
                      placeholder={t("report.detailsPlaceholder")}
                      placeholderTextColor={COLORS.placeholder}
                      selectionColor={COLORS.accent}
                      multiline
                      maxLength={500}
                    />
                  )}
                </ScrollView>

                {!!error && <Text style={styles.error}>{error}</Text>}

                <Pressable
                  onPress={send}
                  disabled={!reason || sending}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    (!reason || sending) && styles.disabled,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                >
                  {sending ? (
                    <ActivityIndicator color={COLORS.onAccent} />
                  ) : (
                    <Text style={styles.primaryText}>{t("report.send")}</Text>
                  )}
                </Pressable>
                <Text style={styles.anonymous}>{t("report.anonymous")}</Text>
              </>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = makeStyles((COLORS) => ({
  flex: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.55)",
  },
  sheet: {
    maxHeight: "88%",
    backgroundColor: COLORS.backgroundElevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    marginTop: 10,
    marginBottom: 12,
  },
  title: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 12,
  },
  list: {
    flexGrow: 0,
  },
  reason: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 6,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  reasonActive: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentSoft,
  },
  reasonPressed: {
    opacity: 0.7,
  },
  reasonText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
  },
  reasonTextActive: {
    fontWeight: "700",
  },
  details: {
    minHeight: 80,
    maxHeight: 140,
    marginTop: 6,
    marginBottom: 6,
    padding: 12,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    fontSize: 15,
    textAlignVertical: "top",
  },
  error: {
    color: COLORS.danger,
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
  },
  primaryButton: {
    alignSelf: "stretch",
    height: 50,
    borderRadius: 14,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  primaryText: {
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
  anonymous: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: "center",
    marginTop: 10,
  },
  done: {
    alignItems: "center",
    paddingVertical: 12,
  },
  doneIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.success,
    alignItems: "center",
    justifyContent: "center",
  },
  doneTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "800",
    marginTop: 14,
  },
  doneText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 6,
    paddingHorizontal: 12,
  },
}));
