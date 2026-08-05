import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
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

  const togglePasswordVisibility = () => setShowPassword(!showPassword);
  const toggleRepeatPasswordVisibility = () =>
    setShowRepeatPassword(!showRepeatPassword);

  const handleRegister = async () => {
    if (!email || !password || !repeatPassword || !username || !title) {
      setError("All fields are required");
      return;
    }
    if (password !== repeatPassword) {
      setError("Passwords do not match");
      return;
    }
    try {
      // Replace with your actual Cloudflare Worker URL
      const apiUrl = "https://night-life-api.elevator-rand.workers.dev"; // TODO: Replace with your actual API URL, e.g., https://night-life-api.elevator-rand.workers.dev

      // First API call: POST /api/register with email, password, user_type
      const registerResponse = await fetch(`${apiUrl}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          user_type: 2,
        }),
      });
      const registerData = await registerResponse.json();
      if (!registerResponse.ok) {
        setError(registerData.error || "Registration failed");
        return;
      }

      // Save token, userId, userType
      await AsyncStorage.setItem("token", registerData.token);
      await AsyncStorage.setItem("userId", registerData.userId.toString());
      await AsyncStorage.setItem("userType", registerData.userType.toString());

      // Second API call: PUT /api/venue/:id with username, title
      const userId = registerData.userId;
      const updateResponse = await fetch(`${apiUrl}/api/venue/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${registerData.token}`,
        },
        body: JSON.stringify({
          username,
          title, // Changed from venue_name to title
        }),
      });
      const updateData = await updateResponse.json();
      if (!updateResponse.ok) {
        setError(updateData.error || "Profile update failed");
        return;
      }

      router.replace("/protected/home");
    } catch (err) {
      console.error("Registration error:", err);
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
            <Text style={styles.headerTitle}>Create Venue Account</Text>
            <Text style={styles.headerBody}>
              Enter your venue details to register!
            </Text>
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
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Repeat Password"
                placeholderTextColor="#8E8E93"
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
                  color="#8E8E93"
                />
              </TouchableOpacity>
            </View>
            <View style={styles.gap} />
            <Text style={styles.detailsText}>Details</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Username"
                placeholderTextColor="#8E8E93"
                value={username}
                onChangeText={setUsername}
              />
            </View>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Venue Name"
                placeholderTextColor="#8E8E93"
                value={title}
                onChangeText={setTitle}
              />
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <TouchableOpacity style={styles.button} onPress={handleRegister}>
              <Text style={styles.buttonText}>Register</Text>
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
