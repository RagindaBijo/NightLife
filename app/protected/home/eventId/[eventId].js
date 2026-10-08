import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import ImageGallery from "../../../../components/ImageGallery";
import InterestCheck from "../../../../components/InterestCheck";
import SegmentedTabs from "../../../../components/SegmentedTabs";
import { api, getSession } from "../../../../lib/api";
import { eventStart, formatEventTime, parseEventTime } from "../../../../lib/format";
import { interests } from "../../../../lib/toggles";
import { useI18n } from "../../../../lib/i18n";
import { makeStyles, useTheme } from "../../../../lib/theme-context";

const SECTIONS = [
  { key: "details", labelKey: "event.details" },
  { key: "tickets", labelKey: "event.tickets" },
];

export default function EventDetail() {
  const { colors: COLORS } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  const { eventId } = useLocalSearchParams();
  const navigation = useNavigation();
  const router = useRouter();
  const [event, setEvent] = useState(null);
  const [venue, setVenue] = useState(null);
  const [error, setError] = useState(null);
  const [userType, setUserType] = useState(null);
  const [section, setSection] = useState("details");
  const [galleryVisible, setGalleryVisible] = useState(false);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const fetchEvent = useCallback(
    () =>
      Promise.all([getSession(), api(`/api/events/${eventId}`)])
        .then(async ([session, eventData]) => {
          interests.seed([eventData], "is_interested");
          setUserType(session?.userType ?? null);
          setEvent({
            id: String(eventData.id ?? eventId),
            title: eventData.title || t("event.untitled"),
            about: eventData.about || t("event.noDescription"),
            time: eventStart(eventData) || t("event.noTime"),
            venueId: eventData.venue_id,
            // photo_id is a full URL from the API
            images: eventData.photo_id ? [eventData.photo_id] : [],
          });
          setError(null);

          if (eventData.venue_id) {
            try {
              setVenue(await api(`/api/venue/${eventData.venue_id}`));
            } catch (err) {
              console.warn(`Failed to fetch venue ${eventData.venue_id}: ${err.message}`);
            }
          }
        })
        .catch((err) => {
          console.error("Error fetching event or venue:", err.message);
          setError(
            err.status === 0
              ? t("common.cantConnect")
              : t("event.loadError"),
          );
        }),
    [eventId, t],
  );

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  const backButton = (
    <Pressable
      onPress={() => router.back()}
      hitSlop={8}
      style={({ pressed }) => [styles.roundButton, styles.backButton, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={t("common.goBack")}
    >
      <MaterialIcons name="arrow-back" size={24} color={COLORS.onImage} />
    </Pressable>
  );

  if (!event) {
    return (
      <View style={styles.centered}>
        {error ? (
          <>
            <MaterialIcons name="cloud-off" size={48} color={COLORS.textSecondary} />
            <Text style={styles.messageText}>{error}</Text>
            <Pressable
              onPress={fetchEvent}
              style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
            >
              <Text style={styles.retryButtonText}>{t("common.tryAgain")}</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator size="large" color={COLORS.accent} />
        )}
        {backButton}
      </View>
    );
  }

  const when = parseEventTime(event.time);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Hero */}
        <Pressable
          onPress={() => event.images.length > 0 && setGalleryVisible(true)}
          style={styles.hero}
          accessibilityRole="imagebutton"
          accessibilityLabel={t("event.viewPhoto")}
        >
          {event.images.length > 0 ? (
            <Image source={{ uri: event.images[0] }} style={styles.heroImage} contentFit="cover" transition={250} />
          ) : (
            <View style={[styles.heroImage, styles.heroPlaceholder]}>
              <MaterialIcons name="event" size={56} color={COLORS.textSecondary} />
            </View>
          )}
          <LinearGradient
            colors={["transparent", COLORS.background]}
            style={styles.heroGradient}
            pointerEvents="none"
          />
          {when && (
            <View style={styles.dateBadge}>
              <Text style={styles.dateDay}>{when.day}</Text>
              <Text style={styles.dateMonth}>{when.month}</Text>
            </View>
          )}
        </Pressable>

        {/* Details */}
        <View style={styles.content}>
          <Text style={styles.title}>{event.title}</Text>

          <View style={styles.infoCard}>
            {event.venueId ? (
              <Pressable
                onPress={() => router.push(`/protected/home/venueId/${event.venueId}`)}
                style={({ pressed }) => [styles.infoRow, pressed && styles.infoRowPressed]}
                accessibilityRole="button"
                accessibilityLabel={t("event.openVenue", { name: venue?.title ?? "" })}
              >
                <View style={styles.infoIcon}>
                  <MaterialIcons name="storefront" size={20} color={COLORS.accent} />
                </View>
                <View style={styles.infoText}>
                  <Text style={styles.infoLabel}>{t("event.venue")}</Text>
                  <Text style={styles.infoValue} numberOfLines={1}>
                    {venue?.title || t("event.unknownVenue")}
                  </Text>
                </View>
                <MaterialIcons name="chevron-right" size={22} color={COLORS.textSecondary} />
              </Pressable>
            ) : null}
            <View style={[styles.infoRow, event.venueId && styles.infoRowDivider]}>
              <View style={styles.infoIcon}>
                <MaterialIcons name="schedule" size={20} color={COLORS.accent} />
              </View>
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>{t("event.when")}</Text>
                <Text style={styles.infoValue}>{formatEventTime(event.time)}</Text>
              </View>
            </View>
          </View>

          <SegmentedTabs
            tabs={SECTIONS.map((item) => ({ key: item.key, label: t(item.labelKey) }))}
            value={section}
            onChange={setSection}
          />

          {section === "details" ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>{t("event.aboutTitle")}</Text>
              <Text style={styles.sectionText}>{event.about}</Text>
            </View>
          ) : (
            <View style={[styles.sectionCard, styles.sectionCardCentered]}>
              <MaterialIcons name="confirmation-number" size={36} color={COLORS.accent} />
              <Text style={styles.sectionTitle}>{t("event.ticketsSoon")}</Text>
              <Text style={[styles.sectionText, styles.centeredText]}>
                {t("event.ticketsSoonText")}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {backButton}
      {userType === "1" && (
        <View style={[styles.roundButton, styles.actionButton]}>
          <InterestCheck
            eventId={event.id}
            size={22}
            activeColor={COLORS.accent}
            inactiveColor={COLORS.onImage}
            style={styles.roundTouch}
          />
        </View>
      )}

      <ImageGallery
        images={event.images}
        visible={galleryVisible}
        onClose={() => setGalleryVisible(false)}
      />
    </View>
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
    paddingBottom: 32,
  },
  pressed: {
    opacity: 0.6,
  },

  // Floating buttons
  roundButton: {
    position: "absolute",
    top: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  backButton: {
    left: 12,
  },
  actionButton: {
    right: 12,
  },
  roundTouch: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  // Hero
  hero: {
    width: "100%",
    aspectRatio: 4 / 3,
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroPlaceholder: {
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  heroGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "40%",
  },
  dateBadge: {
    position: "absolute",
    left: 16,
    bottom: 16,
    minWidth: 58,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: "rgba(14, 11, 22, 0.9)",
    alignItems: "center",
  },
  dateDay: {
    color: COLORS.onImage,
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 26,
  },
  dateMonth: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
  },

  // Content
  content: {
    paddingHorizontal: 16,
    gap: 16,
  },
  title: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "800",
    marginTop: 4,
  },
  infoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    overflow: "hidden",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  infoRowPressed: {
    backgroundColor: COLORS.surfacePressed,
  },
  infoRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.surfacePressed,
  },
  infoIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(167, 139, 250, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
  },
  infoLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  infoValue: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "600",
    marginTop: 1,
  },
  sectionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  sectionCardCentered: {
    alignItems: "center",
    paddingVertical: 28,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "700",
  },
  sectionText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  centeredText: {
    textAlign: "center",
  },

  // Error
  messageText: {
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
}));
