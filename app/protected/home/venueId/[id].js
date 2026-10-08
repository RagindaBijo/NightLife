import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import FavoriteStar from "../../../../components/FavoriteStar";
import ImageGallery from "../../../../components/ImageGallery";
import SegmentedTabs from "../../../../components/SegmentedTabs";
import { api, getSession } from "../../../../lib/api";
import { formatEventTime } from "../../../../lib/format";
import { favorites } from "../../../../lib/toggles";
import { venueTypeIcon, venueTypeLabel } from "../../../../lib/venueTypes";
import { useI18n } from "../../../../lib/i18n";
import { makeStyles, useTheme } from "../../../../lib/theme-context";

const SECTIONS = [
  { key: "status", labelKey: "venue.status" },
  { key: "events", labelKey: "venue.events" },
  { key: "about", labelKey: "venue.about" },
];

function RatingStars({ value, onRate, disabled }) {
  const { colors: COLORS } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  return (
    <View style={styles.rateStars}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Pressable
          key={star}
          onPress={() => onRate(star)}
          disabled={disabled}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t("venue.rateStars", { count: star })}
        >
          <MaterialIcons
            name={value >= star ? "star" : "star-border"}
            size={36}
            color={value >= star ? COLORS.gold : COLORS.textSecondary}
          />
        </Pressable>
      ))}
    </View>
  );
}

function InfoRow({ icon, label, value, divider }) {
  const { colors: COLORS } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.infoRow, divider && styles.infoRowDivider]}>
      <View style={styles.infoIcon}>
        <MaterialIcons name={icon} size={20} color={COLORS.accent} />
      </View>
      <View style={styles.infoText}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function VenueDetail() {
  const { colors: COLORS } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  const { id } = useLocalSearchParams();
  const navigation = useNavigation();
  const router = useRouter();
  const [venue, setVenue] = useState(null);
  const [error, setError] = useState(null);
  const [events, setEvents] = useState(null);
  const [eventsError, setEventsError] = useState(null);
  const [userType, setUserType] = useState(null);
  const [section, setSection] = useState("status");
  const [gallery, setGallery] = useState({ visible: false, index: 0 });
  const [ratingSaving, setRatingSaving] = useState(false);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const fetchVenue = useCallback(
    () =>
      Promise.all([getSession(), api(`/api/venue/${id}`)]).then(
        ([session, data]) => {
          favorites.seed([data], "is_favorite");
          setUserType(session?.userType ?? null);
          setVenue({
            id: String(data.id ?? id),
            title: data.title || t("venue.fallbackTitle"),
            address: data.address || "",
            openHours: data.open_hours || t("venue.defaultHours"),
            status: data.status || t("venue.noStatus"),
            about: data.about || t("venue.noAbout"),
            // photo_ids is an array of full URLs from the API
            images: data.photo_ids,
            types: data.types ?? [],
            ratingAvg: data.rating_avg ?? null,
            ratingCount: data.rating_count ?? 0,
            myRating: data.my_rating ?? null,
          });
          setError(null);
        },
        (err) => {
          console.error("Error fetching venue:", err.message);
          setError(
            err.status === 0
              ? t("common.cantConnect")
              : t("venue.loadError"),
          );
        },
      ),
    [id, t],
  );

  // Events load separately, so a failure here doesn't hide the venue
  const fetchEvents = useCallback(
    () =>
      api(`/api/events?venue_id=${id}`).then(
        (data) => {
          setEvents(
            data.map((event, index) => ({
              id: String(event.id),
              title: event.title || t("event.numbered", { number: index + 1 }),
              time: event.time || "",
              image: event.photo_id || null,
            })),
          );
          setEventsError(null);
        },
        (err) => {
          console.error("Error fetching events:", err.message);
          setEventsError(t("venue.eventsLoadError"));
        },
      ),
    [id, t],
  );

  useEffect(() => {
    fetchVenue();
    fetchEvents();
  }, [fetchVenue, fetchEvents]);

  // Tap a star to rate; tap your current rating again to remove it
  const rateVenue = async (star) => {
    const previous = venue;
    const removing = venue.myRating === star;
    setVenue((prev) => ({ ...prev, myRating: removing ? null : star }));
    setRatingSaving(true);
    try {
      const result = await api(`/api/venues/${venue.id}/rating`, {
        method: removing ? "DELETE" : "PUT",
        body: removing ? undefined : { rating: star },
      });
      setVenue((prev) => ({
        ...prev,
        myRating: result.my_rating,
        ratingAvg: result.rating_avg,
        ratingCount: result.rating_count,
      }));
    } catch (err) {
      console.error("Rating failed:", err.message);
      setVenue(previous);
    } finally {
      setRatingSaving(false);
    }
  };

  const openMaps = async () => {
    const address = encodeURIComponent(venue.address);
    const url = `https://www.google.com/maps/dir/?api=1&destination=${address}&travelmode=driving`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        console.error("Cannot open Google Maps");
      }
    } catch (err) {
      console.error("Error opening Google Maps:", err);
    }
  };

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

  if (!venue) {
    return (
      <View style={styles.centered}>
        {error ? (
          <>
            <MaterialIcons name="cloud-off" size={48} color={COLORS.textSecondary} />
            <Text style={styles.messageText}>{error}</Text>
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
        {backButton}
      </View>
    );
  }

  const renderSection = () => {
    if (section === "status") {
      return (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{t("venue.tonight")}</Text>
          <Text style={styles.sectionText}>{venue.status}</Text>
        </View>
      );
    }

    if (section === "about") {
      return (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{t("venue.about")}</Text>
          <Text style={styles.sectionText}>{venue.about}</Text>
        </View>
      );
    }

    if (!events) {
      return eventsError ? (
        <View style={[styles.sectionCard, styles.sectionCardCentered]}>
          <Text style={styles.sectionText}>{eventsError}</Text>
          <Pressable
            onPress={fetchEvents}
            style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
          >
            <Text style={styles.retryButtonText}>{t("common.tryAgain")}</Text>
          </Pressable>
        </View>
      ) : (
        <ActivityIndicator color={COLORS.accent} style={styles.sectionLoader} />
      );
    }

    if (events.length === 0) {
      return (
        <View style={[styles.sectionCard, styles.sectionCardCentered]}>
          <MaterialIcons name="event-busy" size={36} color={COLORS.textSecondary} />
          <Text style={styles.sectionTitle}>{t("venue.noUpcomingEvents")}</Text>
          <Text style={[styles.sectionText, styles.centeredText]}>
            {t("venue.noUpcomingEventsHint")}
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.eventList}>
        {events.map((event) => (
          <Pressable
            key={event.id}
            onPress={() => router.push(`/protected/home/eventId/${event.id}`)}
            style={({ pressed }) => [styles.eventCard, pressed && styles.eventCardPressed]}
            accessibilityRole="button"
            accessibilityLabel={event.title}
          >
            {event.image ? (
              <Image source={{ uri: event.image }} style={styles.eventImage} contentFit="cover" transition={200} />
            ) : (
              <View style={[styles.eventImage, styles.eventImagePlaceholder]}>
                <MaterialIcons name="event" size={24} color={COLORS.textSecondary} />
              </View>
            )}
            <View style={styles.eventText}>
              <Text style={styles.eventTitle} numberOfLines={2}>
                {event.title}
              </Text>
              {!!event.time && (
                <View style={styles.eventMeta}>
                  <MaterialIcons name="schedule" size={14} color={COLORS.accent} />
                  <Text style={styles.eventTime}>{formatEventTime(event.time)}</Text>
                </View>
              )}
            </View>
            <MaterialIcons name="chevron-right" size={22} color={COLORS.textSecondary} />
          </Pressable>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Hero */}
        <Pressable
          onPress={() => venue.images.length > 0 && setGallery({ visible: true, index: 0 })}
          style={styles.hero}
          accessibilityRole="imagebutton"
          accessibilityLabel={t("venue.viewPhotos")}
        >
          {venue.images.length > 0 ? (
            <Image source={{ uri: venue.images[0] }} style={styles.heroImage} contentFit="cover" transition={250} />
          ) : (
            <View style={[styles.heroImage, styles.heroPlaceholder]}>
              <MaterialIcons name="storefront" size={56} color={COLORS.textSecondary} />
            </View>
          )}
          <LinearGradient
            colors={["transparent", COLORS.background]}
            style={styles.heroGradient}
            pointerEvents="none"
          />
          {venue.images.length > 1 && (
            <View style={styles.photoCount}>
              <MaterialIcons name="photo-library" size={14} color={COLORS.onImage} />
              <Text style={styles.photoCountText}>{venue.images.length}</Text>
            </View>
          )}
        </Pressable>

        {/* Details */}
        <View style={styles.content}>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>{venue.title}</Text>
            <View style={styles.ratingSummary}>
              <MaterialIcons name="star" size={18} color={COLORS.gold} />
              {venue.ratingCount > 0 ? (
                <Text style={styles.ratingSummaryText}>
                  <Text style={styles.ratingAvg}>{venue.ratingAvg}</Text>
                  {`  ·  ${t("venue.ratingCount", { count: venue.ratingCount })}`}
                </Text>
              ) : (
                <Text style={styles.ratingSummaryText}>{t("venue.noRatings")}</Text>
              )}
            </View>
            {venue.types.length > 0 && (
              <View style={styles.typeChips}>
                {venue.types.map((type) => (
                  <View key={type} style={styles.typeChip}>
                    <MaterialCommunityIcons name={venueTypeIcon(type)} size={14} color={COLORS.accent} />
                    <Text style={styles.typeChipText}>{venueTypeLabel(type)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.infoCard}>
            <InfoRow icon="place" label={t("venue.address")} value={venue.address || t("venue.noAddress")} />
            <InfoRow icon="schedule" label={t("venue.openingHours")} value={venue.openHours} divider />
          </View>

          {!!venue.address && (
            <Pressable
              onPress={openMaps}
              style={({ pressed }) => [styles.directionsButton, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <MaterialIcons name="directions" size={20} color={COLORS.onAccent} />
              <Text style={styles.directionsText}>{t("venue.getDirections")}</Text>
            </Pressable>
          )}

          {userType === "1" && (
            <View style={styles.rateCard}>
              <Text style={styles.rateTitle}>
                {venue.myRating ? t("venue.yourRating") : t("venue.rateIt")}
              </Text>
              <RatingStars value={venue.myRating ?? 0} onRate={rateVenue} disabled={ratingSaving} />
              {!!venue.myRating && (
                <Text style={styles.rateHint}>{t("venue.removeRatingHint")}</Text>
              )}
            </View>
          )}

          <SegmentedTabs
            tabs={SECTIONS.map((item) => ({ key: item.key, label: t(item.labelKey) }))}
            value={section}
            onChange={setSection}
          />

          {renderSection()}
        </View>
      </ScrollView>

      {backButton}
      {userType === "1" && (
        <View style={[styles.roundButton, styles.actionButton]}>
          <FavoriteStar venueId={venue.id} style={styles.roundTouch} />
        </View>
      )}

      <ImageGallery
        images={venue.images}
        visible={gallery.visible}
        initialIndex={gallery.index}
        onClose={() => setGallery({ visible: false, index: 0 })}
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
  photoCount: {
    position: "absolute",
    right: 14,
    bottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 12,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  photoCountText: {
    color: COLORS.onImage,
    fontSize: 13,
    fontWeight: "600",
  },

  // Content
  content: {
    paddingHorizontal: 16,
    gap: 16,
  },
  titleBlock: {
    gap: 8,
    marginTop: 4,
  },
  title: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "800",
  },
  ratingSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  ratingSummaryText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  ratingAvg: {
    color: COLORS.text,
    fontWeight: "700",
  },
  typeChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(167, 139, 250, 0.12)",
    borderRadius: 14,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  typeChipText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "600",
  },
  rateCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    gap: 8,
  },
  rateTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
  },
  rateStars: {
    flexDirection: "row",
    gap: 6,
  },
  rateHint: {
    color: COLORS.textSecondary,
    fontSize: 12,
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
    fontSize: 15,
    fontWeight: "600",
    marginTop: 1,
  },
  directionsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    paddingVertical: 13,
  },
  directionsText: {
    color: COLORS.onAccent,
    fontSize: 16,
    fontWeight: "700",
  },

  // Sections
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
  sectionLoader: {
    paddingVertical: 28,
  },
  eventList: {
    gap: 10,
  },
  eventCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 10,
  },
  eventCardPressed: {
    backgroundColor: COLORS.surfacePressed,
  },
  eventImage: {
    width: 72,
    height: 72,
    borderRadius: 12,
  },
  eventImagePlaceholder: {
    backgroundColor: COLORS.surfacePressed,
    alignItems: "center",
    justifyContent: "center",
  },
  eventText: {
    flex: 1,
    marginLeft: 12,
    gap: 6,
  },
  eventTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
  },
  eventMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  eventTime: {
    color: COLORS.textSecondary,
    fontSize: 13,
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
