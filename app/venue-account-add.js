import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
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

export default function VenueAccountAdd() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [username, setUsername] = useState("");
  const [title, setTitle] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { t } = useI18n();

  const togglePasswordVisibility = () => setShowPassword(!showPassword);
  const toggleRepeatPasswordVisibility = () =>
    setShowRepeatPassword(!showRepeatPassword);

  const handleRegister = async () => {
    if (!email || !password || !repeatPassword || !username || !title) {
      setError(t("auth.allFieldsRequired"));
      return;
    }
    if (password !== repeatPassword) {
      setError(t("auth.passwordsDontMatch"));
      return;
    }
    // First API call: POST /api/register with email, password, user_type
    let registerData;
    try {
      registerData = await api("/api/register", {
        method: "POST",
        body: { email, password, user_type: 2 },
        auth: false,
      });
    } catch (err) {
      console.error("Registration error:", err.message);
      setError(err.status === 0 ? t("auth.networkError") : err.message || t("auth.registrationFailed"));
      return;
    }

    // Save token, userId, userType
    await saveSession(registerData);

    // Second API call: PUT /api/venue/:id with username, title
    try {
      await api(`/api/venue/${registerData.userId}`, {
        method: "PUT",
        body: {
          username,
          title, // Changed from venue_name to title
        },
      });
      router.replace("/protected/home");
    } catch (err) {
      console.error("Registration error:", err.message);
      setError(err.status === 0 ? t("auth.networkError") : err.message || t("auth.profileUpdateFailed"));
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
            <Text style={styles.headerTitle}>{t("auth.createVenueAccount")}</Text>
            <Text style={styles.headerBody}>{t("auth.createVenueSubtitle")}</Text>
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
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder={t("auth.repeatPassword")}
                placeholderTextColor="#8C85A3"
                secureTextEntry={!showRepeatPassword}
                value={repeatPassword}
                onChangeText={setRepeatPassword}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={toggleRepeatPasswordVisibility}
              >
                <Ionicons
                  name={showRepeatPassword ? "eye" : "eye-off"}
                  size={24}
                  color="#8C85A3"
                />
              </TouchableOpacity>
            </View>
            <View style={styles.gap} />
            <Text style={styles.detailsText}>{t("auth.details")}</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder={t("auth.username")}
                placeholderTextColor="#8C85A3"
                value={username}
                onChangeText={setUsername}
              />
            </View>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder={t("auth.venueName")}
                placeholderTextColor="#8C85A3"
                value={title}
                onChangeText={setTitle}
              />
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <TouchableOpacity style={styles.button} onPress={handleRegister}>
              <Text style={styles.buttonText}>{t("auth.register")}</Text>
            </TouchableOpacity>
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
  gap: {
    height: 20, // Gap between input groups
  },
  detailsText: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
    marginBottom: 15,
    alignSelf: "center", // Center the text
  },
});
