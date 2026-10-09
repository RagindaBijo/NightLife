import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useI18n } from "../lib/i18n";
import { makeStyles, useTheme } from "../lib/theme-context";

/**
 * Personal accounts need a profile photo, first name, last name and username
 * before they can post, chat or be seen. Shows what's missing and a button to
 * Edit Profile.
 *   missing: ["photo", "firstName", "lastName", "username", "music", "places"] (optional checklist)
 *   compact: banner style (inside the profile) instead of a full screen
 */
export default function CompleteProfileNotice({ missing, compact = false }) {
  const { colors: COLORS } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  const router = useRouter();

  const button = (
    <Pressable
      onPress={() => router.push("/protected/profile-folder/edit-profile")}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      accessibilityRole="button"
    >
      <Text style={styles.buttonText}>{t("completeProfile.button")}</Text>
    </Pressable>
  );

  const checklist = missing?.length > 0 && (
    <View style={styles.list}>
      {missing.map((item) => (
        <View key={item} style={styles.item}>
          <MaterialIcons name="radio-button-unchecked" size={16} color={COLORS.accentPink} />
          <Text style={styles.itemText}>{t(`completeProfile.missing.${item}`)}</Text>
        </View>
      ))}
    </View>
  );

  if (compact) {
    return (
      <View style={styles.banner}>
        <View style={styles.bannerHeader}>
          <MaterialIcons name="visibility-off" size={20} color={COLORS.accentPink} />
          <Text style={styles.bannerTitle}>{t("completeProfile.bannerTitle")}</Text>
        </View>
        <Text style={styles.text}>{t("completeProfile.text")}</Text>
        {checklist}
        {button}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.iconCircle}>
        <MaterialIcons name="person-outline" size={34} color={COLORS.accent} />
      </View>
      <Text style={styles.title}>{t("completeProfile.title")}</Text>
      <Text style={[styles.text, styles.center]}>{t("completeProfile.text")}</Text>
      {checklist}
      {button}
    </View>
  );
}

/** Which of the required profile fields are still empty. */
export function missingProfileFields(profile) {
  return [
    !profile?.profile_photo && "photo",
    !profile?.first_name?.trim() && "firstName",
    !profile?.last_name?.trim() && "lastName",
    !profile?.username?.trim() && "username",
    (profile?.music?.length ?? 0) < 3 && "music",
    (profile?.venue_types?.length ?? 0) < 3 && "places",
  ].filter(Boolean);
}

const useStyles = makeStyles((COLORS) => ({
  screen: {
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
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  center: {
    textAlign: "center",
  },
  list: {
    alignSelf: "stretch",
    gap: 6,
    marginTop: 12,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  itemText: {
    color: COLORS.text,
    fontSize: 14,
  },
  button: {
    alignSelf: "stretch",
    height: 46,
    marginTop: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.accent,
  },
  buttonText: {
    color: COLORS.onAccent,
    fontSize: 15,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.7,
  },
  banner: {
    marginTop: 16,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.accentPink,
    backgroundColor: COLORS.surface,
  },
  bannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bannerTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "800",
  },
}));
