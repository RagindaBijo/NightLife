import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { Image } from "expo-image";
import * as Location from "expo-location";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { api } from "../../lib/api";
import { translate, useI18n } from "../../lib/i18n";
import { VENUE_TYPES, venueTypeIcon, venueTypeLabel } from "../../lib/venueTypes";
import { makeStyles, useTheme } from "../../lib/theme-context";

// Tbilisi – used until the user's location is known
const DEFAULT_REGION = {
  latitude: 41.6938,
  longitude: 44.8015,
  latitudeDelta: 0.0922,
  longitudeDelta: 0.0421,
};

const RATING_OPTIONS = [
  { value: 0, labelKey: "map.anyRating" },
  { value: 3, label: "3+" },
  { value: 4, label: "4+" },
  { value: 4.5, label: "4.5+" },
];

const MAX_DISTANCE = 26; // slider's last step means "any distance"

// Dark map for Google Maps (Android) in dark mode; iOS follows userInterfaceStyle
const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#16121F" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8C85A3" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#16121F" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#262036" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#332B47" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1626" }] },
];

function distanceKm(from, to) {
  const R = 6371;
  const dLat = ((to.latitude - from.latitude) * Math.PI) / 180;
  const dLon = ((to.longitude - from.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((from.latitude * Math.PI) / 180) *
      Math.cos((to.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const formatDistance = (km) =>
  km < 1
    ? translate("map.meters", { value: Math.round(km * 1000) })
    : translate("map.kilometers", { value: km.toFixed(1) });

function parseVenue(venue) {
  const [lat, lon] = (venue.lat_long || "").split(",").map((part) => parseFloat(part));
  if (isNaN(lat) || isNaN(lon)) return null; // venues without a location can't be shown
  return {
    id: String(venue.id),
    title: venue.title || translate("venue.fallbackTitle"),
    address: venue.address || "",
    image: venue.photo_ids[0] || null,
    types: venue.types ?? [],
    ratingAvg: venue.rating_avg ?? null,
    ratingCount: venue.rating_count ?? 0,
    coordinate: { latitude: lat, longitude: lon },
  };
}

// ── UI pieces ────────────────────────────────────

function TypeChip({ type, active, onPress, compact }) {
  const { colors: COLORS } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, compact && styles.chipCompact, active && styles.chipActive]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
    >
      {type.icon && (
        <MaterialCommunityIcons
          name={type.icon}
          size={15}
          color={active ? COLORS.onAccent : COLORS.accent}
        />
      )}
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {type.label ?? venueTypeLabel(type.key)}
      </Text>
    </Pressable>
  );
}

function VenueMarker({ venue, selected }) {
  const { colors: COLORS } = useTheme();
  const styles = useStyles();
  const icon = venue.types.length > 0 ? venueTypeIcon(venue.types[0]) : "map-marker";
  return (
    <View style={styles.markerWrap}>
      <View style={[styles.marker, selected && styles.markerSelected]}>
        <MaterialCommunityIcons
          name={icon}
          size={selected ? 20 : 16}
          color={selected ? COLORS.onAccent : COLORS.text}
        />
      </View>
      <View style={[styles.markerTip, selected && styles.markerTipSelected]} />
    </View>
  );
}

function RatingText({ avg, count }) {
  const { colors: COLORS } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  if (!count) return <Text style={styles.previewMeta}>{t("venue.noRatings")}</Text>;
  return (
    <View style={styles.ratingRow}>
      <MaterialIcons name="star" size={15} color={COLORS.gold} />
      <Text style={styles.previewMeta}>
        <Text style={styles.ratingValue}>{avg}</Text> ({count})
      </Text>
    </View>
  );
}

// ── Screen ───────────────────────────────────────

export default function Maps() {
  const { colors: COLORS, scheme } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  const router = useRouter();
  const mapRef = useRef(null);
  const [venues, setVenues] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [location, setLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState("pending"); // pending | granted | denied
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [minRating, setMinRating] = useState(0);
  const [maxDistance, setMaxDistance] = useState(MAX_DISTANCE);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  // ── Data ──

  const fetchVenues = useCallback(
    () =>
      api("/api/venues").then(
        (data) => {
          setVenues(data.map(parseVenue).filter(Boolean));
          setLoadError(null);
        },
        (err) => {
          console.error("Error fetching venues:", err.message);
          setLoadError(
            err.status === 0 ? t("map.connectError") : t("map.loadError"),
          );
        },
      ),
    [t],
  );

  // Refresh venues whenever the map tab comes into view
  useFocusEffect(
    useCallback(() => {
      fetchVenues();
    }, [fetchVenues]),
  );

  const locateUser = useCallback(
    ({ animate } = { animate: true }) =>
      Location.requestForegroundPermissionsAsync()
        .then(({ status }) => {
          if (status !== "granted") {
            setLocationStatus("denied");
            return null;
          }
          setLocationStatus("granted");
          return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        })
        .then((position) => {
          if (!position) return;
          const coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          setLocation(coords);
          if (animate) {
            mapRef.current?.animateToRegion(
              { ...coords, latitudeDelta: 0.05, longitudeDelta: 0.05 },
              600,
            );
          }
        })
        // Location services off, timeout, etc. – the map still works without it
        .catch((err) => console.warn("Couldn't get location:", err.message)),
    [],
  );

  useEffect(() => {
    locateUser();
  }, [locateUser]);

  // ── Filtering ──

  const distanceLimited = location && maxDistance < MAX_DISTANCE;

  const visibleVenues = useMemo(() => {
    if (!venues) return [];
    const query = searchQuery.trim().toLowerCase();

    return venues.filter((venue) => {
      if (query) {
        const haystack = [
          venue.title,
          venue.address,
          ...venue.types.map(venueTypeLabel),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (selectedTypes.length > 0 && !venue.types.some((type) => selectedTypes.includes(type))) {
        return false;
      }
      if (minRating > 0 && !(venue.ratingAvg >= minRating)) return false;
      if (distanceLimited && distanceKm(location, venue.coordinate) > maxDistance) return false;
      return true;
    });
  }, [venues, searchQuery, selectedTypes, minRating, distanceLimited, location, maxDistance]);

  const activeFilterCount =
    selectedTypes.length + (minRating > 0 ? 1 : 0) + (distanceLimited ? 1 : 0);

  const selectedVenue = visibleVenues.find((venue) => venue.id === selectedId) ?? null;

  const toggleType = (key) =>
    setSelectedTypes((prev) =>
      prev.includes(key) ? prev.filter((type) => type !== key) : [...prev, key],
    );

  const resetFilters = () => {
    setSelectedTypes([]);
    setMinRating(0);
    setMaxDistance(MAX_DISTANCE);
  };

  const selectVenue = (venue) => {
    setSelectedId(venue.id);
    mapRef.current?.animateToRegion(
      { ...venue.coordinate, latitudeDelta: 0.02, longitudeDelta: 0.02 },
      400,
    );
  };

  // ── Render ──

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={DEFAULT_REGION}
        showsUserLocation={locationStatus === "granted"}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        userInterfaceStyle={scheme}
        customMapStyle={Platform.OS === "android" && scheme === "dark" ? DARK_MAP_STYLE : undefined}
        onPress={() => setSelectedId(null)}
      >
        {visibleVenues.map((venue) => {
          const selected = venue.id === selectedId;
          return (
            <Marker
              // Re-mount on selection change so the custom view redraws
              key={`${venue.id}-${selected ? "on" : "off"}`}
              coordinate={venue.coordinate}
              onPress={(e) => {
                e.stopPropagation();
                selectVenue(venue);
              }}
              tracksViewChanges={false}
              anchor={{ x: 0.5, y: 1 }}
              zIndex={selected ? 2 : 1}
            >
              <VenueMarker venue={venue} selected={selected} />
            </Marker>
          );
        })}
      </MapView>

      {/* Search + quick type filters */}
      <View style={styles.topOverlay} pointerEvents="box-none">
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <MaterialIcons name="search" size={22} color={COLORS.textSecondary} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t("map.searchPlaceholder")}
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
          <Pressable
            onPress={() => setFiltersOpen(true)}
            style={({ pressed }) => [
              styles.filterButton,
              activeFilterCount > 0 && styles.filterButtonActive,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={
              activeFilterCount
                ? t("map.filtersActive", { count: activeFilterCount })
                : t("map.filters")
            }
          >
            <MaterialCommunityIcons
              name="tune-variant"
              size={22}
              color={activeFilterCount > 0 ? COLORS.onAccent : COLORS.text}
            />
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickChips}
          keyboardShouldPersistTaps="handled"
        >
          <TypeChip
            type={{ label: t("map.all") }}
            active={selectedTypes.length === 0}
            onPress={() => setSelectedTypes([])}
            compact
          />
          {VENUE_TYPES.map((type) => (
            <TypeChip
              key={type.key}
              type={type}
              active={selectedTypes.includes(type.key)}
              onPress={() => toggleType(type.key)}
              compact
            />
          ))}
        </ScrollView>
      </View>

      {/* Bottom area: status, my-location button, selected venue */}
      <View style={styles.bottomOverlay} pointerEvents="box-none">
        <View style={styles.bottomRow} pointerEvents="box-none">
          <View style={styles.statusPill}>
            {!venues && !loadError ? (
              <ActivityIndicator size="small" color={COLORS.accent} />
            ) : loadError ? (
              <Pressable onPress={fetchVenues} style={styles.statusPressable}>
                <MaterialIcons name="refresh" size={16} color={COLORS.accent} />
                <Text style={styles.statusText}>{`${loadError} ${t("map.tapToRetry")}`}</Text>
              </Pressable>
            ) : (
              <Text style={styles.statusText}>
                {t("map.venueCount", { count: visibleVenues.length })}
              </Text>
            )}
          </View>
          <Pressable
            onPress={() =>
              locationStatus === "denied" ? Linking.openSettings() : locateUser()
            }
            style={({ pressed }) => [styles.locateButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={
              locationStatus === "denied" ? t("map.turnOnLocationSettings") : t("map.goToMyLocation")
            }
          >
            <MaterialCommunityIcons
              name={locationStatus === "denied" ? "crosshairs-off" : "crosshairs-gps"}
              size={22}
              color={COLORS.text}
            />
          </Pressable>
        </View>

        {locationStatus === "denied" && !selectedVenue && (
          <Pressable
            onPress={() => Linking.openSettings()}
            style={({ pressed }) => [styles.banner, pressed && styles.pressed]}
          >
            <MaterialIcons name="location-off" size={20} color={COLORS.accent} />
            <Text style={styles.bannerText}>
              {t("map.locationBanner")}
            </Text>
            <Text style={styles.bannerAction}>{t("map.settings")}</Text>
          </Pressable>
        )}

        {selectedVenue && (
          <Pressable
            onPress={() => router.push(`/protected/home/venueId/${selectedVenue.id}`)}
            style={({ pressed }) => [styles.preview, pressed && styles.previewPressed]}
            accessibilityRole="button"
            accessibilityLabel={t("map.openVenue", { name: selectedVenue.title })}
          >
            {selectedVenue.image ? (
              <Image source={{ uri: selectedVenue.image }} style={styles.previewImage} contentFit="cover" transition={200} />
            ) : (
              <View style={[styles.previewImage, styles.previewImagePlaceholder]}>
                <MaterialIcons name="storefront" size={28} color={COLORS.textSecondary} />
              </View>
            )}
            <View style={styles.previewText}>
              <Text style={styles.previewTitle} numberOfLines={1}>
                {selectedVenue.title}
              </Text>
              <RatingText avg={selectedVenue.ratingAvg} count={selectedVenue.ratingCount} />
              {selectedVenue.types.length > 0 && (
                <Text style={styles.previewTypes} numberOfLines={1}>
                  {selectedVenue.types.map(venueTypeLabel).join(" · ")}
                </Text>
              )}
              <Text style={styles.previewMeta} numberOfLines={1}>
                {location
                  ? t("map.away", { distance: formatDistance(distanceKm(location, selectedVenue.coordinate)) })
                  : selectedVenue.address || t("venue.noAddress")}
              </Text>
            </View>
            <View style={styles.previewSide}>
              <Pressable
                onPress={() => setSelectedId(null)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t("common.close")}
              >
                <MaterialIcons name="close" size={20} color={COLORS.textSecondary} />
              </Pressable>
              <MaterialIcons name="chevron-right" size={26} color={COLORS.accent} />
            </View>
          </Pressable>
        )}
      </View>

      {/* Filters sheet */}
      <Modal
        visible={filtersOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFiltersOpen(false)}
      >
        <View style={styles.sheetBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setFiltersOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{t("map.filters")}</Text>
              <Pressable onPress={resetFilters} hitSlop={10} disabled={activeFilterCount === 0}>
                <Text style={[styles.resetText, activeFilterCount === 0 && styles.resetTextDisabled]}>
                  {t("map.reset")}
                </Text>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.sectionLabel}>{t("map.venueType")}</Text>
              <View style={styles.chipWrap}>
                {VENUE_TYPES.map((type) => (
                  <TypeChip
                    key={type.key}
                    type={type}
                    active={selectedTypes.includes(type.key)}
                    onPress={() => toggleType(type.key)}
                  />
                ))}
              </View>

              <Text style={styles.sectionLabel}>{t("map.minimumRating")}</Text>
              <View style={styles.segment}>
                {RATING_OPTIONS.map((option) => {
                  const active = option.value === minRating;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => setMinRating(option.value)}
                      style={[styles.segmentItem, active && styles.segmentItemActive]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                    >
                      {option.value > 0 && (
                        <MaterialIcons
                          name="star"
                          size={14}
                          color={active ? COLORS.onAccent : COLORS.gold}
                        />
                      )}
                      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                        {option.labelKey ? t(option.labelKey) : option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.distanceHeader}>
                <Text style={styles.sectionLabel}>{t("map.distance")}</Text>
                <Text style={styles.distanceValue}>
                  {maxDistance >= MAX_DISTANCE ? t("map.anyDistance") : t("map.within", { value: maxDistance })}
                </Text>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={1}
                maximumValue={MAX_DISTANCE}
                step={1}
                value={maxDistance}
                onValueChange={setMaxDistance}
                disabled={!location}
                minimumTrackTintColor={COLORS.accent}
                maximumTrackTintColor={COLORS.border}
                thumbTintColor={COLORS.accent}
              />
              {!location && (
                <Text style={styles.hint}>{t("map.distanceNeedsLocation")}</Text>
              )}
            </ScrollView>

            <Pressable
              onPress={() => setFiltersOpen(false)}
              style={({ pressed }) => [styles.applyButton, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Text style={styles.applyText}>
                {t("map.showVenues", { count: visibleVenues.length })}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const shadow = {
  shadowColor: "#000",
  shadowOpacity: 0.35,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 3 },
  elevation: 6,
};

const useStyles = makeStyles((COLORS) => ({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  pressed: {
    opacity: 0.7,
  },

  // Top overlay
  topOverlay: {
    position: "absolute",
    top: 10,
    left: 0,
    right: 0,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingHorizontal: 12,
    ...shadow,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 16,
    paddingVertical: 12,
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    ...shadow,
  },
  filterButtonActive: {
    backgroundColor: COLORS.accent,
  },
  filterBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: COLORS.text,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBadgeText: {
    color: COLORS.onAccent,
    fontSize: 11,
    fontWeight: "800",
  },
  quickChips: {
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  // Chips
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.45)",
    backgroundColor: COLORS.surface,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  chipCompact: {
    ...shadow,
    borderColor: "transparent",
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

  // Markers
  markerWrap: {
    alignItems: "center",
  },
  marker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  markerSelected: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.accent,
    borderColor: COLORS.text,
  },
  markerTip: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: COLORS.accent,
    marginTop: -1,
  },
  markerTipSelected: {
    borderTopColor: COLORS.text,
  },

  // Bottom overlay
  bottomOverlay: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 16,
    gap: 10,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusPill: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 14,
    ...shadow,
  },
  statusPressable: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "600",
  },
  locateButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    ...shadow,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    ...shadow,
  },
  bannerText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 13,
  },
  bannerAction: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: "700",
  },

  // Selected venue preview
  preview: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 10,
    ...shadow,
  },
  previewPressed: {
    backgroundColor: COLORS.surfacePressed,
  },
  previewImage: {
    width: 84,
    height: 84,
    borderRadius: 14,
  },
  previewImagePlaceholder: {
    backgroundColor: COLORS.surfacePressed,
    alignItems: "center",
    justifyContent: "center",
  },
  previewText: {
    flex: 1,
    marginLeft: 12,
    gap: 3,
  },
  previewTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "800",
  },
  previewTypes: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: "600",
  },
  previewMeta: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingValue: {
    color: COLORS.text,
    fontWeight: "700",
  },
  previewSide: {
    alignSelf: "stretch",
    justifyContent: "space-between",
    alignItems: "center",
    paddingLeft: 6,
  },

  // Filters sheet
  sheetBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.55)",
  },
  sheet: {
    maxHeight: "85%",
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 24,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    marginTop: 10,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 6,
  },
  sheetTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "800",
  },
  resetText: {
    color: COLORS.accent,
    fontSize: 15,
    fontWeight: "600",
  },
  resetTextDisabled: {
    opacity: 0.35,
  },
  sheetContent: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  sectionLabel: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "700",
    marginTop: 18,
    marginBottom: 10,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  segment: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 4,
  },
  segmentItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 9,
    borderRadius: 10,
  },
  segmentItemActive: {
    backgroundColor: COLORS.accent,
  },
  segmentText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
  segmentTextActive: {
    color: COLORS.onAccent,
    fontWeight: "700",
  },
  distanceHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  distanceValue: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: "700",
  },
  slider: {
    width: "100%",
    height: 40,
  },
  hint: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  applyButton: {
    marginHorizontal: 20,
    marginTop: 8,
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  applyText: {
    color: COLORS.onAccent,
    fontSize: 16,
    fontWeight: "800",
  },
}));
