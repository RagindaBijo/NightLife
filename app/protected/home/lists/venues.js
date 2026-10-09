import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from "react-native";
import FavoriteStar from "../../../../components/FavoriteStar";
import { api, getSession } from "../../../../lib/api";
import { favorites } from "../../../../lib/toggles";
import { useI18n } from "../../../../lib/i18n";
import { makeStyles, useTheme } from "../../../../lib/theme-context";

const VenueCard = memo(function VenueCard({ venue, showFavorite, onPress }) {
  const { colors: COLORS } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole="button"
      accessibilityLabel={venue.title}
    >
      <View style={styles.imageWrapper}>
        {venue.image ? (
          <Image source={{ uri: venue.image }} style={styles.image} contentFit="cover" transition={250} />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <MaterialIcons name="storefront" size={40} color={COLORS.textSecondary} />
          </View>
        )}
        <LinearGradient
          colors={["transparent", "rgba(0, 0, 0, 0.75)"]}
          style={styles.imageGradient}
          pointerEvents="none"
        />
        <Text style={styles.title} numberOfLines={1}>
          {venue.title}
        </Text>
        {showFavorite && (
          <View style={styles.favoriteButton}>
            <FavoriteStar venueId={venue.id} style={styles.favoriteTouch} />
          </View>
        )}
      </View>

      <View style={styles.info}>
        <View style={styles.infoRow}>
          <MaterialIcons name="place" size={16} color={COLORS.accent} />
          <Text style={styles.infoText} numberOfLines={1}>
            {venue.address}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <MaterialIcons name="schedule" size={16} color={COLORS.accent} />
          <Text style={styles.infoText} numberOfLines={1}>
            {venue.openHours}
          </Text>
        </View>
      </View>
    </Pressable>
  );
});

export default function Venues() {
  const { colors: COLORS } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  const router = useRouter();
  const [venues, setVenues] = useState(null);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [userType, setUserType] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchVenues = useCallback(
    () =>
      Promise.all([getSession(), api("/api/venues")]).then(
        ([session, data]) => {
          favorites.seed(data, "is_favorite");
          setUserType(session?.userType ?? null);
          setVenues(
            data.map((venue, index) => ({
              id: venue.id.toString(),
              title: venue.title || t("venue.numbered", { number: index + 1 }),
              address: venue.address || t("venue.noAddress"),
              openHours: venue.open_hours || t("venue.defaultHours"),
              image: venue.photo_ids[0] || null,
            })),
          );
          setError(null);
        },
        (err) => {
          console.error("Error fetching venues:", err.message);
          setError(
            err.status === 0
              ? t("common.cantConnect")
              : t("home.venuesLoadError"),
          );
        },
      ),
    [t],
  );

  useEffect(() => {
    fetchVenues();
  }, [fetchVenues]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchVenues();
    setRefreshing(false);
  };

  const filteredVenues = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!venues) return [];
    return query
      ? venues.filter((venue) => venue.title.toLowerCase().includes(query))
      : venues;
  }, [venues, searchQuery]);

  const renderVenue = useCallback(
    ({ item }) => (
      <VenueCard
        venue={item}
        showFavorite={userType === "1"}
        onPress={() => router.push(`/protected/home/venueId/${item.id}`)}
      />
    ),
    [userType, router],
  );

  const renderEmpty = () => {
    if (!venues && error) {
      return (
        <View style={styles.message}>
          <MaterialIcons name="cloud-off" size={44} color={COLORS.textSecondary} />
          <Text style={styles.messageText}>{error}</Text>
          <Pressable
            onPress={fetchVenues}
            style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
          >
            <Text style={styles.retryButtonText}>{t("common.tryAgain")}</Text>
          </Pressable>
        </View>
      );
    }
    if (!venues) {
      return (
        <View style={styles.message}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      );
    }
    return (
      <View style={styles.message}>
        <MaterialIcons
          name={searchQuery ? "search-off" : "storefront"}
          size={44}
          color={COLORS.textSecondary}
        />
        <Text style={styles.messageTitle}>
          {searchQuery ? t("home.noVenuesMatch") : t("home.noVenues")}
        </Text>
        <Text style={styles.messageText}>
          {searchQuery ? t("home.tryDifferentName") : t("home.noVenuesHint")}
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
          placeholder={t("home.searchVenues")}
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
        data={filteredVenues}
        keyExtractor={(venue) => venue.id}
        renderItem={renderVenue}
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
    aspectRatio: 16 / 10,
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
  imageGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "55%",
  },
  title: {
    position: "absolute",
    left: 14,
    right: 60,
    bottom: 12,
    color: COLORS.onImage,
    fontSize: 22,
    fontWeight: "800",
  },
  favoriteButton: {
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
  favoriteTouch: {
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
