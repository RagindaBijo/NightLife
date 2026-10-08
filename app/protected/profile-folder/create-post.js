import { MaterialIcons } from "@expo/vector-icons";
import { File } from "expo-file-system";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import CompleteProfileNotice, { missingProfileFields } from "../../../components/CompleteProfileNotice";
import { api, getSession } from "../../../lib/api";
import { translate, useI18n } from "../../../lib/i18n";
import { makeStyles, useTheme } from "../../../lib/theme-context";

const MAX_SUGGESTIONS = 5;

export default function CreatePost() {
  const { colors: COLORS } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  const router = useRouter();
  const scrollRef = useRef(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [caption, setCaption] = useState("");
  const [location, setLocation] = useState("");
  const [selectedVenue, setSelectedVenue] = useState(null); // venue picked from suggestions
  const [venues, setVenues] = useState([]);
  const [locationFocused, setLocationFocused] = useState(false);
  const [captionFocused, setCaptionFocused] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [missing, setMissing] = useState([]); // required profile fields still empty

  // Posting needs a complete profile (photo, names, username)
  useEffect(() => {
    getSession()
      .then((session) => api(`/api/user/${session.userId}`))
      .then((profile) => {
        if (profile.profile_complete === false) setMissing(missingProfileFields(profile));
      })
      .catch(() => {}); // the server checks again when posting
  }, []);

  // Venue names for the location suggestions (a failure just means no suggestions)
  useEffect(() => {
    api("/api/venues").then(
      (data) =>
        setVenues(
          data.map((venue) => ({
            id: String(venue.id),
            title: venue.title || translate("venue.fallbackTitle"),
            address: venue.address || "",
            image: venue.photo_ids[0] || null,
          })),
        ),
      (err) => console.warn("Couldn't load venues for suggestions:", err.message),
    );
  }, []);

  const query = location.trim().toLowerCase();
  const suggestions =
    locationFocused && query && !selectedVenue
      ? venues
          .filter((venue) => venue.title.toLowerCase().includes(query))
          // Names starting with the query first
          .sort(
            (a, b) =>
              a.title.toLowerCase().startsWith(query) === b.title.toLowerCase().startsWith(query)
                ? a.title.localeCompare(b.title)
                : a.title.toLowerCase().startsWith(query)
                  ? -1
                  : 1,
          )
          .slice(0, MAX_SUGGESTIONS)
      : [];

  const handleLocationChange = (text) => {
    setLocation(text);
    // Editing the text after choosing a venue turns it back into free text
    if (selectedVenue) setSelectedVenue(null);
  };

  const chooseVenue = (venue) => {
    setSelectedVenue(venue);
    setLocation(venue.title);
  };

  const clearLocation = () => {
    setSelectedVenue(null);
    setLocation("");
  };

  const pickImage = async () => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert(
        t("common.permissionDenied"),
        t("common.photosPermission"),
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
      Alert.alert(t("createPost.addPhoto"), t("createPost.photoRequired"));
      return;
    }

    setUploading(true);
    try {
      const session = await getSession();
      if (!session) {
        Alert.alert(t("common.error"), t("api.loginAgain"));
        return;
      }

      // Upload image to Cloudflare R2 via /api/upload-image
      const formData = new FormData();
      formData.append("file", new File(selectedImage.uri));

      const { key } = await api("/api/upload-image", {
        method: "POST",
        body: formData,
      });

      // Create post and save photo_id in posts table
      await api("/api/posts", {
        method: "POST",
        body: {
          user_id: parseInt(session.userId), // Send as integer to match backend expectation
          post_text: caption.trim(),
          location_tag: location.trim(),
          photo_id: key,
        },
      });

      // The profile refreshes itself when it comes back into view
      router.back();
    } catch (error) {
      console.error("Create Post Error:", error.message);
      if (error.code === "profile_incomplete") {
        setMissing(["photo", "firstName", "lastName", "username"]);
        return;
      }
      Alert.alert(
        t("createPost.shareError"),
        error.status === 0
          ? t("createPost.networkError")
          : error.message || t("createPost.failed"),
      );
    } finally {
      setUploading(false);
    }
  };

  if (missing.length > 0) return <CompleteProfileNotice missing={missing} />;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Photo */}
        <Pressable
          onPress={pickImage}
          disabled={uploading}
          style={({ pressed }) => [
            styles.photoBox,
            !selectedImage && styles.photoBoxEmpty,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={selectedImage ? t("createPost.changePhoto") : t("createPost.selectPhoto")}
        >
          {selectedImage ? (
            <>
              <Image
                source={{ uri: selectedImage.uri }}
                style={styles.photo}
                contentFit="cover"
                transition={200}
              />
              <View style={styles.changePhotoChip}>
                <MaterialIcons name="photo-library" size={16} color={COLORS.onImage} />
                <Text style={styles.changePhotoText}>{t("createPost.change")}</Text>
              </View>
            </>
          ) : (
            <View style={styles.photoPrompt}>
              <View style={styles.photoIconCircle}>
                <MaterialIcons name="add-photo-alternate" size={36} color={COLORS.accent} />
              </View>
              <Text style={styles.photoPromptTitle}>{t("createPost.addPhoto")}</Text>
              <Text style={styles.photoPromptText}>{t("createPost.tapToChoose")}</Text>
            </View>
          )}
        </Pressable>

        {/* Caption */}
        <View style={[styles.field, captionFocused && styles.fieldFocused]}>
          <TextInput
            style={styles.captionInput}
            placeholder={t("createPost.captionPlaceholder")}
            maxLength={2200}
            placeholderTextColor={COLORS.placeholder}
            selectionColor={COLORS.accent}
            value={caption}
            onChangeText={setCaption}
            multiline
            onFocus={() => setCaptionFocused(true)}
            onBlur={() => setCaptionFocused(false)}
          />
        </View>

        {/* Location with venue suggestions */}
        <View
          style={[
            styles.field,
            styles.locationField,
            locationFocused && styles.fieldFocused,
          ]}
        >
          <MaterialIcons
            name={selectedVenue ? "storefront" : "place"}
            size={22}
            color={selectedVenue ? COLORS.accent : COLORS.textSecondary}
          />
          <TextInput
            style={styles.locationInput}
            placeholder={t("createPost.locationPlaceholder")}
            maxLength={100}
            placeholderTextColor={COLORS.placeholder}
            selectionColor={COLORS.accent}
            value={location}
            onChangeText={handleLocationChange}
            onFocus={() => {
              setLocationFocused(true);
              // Keep the suggestions visible above the keyboard
              setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250);
            }}
            onBlur={() => setLocationFocused(false)}
            autoCorrect={false}
            returnKeyType="done"
          />
          {!!location && (
            <Pressable
              onPress={clearLocation}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t("createPost.clearLocation")}
            >
              <MaterialIcons name="cancel" size={20} color={COLORS.textSecondary} />
            </Pressable>
          )}
        </View>

        {selectedVenue && (
          <Text style={styles.venueHint}>{t("createPost.taggedVenue", { name: selectedVenue.title })}</Text>
        )}

        {suggestions.length > 0 && (
          <View style={styles.suggestions}>
            {suggestions.map((venue, index) => (
              <Pressable
                key={venue.id}
                onPress={() => chooseVenue(venue)}
                style={({ pressed }) => [
                  styles.suggestion,
                  index > 0 && styles.suggestionDivider,
                  pressed && styles.suggestionPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={t("createPost.tagVenue", { name: venue.title })}
              >
                {venue.image ? (
                  <Image source={{ uri: venue.image }} style={styles.suggestionImage} contentFit="cover" />
                ) : (
                  <View style={[styles.suggestionImage, styles.suggestionImagePlaceholder]}>
                    <MaterialIcons name="storefront" size={18} color={COLORS.textSecondary} />
                  </View>
                )}
                <View style={styles.suggestionText}>
                  <Text style={styles.suggestionTitle} numberOfLines={1}>
                    {venue.title}
                  </Text>
                  {!!venue.address && (
                    <Text style={styles.suggestionAddress} numberOfLines={1}>
                      {venue.address}
                    </Text>
                  )}
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Share */}
      <View style={styles.footer}>
        <Pressable
          onPress={createPost}
          disabled={uploading || !selectedImage}
          style={({ pressed }) => [
            styles.shareButton,
            (uploading || !selectedImage) && styles.shareButtonDisabled,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
        >
          {uploading ? (
            <ActivityIndicator color={COLORS.text} />
          ) : (
            <Text style={styles.shareButtonText}>{t("createPost.share")}</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((COLORS) => ({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  pressed: {
    opacity: 0.7,
  },

  // Photo
  photoBox: {
    width: "100%",
    aspectRatio: 4 / 5,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: COLORS.surface,
    marginBottom: 16,
  },
  photoBoxEmpty: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: COLORS.border,
  },
  photo: {
    width: "100%",
    height: "100%",
  },
  photoPrompt: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  photoIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(167, 139, 250, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  photoPromptTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "700",
    marginTop: 14,
  },
  photoPromptText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 4,
  },
  changePhotoChip: {
    position: "absolute",
    right: 12,
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  changePhotoText: {
    color: COLORS.onImage,
    fontSize: 13,
    fontWeight: "600",
  },

  // Fields
  field: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "transparent",
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  fieldFocused: {
    borderColor: COLORS.accent,
  },
  captionInput: {
    color: COLORS.text,
    fontSize: 16,
    minHeight: 88,
    paddingVertical: 12,
    textAlignVertical: "top",
  },
  locationField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  locationInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 16,
    paddingVertical: 14,
  },
  venueHint: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: "600",
    marginTop: -4,
    marginBottom: 12,
    marginLeft: 4,
  },

  // Suggestions
  suggestions: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    overflow: "hidden",
    marginTop: -4,
  },
  suggestion: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  suggestionDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  suggestionPressed: {
    backgroundColor: COLORS.surfacePressed,
  },
  suggestionImage: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  suggestionImagePlaceholder: {
    backgroundColor: COLORS.surfacePressed,
    alignItems: "center",
    justifyContent: "center",
  },
  suggestionText: {
    flex: 1,
    marginLeft: 12,
  },
  suggestionTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "600",
  },
  suggestionAddress: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },

  // Share
  footer: {
    padding: 16,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  shareButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  shareButtonDisabled: {
    opacity: 0.4,
  },
  shareButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
  },
}));
