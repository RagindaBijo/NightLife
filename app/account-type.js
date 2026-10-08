import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useI18n } from "../lib/i18n";

export const options = {
  headerShown: false,
};

export default function AccountType() {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <LinearGradient
      colors={["#A78BFA", "#5B21B6", "#3B0764", "#1A1626"]}
      style={styles.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.formContainer}>
          <Text style={styles.headerTitle}>{t("auth.chooseAccountType")}</Text>
          <Text style={styles.headerBody}>{t("auth.chooseAccountSubtitle")}</Text>
          <TouchableOpacity
            style={[styles.button, styles.personalButton]}
            onPress={() => router.push("/user-account-add")}
          >
            <Ionicons
              name="person"
              size={28}
              color="#FFFFFF"
              style={styles.buttonIcon}
            />
            <Text style={styles.buttonText}>{t("auth.personalAccount")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.venueButton]}
            onPress={() => router.push("/venue-account-add")}
          >
            <Ionicons
              name="business"
              size={28}
              color="#FFFFFF"
              style={styles.buttonIcon}
            />
            <Text style={styles.buttonText}>{t("auth.venueAccount")}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 10,
  },
  formContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
    marginBottom: 15,
  },
  headerBody: {
    fontSize: 18,
    color: "#DDD8EA",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
    marginBottom: 40,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1A1626",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2E2742",
    padding: 20,
    marginBottom: 20,
    width: "95%",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  personalButton: {
    backgroundColor: "#A78BFA",
  },
  venueButton: {
    backgroundColor: "#F472B6",
  },
  buttonIcon: {
    marginRight: 10,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
});
