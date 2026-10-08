import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import {
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, saveSession } from "../lib/api";
import { useI18n } from "../lib/i18n";

export const options = {
  headerShown: false,
};

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const { t } = useI18n();

  const togglePasswordVisibility = () => setShowPassword(!showPassword);

  const handleLogin = async () => {
    try {
      const data = await api("/api/login", {
        method: "POST",
        body: { email, password },
        auth: false,
      });
      await saveSession(data);
      router.replace("/protected/home");
    } catch (err) {
      setError(err.status === 0 ? t("auth.networkError") : err.message || t("auth.loginFailed"));
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <LinearGradient
        colors={["#A78BFA", "#5B21B6", "#3B0764", "#1A1626"]}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView style={styles.container}>
          <View style={styles.formContainer}>
            <Text style={styles.headerTitle}>{t("auth.welcomeBack")}</Text>
            <Text style={styles.headerBody}>{t("auth.loginSubtitle")}</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder={t("auth.email")}
                placeholderTextColor="#8C85A3"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </View>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder={t("auth.password")}
                placeholderTextColor="#8C85A3"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={togglePasswordVisibility}
              >
                <Ionicons
                  name={showPassword ? "eye" : "eye-off"}
                  size={24}
                  color="#8C85A3"
                />
              </TouchableOpacity>
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <TouchableOpacity style={styles.button} onPress={handleLogin}>
              <Text style={styles.buttonText}>{t("auth.logIn")}</Text>
            </TouchableOpacity>
            <View style={styles.socialLoginContainer}>
              <TouchableOpacity
                style={[styles.socialButton, { backgroundColor: "#FFFFFF" }]}
              >
                <Ionicons name="logo-google" size={22} color="#000000" />
                <Text style={[styles.socialButtonText, { color: "#000000" }]}>
                  Google
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.socialButton, { backgroundColor: "#000000" }]}
              >
                <Ionicons name="logo-apple" size={22} color="#FFFFFF" />
                <Text style={[styles.socialButtonText, { color: "#FFFFFF" }]}>
                  Apple
                </Text>
              </TouchableOpacity>
            </View>
            <Link href="/account-type" asChild>
              <TouchableOpacity>
                <Text style={styles.linkText}>{t("auth.needAccount")}</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </SafeAreaView>
      </LinearGradient>
    </TouchableWithoutFeedback>
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
    marginBottom: 30,
  },
  inputContainer: {
    backgroundColor: "#1A1626",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2E2742",
    marginBottom: 10,
    paddingHorizontal: 10,
    width: "95%",
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: "#FFFFFF",
  },
  eyeIcon: {
    padding: 10,
  },
  errorText: {
    fontSize: 16,
    color: "#F87171",
    marginBottom: 10,
  },
  button: {
    backgroundColor: "#A78BFA",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    marginTop: 10,
    width: "95%",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  socialLoginContainer: {
    marginTop: 20,
    gap: 10,
    width: "95%",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  socialButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#2E2742",
    flex: 1,
    marginHorizontal: 5,
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 5,
  },
  linkText: {
    fontSize: 16,
    color: "#F472B6",
    marginTop: 15,
    textDecorationLine: "underline",
  },
});
