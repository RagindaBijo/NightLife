import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { Image } from "expo-image";
import { Link, useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect, useState } from "react";
import {
  Dimensions,
  FlatList,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const Tab = createMaterialTopTabNavigator();

export default function VenueDetail() {
  const { id } = useLocalSearchParams();
  const navigation = useNavigation();
  const [venue, setVenue] = useState({
    id: "",
    title: "",
    address: "",
    openHours: "Mon-Sun: 10AM-10PM",
    status: "",
    about: "",
    event_ids: null,
    images: ["https://picsum.photos/800/600?random=1"],
  });
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userType, setUserType] = useState(null);
  const [isImageModalVisible, setIsImageModalVisible] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const apiUrl = "https://night-life-api.elevator-rand.workers.dev";

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    const fetchVenue = async () => {
      try {
        setLoading(true);
        setError(null);
        const token = await AsyncStorage.getItem("token");
        const storedUserType = await AsyncStorage.getItem("userType");
        setUserType(storedUserType);

        if (!token) {
          setError("Authentication token not found. Please log in.");
          return;
        }

        const response = await fetch(`${apiUrl}/api/venue/${id}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch venue: ${response.status}`);
        }

        const data = await response.json();
        if (data.error) {
          throw new Error("Venue not found");
        }

        const mockImages = [
          `https://picsum.photos/800/600?random=1`,
          `https://picsum.photos/800/600?random=2`,
          `https://picsum.photos/800/600?random=3`,
        ];

        const images = data.photo_ids
          ? data.photo_ids
              .split(",")
              .map((url) => url.trim())
              .filter(Boolean)
          : mockImages;

        console.log("Venue images:", images);

        setVenue({
          id: String(data.id || id),
          title: data.title || "Venue Profile",
          address: data.address || "No address provided",
          openHours: data.open_hours || "Mon-Sun: 10AM-10PM",
          status: data.status || "No status provided",
          about: data.about || "No about information provided",
          event_ids: data.event_ids || null,
          images: images.length > 0 ? images : mockImages,
        });
      } catch (err) {
        console.error("Error fetching venue:", err);
        setError("Failed to load venue. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchVenue();
  }, [id]);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setEvents([]);
        const token = await AsyncStorage.getItem("token");
        if (!token) {
          setError("Authentication token not found.");
          return;
        }

        const response = await fetch(`${apiUrl}/api/events?venue_id=${id}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch events: ${response.status}`);
        }

        const data = await response.json();
        setEvents(
          data.map((event, index) => ({
            id: String(event.id),
            title: event.title || `Event ${index + 1}`,
            body: event.about || "No event description",
            image: event.photo_ids
              ? event.photo_ids
                  .split(",")
                  .filter((url) => url.trim())[0]
                  ?.trim()
              : `https://picsum.photos/200/200?random=${index + 1}`,
          })),
        );
      } catch (err) {
        console.error("Error fetching events:", err);
        setError("Failed to load events.");
      }
    };

    fetchEvents();
  }, [id]);

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

  const openImageModal = () => {
    if (venue.images.length === 0) {
      console.log("No images to display in modal");
      return;
    }
    console.log("Image pressed, opening modal");
    setActiveIndex(0);
    setIsImageModalVisible(true);
  };

  const closeImageModal = () => {
    console.log("Modal closed");
    setIsImageModalVisible(false);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Loading venue...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!venue.id) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Venue not found</Text>
      </View>
    );
  }

  const StatusScreen = () => (
    <View style={styles.tabContent}>
      <View style={styles.tabTextContainer}>
        <Text style={styles.tabContentText}>{venue.status}</Text>
      </View>
    </View>
  );

  const EventsScreen = () => (
    <ScrollView style={styles.eventListContainer}>
      {events.length === 0 ? (
        <View style={styles.noEventsContainer}>
          <Text style={styles.noEventsText}>No Events</Text>
        </View>
      ) : (
        events.map((event) => (
          <Link
            href={`/protected/home/eventId/${event.id}`}
            key={event.id}
            asChild
          >
            <TouchableOpacity style={styles.eventPost}>
              <Image
                source={{ uri: event.image }}
                style={styles.eventImage}
                contentFit="cover"
              />
              <View style={styles.eventTextContainer}>
                <Text style={styles.eventTitle}>{event.title}</Text>
                <Text style={styles.eventBody}>{event.body}</Text>
              </View>
            </TouchableOpacity>
          </Link>
        ))
      )}
    </ScrollView>
  );

  const AboutScreen = () => (
    <View style={styles.tabContent}>
      <View style={styles.tabTextContainer}>
        <Text style={styles.tabContentText}>{venue.about}</Text>
      </View>
    </View>
  );

  function StarIcon() {
    const [isStarred, setIsStarred] = useState(false);
    const [favoriteIds, setFavoriteIds] = useState([]);

    useEffect(() => {
      const fetchUserFavorites = async () => {
        try {
          const token = await AsyncStorage.getItem("token");
          const userId = await AsyncStorage.getItem("userId");
          if (!token || !userId) return;

          const response = await fetch(`${apiUrl}/api/user/${userId}`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          });

          if (response.ok) {
            const data = await response.json();
            const ids = data.favorite_ids
              ? data.favorite_ids
                  .split(",")
                  .map((id) => id.trim())
                  .filter(Boolean)
              : [];
            setFavoriteIds(ids);
            setIsStarred(ids.includes(venue.id));
          }
        } catch (error) {
          console.error("Error fetching user favorite_ids:", error);
        }
      };

      fetchUserFavorites();
    }, []);

    const toggleStar = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        const userId = await AsyncStorage.getItem("userId");
        if (!token || !userId) {
          setError("Authentication token or user ID not found.");
          return;
        }

        const newIds = isStarred
          ? favoriteIds.filter((fid) => fid !== venue.id)
          : [...favoriteIds, venue.id];

        const newFavoriteStr = newIds.join(",");

        const response = await fetch(`${apiUrl}/api/user/${userId}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            favorite_ids: newFavoriteStr,
          }),
        });

        if (response.ok) {
          setFavoriteIds(newIds);
          setIsStarred(!isStarred);
        } else {
          console.error("Failed to toggle star");
        }
      } catch (error) {
        console.error("Error toggling star:", error);
        setError("Failed to update favorite.");
      }
    };

    return (
      <TouchableOpacity onPress={toggleStar} style={styles.starContainer}>
        <Text
          style={[
            styles.starIcon,
            { color: isStarred ? "#FFD700" : "#FFFFFF" },
          ]}
        >
          ★
        </Text>
      </TouchableOpacity>
    );
  }

  const renderImageItem = ({ item }) => (
    <View style={styles.imageItem}>
      <Image
        source={{ uri: item }}
        style={styles.fullScreenImage}
        contentFit="contain"
        placeholder={{ uri: "https://picsum.photos/800/600?random=1" }}
        onError={(e) => console.log("Image load error:", e.nativeEvent.error)}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.post}>
        <TouchableOpacity
          onPress={openImageModal}
          activeOpacity={0.8}
          style={styles.imageWrapper}
          accessibilityLabel="View venue images full screen"
        >
          <Image
            source={{
              uri: venue.images[0] || "https://picsum.photos/800/600?random=1",
            }}
            style={styles.postImage}
            contentFit="cover"
            placeholder={{ uri: "https://picsum.photos/800/600?random=1" }}
            onError={(e) =>
              console.log("Image load error:", e.nativeEvent.error)
            }
          />
        </TouchableOpacity>
        {venue.address !== "No address provided" && (
          <TouchableOpacity onPress={openMaps} style={styles.mapButton}>
            <MaterialCommunityIcons
              name="google-maps"
              size={24}
              color="#BB86FC"
              style={styles.mapButtonIcon}
            />
          </TouchableOpacity>
        )}
        <View style={styles.textContainer}>
          <Text style={styles.postTitle}>{venue.title}</Text>
          <Text style={styles.postBodyAddress}>{venue.address}</Text>
          <Text style={styles.postBodyHours}>{venue.openHours}</Text>
          {userType === "1" && <StarIcon />}
        </View>
      </View>
      <Modal
        visible={isImageModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeImageModal}
      >
        <View style={styles.modalContainer}>
          <FlatList
            data={venue.images}
            renderItem={renderImageItem}
            keyExtractor={(item, index) => index.toString()}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(
                e.nativeEvent.contentOffset.x / Dimensions.get("window").width,
              );
              setActiveIndex(index);
              console.log("Swiped to image index:", index);
            }}
          />
          {venue.images.length > 1 && (
            <View style={styles.dotsContainer}>
              {venue.images.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    i === activeIndex ? styles.activeDot : null,
                  ]}
                />
              ))}
            </View>
          )}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={closeImageModal}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
      </Modal>
      <Tab.Navigator
        screenOptions={{
          tabBarPosition: "top",
          tabBarStyle: {
            backgroundColor: "#121212",
            borderBottomColor: "#333333",
          },
          tabBarLabelStyle: {
            fontSize: 16,
            fontWeight: "bold",
            color: "#FFFFFF",
          },
          tabBarActiveTintColor: "#BB86FC",
          tabBarInactiveTintColor: "#8E8E93",
          tabBarIndicatorStyle: {
            backgroundColor: "#BB86FC",
          },
        }}
      >
        <Tab.Screen
          name="Status"
          component={StatusScreen}
          options={{ title: "Status" }}
        />
        <Tab.Screen
          name="Events"
          component={EventsScreen}
          options={{ title: "Events" }}
        />
        <Tab.Screen
          name="About"
          component={AboutScreen}
          options={{ title: "About" }}
        />
      </Tab.Navigator>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  post: {
    height: 200,
    width: "100%",
    borderWidth: 1,
    borderColor: "#333333",
    position: "relative",
  },
  imageWrapper: {
    flex: 1,
  },
  postImage: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  textContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    zIndex: 2,
  },
  postTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  postBodyAddress: {
    fontSize: 16,
    color: "#E0E0E0",
    marginTop: 5,
    fontStyle: "italic",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  postBodyHours: {
    fontSize: 16,
    color: "#BB86FC",
    marginTop: 5,
    fontWeight: "600",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  mapButton: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#BB86FC",
    zIndex: 3,
  },
  mapButtonIcon: {
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  starContainer: {
    position: "absolute",
    right: 10,
    bottom: 10,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 3,
  },
  starIcon: {
    fontSize: 32,
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  tabContent: {
    flex: 1,
    backgroundColor: "#121212",
    padding: 20,
    alignItems: "center",
  },
  tabTextContainer: {
    backgroundColor: "#252525",
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#BB86FC",
    width: "95%",
    padding: 15,
    marginTop: 15,
    alignSelf: "center",
  },
  tabContentText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#E0E0E0",
    textAlign: "left",
  },
  errorText: {
    fontSize: 18,
    color: "#FFFFFF",
    textAlign: "center",
    marginTop: 20,
  },
  eventListContainer: {
    flex: 1,
    backgroundColor: "#121212",
    width: "100%",
    paddingTop: 5,
    paddingHorizontal: 5,
  },
  eventPost: {
    flexDirection: "row",
    height: 100,
    width: "100%",
    marginBottom: 10,
    backgroundColor: "#1E1E1E",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#333333",
    padding: 10,
  },
  eventImage: {
    width: 80,
    height: "100%",
    borderRadius: 8,
  },
  eventTextContainer: {
    flex: 1,
    paddingLeft: 10,
    justifyContent: "center",
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  eventBody: {
    fontSize: 12,
    color: "#E0E0E0",
    marginTop: 5,
  },
  noEventsContainer: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: 20,
  },
  noEventsText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  imageItem: {
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height * 0.8,
    justifyContent: "center",
    alignItems: "center",
  },
  fullScreenImage: {
    width: "90%",
    height: "100%",
    borderRadius: 10,
  },
  dotsContainer: {
    flexDirection: "row",
    position: "absolute",
    bottom: 20,
    alignSelf: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#888888",
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: "#FFFFFF",
  },
  closeButton: {
    position: "absolute",
    top: 40,
    right: 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#BB86FC",
  },
  closeButtonText: {
    fontSize: 24,
    color: "#BB86FC",
    fontWeight: "bold",
  },
});
