import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from "react-native";

export default function CreatePost() {
  const router = useRouter();
  const [selectedImage, setSelectedImage] = useState(null);
  const [caption, setCaption] = useState("");
  const [location, setLocation] = useState("");
  const [uploading, setUploading] = useState(false);
  const [captionInputY, setCaptionInputY] = useState(0);
  const [locationInputY, setLocationInputY] = useState(0);
  const [keyboardPadding, setKeyboardPadding] = useState(0);
  const scrollViewRef = useRef(null);
  const apiUrl = "https://night-life-api.elevator-rand.workers.dev";
  const imageDomain = `${apiUrl}/images`;

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
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setSelectedImage(result.assets[0]);
    }
  };

  const createPost = async () => {
    if (!selectedImage) {
      Alert.alert("Error", "Please select an image.");
      return;
    }

    setUploading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const userId = await AsyncStorage.getItem("userId");
      if (!token || !userId) {
        console.error("Authentication Error: Missing token or userId", {
          token,
          userId,
        });
        Alert.alert("Error", "Authentication required. Please log in again.");
        return;
      }

      // Upload image to Cloudflare R2 via /api/upload-image
      const formData = new FormData();
      formData.append("file", {
        uri: selectedImage.uri,
        type: selectedImage.mimeType || "image/jpeg",
        name: `image.jpeg`, // Consistent with original profile.js
      });

      const uploadResponse = await fetch(`${apiUrl}/api/upload-image`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json().catch(() => ({}));
        console.error("Image Upload Error:", {
          status: uploadResponse.status,
          error: errorData.error || "Unknown error",
          response: errorData,
        });
        Alert.alert(
          "Error",
          errorData.error || "Failed to upload image to R2.",
        );
        return;
      }

      const { key } = await uploadResponse.json();
      console.log(`R2 Image Key: ${key}`); // Verify key format (e.g., users/<userId>/<uuid>.jpeg)

      // Create post and save photo_id in posts table
      const postData = {
        user_id: parseInt(userId), // Send as integer to match backend expectation
        post_text: caption || "",
        location_tag: location || "",
        photo_id: key,
      };
      console.log("Sending Post Data:", postData); // Log data for debugging

      const postResponse = await fetch(`${apiUrl}/api/posts`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(postData),
      });

      const postResponseText = await postResponse.text(); // Get raw response for debugging
      if (!postResponse.ok) {
        let errorData;
        try {
          errorData = JSON.parse(postResponseText);
        } catch {
          errorData = { error: postResponseText || "Unknown server error" };
        }
        console.error("Post Creation Error:", {
          status: postResponse.status,
          error: errorData.error || "Unknown error",
          response: errorData,
          rawResponse: postResponseText,
        });
        Alert.alert("Error", errorData.error || "Failed to create post.");
        return;
      }

      console.log("Post created successfully with photo_id:", key);
      Alert.alert("Success", "Post created successfully!");
      router.push("/protected/profile-folder/profile");
    } catch (error) {
      console.error("Create Post Error:", error.message, error.stack);
      Alert.alert(
        "Error",
        "Failed to create post due to a network or server issue.",
      );
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      "keyboardDidShow",
      (e) => {
        const keyboardHeight = e.endCoordinates.height;
        setKeyboardPadding(keyboardHeight + 10); // Reduced padding
        const targetY =
          captionInputY > 0 && locationInputY > 0
            ? Math.min(captionInputY, locationInputY)
            : captionInputY || locationInputY;
        if (scrollViewRef.current && targetY > 0) {
          scrollViewRef.current.scrollTo({
            y: targetY - keyboardHeight, // Intense scroll to input above keyboard
            animated: true,
          });
        }
      },
    );

    const keyboardDidHideListener = Keyboard.addListener(
      "keyboardDidHide",
      () => {
        setKeyboardPadding(0); // Reset padding
        if (scrollViewRef.current) {
          scrollViewRef.current.scrollTo({ y: 0, animated: true }); // Scroll to top
        }
      },
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, [captionInputY, locationInputY]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.contentContainer,
        { paddingBottom: keyboardPadding },
      ]}
      ref={scrollViewRef}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Create Post</Text>
      {selectedImage && (
        <Image
          source={{ uri: selectedImage.uri }}
          style={styles.previewImage}
          contentFit="contain"
          backgroundColor="#808080"
          onError={(e) =>
            console.log(`Failed to load image:`, e.nativeEvent.error)
          }
          onLoad={() => console.log(`Image loaded: ${selectedImage.uri}`)}
        />
      )}
      <TouchableOpacity style={styles.selectImageButton} onPress={pickImage}>
        <Text style={styles.buttonText}>
          {selectedImage ? "Change Image" : "Select Image"}
        </Text>
      </TouchableOpacity>
      <TextInput
        style={styles.input}
        placeholder="Add Caption"
        placeholderTextColor="#808080"
        value={caption}
        onChangeText={setCaption}
        multiline
        onFocus={() => {
          setCaptionInputY(captionInputY);
        }}
        onLayout={(e) => {
          const { y } = e.nativeEvent.layout;
          setCaptionInputY(y);
        }}
      />
      <TextInput
        style={styles.input}
        placeholder="Location (optional)"
        placeholderTextColor="#808080"
        value={location}
        onChangeText={setLocation}
        onFocus={() => {
          setLocationInputY(locationInputY);
        }}
        onLayout={(e) => {
          const { y } = e.nativeEvent.layout;
          setLocationInputY(y);
        }}
      />
      <TouchableOpacity
        style={[styles.submitButton, uploading && styles.disabledButton]}
        onPress={createPost}
        disabled={uploading}
      >
        <Text style={styles.buttonText}>
          {uploading ? "Creating Post..." : "Create Post"}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  contentContainer: {
    padding: 20,
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 20,
  },
  previewImage: {
    width: 300,
    height: 400,
    borderRadius: 10,
    marginBottom: 20,
  },
  selectImageButton: {
    backgroundColor: "#1E1E1E",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 20,
  },
  input: {
    width: "100%",
    backgroundColor: "#1E1E1E",
    borderRadius: 8,
    padding: 10,
    color: "#FFFFFF",
    fontSize: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#333333",
  },
  submitButton: {
    backgroundColor: "#BB86FC",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    width: "100%",
    alignItems: "center",
  },
  disabledButton: {
    backgroundColor: "#808080",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
});
