import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { api, clearSession, getSession } from "../../../lib/api";
import { unregisterPush } from "../../../lib/push";
import { APP_INFO } from "../../../lib/appInfo";
import { LANGUAGES, useI18n } from "../../../lib/i18n";
import { useUserType } from "../../../lib/session-context";
import { makeStyles, useTheme } from "../../../lib/theme-context";

// ── UI pieces ────────────────────────────────────

function Row({ icon, label, onPress, badge, danger, loading, last }) {
  const { colors: COLORS } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress || loading}
      style={({ pressed }) => [styles.row, !last && styles.rowDivider, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityState={{ disabled: !onPress }}
    >
      <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>
        <MaterialIcons name={icon} size={20} color={danger ? COLORS.danger : COLORS.accent} />
      </View>
      <Text
        style={[styles.rowLabel, danger && styles.rowLabelDanger, !onPress && styles.rowLabelMuted]}
      >
        {label}
      </Text>
      {loading ? (
        <ActivityIndicator size="small" color={COLORS.accent} />
      ) : badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : (
        onPress && <MaterialIcons name="chevron-right" size={22} color={COLORS.placeholder} />
      )}
    </Pressable>
  );
}

function Section({ title, children }) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

const THEME_OPTIONS = [
  { key: "light", labelKey: "settings.themeLight", icon: "light-mode" },
  { key: "dark", labelKey: "settings.themeDark", icon: "dark-mode" },
  { key: "system", labelKey: "settings.themeSystem", icon: "brightness-auto" },
];

function ThemePicker() {
  const { colors: COLORS, preference, setPreference } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  return (
    <View style={styles.themeRow} accessibilityRole="radiogroup">
      {THEME_OPTIONS.map((option) => {
        const active = option.key === preference;
        return (
          <Pressable
            key={option.key}
            onPress={() => setPreference(option.key)}
            style={[styles.themeOption, active && styles.themeOptionActive]}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
          >
            <MaterialIcons
              name={option.icon}
              size={22}
              color={active ? COLORS.accent : COLORS.textSecondary}
            />
            <Text style={[styles.themeLabel, active && styles.themeLabelActive]}>
              {t(option.labelKey)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function LanguagePicker() {
  const { colors: COLORS } = useTheme();
  const { t, preference, setPreference } = useI18n();
  const styles = useStyles();
  const options = [{ key: "system", label: t("settings.languageSystem") }, ...LANGUAGES];
  return (
    <View style={styles.sectionCard} accessibilityRole="radiogroup">
      {options.map((option, index) => {
        const active = option.key === preference;
        return (
          <Pressable
            key={option.key}
            onPress={() => setPreference(option.key)}
            style={({ pressed }) => [
              styles.row,
              index < options.length - 1 && styles.rowDivider,
              pressed && styles.rowPressed,
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.rowLabel, active && styles.languageLabelActive]}>
              {option.label}
            </Text>
            {active && <MaterialIcons name="check" size={22} color={COLORS.accent} />}
          </Pressable>
        );
      })}
    </View>
  );
}

function HelpSheet({ visible, onClose, onFeedback }) {
  const { colors: COLORS } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  const [open, setOpen] = useState(null);

  const emailSupport = async () => {
    const url = `mailto:${APP_INFO.supportEmail}?subject=${encodeURIComponent(t("settings.helpSubject", { name: APP_INFO.name }))}`;
    try {
      if (await Linking.canOpenURL(url)) {
        await Linking.openURL(url);
        return;
      }
    } catch (err) {
      console.warn("Couldn't open mail app:", err.message);
    }
    Alert.alert(t("settings.emailUs"), t("settings.reachUsAt", { email: APP_INFO.supportEmail }));
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{t("settings.help")}</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel={t("common.close")}>
              <MaterialIcons name="close" size={24} color={COLORS.textSecondary} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.sheetLabel}>{t("settings.commonQuestions")}</Text>
            <View style={styles.faqCard}>
              {t("settings.faq").map((item, index) => {
                const isOpen = open === index;
                return (
                  <Pressable
                    key={item.question}
                    onPress={() => setOpen(isOpen ? null : index)}
                    style={[styles.faqItem, index > 0 && styles.rowDivider]}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: isOpen }}
                  >
                    <View style={styles.faqQuestionRow}>
                      <Text style={styles.faqQuestion}>{item.question}</Text>
                      <MaterialIcons
                        name={isOpen ? "expand-less" : "expand-more"}
                        size={22}
                        color={COLORS.accent}
                      />
                    </View>
                    {isOpen && <Text style={styles.faqAnswer}>{item.answer}</Text>}
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.sheetLabel}>{t("settings.stillNeedHelp")}</Text>
            <View style={styles.contactRow}>
              <Pressable
                onPress={emailSupport}
                style={({ pressed }) => [styles.contactButton, styles.contactPrimary, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <MaterialIcons name="mail-outline" size={20} color={COLORS.onAccent} />
                <Text style={styles.contactPrimaryText}>{t("settings.emailUs")}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  onClose();
                  onFeedback();
                }}
                style={({ pressed }) => [styles.contactButton, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <MaterialIcons name="rate-review" size={20} color={COLORS.accent} />
                <Text style={styles.contactText}>{t("settings.sendFeedback")}</Text>
              </Pressable>
            </View>
            <Text style={styles.contactHint}>{APP_INFO.supportEmail}</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── Screen ───────────────────────────────────────

export default function Settings() {
  const { colors: COLORS, gradients: GRADIENTS } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  const navigation = useNavigation();
  const router = useRouter();
  const isVenue = useUserType() === "2";
  const [email, setEmail] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hidden, setHidden] = useState(null); // personal accounts: hidden from Discover / search
  const [hiddenSaving, setHiddenSaving] = useState(false);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  // The account's email for the header card
  useEffect(() => {
    getSession()
      .then((session) => (session ? api(`/api/login/${session.userId}`) : null))
      .then((record) => record && setEmail(record.email))
      .catch((err) => console.warn("Couldn't load account email:", err.message));
  }, []);

  // Whether the profile is hidden (personal accounts only)
  useEffect(() => {
    if (isVenue) return;
    getSession()
      .then((session) => (session ? api(`/api/user/${session.userId}`) : null))
      .then((profile) => profile && setHidden(!!profile.is_hidden))
      .catch((err) => console.warn("Couldn't load privacy setting:", err.message));
  }, [isVenue]);

  const toggleHidden = async (value) => {
    setHidden(value);
    setHiddenSaving(true);
    try {
      const session = await getSession();
      await api(`/api/user/${session.userId}`, { method: "PUT", body: { is_hidden: value } });
    } catch (err) {
      setHidden(!value);
      Alert.alert(t("common.saveError"), err.message);
    } finally {
      setHiddenSaving(false);
    }
  };

  const signOut = () =>
    Alert.alert(t("settings.signOutTitle"), t("settings.signOutMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("settings.signOut"),
        style: "destructive",
        onPress: async () => {
          try {
            // Stop push to this phone before the session is gone
            await unregisterPush();
            await clearSession();
            router.replace("/login");
          } catch (err) {
            console.error("Sign out failed:", err);
            Alert.alert(t("settings.signOutError"), t("common.pleaseTryAgain"));
          }
        },
      },
    ]);

  const deleteAccount = () =>
    Alert.alert(
      t("settings.deleteTitle"),
      isVenue ? t("settings.deleteVenueMessage") : t("settings.deleteUserMessage"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("settings.deleteAccount"),
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              const session = await getSession();
              if (!session) {
                router.replace("/login");
                return;
              }
              await api(`/api/user/${session.userId}`, { method: "DELETE" });
              await clearSession();
              router.replace("/login");
              Alert.alert(t("settings.accountDeleted"), t("settings.accountDeletedMessage"));
            } catch (err) {
              console.error("Delete account failed:", err.message);
              Alert.alert(
                t("settings.deleteError"),
                err.status === 0
                  ? `${t("common.networkIssue")} ${t("common.pleaseTryAgain")}`
                  : err.message || t("common.pleaseTryAgain"),
              );
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t("common.goBack")}
          >
            <MaterialIcons name="arrow-back" size={24} color={COLORS.text} />
          </Pressable>
          <Text style={styles.title}>{t("settings.title")}</Text>
        </View>

        {/* Account card */}
        <LinearGradient
          colors={["rgba(167, 139, 250, 0.22)", "rgba(244, 114, 182, 0.12)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.accountCard}
        >
          <LinearGradient colors={GRADIENTS.brand} style={styles.accountAvatar}>
            <MaterialIcons name={isVenue ? "storefront" : "person"} size={28} color={COLORS.onImage} />
          </LinearGradient>
          <View style={styles.accountText}>
            <Text style={styles.accountEmail} numberOfLines={1}>
              {email ?? " "}
            </Text>
            <View style={styles.accountType}>
              <Text style={styles.accountTypeText}>
                {isVenue ? t("settings.venueAccount") : t("settings.personalAccount")}
              </Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("settings.appearance")}</Text>
          <ThemePicker />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("settings.language")}</Text>
          <LanguagePicker />
        </View>

        <Section title={t("settings.account")}>
          <Row
            icon={isVenue ? "storefront" : "person-outline"}
            label={isVenue ? t("settings.manageVenue") : t("settings.editProfile")}
            onPress={() =>
              router.push(
                isVenue
                  ? "/protected/profile-folder/venue-profile"
                  : "/protected/profile-folder/edit-profile",
              )
            }
          />
          <Row
            icon="block"
            label={t("settings.blockedAccounts")}
            onPress={() => router.push("/protected/settings-folder/blocked")}
          />
          <Row icon="notifications-none" label={t("settings.notifications")} badge={t("settings.soon")} />
          <Row icon="lock-outline" label={t("settings.passwordSecurity")} badge={t("settings.soon")} last />
        </Section>

        {!isVenue && hidden !== null && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("settings.privacy")}</Text>
            <View style={[styles.sectionCard, styles.privacyCard]}>
              <View style={[styles.rowIcon, hidden && styles.rowIconActive]}>
                <MaterialIcons
                  name={hidden ? "visibility-off" : "visibility"}
                  size={20}
                  color={hidden ? COLORS.onAccent : COLORS.accent}
                />
              </View>
              <View style={styles.privacyText}>
                <Text style={styles.rowLabel}>{t("settings.hideProfile")}</Text>
                <Text style={styles.privacyHint}>
                  {hidden ? t("settings.hideProfileOn") : t("settings.hideProfileOff")}
                </Text>
              </View>
              {hiddenSaving ? (
                <ActivityIndicator color={COLORS.accent} />
              ) : (
                <Switch
                  value={hidden}
                  onValueChange={toggleHidden}
                  trackColor={{ false: COLORS.border, true: COLORS.accent }}
                  thumbColor="#FFFFFF"
                  accessibilityLabel={t("settings.hideProfile")}
                />
              )}
            </View>
          </View>
        )}

        <Section title={t("settings.support")}>
          <Row icon="help-outline" label={t("settings.help")} onPress={() => setHelpOpen(true)} />
          <Row
            icon="rate-review"
            label={t("settings.sendFeedback")}
            onPress={() => router.push("/protected/settings-folder/feedback")}
            last
          />
        </Section>

        <Section title={t("settings.legal")}>
          <Row
            icon="privacy-tip"
            label={t("settings.privacyPolicy")}
            onPress={() => router.push("/protected/settings-folder/privacy-policy")}
          />
          <Row
            icon="gavel"
            label={t("settings.termsOfUse")}
            onPress={() => router.push("/protected/settings-folder/terms-conditions")}
            last
          />
        </Section>

        <View style={styles.sectionCard}>
          <Row icon="logout" label={t("settings.signOut")} onPress={signOut} last />
        </View>

        <View style={styles.dangerCard}>
          <Text style={styles.dangerTitle}>{t("settings.deleteAccount")}</Text>
          <Text style={styles.dangerText}>
            {t("settings.deleteAccountHint")}
          </Text>
          <Pressable
            onPress={deleteAccount}
            disabled={deleting}
            style={({ pressed }) => [styles.dangerButton, (pressed || deleting) && styles.pressed]}
            accessibilityRole="button"
          >
            {deleting ? (
              <ActivityIndicator color={COLORS.danger} />
            ) : (
              <>
                <MaterialIcons name="delete-forever" size={20} color={COLORS.danger} />
                <Text style={styles.dangerButtonText}>{t("settings.deleteAccount")}</Text>
              </>
            )}
          </Pressable>
        </View>

        <Text style={styles.footer}>
          {APP_INFO.name} · {t("settings.version", { version: APP_INFO.version })}
        </Text>
      </ScrollView>

      <HelpSheet
        visible={helpOpen}
        onClose={() => setHelpOpen(false)}
        onFeedback={() => router.push("/protected/settings-folder/feedback")}
      />
    </View>
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
    gap: 18,
  },
  pressed: {
    opacity: 0.6,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  backButton: {
    width: 36,
    height: 36,
    marginLeft: -6,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "800",
  },

  // Account card
  accountCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  accountAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  accountText: {
    flex: 1,
    gap: 6,
  },
  accountEmail: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
  },
  accountType: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.accentSoft,
    borderRadius: 10,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  accountTypeText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: "700",
  },

  // Sections & rows
  section: {
    gap: 8,
  },
  sectionTitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginLeft: 4,
  },
  themeRow: {
    flexDirection: "row",
    gap: 10,
  },
  themeOption: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "transparent",
    paddingVertical: 14,
  },
  themeOptionActive: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentSoft,
  },
  themeLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
  themeLabelActive: {
    color: COLORS.accent,
    fontWeight: "700",
  },
  languageLabelActive: {
    color: COLORS.accent,
    fontWeight: "700",
  },
  privacyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  privacyText: {
    flex: 1,
    gap: 3,
  },
  privacyHint: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  rowIconActive: {
    backgroundColor: COLORS.accent,
  },
  sectionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  rowPressed: {
    backgroundColor: COLORS.surfacePressed,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  rowIconDanger: {
    backgroundColor: "rgba(248, 113, 113, 0.12)",
  },
  rowLabel: {
    flex: 1,
    color: COLORS.text,
    fontSize: 16,
  },
  rowLabelDanger: {
    color: COLORS.danger,
  },
  rowLabelMuted: {
    color: COLORS.textSecondary,
  },
  badge: {
    backgroundColor: COLORS.surfacePressed,
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  badgeText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },

  // Danger zone
  dangerCard: {
    backgroundColor: "rgba(248, 113, 113, 0.06)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.25)",
    padding: 16,
    gap: 6,
  },
  dangerTitle: {
    color: COLORS.danger,
    fontSize: 16,
    fontWeight: "700",
  },
  dangerText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  dangerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.5)",
    paddingVertical: 12,
  },
  dangerButtonText: {
    color: COLORS.danger,
    fontSize: 15,
    fontWeight: "700",
  },
  footer: {
    color: COLORS.placeholder,
    fontSize: 12,
    textAlign: "center",
  },

  // Help sheet
  sheetBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.55)",
  },
  sheet: {
    maxHeight: "85%",
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 24,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    marginTop: 10,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 4,
  },
  sheetTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "800",
  },
  sheetContent: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  sheetLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 18,
    marginBottom: 10,
  },
  faqCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    overflow: "hidden",
  },
  faqItem: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 8,
  },
  faqQuestionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  faqQuestion: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "600",
  },
  faqAnswer: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  contactRow: {
    flexDirection: "row",
    gap: 10,
  },
  contactButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    paddingVertical: 13,
  },
  contactPrimary: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  contactPrimaryText: {
    color: COLORS.onAccent,
    fontSize: 15,
    fontWeight: "700",
  },
  contactText: {
    color: COLORS.accent,
    fontSize: 15,
    fontWeight: "700",
  },
  contactHint: {
    color: COLORS.placeholder,
    fontSize: 12,
    textAlign: "center",
    marginTop: 10,
  },
}));
