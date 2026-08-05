import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Slider from '@react-native-community/slider';
import * as Location from 'expo-location';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import RNModal from 'react-native-modal';

export default function Maps() {
  const { selectLocation, currentLatLong } = useLocalSearchParams();
  const router = useRouter();
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('All');
  const [selectedRating, setSelectedRating] = useState('All');
  const [selectedDistance, setSelectedDistance] = useState(25.5);
  const [filteredVenues, setFilteredVenues] = useState([]);
  const [venues, setVenues] = useState([]);
  const [isFilterModalVisible, setFilterModalVisible] = useState(false);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const apiUrl = 'https://night-life-api.elevator-rand.workers.dev';
  const [lastFetch, setLastFetch] = useState(0);
  const debounceTimeout = useRef(null);

  const calculateDistance = useCallback((lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  const reverseGeocode = useCallback(async (lat, lon) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`
      );
      const data = await response.json();
      return data.display_name || 'Unknown Address';
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      Alert.alert('Error', 'Failed to fetch address. Using coordinates only.');
      return 'Unknown Address';
    }
  }, []);

  const fetchVenues = useCallback(async () => {
    const now = Date.now();
    if (now - lastFetch < 1000) return;
    setLastFetch(now);

    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'No token found. Please log in.');
        return;
      }

      const response = await fetch(`${apiUrl}/api/venues`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const parsedVenues = data.map((venue) => {
          let latitude = null;
          let longitude = null;
          if (venue.lat_long) {
            const [lat, lon] = venue.lat_long.split(',').map(coord => parseFloat(coord.trim()));
            if (!isNaN(lat) && !isNaN(lon)) {
              latitude = lat;
              longitude = lon;
            }
          }
          return {
            id: venue.id.toString(),
            title: venue.title || 'Unknown Venue',
            address: venue.address || 'No Address',
            latitude,
            longitude,
            style: venue.style || 'Venue',
            rating: venue.rating || 0,
          };
        }).filter(venue => venue.latitude !== null && venue.longitude !== null);
        setVenues(parsedVenues);
      } else {
        console.error('Failed to fetch venues');
        Alert.alert('Error', 'Failed to fetch venues from the database.');
      }
    } catch (error) {
      console.error('Error fetching venues:', error);
      Alert.alert('Error', 'Failed to fetch venues due to a network issue.');
    }
  }, [lastFetch]);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        Alert.alert('Location Permission', 'Please enable location access for better experience.');
        return;
      }

      let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation(loc);

      let initialLat = loc?.coords.latitude || 41.6938;
      let initialLong = loc?.coords.longitude || 44.8015;
      let deltaLat = selectLocation === 'true' ? 0.01 : 0.0922;
      let deltaLong = selectLocation === 'true' ? 0.01 : 0.0421;

      if (selectLocation === 'true' && currentLatLong) {
        const [latStr, longStr] = currentLatLong.split(',');
        const lat = parseFloat(latStr?.trim());
        const long = parseFloat(longStr?.trim());
        if (!isNaN(lat) && !isNaN(long) && (lat !== 0 || long !== 0)) {
          initialLat = lat;
          initialLong = long;
        }
      }

      setSelectedMarker({
        latitude: initialLat,
        longitude: initialLong,
        latitudeDelta: deltaLat,
        longitudeDelta: deltaLong,
      });
    })();
  }, [selectLocation, currentLatLong]);

  useFocusEffect(
    useCallback(() => {
      if (selectLocation !== 'true') {
        fetchVenues();
      }
    }, [selectLocation, fetchVenues])
  );

  useEffect(() => {
    let filtered = venues.filter(venue =>
      venue.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (selectedStyle !== 'All') {
      filtered = filtered.filter(venue => venue.style === selectedStyle);
    }

    if (selectedRating !== 'All') {
      const minRating = parseFloat(selectedRating.split('+')[0]);
      filtered = filtered.filter(venue => venue.rating >= minRating);
    }

    if (selectedDistance < 25.5 && location) {
      filtered = filtered.filter(venue => {
        const distance = calculateDistance(
          location.coords.latitude,
          location.coords.longitude,
          venue.latitude,
          venue.longitude
        );
        return distance <= selectedDistance;
      });
    }

    setFilteredVenues(filtered);
  }, [searchQuery, selectedStyle, selectedRating, selectedDistance, location, venues, calculateDistance]);

  const handleRegionChangeComplete = useCallback((region) => {
    if (selectLocation === 'true') {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
      debounceTimeout.current = setTimeout(() => {
        setSelectedMarker({
          latitude: region.latitude,
          longitude: region.longitude,
          latitudeDelta: region.latitudeDelta,
          longitudeDelta: region.longitudeDelta,
        });
      }, 100);
    }
  }, [selectLocation]);

  const handleConfirmLocation = useCallback(async () => {
    if (!selectedMarker || !selectedMarker.latitude || !selectedMarker.longitude) {
      Alert.alert('Error', 'No valid location selected. Please try again.');
      return;
    }
    const { latitude, longitude } = selectedMarker;
    const address = await reverseGeocode(latitude, longitude);
    router.replace({
      pathname: '/protected/profile-folder/venue-profile',
      params: {
        selectedLatLong: `${latitude.toFixed(6)},${longitude.toFixed(6)}`,
        selectedAddress: encodeURIComponent(address),
      },
    });
  }, [selectedMarker, reverseGeocode, router]);

  const toggleFilterModal = useCallback(() => {
    setFilterModalVisible(!isFilterModalVisible);
  }, [isFilterModalVisible]);

  const selectStyle = useCallback((style) => {
    setSelectedStyle(style);
  }, []);

  const selectRating = useCallback((rating) => {
    setSelectedRating(rating);
  }, []);

  const venueStyles = ['All', ...new Set(venues.map(v => v.style))];
  const ratings = ['All', '4+', '3+', '2+'];

  return (
    <View style={styles.container}>
      {selectLocation !== 'true' && (
        <View style={styles.controlsContainer}>
          <View style={styles.searchContainer}>
            <MaterialIcons name="search" size={24} color="#A0A0A0" style={styles.searchIcon} />
            <TextInput
              style={styles.searchBar}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search"
              placeholderTextColor="#A0A0A0"
            />
            <TouchableOpacity style={styles.filterButton} onPress={toggleFilterModal}>
              <MaterialIcons name="filter-list" size={24} color="#F7F7F7" />
            </TouchableOpacity>
          </View>
        </View>
      )}
      {selectLocation === 'true' && (
        <View style={styles.controlsContainer}>
          <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmLocation}>
            <Text style={styles.confirmButtonText}>Confirm Location</Text>
          </TouchableOpacity>
        </View>
      )}
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
              {venueStyles.map(style => (
                <TouchableOpacity
                  key={style}
                  style={[
                    styles.filterOptionButton,
                    selectedStyle === style && styles.filterOptionButtonSelected,
                  ]}
                  onPress={() => selectStyle(style)}
                >
                  <Text style={styles.filterOptionText}>{style}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.filterLabel}>Rating</Text>
            <View style={styles.filterButtonContainer}>
              {ratings.map(rating => (
                <TouchableOpacity
                  key={rating}
                  style={{
                    ...styles.filterOptionButton,
                    ...(selectedRating === rating && styles.filterOptionButtonSelected),
                  }}
                  onPress={() => selectRating(rating)}
                >
                  <Text style={styles.filterOptionText}>{rating}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.filterLabel}>Distance</Text>
            <Text style={styles.sliderValue}>
              {selectedDistance >= 25.5 ? '25+ km' : `${selectedDistance} km`}
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
          <TouchableOpacity style={styles.closeButton} onPress={toggleFilterModal}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </RNModal>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: selectedMarker?.latitude || 41.6938,
          longitude: selectedMarker?.longitude || 44.8015,
          latitudeDelta: selectedMarker?.latitudeDelta || 0.0922,
          longitudeDelta: selectedMarker?.longitudeDelta || 0.0421,
        }}
        region={selectLocation === 'true' && selectedMarker ? {
          latitude: selectedMarker.latitude,
          longitude: selectedMarker.longitude,
          latitudeDelta: selectedMarker.latitudeDelta,
          longitudeDelta: selectedMarker.longitudeDelta,
        } : undefined}
        onRegionChangeComplete={handleRegionChangeComplete}
        showsUserLocation={true}
        showsMyLocationButton={true}
        mapType="standard"
      >
        {selectLocation !== 'true' &&
          filteredVenues.map((venue) => (
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
      {selectLocation === 'true' && (
        <View style={styles.fixedPinContainer} pointerEvents="none">
          <MaterialIcons name="location-pin" size={40} color="#26A69A" />
        </View>
      )}
      {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A3D62',
  },
  controlsContainer: {
    padding: 10,
    backgroundColor: '#0A3D62',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1B263B',
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchBar: {
    flex: 1,
    padding: 10,
    color: '#F7F7F7',
    fontSize: 16,
    backgroundColor: '#1B263B',
  },
  filterButton: {
    padding: 10,
  },
  confirmButton: {
    backgroundColor: '#BB86FC',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#F7F7F7',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modal: {
    justifyContent: 'center',
    margin: 20,
  },
  modalContent: {
    backgroundColor: '#1B263B',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#415A77',
    maxHeight: '80%',
  },
  modalTitle: {
    color: '#F7F7F7',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalScroll: {
    maxHeight: 300,
  },
  filterLabel: {
    color: '#F7F7F7',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 5,
  },
  filterButtonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  filterOptionButton: {
    backgroundColor: '#415A77',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    margin: 5,
  },
  filterOptionButtonSelected: {
    backgroundColor: '#3E92CC',
  },
  filterOptionText: {
    color: '#F7F7F7',
    fontSize: 14,
  },
  slider: {
    width: '100%',
    height: 40,
    marginBottom: 10,
  },
  sliderValue: {
    color: '#F7F7F7',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
  },
  closeButton: {
    backgroundColor: '#FF6F61',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 15,
  },
  closeButtonText: {
    color: '#F7F7F7',
    fontSize: 16,
    fontWeight: 'bold',
  },
  map: {
    flex: 1,
  },
  fixedPinContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -20,
    marginTop: -40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    color: '#E63946',
    fontSize: 16,
    textAlign: 'center',
  },
});