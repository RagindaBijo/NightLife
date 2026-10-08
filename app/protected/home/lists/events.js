import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import InterestCheck from "../../../../components/InterestCheck";
import { api, getSession } from "../../../../lib/api";
import { eventStart, formatEventTime, parseEventTime } from "../../../../lib/format";
import { interests } from "../../../../lib/toggles";
import { useI18n } from "../../../../lib/i18n";
import { makeStyles, useTheme } from "../../../../lib/theme-context";

const EventCard = memo(function EventCard({ event, showInterest, onPress }) {
  const { colors: COLORS } = useTheme();
  const styles = useStyles();
  const { t } = useI18n();
  const when = parseEventTime(event.time);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole="button"
      accessibilityLabel={event.title}
    >
      <View style={styles.imageWrapper}>
        {event.image ? (
          <Image source={{ uri: event.image }} style={styles.image} contentFit="cover" transition={250} />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <MaterialIcons name="event" size={40} color={COLORS.textSecondary} />
          </View>
        )}
        {when && (
          <View style={styles.dateBadge}>
            <Text style={styles.dateDay}>{when.day}</Text>
            <Text style={styles.dateMonth}>{when.month}</Text>
          </View>
        )}
        {showInterest && (
          <View style={styles.interestButton}>
            <InterestCheck
              eventId={event.id}
              size={24}
              activeColor={COLORS.accent}
              inactiveColor={COLORS.onImage}
              style={styles.interestTouch}
            />
          </View>
        )}
      </View>

      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {event.title}
        </Text>
        <View style={styles.infoRow}>
          <MaterialIcons name="storefront" size={16} color={COLORS.accent} />
          <Text style={styles.infoText} numberOfLines={1}>
            {event.venueName}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <MaterialIcons name="schedule" size={16} color={COLORS.accent} />
          <Text style={styles.infoText} numberOfLines={1}>
            {formatEventTime(event.time)}
          </Text>
        </View>
        {event.goingCount > 0 && (
          <View style={styles.infoRow}>
            <MaterialIcons name="people" size={16} color={COLORS.accent} />
            <Text style={styles.infoText}>{t("event.goingCount", { count: event.goingCount })}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
});

export default function Events() {
  const { colors: COLORS } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  const router = useRouter();
  const [events, setEvents] = useState(null);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [userType, setUserType] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchEvents = useCallback(
    () =>
      Promise.all([getSession(), api("/api/events")])
        .then(async ([session, data]) => {
          // Look each venue up once, even if several events share it
          const venueNames = new Map();
          const venueName = (venueId) => {
            if (!venueId) return Promise.resolve(t("event.unknownVenue"));
            if (!venueNames.has(venueId)) {
              venueNames.set(
                venueId,
                api(`/api/venue/${venueId}`)
                  .then((venue) => venue.title || t("event.unknownVenue"))
                  .catch((err) => {
                    console.warn(`Error fetching venue ${venueId}:`, err.message);
                    return t("event.unknownVenue");
                  }),
              );
            }
            return venueNames.get(venueId);
          };

          const list = await Promise.all(
            data.map(async (event, index) => ({
              id: event.id.toString(),
              title: event.title || t("event.numbered", { number: index + 1 }),
              venueName: await venueName(event.venue_id),
              time: eventStart(event) || t("event.noTime"),
              image: event.photo_id || null,
              goingCount: event.going_count ?? 0,
            })),
          );

          interests.seed(data, "is_interested");
          setUserType(session?.userType ?? null);
          setEvents(list);
          setError(null);
        })
        .catch((err) => {
          console.error("Error fetching events:", err.message);
          setError(
            err.status === 0
              ? t("common.cantConnect")
              : t("home.eventsLoadError"),
          );
        }),
    [t],
  );

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchEvents();
    setRefreshing(false);
  };

  const filteredEvents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!events) return [];
    return query
      ? events.filter((event) => event.title.toLowerCase().includes(query))
      : events;
  }, [events, searchQuery]);

  const renderEvent = useCallback(
    ({ item }) => (
      <EventCard
        event={item}
        showInterest={userType === "1"}
        onPress={() => router.push(`/protected/home/eventId/${item.id}`)}
      />
    ),
    [userType, router],
  );

  const renderEmpty = () => {
    if (!events && error) {
      return (
        <View style={styles.message}>
          <MaterialIcons name="cloud-off" size={44} color={COLORS.textSecondary} />
          <Text style={styles.messageText}>{error}</Text>
          <Pressable
            onPress={fetchEvents}
            style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
          >
            <Text style={styles.retryButtonText}>{t("common.tryAgain")}</Text>
          </Pressable>
        </View>
      );
    }
    if (!events) {
      return (
        <View style={styles.message}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      );
    }
    return (
      <View style={styles.message}>
        <MaterialIcons
          name={searchQuery ? "search-off" : "event"}
          size={44}
          color={COLORS.textSecondary}
        />
        <Text style={styles.messageTitle}>
          {searchQuery ? t("home.noEventsMatch") : t("home.noEvents")}
        </Text>
        <Text style={styles.messageText}>
          {searchQuery ? t("home.tryDifferentName") : t("home.noEventsHint")}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={22} color={COLORS.textSecondary} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t("home.searchEvents")}
          placeholderTextColor={COLORS.placeholder}
          selectionColor={COLORS.accent}
          autoCorrect={false}
          returnKeyType="search"
        />
        {!!searchQuery && (
          <Pressable onPress={() => setSearchQuery("")} hitSlop={10} accessibilityLabel={t("common.clearSearch")}>
            <MaterialIcons name="cancel" size={20} color={COLORS.textSecondary} />
          </Pressable>
        )}
      </View>
      <FlatList
        data={filteredEvents}
        keyExtractor={(event) => event.id}
        renderItem={renderEvent}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.accent}
            colors={[COLORS.accent]}
          />
        }
      />
    </View>
  );
}

const useStyles = makeStyles((COLORS) => ({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  pressed: {
    opacity: 0.6,
  },

  // Search
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 4,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 16,
    paddingVertical: 11,
  },

  // List
  list: {
    flexGrow: 1,
    padding: 12,
    gap: 14,
  },

  // Card
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    overflow: "hidden",
  },
  cardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  imageWrapper: {
    width: "100%",
    aspectRatio: 16 / 9,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    backgroundColor: COLORS.surfacePressed,
    alignItems: "center",
    justifyContent: "center",
  },
  dateBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    minWidth: 52,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: "rgba(14, 11, 22, 0.85)",
    alignItems: "center",
  },
  dateDay: {
    color: COLORS.onImage,
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 22,
  },
  dateMonth: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },
  interestButton: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  interestTouch: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  title: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 2,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoText: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: 14,
  },

  // Empty / loading / error
  message: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  messageTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "700",
    marginTop: 14,
  },
  messageText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: "center",
    marginTop: 6,
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
