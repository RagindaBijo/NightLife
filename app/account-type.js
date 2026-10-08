import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import AuthScreen from "../components/auth/AuthScreen";
import { AUTH_COLORS as C } from "../components/auth/authColors";
import { useI18n } from "../lib/i18n";

export const options = {
  headerShown: false,
};

const TYPES = [
  {
    key: "personal",
    route: "/user-account-add",
    icon: "person",
    gradient: ["#7C3AED", "#A78BFA"],
    titleKey: "auth.personalAccount",
    points: ["personalPoint1", "personalPoint2", "personalPoint3"],
  },
  {
    key: "venue",
    route: "/venue-account-add",
    icon: "storefront",
    gradient: ["#C026D3", "#F472B6"],
    titleKey: "auth.venueAccount",
    points: ["venuePoint1", "venuePoint2", "venuePoint3"],
  },
];

export default function AccountType() {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <AuthScreen showBack>
      <Text style={styles.title}>{t("auth.chooseAccountType")}</Text>
      <Text style={styles.subtitle}>{t("auth.chooseAccountSubtitle")}</Text>

      <View style={styles.cards}>
        {TYPES.map((type) => (
          <Pressable
            key={type.key}
            onPress={() => router.push(type.route)}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            accessibilityRole="button"
          >
            <View style={styles.cardHeader}>
              <LinearGradient colors={type.gradient} style={styles.cardIcon}>
                <MaterialIcons name={type.icon} size={26} color="#FFFFFF" />
              </LinearGradient>
              <View style={styles.cardHeading}>
                <Text style={styles.cardTitle}>{t(type.titleKey)}</Text>
                <Text style={styles.cardSubtitle}>{t(`auth.${type.key}Subtitle`)}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={26} color={C.textSecondary} />
            </View>
            <View style={styles.points}>
              {type.points.map((point) => (
                <View key={point} style={styles.point}>
                  <MaterialIcons name="check" size={16} color={C.accent} />
                  <Text style={styles.pointText}>{t(`auth.${point}`)}</Text>
                </View>
              ))}
            </View>
          </Pressable>
        ))}
      </View>

      <Pressable onPress={() => router.replace("/login")} style={styles.loginLink} hitSlop={8}>
        <Text style={styles.loginText}>
          {t("auth.haveAccount")} <Text style={styles.loginTextStrong}>{t("auth.logIn")}</Text>
        </Text>
      </Pressable>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: C.text,
    fontSize: 30,
    fontWeight: "800",
  },
  subtitle: {
    color: C.textSecondary,
    fontSize: 16,
    marginTop: 8,
  },
  cards: {
    gap: 14,
    marginTop: 28,
  },
  card: {
    padding: 18,
    borderRadius: 22,
    backgroundColor: "rgba(26, 22, 38, 0.85)",
    borderWidth: 1,
    borderColor: C.border,
    gap: 14,
  },
  cardPressed: {
    borderColor: C.accent,
    backgroundColor: C.surfacePressed,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  cardIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  cardHeading: {
    flex: 1,
  },
  cardTitle: {
    color: C.text,
    fontSize: 18,
    fontWeight: "800",
  },
  cardSubtitle: {
    color: C.textSecondary,
    fontSize: 14,
    marginTop: 2,
  },
  points: {
    gap: 8,
  },
  point: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pointText: {
    flex: 1,
    color: C.text,
    fontSize: 14,
  },
  loginLink: {
    alignSelf: "center",
    marginTop: 28,
  },
  loginText: {
    color: C.textSecondary,
    fontSize: 15,
  },
  loginTextStrong: {
    color: C.accent,
    fontWeight: "700",
  },
});
