import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
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

export const options = {
  headerShown: false,
};

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const togglePasswordVisibility = () => setShowPassword(!showPassword);

  const handleLogin = async () => {
    try {
      const response = await fetch(
        "https://night-life-api.elevator-rand.workers.dev/api/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        },
      );
      const data = await response.json();
      if (response.ok) {
        await AsyncStorage.setItem("token", data.token);
        await AsyncStorage.setItem("userId", data.userId.toString());
        await AsyncStorage.setItem("userType", data.userType.toString());
        router.replace("/protected/home");
      } else {
        setError(data.error || "Login failed");
      }
    } catch (err) {
      setError("Network error");
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <LinearGradient
        colors={["#BB86FC", "#6200EE", "#8B008B", "#1E1E1E"]}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView style={styles.container}>
          <View style={styles.formContainer}>
            <Text style={styles.headerTitle}>Welcome Back</Text>
            <Text style={styles.headerBody}>Log in to continue exploring!</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#8E8E93"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </View>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#8E8E93"
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
                  color="#8E8E93"
                />
              </TouchableOpacity>
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <TouchableOpacity style={styles.button} onPress={handleLogin}>
              <Text style={styles.buttonText}>Log In</Text>
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
                <Text style={styles.linkText}>Need an account? Register</Text>
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
    color: "#E0E0E0",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
    marginBottom: 30,
  },
  inputContainer: {
    backgroundColor: "#1E1E1E",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#333333",
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
    color: "#FF4444",
    marginBottom: 10,
  },
  button: {
    backgroundColor: "#BB86FC",
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
    borderColor: "#333333",
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
    color: "#FF69B4",
    marginTop: 15,
    textDecorationLine: "underline",
  },
});
