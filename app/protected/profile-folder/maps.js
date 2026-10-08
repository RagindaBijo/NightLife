import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import MapView from "react-native-maps";
import { setPickedLocation } from "../../../lib/locationPick";
import { useI18n } from "../../../lib/i18n";
import { makeStyles, useTheme } from "../../../lib/theme-context";

// Tbilisi – used when there's no saved location and no GPS
const DEFAULT_CENTER = { latitude: 41.6938, longitude: 44.8015 };
const ZOOM = { latitudeDelta: 0.01, longitudeDelta: 0.01 };

const NOMINATIM = "https://nominatim.openstreetmap.org";
const NOMINATIM_HEADERS = { "Accept-Language": "en", "User-Agent": "NightLifeApp/1.0" };

const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#16121F" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8C85A3" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#16121F" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#262036" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#332B47" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0E1626" }] },
];

function parseLatLong(value) {
  const [lat, lon] = (value || "").split(",").map((part) => parseFloat(part));
  if (isNaN(lat) || isNaN(lon) || (lat === 0 && lon === 0)) return null;
  return { latitude: lat, longitude: lon };
}

const reverseGeocode = ({ latitude, longitude }) =>
  fetch(
    `${NOMINATIM}/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
    { headers: NOMINATIM_HEADERS },
  )
    .then((response) => response.json())
    .then((data) => data.display_name || null);

const searchAddress = (query) =>
  fetch(`${NOMINATIM}/search?format=json&limit=5&q=${encodeURIComponent(query)}`, {
    headers: NOMINATIM_HEADERS,
  })
    .then((response) => response.json())
    .then((data) =>
      data.map((place) => ({
        id: String(place.place_id),
        label: place.display_name,
        coordinate: { latitude: parseFloat(place.lat), longitude: parseFloat(place.lon) },
      })),
    );

/**
 * Location picker for the venue profile: move the map under the pin (or
 * search an address), then confirm. The result goes back via lib/locationPick.
 */
export default function LocationPicker() {
  const { colors: COLORS, scheme } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  const { currentLatLong } = useLocalSearchParams();
  const router = useRouter();
  const mapRef = useRef(null);
  const geocodeTimer = useRef(null);
  const searchTimer = useRef(null);
  const [initialCenter] = useState(() => parseLatLong(currentLatLong) ?? DEFAULT_CENTER);
  const [center, setCenter] = useState(initialCenter);
  const [address, setAddress] = useState(null);
  const [resolving, setResolving] = useState(true);
  const [moving, setMoving] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);

  // Look up the address under the pin (debounced while the map moves)
  const lookUpAddress = useCallback((coordinate) => {
    clearTimeout(geocodeTimer.current);
    geocodeTimer.current = setTimeout(() => {
      reverseGeocode(coordinate)
        .then((name) => setAddress(name))
        .catch((err) => {
          console.warn("Reverse geocoding failed:", err.message);
          setAddress(null);
        })
        .finally(() => setResolving(false));
    }, 500);
  }, []);

  const resolveAddress = (coordinate) => {
    setResolving(true);
    lookUpAddress(coordinate);
  };

  const moveTo = (coordinate) => {
    mapRef.current?.animateToRegion({ ...coordinate, ...ZOOM }, 500);
  };

  const goToMyLocation = useCallback(
    () =>
      Location.requestForegroundPermissionsAsync()
        .then(({ status }) => {
          if (status !== "granted") {
            setLocationDenied(true);
            return null;
          }
          setLocationDenied(false);
          return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        })
        .then((position) => {
          if (!position) return;
          mapRef.current?.animateToRegion(
            {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              ...ZOOM,
            },
            500,
          );
        })
        .catch((err) => console.warn("Couldn't get location:", err.message)),
    [],
  );

  // First address lookup; jump to the user's position if no location is saved yet
  useEffect(() => {
    lookUpAddress(initialCenter); // "resolving" already starts as true
    if (!parseLatLong(currentLatLong)) goToMyLocation();
    return () => {
      clearTimeout(geocodeTimer.current);
      clearTimeout(searchTimer.current);
    };
  }, [lookUpAddress, goToMyLocation, initialCenter, currentLatLong]);

  const handleQueryChange = (text) => {
    setQuery(text);
    clearTimeout(searchTimer.current);
    if (text.trim().length < 3) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(() => {
      searchAddress(text.trim())
        .then(setResults)
        .catch((err) => {
          console.warn("Address search failed:", err.message);
          setResults([]);
        })
        .finally(() => setSearching(false));
    }, 600);
  };

  const chooseResult = (result) => {
    Keyboard.dismiss();
    setQuery("");
    setResults([]);
    moveTo(result.coordinate);
  };

  const confirm = () => {
    setPickedLocation({
      latLong: `${center.latitude.toFixed(6)},${center.longitude.toFixed(6)}`,
      address: address || `${center.latitude.toFixed(5)}, ${center.longitude.toFixed(5)}`,
    });
    router.back();
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={{ ...initialCenter, ...ZOOM }}
        showsUserLocation={!locationDenied}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        userInterfaceStyle={scheme}
        customMapStyle={Platform.OS === "android" && scheme === "dark" ? DARK_MAP_STYLE : undefined}
        onRegionChange={() => !moving && setMoving(true)}
        onRegionChangeComplete={(region) => {
          setMoving(false);
          const coordinate = { latitude: region.latitude, longitude: region.longitude };
          setCenter(coordinate);
          resolveAddress(coordinate);
        }}
        onPanDrag={() => Keyboard.dismiss()}
      />

      {/* Fixed pin in the middle of the map */}
      <View style={styles.pinWrap} pointerEvents="none">
        <View style={[styles.pin, moving && styles.pinLifted]}>
          <MaterialCommunityIcons name="map-marker" size={48} color={COLORS.accent} />
        </View>
        <View style={[styles.pinShadow, moving && styles.pinShadowLifted]} />
      </View>

      {/* Top: back + address search */}
      <View style={styles.top} pointerEvents="box-none">
        <View style={styles.searchRow}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t("common.goBack")}
          >
            <MaterialIcons name="arrow-back" size={24} color={COLORS.text} />
          </Pressable>
          <View style={styles.searchBar}>
            <MaterialIcons name="search" size={22} color={COLORS.textSecondary} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={handleQueryChange}
              placeholder={t("locationPicker.searchPlaceholder")}
              placeholderTextColor={COLORS.placeholder}
              selectionColor={COLORS.accent}
              autoCorrect={false}
              returnKeyType="search"
            />
            {searching ? (
              <ActivityIndicator size="small" color={COLORS.accent} />
            ) : (
              !!query && (
                <Pressable onPress={() => handleQueryChange("")} hitSlop={10} accessibilityLabel={t("common.clearSearch")}>
                  <MaterialIcons name="cancel" size={20} color={COLORS.textSecondary} />
                </Pressable>
              )
            )}
          </View>
        </View>

        {results.length > 0 && (
          <View style={styles.results}>
            {results.map((result, index) => (
              <Pressable
                key={result.id}
                onPress={() => chooseResult(result)}
                style={({ pressed }) => [
                  styles.result,
                  index > 0 && styles.resultDivider,
                  pressed && styles.resultPressed,
                ]}
                accessibilityRole="button"
              >
                <MaterialIcons name="place" size={20} color={COLORS.accent} />
                <Text style={styles.resultText} numberOfLines={2}>
                  {result.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* Bottom: my location + chosen address + confirm */}
      <View style={styles.bottom} pointerEvents="box-none">
        <Pressable
          onPress={() => (locationDenied ? Linking.openSettings() : goToMyLocation())}
          style={({ pressed }) => [styles.roundButton, styles.locateButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={locationDenied ? t("map.turnOnLocationSettings") : t("locationPicker.useMyLocation")}
        >
          <MaterialCommunityIcons
            name={locationDenied ? "crosshairs-off" : "crosshairs-gps"}
            size={22}
            color={COLORS.text}
          />
        </Pressable>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t("locationPicker.title")}</Text>
          <View style={styles.addressRow}>
            <View style={styles.addressIcon}>
              <MaterialIcons name="storefront" size={20} color={COLORS.accent} />
            </View>
            <View style={styles.addressText}>
              {resolving || moving ? (
                <Text style={styles.addressPending}>{t("locationPicker.findingAddress")}</Text>
              ) : (
                <Text style={styles.address} numberOfLines={3}>
                  {address || t("locationPicker.addressNotFound")}
                </Text>
              )}
              <Text style={styles.coordinates}>
                {center.latitude.toFixed(5)}, {center.longitude.toFixed(5)}
              </Text>
            </View>
          </View>
          <Text style={styles.hint}>{t("locationPicker.hint")}</Text>
          <Pressable
            onPress={confirm}
            disabled={resolving || moving}
            style={({ pressed }) => [
              styles.confirmButton,
              (resolving || moving) && styles.confirmDisabled,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
          >
            <MaterialIcons name="check" size={20} color={COLORS.onAccent} />
            <Text style={styles.confirmText}>{t("locationPicker.confirm")}</Text>
          </Pressable>
        </View>
      </View>
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

  // Pin
  pinWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  pin: {
    marginBottom: 46, // the marker's tip sits on the map centre
  },
  pinLifted: {
    transform: [{ translateY: -10 }],
  },
  pinShadow: {
    position: "absolute",
    width: 12,
    height: 5,
    borderRadius: 6,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  pinShadowLifted: {
    width: 8,
    opacity: 0.6,
  },

  // Top
  top: {
    position: "absolute",
    top: 10,
    left: 12,
    right: 12,
    gap: 8,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  roundButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    ...shadow,
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
  results: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    overflow: "hidden",
    ...shadow,
  },
  result: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  resultDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  resultPressed: {
    backgroundColor: COLORS.surfacePressed,
  },
  resultText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
  },

  // Bottom
  bottom: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 16,
    gap: 10,
  },
  locateButton: {
    alignSelf: "flex-end",
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 16,
    gap: 10,
    ...shadow,
  },
  cardLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  addressIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  addressText: {
    flex: 1,
    gap: 4,
  },
  address: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 20,
  },
  addressPending: {
    color: COLORS.textSecondary,
    fontSize: 15,
  },
  coordinates: {
    color: COLORS.placeholder,
    fontSize: 12,
  },
  hint: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  confirmButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    paddingVertical: 14,
  },
  confirmDisabled: {
    opacity: 0.45,
  },
  confirmText: {
    color: COLORS.onAccent,
    fontSize: 16,
    fontWeight: "800",
  },
}));
