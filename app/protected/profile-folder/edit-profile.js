import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useNavigation, useRouter } from "expo-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

export default function EditProfile() {
  const navigation = useNavigation();
  const router = useRouter();
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    username: "",
    bio_text: "",
    profile_photo: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const apiUrl = "https://night-life-api.elevator-rand.workers.dev";
  const imageDomain = `${apiUrl}/images`;

  // Animation setup for bottom sheet slide-up
  const photoSlideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (showPhotoModal) {
      Animated.timing(photoSlideAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    } else {
      photoSlideAnim.setValue(300);
    }
  }, [showPhotoModal]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.headerButtonText}>Cancel</Text>
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity onPress={handleSave}>
          <Text style={styles.headerButtonText}>Done</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, form]);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        const userId = await AsyncStorage.getItem("userId");
        if (!token || !userId) {
          setError("No token or user ID found. Please log in again.");
          setLoading(false);
          return;
        }

        const response = await fetch(`${apiUrl}/api/user/${userId}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.error) {
            setError("User profile not found in database.");
            setLoading(false);
            return;
          }
          setForm({
            first_name: data.first_name || "",
            last_name: data.last_name || "",
            username: data.username || "",
            bio_text: data.bio_text || "",
            profile_photo: data.profile_photo
              ? `${imageDomain}/${data.profile_photo}`
              : "https://picsum.photos/800/600?random=11",
          });
        } else {
          setError(`Failed to fetch user profile: HTTP ${response.status}`);
        }
        setLoading(false);
      } catch (error) {
        console.error("Error fetching user profile:", error);
        setError("Error fetching user profile: Network or server issue.");
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  const pickImage = async () => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert(
        "Permission Denied",
        "Please allow access to your photos to upload an image.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      await uploadImage(result.assets[0]);
    }
    setShowPhotoModal(false);
  };

  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert(
        "Permission Denied",
        "Please allow access to your camera to take a photo.",
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      await uploadImage(result.assets[0]);
    }
    setShowPhotoModal(false);
  };

  const uploadImage = async (asset) => {
    try {
      const token = await AsyncStorage.getItem("token");
      const userId = await AsyncStorage.getItem("userId");
      if (!token || !userId) {
        Alert.alert("Error", "Authentication required. Please log in again.");
        return;
      }

      const formData = new FormData();
      formData.append("file", {
        uri: asset.uri,
        type: asset.mimeType || "image/jpeg",
        name: `image.${asset.uri.split(".").pop()?.toLowerCase() || "jpg"}`,
      });

      const response = await fetch(`${apiUrl}/api/upload-image`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
        body: formData,
      });

      if (response.ok) {
        const { url, key } = await response.json();
        // Delete old profile photo if exists
        const oldKey = form.profile_photo.replace(`${imageDomain}/`, "");
        if (oldKey) {
          await fetch(`${apiUrl}/api/delete-image/${oldKey}`, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
        }
        setForm({ ...form, profile_photo: url });
      } else {
        const errorData = await response.json();
        Alert.alert("Error", errorData.error || "Failed to upload image.");
      }
    } catch (error) {
      console.error("Upload error:", error);
      Alert.alert(
        "Error",
        "Failed to upload image due to a network or server issue.",
      );
    }
  };

  const handleRemovePhoto = () => {
    // Delete old profile photo if exists
    const oldKey = form.profile_photo.replace(`${imageDomain}/`, "");
    if (oldKey) {
      const token = AsyncStorage.getItem("token");
      fetch(`${apiUrl}/api/delete-image/${oldKey}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    }
    setForm({ ...form, profile_photo: "" });
    setShowPhotoModal(false);
  };

  const handleSave = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const userId = await AsyncStorage.getItem("userId");
      if (!token || !userId) {
        Alert.alert("Error", "No token or user ID found. Please log in again.");
        return;
      }

      const response = await fetch(`${apiUrl}/api/user/${userId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          first_name: form.first_name,
          last_name: form.last_name,
          username: form.username,
          bio_text: form.bio_text,
          profile_photo:
            form.profile_photo.replace(`${imageDomain}/`, "") || "",
        }),
      });

      if (response.ok) {
        Alert.alert("Success", "Profile updated successfully!");
        router.back();
      } else {
        const errorData = await response.json();
        Alert.alert("Error", errorData.error || "Failed to update profile.");
      }
    } catch (error) {
      console.error("Update profile failed:", error);
      Alert.alert(
        "Error",
        "Failed to update profile due to a network or server issue.",
      );
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>Loading...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.profileImageContainer}>
        <TouchableOpacity onPress={() => setShowPhotoModal(true)}>
          <Image
            source={{
              uri:
                form.profile_photo || "https://picsum.photos/800/600?random=11",
            }}
            style={styles.profileImage}
            contentFit="cover"
            backgroundColor="#808080"
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowPhotoModal(true)}>
          <Text style={styles.changePhotoText}>Change Profile Photo</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.label}>First Name</Text>
      <TextInput
        style={styles.input}
        value={form.first_name}
        onChangeText={(text) => setForm({ ...form, first_name: text })}
        placeholder="Enter first name"
        placeholderTextColor="#888888"
      />
      <Text style={styles.label}>Last Name</Text>
      <TextInput
        style={styles.input}
        value={form.last_name}
        onChangeText={(text) => setForm({ ...form, last_name: text })}
        placeholder="Enter last name"
        placeholderTextColor="#888888"
      />
      <Text style={styles.label}>Username</Text>
      <TextInput
        style={styles.input}
        value={form.username}
        onChangeText={(text) => setForm({ ...form, username: text })}
        placeholder="Enter username"
        placeholderTextColor="#888888"
      />
      <Text style={styles.label}>Bio</Text>
      <TextInput
        style={[styles.input, styles.bioInput]}
        value={form.bio_text}
        onChangeText={(text) => setForm({ ...form, bio_text: text })}
        placeholder="Enter bio"
        placeholderTextColor="#888888"
        multiline
      />
      <Modal
        visible={showPhotoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPhotoModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowPhotoModal(false)}>
          <View style={styles.bottomSheetContainer}>
            <TouchableWithoutFeedback>
              <Animated.View
                style={[
                  styles.bottomSheetContent,
                  { transform: [{ translateY: photoSlideAnim }] },
                ]}
              >
                <Text style={styles.modalTitle}>Change Profile Photo</Text>
                <TouchableOpacity
                  style={styles.optionButton}
                  onPress={pickImage}
                >
                  <MaterialIcons
                    name="photo-library"
                    size={24}
                    color="#FFFFFF"
                  />
                  <Text style={styles.optionText}>Choose from Library</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.optionButton}
                  onPress={takePhoto}
                >
                  <MaterialIcons name="camera" size={24} color="#FFFFFF" />
                  <Text style={styles.optionText}>Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.optionButton}
                  onPress={handleRemovePhoto}
                >
                  <MaterialIcons name="delete" size={24} color="#FF4444" />
                  <Text style={styles.optionText}>Remove Current Picture</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.optionButton, { borderTopWidth: 0 }]}
                  onPress={() => setShowPhotoModal(false)}
                >
                  <Text style={[styles.optionText, { color: "#FF4444" }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    padding: 20,
    alignItems: "center",
  },
  profileImageContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  changePhotoText: {
    color: "#3897f0",
    fontWeight: "bold",
    marginTop: 10,
  },
  label: {
    fontSize: 16,
    color: "#FFFFFF",
    alignSelf: "flex-start",
    marginBottom: 5,
  },
  input: {
    backgroundColor: "#1E1E1E",
    borderRadius: 8,
    padding: 10,
    color: "#FFFFFF",
    width: "100%",
    marginBottom: 15,
  },
  bioInput: {
    height: 100,
    textAlignVertical: "top",
  },
  headerButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    paddingHorizontal: 10,
  },
  bottomSheetContainer: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  bottomSheetContent: {
    backgroundColor: "#1E1E1E",
    padding: 18,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 20,
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: "#333333",
  },
  optionText: {
    fontSize: 16,
    color: "#FFFFFF",
    marginLeft: 10,
  },
});
