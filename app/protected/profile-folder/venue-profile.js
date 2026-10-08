import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { File } from "expo-file-system";
import { Image } from "expo-image";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import {
  useFocusEffect,
  useNavigation,
  useRouter,
} from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import ImageGallery from "../../../components/ImageGallery";
import SegmentedTabs from "../../../components/SegmentedTabs";
import SwipeableTabContent from "../../../components/SwipeableTabContent";
import { API_URL, api, getSession } from "../../../lib/api";
import { eventStart, formatEventTime } from "../../../lib/format";
import { upcomingCutoffMs } from "../../../lib/eventTimes";
import { useI18n } from "../../../lib/i18n";
import { takePickedLocation } from "../../../lib/locationPick";
import { VENUE_TYPES, venueTypeLabel } from "../../../lib/venueTypes";
import { makeStyles, useTheme } from "../../../lib/theme-context";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PHOTO_GAP = 8;
const PHOTO_SIZE = (SCREEN_WIDTH - 32 - PHOTO_GAP * 2) / 3;
const COVER_RATIO = 16 / 10;

const SECTIONS = [
  { key: "details", labelKey: "venueProfile.details" },
  { key: "events", labelKey: "venueProfile.events" },
  { key: "photos", labelKey: "venueProfile.photos" },
];

const COORDINATES_RE = /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/;

// ── Opening hours helpers ────────────────────────

const dayOrder = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function groupDays(selected) {
  const sorted = [...new Set(selected)].sort(
    (a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b),
  );
  if (sorted.length === 0) return "";
  const ranges = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (dayOrder.indexOf(sorted[i]) === dayOrder.indexOf(prev) + 1) {
      prev = sorted[i];
    } else {
      ranges.push(start === prev ? start : `${start}-${prev}`);
      start = sorted[i];
      prev = sorted[i];
    }
  }
  ranges.push(start === prev ? start : `${start}-${prev}`);
  return ranges.join(", ");
}

function parseOpenHours(timeStr) {
  const defaultValues = {
    selectedDays: dayOrder,
    startHour: "10",
    startPeriod: "AM",
    endHour: "10",
    endPeriod: "PM",
  };
  if (!timeStr) return defaultValues;

  const [daysStr, timePart] = timeStr.split(": ");
  let selectedDays = [];
  if (daysStr) {
    const rangeStrs = daysStr.split(",").map((s) => s.trim());
    for (const rangeStr of rangeStrs) {
      if (rangeStr.includes("-")) {
        const [startD, endD] = rangeStr.split("-").map((s) => s.trim());
        const startIdx = dayOrder.indexOf(startD);
        const endIdx = dayOrder.indexOf(endD);
        if (startIdx !== -1 && endIdx !== -1 && startIdx <= endIdx) {
          for (let i = startIdx; i <= endIdx; i++) {
            selectedDays.push(dayOrder[i]);
          }
        }
      } else {
        const day = rangeStr.trim();
        if (dayOrder.includes(day)) {
          selectedDays.push(day);
        }
      }
    }
  }
  if (selectedDays.length === 0) selectedDays = defaultValues.selectedDays;

  const timeParts = timePart ? timePart.split("-") : ["10AM", "10PM"];
  const startTimeStr = timeParts[0] || "10AM";
  const endTimeStr = timeParts[1] || "10PM";
  const startPeriod = startTimeStr.slice(-2);
  const startHour = startTimeStr.slice(0, -2).padStart(2, "0");
  const endPeriod = endTimeStr.slice(-2);
  const endHour = endTimeStr.slice(0, -2).padStart(2, "0");
  return { selectedDays, startHour, startPeriod, endHour, endPeriod };
}

// ── Small UI pieces ──────────────────────────────

function Card({ icon, title, action, children }) {
  const { colors: COLORS } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardIcon}>
          <MaterialIcons name={icon} size={18} color={COLORS.accent} />
        </View>
        <Text style={styles.cardTitle}>{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

function SmallButton({ label, icon, onPress, primary, disabled }) {
  const { colors: COLORS } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => [
        styles.smallButton,
        primary && styles.smallButtonPrimary,
        (pressed || disabled) && styles.pressed,
      ]}
      accessibilityRole="button"
    >
      {icon && (
        <MaterialIcons
          name={icon}
          size={16}
          color={primary ? COLORS.onAccent : COLORS.accent}
        />
      )}
      <Text style={[styles.smallButtonText, primary && styles.smallButtonTextPrimary]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Card with a text value that switches to an input with Cancel / Save. */
function EditableCard({ icon, title, value, placeholder, multiline, maxLength, onSave, onStartEdit }) {
  const { colors: COLORS } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  const cardRef = useRef(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const startEditing = () => {
    setDraft(value || "");
    setEditing(true);
    onStartEdit?.(cardRef);
  };

  const save = async () => {
    setSaving(true);
    const ok = await onSave(draft.trim());
    setSaving(false);
    if (ok) setEditing(false);
  };

  return (
    <View ref={cardRef} collapsable={false}>
    <Card
      icon={icon}
      title={title}
      action={!editing && <SmallButton label={t("venueProfile.edit")} icon="edit" onPress={startEditing} />}
    >
      {editing ? (
        <>
          <TextInput
            style={[styles.input, multiline && styles.inputMultiline]}
            value={draft}
            onChangeText={setDraft}
            placeholder={placeholder}
            placeholderTextColor={COLORS.placeholder}
            selectionColor={COLORS.accent}
            multiline={multiline}
            maxLength={maxLength}
            autoFocus
          />
          <View style={styles.editActions}>
            <SmallButton label={t("common.cancel")} onPress={() => setEditing(false)} disabled={saving} />
            {saving ? (
              <ActivityIndicator color={COLORS.accent} style={styles.savingSpinner} />
            ) : (
              <SmallButton label={t("common.save")} icon="check" primary onPress={save} />
            )}
          </View>
        </>
      ) : value ? (
        <Text style={styles.cardText}>{value}</Text>
      ) : (
        <Pressable onPress={startEditing}>
          <Text style={styles.cardPlaceholder}>{placeholder}</Text>
        </Pressable>
      )}
    </Card>
    </View>
  );
}

function VenueTypesCard({ selected, onChange }) {
  const { colors: COLORS } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  const [saving, setSaving] = useState(false);

  const toggleType = async (key) => {
    const next = selected.includes(key)
      ? selected.filter((type) => type !== key)
      : [...selected, key];
    setSaving(true);
    await onChange(next);
    setSaving(false);
  };

  return (
    <Card
      icon="local-bar"
      title={t("venueProfile.venueType")}
      action={saving && <ActivityIndicator size="small" color={COLORS.accent} />}
    >
      <Text style={styles.cardHint}>
        {t("venueProfile.venueTypeHint")}
      </Text>
      <View style={styles.chipWrap}>
        {VENUE_TYPES.map((type) => {
          const active = selected.includes(type.key);
          return (
            <Pressable
              key={type.key}
              onPress={() => toggleType(type.key)}
              disabled={saving}
              style={[styles.chip, active && styles.chipActive]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active }}
            >
              <MaterialCommunityIcons
                name={type.icon}
                size={15}
                color={active ? COLORS.onAccent : COLORS.accent}
              />
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {venueTypeLabel(type.key)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

function HourStepper({ label, hour, period, onChange }) {
  const { colors: COLORS } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  const step = (delta) => onChange(((hour - 1 + delta + 12) % 12) + 1, period);

  return (
    <View style={styles.stepperRow}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepper}>
        <Pressable onPress={() => step(-1)} hitSlop={8} style={styles.stepperButton} accessibilityLabel={t("venueProfile.earlier", { label })}>
          <MaterialIcons name="remove" size={20} color={COLORS.text} />
        </Pressable>
        <Text style={styles.stepperValue}>{hour}</Text>
        <Pressable onPress={() => step(1)} hitSlop={8} style={styles.stepperButton} accessibilityLabel={t("venueProfile.later", { label })}>
          <MaterialIcons name="add" size={20} color={COLORS.text} />
        </Pressable>
      </View>
      <View style={styles.periodToggle}>
        {["AM", "PM"].map((value) => (
          <Pressable
            key={value}
            onPress={() => onChange(hour, value)}
            style={[styles.periodOption, period === value && styles.periodOptionActive]}
          >
            <Text style={[styles.periodText, period === value && styles.periodTextActive]}>
              {value}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** Bottom sheet for editing opening hours. Mounted only while open. */
function HoursSheet({ value, onClose, onSave }) {
  const { colors: COLORS } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  const initial = parseOpenHours(value);
  const [days, setDays] = useState(initial.selectedDays);
  const [start, setStart] = useState({
    hour: Number(initial.startHour) || 10,
    period: initial.startPeriod,
  });
  const [end, setEnd] = useState({
    hour: Number(initial.endHour) || 10,
    period: initial.endPeriod,
  });
  const [saving, setSaving] = useState(false);

  const toggleDay = (day) =>
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));

  const preview = days.length
    ? `${groupDays(days)}: ${start.hour}${start.period}-${end.hour}${end.period}`
    : t("venueProfile.pickOneDay");

  const save = async () => {
    setSaving(true);
    const ok = await onSave(preview);
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{t("venueProfile.openingHours")}</Text>

          <Text style={styles.sheetLabel}>{t("venueProfile.openOn")}</Text>
          <View style={styles.dayRow}>
            {dayOrder.map((day) => {
              const active = days.includes(day);
              return (
                <Pressable
                  key={day}
                  onPress={() => toggleDay(day)}
                  style={[styles.dayChip, active && styles.dayChipActive]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                >
                  <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>
                    {t("days.short")[dayOrder.indexOf(day)]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.presetRow}>
            <SmallButton label={t("venueProfile.everyDay")} onPress={() => setDays(dayOrder)} />
            <SmallButton label={t("venueProfile.weekends")} onPress={() => setDays(["Fri", "Sat", "Sun"])} />
          </View>

          <Text style={styles.sheetLabel}>{t("venueProfile.hours")}</Text>
          <HourStepper
            label={t("venueProfile.opens")}
            hour={start.hour}
            period={start.period}
            onChange={(hour, period) => setStart({ hour, period })}
          />
          <HourStepper
            label={t("venueProfile.closes")}
            hour={end.hour}
            period={end.period}
            onChange={(hour, period) => setEnd({ hour, period })}
          />

          <View style={styles.hoursPreview}>
            <MaterialIcons name="schedule" size={18} color={COLORS.accent} />
            <Text style={styles.hoursPreviewText}>{preview}</Text>
          </View>

          <Pressable
            onPress={save}
            disabled={saving || days.length === 0}
            style={({ pressed }) => [
              styles.sheetSave,
              (saving || days.length === 0) && styles.sheetSaveDisabled,
              pressed && styles.pressed,
            ]}
          >
            {saving ? (
              <ActivityIndicator color={COLORS.onAccent} />
            ) : (
              <Text style={styles.sheetSaveText}>{t("venueProfile.saveHours")}</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ── Screen ───────────────────────────────────────

export default function VenueProfile() {
  const { colors: COLORS } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  const navigation = useNavigation();
  const router = useRouter();
  const scrollRef = useRef(null);
  const contentRef = useRef(null);
  const [venue, setVenue] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [events, setEvents] = useState(null);
  const [section, setSection] = useState("details");
  const [refreshing, setRefreshing] = useState(false);
  const [hoursOpen, setHoursOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [gallery, setGallery] = useState({ visible: false, index: 0 });
  const [visibilitySaving, setVisibilitySaving] = useState(false);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  // ── Data ──

  const fetchVenue = useCallback(
    () =>
      getSession()
        .then((session) => {
          if (!session) throw new Error("No session");
          return api(`/api/venue/${session.userId}`);
        })
        .then((data) => {
          setVenue({
            id: String(data.id),
            title: data.title || "",
            address: data.address || "",
            lat_long: data.lat_long || "",
            open_hours: data.open_hours || "",
            status: data.status || "",
            about: data.about || "",
            photo_ids: data.photo_ids ?? [], // full URLs
            types: data.types ?? [],
            public_status: data.public_status || 0,
            stats: data.stats ?? null, // { views_total, views_30d, favorites }
          });
          setLoadError(null);
        })
        .catch((err) => {
          console.error("Error fetching venue profile:", err.message);
          setLoadError(
            err.status === 0
              ? t("common.cantConnect")
              : t("venueProfile.loadError"),
          );
        }),
    [t],
  );

  const fetchEvents = useCallback(
    (venueId) =>
      api(`/api/events?venue_id=${venueId}&include_past=1`).then(
        (data) =>
          setEvents(
            data.map((event, index) => ({
              id: String(event.id),
              title: event.title || t("event.numbered", { number: index + 1 }),
              time: eventStart(event) || "",
              ended: !!event.starts_at && new Date(event.starts_at).getTime() < upcomingCutoffMs(),
              image: event.photo_id || null,
              goingCount: event.going_count ?? 0,
            })),
          ),
        (err) => {
          console.error("Error fetching events:", err.message);
          setEvents((prev) => prev ?? []);
        },
      ),
    [t],
  );

  // Reload when coming back (e.g. after creating or editing an event)
  useFocusEffect(
    useCallback(() => {
      fetchVenue();
    }, [fetchVenue]),
  );

  useEffect(() => {
    if (venue?.id) fetchEvents(venue.id);
  }, [venue?.id, fetchEvents]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchVenue();
    if (venue?.id) await fetchEvents(venue.id);
    setRefreshing(false);
  };

  /** Saves fields to the API and, on success, into state. Returns true/false. */
  const updateVenue = useCallback(
    (updates) =>
      getSession()
        .then((session) =>
          api(`/api/venue/${session.userId}`, { method: "PUT", body: updates }),
        )
        .then(() => {
          setVenue((prev) => ({ ...prev, ...updates }));
          return true;
        })
        .catch((err) => {
          console.error("Update venue error:", err.message);
          Alert.alert(
            t("common.saveError"),
            err.status === 0 ? t("common.networkIssue") : err.message || t("common.pleaseTryAgain"),
          );
          return false;
        }),
    [t],
  );

  // A location picked on the map screen is handed back when we regain focus
  useFocusEffect(
    useCallback(() => {
      const picked = takePickedLocation();
      if (picked) updateVenue({ lat_long: picked.latLong, address: picked.address });
    }, [updateVenue]),
  );

  // Scroll a card that's being edited to the top, so the keyboard doesn't cover it
  const scrollToCard = useCallback((cardRef) => {
    setTimeout(() => {
      if (!cardRef.current || !contentRef.current) return;
      cardRef.current.measureLayout(contentRef.current, (_x, y) =>
        scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true }),
      );
    }, 350);
  }, []);

  const confirmDeletePhoto = (url) =>
    Alert.alert(
      t("venueProfile.deletePhotoTitle"),
      url === venue.photo_ids[0]
        ? t("venueProfile.deleteCoverMessage")
        : t("venueProfile.deletePhotoMessage"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            // Remove it from the venue first, then delete the file itself
            const ok = await updateVenue({
              photo_ids: venue.photo_ids.filter((photo) => photo !== url),
            });
            if (ok) {
              const key = url.replace(`${API_URL}/images/`, "");
              api(`/api/delete-image/${key}`, { method: "DELETE" }).catch((err) =>
                console.warn("Delete photo file failed:", err.message),
              );
            }
          },
        },
      ],
    );

  // ── Actions ──

  const openMapPicker = () => {
    router.push({
      pathname: "/protected/profile-folder/maps",
      params: { currentLatLong: venue.lat_long || "" },
    });
  };

  const checklist = venue
    ? [
        { label: t("venueProfile.venueName"), done: !!venue.title.trim() },
        {
          label: t("venueProfile.locationOnMap"),
          done: !!venue.address.trim() && COORDINATES_RE.test(venue.lat_long),
        },
        { label: t("venueProfile.openingHours"), done: !!venue.open_hours.trim() },
        { label: t("venueProfile.tonightStatus"), done: !!venue.status.trim() },
        { label: t("venueProfile.about"), done: !!venue.about.trim() },
      ]
    : [];
  const missing = checklist.filter((item) => !item.done);

  const toggleVisibility = async (makePublic) => {
    if (makePublic && missing.length > 0) {
      Alert.alert(
        t("venueProfile.almostThere"),
        t("venueProfile.beforePublic", { items: missing.map((item) => item.label).join(", ") }),
      );
      return;
    }
    setVisibilitySaving(true);
    await updateVenue({ public_status: makePublic ? 1 : 0 });
    setVisibilitySaving(false);
  };

  const addPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(t("common.permissionDenied"), t("common.photosPermission"));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      });
      if (result.canceled || !result.assets?.[0]) return;

      setUploading(true);

      // Centre-crop to the 16:10 cover shape and keep a sensible size
      const { uri, width: origW, height: origH } = result.assets[0];
      let cropW = origW;
      let cropH = origW / COVER_RATIO;
      if (cropH > origH) {
        cropH = origH;
        cropW = origH * COVER_RATIO;
      }
      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [
          {
            crop: {
              originX: Math.round((origW - cropW) / 2),
              originY: Math.round((origH - cropH) / 2),
              width: Math.round(cropW),
              height: Math.round(cropH),
            },
          },
          { resize: { width: Math.min(1600, Math.round(cropW)) } },
        ],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
      );

      const formData = new FormData();
      formData.append("file", new File(manipResult.uri));

      const { urls } = await api("/api/upload-image?type=venue", {
        method: "POST",
        body: formData,
      });

      // The API accepts full URLs, so photo_ids stays a list of URLs in state
      await updateVenue({ photo_ids: [...venue.photo_ids, ...urls] });
    } catch (err) {
      console.error("Image upload error:", err.message);
      Alert.alert(
        t("common.uploadFailed"),
        err.status === 0 ? t("common.networkIssue") : err.message || t("common.pleaseTryAgain"),
      );
    } finally {
      setUploading(false);
    }
  };

  const deleteEvent = (event) => {
    Alert.alert(t("venueProfile.deleteEventTitle"), t("venueProfile.deleteEventMessage", { name: event.title }), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          try {
            await api(`/api/events/${event.id}`, { method: "DELETE" });
            setEvents((prev) => prev.filter((e) => e.id !== event.id));
          } catch (err) {
            console.error("Delete event error:", err.message);
            Alert.alert(t("common.deleteError"), t("common.pleaseTryAgain"));
          }
        },
      },
    ]);
  };

  // ── Full-screen states ──

  if (!venue) {
    return (
      <View style={styles.centered}>
        {loadError ? (
          <>
            <MaterialIcons name="cloud-off" size={48} color={COLORS.textSecondary} />
            <Text style={styles.messageText}>{loadError}</Text>
            <Pressable
              onPress={fetchVenue}
              style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
            >
              <Text style={styles.retryButtonText}>{t("common.tryAgain")}</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator size="large" color={COLORS.accent} />
        )}
      </View>
    );
  }

  const isPublic = !!venue.public_status;
  const cover = venue.photo_ids[0];

  // ── Sections ──

  const renderDetails = () => (
    <View style={styles.sectionBody}>
      <EditableCard
        icon="storefront"
        title={t("venueProfile.venueName")}
        value={venue.title}
        placeholder={t("venueProfile.venueNamePlaceholder")}
        maxLength={80}
        onSave={(title) => updateVenue({ title })}
        onStartEdit={scrollToCard}
      />

      <Card
        icon="place"
        title={t("venueProfile.location")}
        action={<SmallButton label={t("venueProfile.setOnMap")} icon="map" onPress={openMapPicker} />}
      >
        {venue.address ? (
          <Text style={styles.cardText}>{venue.address}</Text>
        ) : (
          <Text style={styles.cardPlaceholder}>
            {t("venueProfile.noLocation")}
          </Text>
        )}
      </Card>

      <Card
        icon="schedule"
        title={t("venueProfile.openingHours")}
        action={<SmallButton label={t("venueProfile.edit")} icon="edit" onPress={() => setHoursOpen(true)} />}
      >
        {venue.open_hours ? (
          <Text style={styles.cardText}>{venue.open_hours}</Text>
        ) : (
          <Text style={styles.cardPlaceholder}>{t("venueProfile.addOpeningHours")}</Text>
        )}
      </Card>

      <VenueTypesCard selected={venue.types} onChange={(types) => updateVenue({ types })} />

      <EditableCard
        icon="campaign"
        title={t("venueProfile.tonightStatus")}
        value={venue.status}
        placeholder={t("venueProfile.statusPlaceholder")}
        maxLength={300}
        multiline
        onSave={(status) => updateVenue({ status })}
        onStartEdit={scrollToCard}
      />

      <EditableCard
        icon="info-outline"
        title={t("venueProfile.about")}
        value={venue.about}
        placeholder={t("venueProfile.aboutPlaceholder")}
        maxLength={2000}
        multiline
        onSave={(about) => updateVenue({ about })}
        onStartEdit={scrollToCard}
      />
    </View>
  );

  const renderEvents = () => (
    <View style={styles.sectionBody}>
      <Pressable
        onPress={() => router.push("/protected/profile-folder/create-event")}
        style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        <MaterialIcons name="add" size={22} color={COLORS.onAccent} />
        <Text style={styles.primaryButtonText}>{t("venueProfile.newEvent")}</Text>
      </Pressable>

      {!events ? (
        <ActivityIndicator color={COLORS.accent} style={styles.sectionLoader} />
      ) : events.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="event" size={40} color={COLORS.textSecondary} />
          <Text style={styles.emptyTitle}>{t("venueProfile.noEvents")}</Text>
          <Text style={styles.messageText}>{t("venueProfile.noEventsHint")}</Text>
        </View>
      ) : (
        events.map((event) => (
          <Pressable
            key={event.id}
            onPress={() =>
              router.push(`/protected/profile-folder/create-event?eventId=${event.id}`)
            }
            style={({ pressed }) => [styles.eventRow, pressed && styles.eventRowPressed]}
            accessibilityRole="button"
            accessibilityLabel={t("venueProfile.editItem", { name: event.title })}
          >
            {event.image ? (
              <Image source={{ uri: event.image }} style={styles.eventImage} contentFit="cover" transition={200} />
            ) : (
              <View style={[styles.eventImage, styles.placeholderBox]}>
                <MaterialIcons name="event" size={24} color={COLORS.textSecondary} />
              </View>
            )}
            <View style={styles.eventText}>
              <Text style={styles.eventTitle} numberOfLines={2}>
                {event.title}
              </Text>
              {!!event.time && (
                <Text style={styles.eventTime}>
                  {formatEventTime(event.time)}
                  {event.ended ? ` · ${t("event.ended")}` : ""}
                  {` · ${t("event.goingCount", { count: event.goingCount })}`}
                </Text>
              )}
              <Text style={styles.eventEditHint}>{t("venueProfile.tapToEdit")}</Text>
            </View>
            <Pressable
              onPress={() => deleteEvent(event)}
              hitSlop={10}
              style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={t("venueProfile.deleteItem", { name: event.title })}
            >
              <MaterialIcons name="delete-outline" size={22} color={COLORS.danger} />
            </Pressable>
          </Pressable>
        ))
      )}
    </View>
  );

  const renderPhotos = () => (
    <View style={styles.sectionBody}>
      <Text style={styles.cardHint}>
        {t("venueProfile.photosHint")}
      </Text>
      <View style={styles.photoGrid}>
        <Pressable
          onPress={addPhoto}
          disabled={uploading}
          style={({ pressed }) => [styles.photoTile, styles.addPhotoTile, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t("venueProfile.addPhoto")}
        >
          {uploading ? (
            <ActivityIndicator color={COLORS.accent} />
          ) : (
            <>
              <MaterialIcons name="add-photo-alternate" size={28} color={COLORS.accent} />
              <Text style={styles.addPhotoText}>{t("venueProfile.addPhoto")}</Text>
            </>
          )}
        </Pressable>
        {venue.photo_ids.map((url, index) => (
          <Pressable
            key={`${index}-${url}`}
            onPress={() => setGallery({ visible: true, index })}
            style={styles.photoTile}
            accessibilityRole="imagebutton"
            accessibilityLabel={index === 0 ? t("venueProfile.coverPhoto") : t("venueProfile.photoNumber", { number: index + 1 })}
          >
            <Image source={{ uri: url }} style={styles.photoImage} contentFit="cover" transition={200} />
            {index === 0 && (
              <View style={styles.coverBadge}>
                <Text style={styles.coverBadgeText}>{t("venueProfile.cover")}</Text>
              </View>
            )}
            <Pressable
              onPress={() => confirmDeletePhoto(url)}
              hitSlop={8}
              style={({ pressed }) => [styles.photoDelete, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={t("venueProfile.deletePhoto")}
            >
              <MaterialIcons name="delete-outline" size={18} color={COLORS.onImage} />
            </Pressable>
          </Pressable>
        ))}
      </View>
    </View>
  );

  // ── Layout ──

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.accent}
            colors={[COLORS.accent]}
          />
        }
      >
        <View ref={contentRef} collapsable={false}>
        {/* Cover */}
        <Pressable
          onPress={() => (cover ? setGallery({ visible: true, index: 0 }) : addPhoto())}
          style={styles.hero}
          accessibilityRole="imagebutton"
          accessibilityLabel={cover ? t("venueProfile.viewCover") : t("venueProfile.addCover")}
        >
          {cover ? (
            <Image source={{ uri: cover }} style={styles.heroImage} contentFit="cover" transition={250} />
          ) : (
            <View style={[styles.heroImage, styles.heroPlaceholder]}>
              {uploading ? (
                <ActivityIndicator color={COLORS.accent} />
              ) : (
                <>
                  <MaterialIcons name="add-photo-alternate" size={40} color={COLORS.accent} />
                  <Text style={styles.heroPlaceholderText}>{t("venueProfile.addCover")}</Text>
                </>
              )}
            </View>
          )}
          <LinearGradient
            colors={["transparent", COLORS.background]}
            style={styles.heroGradient}
            pointerEvents="none"
          />
          <View style={styles.heroText} pointerEvents="none">
            <View style={[styles.visibilityBadge, isPublic && styles.visibilityBadgePublic]}>
              <View style={[styles.visibilityDot, isPublic && styles.visibilityDotPublic]} />
              <Text style={styles.visibilityBadgeText}>{isPublic ? t("venueProfile.public") : t("venueProfile.hidden")}</Text>
            </View>
            <Text style={styles.heroTitle} numberOfLines={2}>
              {venue.title || t("venueProfile.yourVenue")}
            </Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => router.push("/protected/settings-folder/settings")}
          hitSlop={8}
          style={({ pressed }) => [styles.settingsButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t("tabs.settings")}
        >
          <MaterialIcons name="settings" size={22} color={COLORS.onImage} />
        </Pressable>

        <View style={styles.content}>
          {/* Visibility */}
          <View style={styles.card}>
            <View style={styles.visibilityRow}>
              <MaterialIcons
                name={isPublic ? "visibility" : "visibility-off"}
                size={24}
                color={isPublic ? COLORS.success : COLORS.textSecondary}
              />
              <View style={styles.visibilityText}>
                <Text style={styles.cardTitle}>{t("venueProfile.visibleToGuests")}</Text>
                <Text style={styles.cardHint}>
                  {isPublic
                    ? t("venueProfile.publicHint")
                    : t("venueProfile.hiddenHint")}
                </Text>
              </View>
              {visibilitySaving ? (
                <ActivityIndicator color={COLORS.accent} />
              ) : (
                <Switch
                  value={isPublic}
                  onValueChange={toggleVisibility}
                  trackColor={{ false: COLORS.border, true: COLORS.success }}
                  thumbColor={COLORS.text}
                />
              )}
            </View>

            {missing.length > 0 && (
              <View style={styles.checklist}>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${((checklist.length - missing.length) / checklist.length) * 100}%` },
                    ]}
                  />
                </View>
                <Text style={styles.checklistTitle}>
                  {t("venueProfile.progress", { done: checklist.length - missing.length, total: checklist.length })}
                  {isPublic ? "" : ` · ${t("venueProfile.completeToPublish")}`}
                </Text>
                {checklist.map((item) => (
                  <View key={item.label} style={styles.checklistItem}>
                    <MaterialIcons
                      name={item.done ? "check-circle" : "radio-button-unchecked"}
                      size={18}
                      color={item.done ? COLORS.success : COLORS.textSecondary}
                    />
                    <Text style={[styles.checklistText, item.done && styles.checklistTextDone]}>
                      {item.label}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Totals: who looked at the venue and who saved it */}
          {!!venue.stats && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIcon}>
                  <MaterialIcons name="insights" size={18} color={COLORS.accent} />
                </View>
                <Text style={styles.cardTitle}>{t("venueProfile.statsTitle")}</Text>
              </View>
              <View style={styles.statsRow}>
                {[
                  { value: venue.stats.views_30d, label: t("venueProfile.statsViews30") },
                  { value: venue.stats.views_total, label: t("venueProfile.statsViewsTotal") },
                  { value: venue.stats.favorites, label: t("venueProfile.statsFavorites") },
                ].map((item) => (
                  <View key={item.label} style={styles.statBox}>
                    <Text style={styles.statValue}>{item.value ?? 0}</Text>
                    <Text style={styles.statLabel}>{item.label}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.cardHint}>{t("venueProfile.statsHint")}</Text>
            </View>
          )}

          <SegmentedTabs
            tabs={SECTIONS.map((item) => ({ key: item.key, label: t(item.labelKey) }))}
            value={section}
            onChange={setSection}
          />

          <SwipeableTabContent
            index={SECTIONS.findIndex((item) => item.key === section)}
            count={SECTIONS.length}
            onChange={(index) => setSection(SECTIONS[index].key)}
          >
            {section === "details" && renderDetails()}
            {section === "events" && renderEvents()}
            {section === "photos" && renderPhotos()}
          </SwipeableTabContent>
        </View>
        </View>
      </ScrollView>

      {hoursOpen && (
        <HoursSheet
          value={venue.open_hours}
          onClose={() => setHoursOpen(false)}
          onSave={(open_hours) => updateVenue({ open_hours })}
        />
      )}

      <ImageGallery
        images={venue.photo_ids}
        visible={gallery.visible}
        initialIndex={gallery.index}
        onClose={() => setGallery({ visible: false, index: 0 })}
      />
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
  scrollContent: {
    paddingBottom: 40,
  },
  pressed: {
    opacity: 0.6,
  },

  // Hero
  hero: {
    width: "100%",
    aspectRatio: COVER_RATIO,
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroPlaceholder: {
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  heroPlaceholderText: {
    color: COLORS.accent,
    fontSize: 15,
    fontWeight: "600",
  },
  heroGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "60%",
  },
  heroText: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 14,
    gap: 8,
  },
  settingsButton: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  heroTitle: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "800",
  },
  visibilityBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  visibilityBadgePublic: {
    backgroundColor: "rgba(52, 211, 153, 0.2)",
  },
  visibilityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.textSecondary,
  },
  visibilityDotPublic: {
    backgroundColor: COLORS.success,
  },
  visibilityBadgeText: {
    color: COLORS.onImage,
    fontSize: 12,
    fontWeight: "700",
  },

  // Content
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 16,
  },
  sectionBody: {
    gap: 12,
  },
  sectionLoader: {
    paddingVertical: 32,
  },

  // Cards
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cardIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(167, 139, 250, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
  },
  cardText: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 21,
  },
  cardPlaceholder: {
    color: COLORS.placeholder,
    fontSize: 15,
    lineHeight: 21,
  },
  cardHint: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  smallButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.45)",
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  smallButtonPrimary: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  smallButtonText: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: "600",
  },
  smallButtonTextPrimary: {
    color: COLORS.onAccent,
    fontWeight: "700",
  },
  input: {
    backgroundColor: COLORS.background,
    color: COLORS.text,
    fontSize: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.accent,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputMultiline: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  editActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  savingSpinner: {
    paddingHorizontal: 18,
  },

  // Venue types
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.45)",
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  chipActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  chipText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "600",
  },
  chipTextActive: {
    color: COLORS.onAccent,
  },

  // Visibility
  visibilityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  visibilityText: {
    flex: 1,
    gap: 2,
  },
  checklist: {
    gap: 8,
    paddingTop: 4,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.surfacePressed,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: COLORS.accent,
  },
  checklistTitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: COLORS.surfacePressed,
  },
  statValue: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "800",
  },
  statLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: "center",
    marginTop: 2,
  },
  checklistItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  checklistText: {
    color: COLORS.text,
    fontSize: 14,
  },
  checklistTextDone: {
    color: COLORS.textSecondary,
    textDecorationLine: "line-through",
  },

  // Events
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    paddingVertical: 13,
  },
  primaryButtonText: {
    color: COLORS.onAccent,
    fontSize: 16,
    fontWeight: "700",
  },
  eventRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 10,
  },
  eventRowPressed: {
    backgroundColor: COLORS.surfacePressed,
  },
  eventImage: {
    width: 72,
    height: 72,
    borderRadius: 12,
  },
  placeholderBox: {
    backgroundColor: COLORS.surfacePressed,
    alignItems: "center",
    justifyContent: "center",
  },
  eventText: {
    flex: 1,
    marginLeft: 12,
    gap: 3,
  },
  eventTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
  },
  eventTime: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: "600",
  },
  eventEditHint: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  deleteButton: {
    padding: 8,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "700",
    marginTop: 10,
  },

  // Photos
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: PHOTO_GAP,
  },
  photoTile: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: COLORS.surface,
  },
  addPhotoTile: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(167, 139, 250, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  addPhotoText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: "600",
  },
  photoImage: {
    width: "100%",
    height: "100%",
  },
  photoDelete: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  coverBadge: {
    position: "absolute",
    left: 6,
    bottom: 6,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  coverBadgeText: {
    color: COLORS.onImage,
    fontSize: 11,
    fontWeight: "700",
  },

  // Hours sheet
  sheetBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.55)",
  },
  sheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    marginTop: 10,
  },
  sheetTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "800",
    marginTop: 14,
  },
  sheetLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 18,
    marginBottom: 10,
  },
  dayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dayChip: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  dayChipActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  dayChipText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
  },
  dayChipTextActive: {
    color: COLORS.onAccent,
  },
  presetRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  stepperLabel: {
    width: 60,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "600",
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 12,
  },
  stepperButton: {
    padding: 10,
  },
  stepperValue: {
    minWidth: 30,
    textAlign: "center",
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "700",
  },
  periodToggle: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 3,
  },
  periodOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 9,
  },
  periodOptionActive: {
    backgroundColor: COLORS.accent,
  },
  periodText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: "700",
  },
  periodTextActive: {
    color: COLORS.onAccent,
  },
  hoursPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    marginTop: 6,
  },
  hoursPreviewText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "600",
  },
  sheetSave: {
    marginTop: 16,
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  sheetSaveDisabled: {
    opacity: 0.4,
  },
  sheetSaveText: {
    color: COLORS.onAccent,
    fontSize: 16,
    fontWeight: "800",
  },

  // Error
  messageText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
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
}));
