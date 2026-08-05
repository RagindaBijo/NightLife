import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Slider from "@react-native-community/slider";
import * as Location from "expo-location";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import RNModal from "react-native-modal";

export default function Maps() {
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("All");
  const [selectedRating, setSelectedRating] = useState("All");
  const [selectedDistance, setSelectedDistance] = useState(25.5); // 25.5 represents 25+ km (no limit)
  const [filteredVenues, setFilteredVenues] = useState([]);
  const [venues, setVenues] = useState([]); // State for fetched venues
  const [isFilterModalVisible, setFilterModalVisible] = useState(false);
  const apiUrl = "https://night-life-api.elevator-rand.workers.dev";
  const [lastFetch, setLastFetch] = useState(0); // Track last fetch time for debouncing

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const fetchVenues = async () => {
    const now = Date.now();
    if (now - lastFetch < 1000) return; // Debounce: skip if last fetch was < 1s ago
    setLastFetch(now);

    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Error", "No token found. Please log in.");
        return;
      }

      const response = await fetch(`${apiUrl}/api/venues`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        const parsedVenues = data
          .map((venue) => {
            let latitude = null;
            let longitude = null;
            if (venue.lat_long) {
              const [lat, lon] = venue.lat_long
                .split(",")
                .map((coord) => parseFloat(coord.trim()));
              if (!isNaN(lat) && !isNaN(lon)) {
                latitude = lat;
                longitude = lon;
              }
            }
            return {
              id: venue.id.toString(),
              title: venue.title || "Unknown Venue",
              address: venue.address || "No Address",
              latitude,
              longitude,
              style: venue.style || "Venue", // Placeholder if style not in DB
              rating: venue.rating || 0, // Placeholder if rating not in DB
            };
          })
          .filter(
            (venue) => venue.latitude !== null && venue.longitude !== null,
          ); // Filter out venues without valid lat_long
        setVenues(parsedVenues);
      } else {
        console.error("Failed to fetch venues");
        Alert.alert("Error", "Failed to fetch venues from the database.");
      }
    } catch (error) {
      console.error("Error fetching venues:", error);
      Alert.alert("Error", "Failed to fetch venues due to a network issue.");
    }
  };

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setErrorMsg("Permission to access location was denied");
        Alert.alert(
          "Location Permission",
          "Please enable location access for better experience.",
        );
        return;
      }

      let loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setLocation(loc);
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchVenues(); // Fetch venues every time the screen is focused
    }, []),
  );

  useEffect(() => {
    let filtered = venues.filter((venue) =>
      venue.title.toLowerCase().includes(searchQuery.toLowerCase()),
    );

    if (selectedStyle !== "All") {
      filtered = filtered.filter((venue) => venue.style === selectedStyle);
    }

    if (selectedRating !== "All") {
      const minRating = parseFloat(selectedRating.split("+")[0]);
      filtered = filtered.filter((venue) => venue.rating >= minRating);
    }

    if (selectedDistance < 25.5 && location) {
      // 25.5 represents 25+ km (no limit)
      filtered = filtered.filter((venue) => {
        const distance = calculateDistance(
          location.coords.latitude,
          location.coords.longitude,
          venue.latitude,
          venue.longitude,
        );
        return distance <= selectedDistance;
      });
    }

    setFilteredVenues(filtered);
  }, [
    searchQuery,
    selectedStyle,
    selectedRating,
    selectedDistance,
    location,
    venues,
  ]);

  const toggleFilterModal = () => {
    setFilterModalVisible(!isFilterModalVisible);
  };

  const selectStyle = (style) => {
    setSelectedStyle(style);
  };

  const selectRating = (rating) => {
    setSelectedRating(rating);
  };

  const venueStyles = ["All", ...new Set(venues.map((v) => v.style))];
  const ratings = ["All", "4+", "3+", "2+"];

  const initialRegion = {
    latitude: 41.6938,
    longitude: 44.8015,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  };

  return (
    <View style={styles.container}>
      <View style={styles.controlsContainer}>
        <View style={styles.searchContainer}>
          <MaterialIcons
            name="search"
            size={24}
            color="#A0A0A0"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchBar}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search"
            placeholderTextColor="#A0A0A0"
          />
          <TouchableOpacity
            style={styles.filterButton}
            onPress={toggleFilterModal}
          >
            <MaterialIcons name="filter-list" size={24} color="#F7F7F7" />
          </TouchableOpacity>
        </View>
      </View>
      <RNModal
        isVisible={isFilterModalVisible}
        onBackdropPress={toggleFilterModal}
        style={styles.modal}
        backdropOpacity={0.5}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Filter Venues</Text>
          <ScrollView style={styles.modalScroll}>
            <Text style={styles.filterLabel}>Style</Text>
            <View style={styles.filterButtonContainer}>
              {venueStyles.map((style) => (
                <TouchableOpacity
                  key={style}
                  style={[
                    styles.filterOptionButton,
                    selectedStyle === style &&
                      styles.filterOptionButtonSelected,
                  ]}
                  onPress={() => selectStyle(style)}
                >
                  <Text style={styles.filterOptionText}>{style}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.filterLabel}>Rating</Text>
            <View style={styles.filterButtonContainer}>
              {ratings.map((rating) => (
                <TouchableOpacity
                  key={rating}
                  style={{
                    ...styles.filterOptionButton,
                    ...(selectedRating === rating &&
                      styles.filterOptionButtonSelected),
                  }}
                  onPress={() => selectRating(rating)}
                >
                  <Text style={styles.filterOptionText}>{rating}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.filterLabel}>Distance</Text>
            <Text style={styles.sliderValue}>
              {selectedDistance >= 25.5 ? "25+ km" : `${selectedDistance} km`}
            </Text>
            <Slider
              style={styles.slider}
              minimumValue={0.5}
              maximumValue={25.5}
              step={0.5}
              value={selectedDistance}
              onValueChange={setSelectedDistance}
              minimumTrackTintColor="#3E92CC"
              maximumTrackTintColor="#A0A0A0"
              thumbTintColor="#FF6F61"
            />
          </ScrollView>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={toggleFilterModal}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </RNModal>
      <MapView
        style={styles.map}
        initialRegion={initialRegion}
        region={
          location
            ? {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                latitudeDelta: 0.0922,
                longitudeDelta: 0.0421,
              }
            : initialRegion
        }
        showsUserLocation={true}
        showsMyLocationButton={true}
        mapType="standard"
      >
        {filteredVenues.map((venue) => (
          <Marker
            key={venue.id}
            coordinate={{
              latitude: venue.latitude,
              longitude: venue.longitude,
            }}
            title={venue.title}
            description={venue.address}
            pinColor="#FF6F61"
          />
        ))}
      </MapView>
      {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A3D62", // Dark teal
  },
  controlsContainer: {
    padding: 10,
    backgroundColor: "#0A3D62",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1B263B", // Deep navy
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchBar: {
    flex: 1,
    padding: 10,
    color: "#F7F7F7", // Soft white
    fontSize: 16,
    backgroundColor: "#1B263B",
  },
  filterButton: {
    padding: 10,
  },
  modal: {
    justifyContent: "center",
    margin: 20,
  },
  modalContent: {
    backgroundColor: "#1B263B",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "#415A77", // Slightly lighter navy
    maxHeight: "80%",
  },
  modalTitle: {
    color: "#F7F7F7",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
  },
  modalScroll: {
    maxHeight: 300,
  },
  filterLabel: {
    color: "#F7F7F7",
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 10,
    marginBottom: 5,
  },
  filterButtonContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 10,
  },
  filterOptionButton: {
    backgroundColor: "#415A77",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    margin: 5,
  },
  filterOptionButtonSelected: {
    backgroundColor: "#3E92CC", // Light teal
  },
  filterOptionText: {
    color: "#F7F7F7",
    fontSize: 14,
  },
  slider: {
    width: "100%",
    height: 40,
    marginBottom: 10,
  },
  sliderValue: {
    color: "#F7F7F7",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 10,
  },
  closeButton: {
    backgroundColor: "#FF6F61", // Bright coral
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 15,
  },
  closeButtonText: {
    color: "#F7F7F7",
    fontSize: 16,
    fontWeight: "bold",
  },
  map: {
    flex: 1,
  },
  errorText: {
    position: "absolute",
    bottom: 20,
    alignSelf: "center",
    color: "#E63946", // Bright red
    fontSize: 16,
    textAlign: "center",
  },
});
