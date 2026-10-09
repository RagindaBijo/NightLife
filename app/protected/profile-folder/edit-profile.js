import { MaterialIcons } from "@expo/vector-icons";
import { File } from "expo-file-system";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import PreferencePicker from "../../../components/PreferencePicker";
import { API_URL, api, getSession } from "../../../lib/api";
import { MIN_PREFERENCES, MUSIC_GENRES, PLACE_TYPES, musicLabel, placeLabel } from "../../../lib/preferences";
import { translate, useI18n } from "../../../lib/i18n";
import { makeStyles, useTheme } from "../../../lib/theme-context";

const SHEET_CLOSE_MS = 400; // the photo menu's fade-out, plus a little margin

function Field({ label, prefix, multiline, ...inputProps }) {
  const { colors: COLORS } = useTheme();
  const styles = useStyles();
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.field, focused && styles.fieldFocused]}>
      <Text style={[styles.fieldLabel, focused && styles.fieldLabelFocused]}>
        {label}
      </Text>
      <View style={styles.fieldRow}>
        {prefix && <Text style={styles.fieldPrefix}>{prefix}</Text>}
        <TextInput
          style={[styles.fieldInput, multiline && styles.fieldInputMultiline]}
          placeholderTextColor={COLORS.placeholder}
          selectionColor={COLORS.accent}
          multiline={multiline}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...inputProps}
        />
      </View>
    </View>
  );
}

function SheetOption({ icon, label, color, onPress }) {
  const { colors: COLORS } = useTheme();
  const styles = useStyles();
  const tint = color ?? COLORS.text;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.sheetOption, pressed && styles.sheetOptionPressed]}
      accessibilityRole="button"
    >
      <MaterialIcons name={icon} size={24} color={tint} />
      <Text style={[styles.sheetOptionText, { color: tint }]}>{label}</Text>
    </Pressable>
  );
}

export default function EditProfile() {
  const { colors: COLORS } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  const navigation = useNavigation();
  const router = useRouter();
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    username: "",
    bio_text: "",
    profile_photo: "", // full URL, or "" when there is no photo
    music: [], // music style keys (min 3)
    venue_types: [], // kinds of places (min 3)
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [sheetY] = useState(() => new Animated.Value(300));
  const imageDomain = `${API_URL}/images`;

  const setField = (key) => (text) => setForm((prev) => ({ ...prev, [key]: text }));

  // Bottom sheet slide-up
  useEffect(() => {
    if (showPhotoModal) {
      Animated.spring(sheetY, {
        toValue: 0,
        useNativeDriver: true,
        speed: 20,
        bounciness: 4,
      }).start();
    } else {
      sheetY.setValue(300);
    }
  }, [showPhotoModal, sheetY]);

  const fetchUser = useCallback(
    () =>
      getSession()
        .then((session) => {
          if (!session) throw new Error(translate("api.loginAgain"));
          return api(`/api/user/${session.userId}`);
        })
        .then((data) => {
          setForm({
            first_name: data.first_name || "",
            last_name: data.last_name || "",
            username: data.username || "",
            bio_text: data.bio_text || "",
            // profile_photo is a full URL from the API
            profile_photo: data.profile_photo || "",
            music: data.music ?? [],
            venue_types: data.venue_types ?? [],
          });
          setError(null);
        })
        .catch((err) => {
          console.error("Error fetching user profile:", err.message);
          setError(
            err.status === 0
              ? translate("common.cantConnect")
              : translate("profile.loadError"),
          );
        })
        .finally(() => setLoading(false)),
    [],
  );

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const retryFetch = () => {
    setLoading(true);
    setError(null);
    fetchUser();
  };

  const uploadImage = async (asset) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", new File(asset.uri));

      const { url } = await api("/api/upload-image", {
        method: "POST",
        body: formData,
      });

      // Delete old profile photo if exists (a failed delete doesn't block the upload)
      const oldKey = form.profile_photo.replace(`${imageDomain}/`, "");
      if (oldKey) {
        try {
          await api(`/api/delete-image/${oldKey}`, { method: "DELETE" });
        } catch (err) {
          console.warn("Delete old photo failed:", err.message);
        }
      }
      setForm((prev) => ({ ...prev, profile_photo: url }));
    } catch (err) {
      console.error("Upload error:", err.message);
      Alert.alert(
        t("common.uploadFailed"),
        err.status === 0
          ? t("common.uploadNetworkError")
          : err.message || t("common.uploadFailedMessage"),
      );
    } finally {
      setUploading(false);
    }
  };

  // The photo menu must be fully closed first: a picker opened while it's still
  // fading out is silently ignored by the phone
  const closePhotoMenu = () => {
    setShowPhotoModal(false);
    return new Promise((resolve) => setTimeout(resolve, SHEET_CLOSE_MS));
  };

  // The system photo picker needs no permission: the app only gets the photo the user picks
  const pickImage = async () => {
    await closePhotoMenu();
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      await uploadImage(result.assets[0]);
    }
  };

  const takePhoto = async () => {
    await closePhotoMenu();
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert(
        t("common.permissionDenied"),
        t("common.cameraPermission"),
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      await uploadImage(result.assets[0]);
    }
  };

  const handleRemovePhoto = () => {
    // Delete old profile photo if exists
    const oldKey = form.profile_photo.replace(`${imageDomain}/`, "");
    if (oldKey) {
      api(`/api/delete-image/${oldKey}`, { method: "DELETE" }).catch((err) =>
        console.warn("Delete photo failed:", err.message),
      );
    }
    setForm((prev) => ({ ...prev, profile_photo: "" }));
    setShowPhotoModal(false);
  };

  const handleSave = useCallback(async () => {
    if (saving || uploading) return;
    // At least 3 of each (part of a complete profile)
    if (form.music.length < MIN_PREFERENCES || form.venue_types.length < MIN_PREFERENCES) {
      Alert.alert(t("preferences.needMoreTitle"), t("preferences.needMoreText", { min: MIN_PREFERENCES }));
      return;
    }
    setSaving(true);
    try {
      const session = await getSession();
      if (!session) {
        Alert.alert(t("common.error"), t("api.loginAgain"));
        return;
      }

      await api(`/api/user/${session.userId}`, {
        method: "PUT",
        body: {
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          username: form.username.trim(),
          bio_text: form.bio_text.trim(),
          profile_photo: form.profile_photo.replace(`${imageDomain}/`, ""),
          music: form.music,
          venue_types: form.venue_types,
        },
      });

      // The profile screen refreshes itself when it comes back into view
      router.back();
    } catch (err) {
      console.error("Update profile failed:", err.message);
      Alert.alert(
        t("common.saveError"),
        err.status === 0
          ? t("editProfile.saveNetworkError")
          : err.code === "username_taken"
            ? t("auth.usernameTaken")
            : err.code === "invalid_username"
              ? t("auth.usernameRules")
              : err.code === "preferences_count"
                ? t("preferences.needMoreText", { min: MIN_PREFERENCES })
                : err.message || t("editProfile.saveFailed"),
      );
    } finally {
      setSaving(false);
    }
  }, [form, saving, uploading, imageDomain, router, t]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerStyle: { backgroundColor: COLORS.background },
      headerShadowVisible: false,
      headerTitleStyle: { fontWeight: "700" },
      headerLeft: () => (
        <Pressable onPress={() => router.back()} hitSlop={10} disabled={saving}>
          <Text style={styles.headerCancel}>{t("common.cancel")}</Text>
        </Pressable>
      ),
      headerRight: () =>
        saving ? (
          <ActivityIndicator color={COLORS.accent} />
        ) : (
          <Pressable onPress={handleSave} hitSlop={10} disabled={loading || uploading}>
            <Text
              style={[
                styles.headerDone,
                (loading || uploading) && styles.headerDoneDisabled,
              ]}
            >
              {t("common.done")}
            </Text>
          </Pressable>
        ),
    });
  }, [navigation, router, handleSave, saving, loading, uploading, COLORS, styles, t]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <MaterialIcons name="cloud-off" size={48} color={COLORS.textSecondary} />
        <Text style={styles.errorText}>{error}</Text>
        <Pressable
          onPress={retryFetch}
          style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
        >
          <Text style={styles.retryButtonText}>{t("common.tryAgain")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Photo */}
        <Pressable
          onPress={() => setShowPhotoModal(true)}
          disabled={uploading}
          style={styles.photoSection}
          accessibilityRole="button"
          accessibilityLabel={t("editProfile.changePhoto")}
        >
          <LinearGradient
            colors={[COLORS.accent, COLORS.accentPink]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatarRing}
          >
            <View style={styles.avatarInner}>
              {form.profile_photo ? (
                <Image
                  source={{ uri: form.profile_photo }}
                  style={styles.avatar}
                  contentFit="cover"
                  transition={200}
                />
              ) : (
                <MaterialIcons name="person" size={56} color={COLORS.textSecondary} />
              )}
              {uploading && (
                <View style={styles.avatarOverlay}>
                  <ActivityIndicator color={COLORS.onImage} />
                </View>
              )}
            </View>
          </LinearGradient>
          <View style={styles.cameraBadge}>
            <MaterialIcons name="photo-camera" size={16} color={COLORS.onAccent} />
          </View>
          <Text style={styles.changePhotoText}>
            {uploading ? t("editProfile.uploading") : t("editProfile.editPicture")}
          </Text>
        </Pressable>

        {/* Fields */}
        <View style={styles.row}>
          <View style={styles.rowItem}>
            <Field
              label={t("editProfile.firstName")}
              value={form.first_name}
              onChangeText={setField("first_name")}
              placeholder={t("editProfile.firstName")}
              maxLength={50}
              autoCapitalize="words"
              returnKeyType="next"
            />
          </View>
          <View style={styles.rowItem}>
            <Field
              label={t("editProfile.lastName")}
              value={form.last_name}
              onChangeText={setField("last_name")}
              placeholder={t("editProfile.lastName")}
              maxLength={50}
              autoCapitalize="words"
              returnKeyType="next"
            />
          </View>
        </View>
        <Field
          label={t("editProfile.username")}
          prefix="@"
          value={form.username}
          onChangeText={setField("username")}
          placeholder={t("editProfile.usernamePlaceholder")}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
        />
        <Field
          label={t("editProfile.bio")}
          value={form.bio_text}
          onChangeText={setField("bio_text")}
          placeholder={t("editProfile.bioPlaceholder")}
          maxLength={300}
          multiline
        />

        {/* Taste: shown on Discover; at least 3 of each */}
        <PreferencePicker
          title={t("preferences.musicTitle")}
          hint={t("preferences.musicHint", { min: MIN_PREFERENCES })}
          options={MUSIC_GENRES}
          label={musicLabel}
          selected={form.music}
          onChange={(music) => setForm((prev) => ({ ...prev, music }))}
        />
        <PreferencePicker
          title={t("preferences.placesTitle")}
          hint={t("preferences.placesHint", { min: MIN_PREFERENCES })}
          options={PLACE_TYPES}
          label={placeLabel}
          selected={form.venue_types}
          onChange={(venue_types) => setForm((prev) => ({ ...prev, venue_types }))}
        />
      </ScrollView>

      {/* Photo options */}
      <Modal
        visible={showPhotoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPhotoModal(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setShowPhotoModal(false)}>
          <Animated.View
            style={[styles.sheet, { transform: [{ translateY: sheetY }] }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{t("editProfile.profilePhoto")}</Text>
            <SheetOption icon="photo-library" label={t("editProfile.chooseFromLibrary")} onPress={pickImage} />
            <SheetOption icon="photo-camera" label={t("editProfile.takePhoto")} onPress={takePhoto} />
            {!!form.profile_photo && (
              <SheetOption
                icon="delete-outline"
                label={t("editProfile.removePicture")}
                color={COLORS.danger}
                onPress={handleRemovePhoto}
              />
            )}
            <Pressable
              onPress={() => setShowPhotoModal(false)}
              style={({ pressed }) => [styles.sheetCancel, pressed && styles.sheetOptionPressed]}
            >
              <Text style={styles.sheetCancelText}>{t("common.cancel")}</Text>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((COLORS) => ({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centered: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  pressed: {
    opacity: 0.6,
  },

  // Header
  headerCancel: {
    color: COLORS.text,
    fontSize: 16,
  },
  headerDone: {
    color: COLORS.accent,
    fontSize: 16,
    fontWeight: "700",
  },
  headerDoneDisabled: {
    opacity: 0.4,
  },

  // Photo
  photoSection: {
    alignItems: "center",
    marginTop: 8,
    marginBottom: 28,
  },
  avatarRing: {
    width: 104,
    height: 104,
    borderRadius: 52,
    padding: 3,
  },
  avatarInner: {
    flex: 1,
    borderRadius: 49,
    backgroundColor: COLORS.surface,
    borderWidth: 3,
    borderColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraBadge: {
    position: "absolute",
    top: 74,
    marginLeft: 72,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.accent,
    borderWidth: 3,
    borderColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
  },
  changePhotoText: {
    color: COLORS.accent,
    fontSize: 15,
    fontWeight: "600",
    marginTop: 12,
  },

  // Fields
  row: {
    flexDirection: "row",
    gap: 10,
  },
  rowItem: {
    flex: 1,
  },
  field: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "transparent",
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
    marginBottom: 12,
  },
  fieldFocused: {
    borderColor: COLORS.accent,
  },
  fieldLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  fieldLabelFocused: {
    color: COLORS.accent,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  fieldPrefix: {
    color: COLORS.textSecondary,
    fontSize: 16,
    marginRight: 2,
  },
  fieldInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 16,
    paddingVertical: 6,
  },
  fieldInputMultiline: {
    minHeight: 96,
    textAlignVertical: "top",
  },

  // Error state
  errorText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    textAlign: "center",
    marginTop: 12,
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  retryButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
  },

  // Bottom sheet
  sheetBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.55)",
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 8,
    paddingBottom: 28,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    marginTop: 10,
    marginBottom: 12,
  },
  sheetTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  sheetOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  sheetOptionPressed: {
    backgroundColor: COLORS.surfacePressed,
  },
  sheetOptionText: {
    fontSize: 16,
    marginLeft: 14,
  },
  sheetCancel: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  sheetCancelText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "600",
  },
}));
