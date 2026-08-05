import { FontAwesome } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { Image } from "expo-image";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect, useState } from "react";
import {
  Dimensions,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const Tab = createMaterialTopTabNavigator();

export default function EventDetail() {
  const { eventId } = useLocalSearchParams();
  const navigation = useNavigation();
  const [event, setEvent] = useState(null);
  const [venue, setVenue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userType, setUserType] = useState(null);
  const [isImageModalVisible, setIsImageModalVisible] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const apiUrl = "https://night-life-api.elevator-rand.workers.dev";
  const IMAGE_DOMAIN =
    "https://night-life-api.elevator-rand.workers.dev/images";

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  useEffect(() => {
    const fetchEventAndVenue = async () => {
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

        const eventResponse = await fetch(`${apiUrl}/api/events/${eventId}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!eventResponse.ok) {
          throw new Error(`Failed to fetch event: ${eventResponse.status}`);
        }

        const eventData = await eventResponse.json();
        if (eventData.error) {
          throw new Error(eventData.error);
        }

        console.log("Event data:", eventData); // Debug log to verify photo_id

        // Use photo_id from API (already includes IMAGE_DOMAIN)
        const image = eventData.photo_id || `${IMAGE_DOMAIN}/placeholder.jpg`;

        setEvent({
          id: eventData.id ? String(eventData.id) : String(eventId),
          title: eventData.title || "Untitled Event",
          about: eventData.about || "No description provided",
          time: eventData.time || "No time provided",
          venue_id: eventData.venue_id,
          images: [image], // Single image array
        });

        if (!eventData.venue_id) {
          console.warn("No venue_id found for this event");
          setVenue({
            title: "Unknown",
            address: "No address provided",
            about: "No description provided",
          });
          return;
        }

        const venueResponse = await fetch(
          `${apiUrl}/api/venue/${eventData.venue_id}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          },
        );

        if (!venueResponse.ok) {
          console.warn(
            `Failed to fetch venue ${eventData.venue_id}: ${venueResponse.status}`,
          );
          setVenue({
            title: "Unknown",
            address: "No address provided",
            about: "No description provided",
          });
          return;
        }

        const venueData = await venueResponse.json();
        if (venueData.error) {
          console.warn(`Venue data error: ${venueData.error}`);
          setVenue({
            title: "Unknown",
            address: "No address provided",
            about: "No description provided",
          });
          return;
        }

        setVenue(venueData);
      } catch (err) {
        console.error("Error fetching event or venue:", err);
        setError("Failed to load event details. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    if (eventId) {
      fetchEventAndVenue();
    } else {
      setError("No event ID provided");
      setLoading(false);
    }
  }, [eventId]);

  const openImageModal = () => {
    if (!event.images || event.images.length === 0) {
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
        <Text style={styles.errorText}>Loading event...</Text>
      </View>
    );
  }

  if (error || !event) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error || "Event not found"}</Text>
      </View>
    );
  }

  const DetailsScreen = () => (
    <View style={styles.tabContent}>
      <View style={styles.detailItem}>
        <Text style={styles.tabContentLabel}>About:</Text>
        <Text style={styles.tabContentValue}>{event.about}</Text>
      </View>
    </View>
  );

  const TicketsScreen = () => (
    <View style={styles.tabContent}>
      <Text style={styles.tabContentText}>Tickets Coming Soon</Text>
    </View>
  );

  function CheckIcon() {
    const [isActive, setIsActive] = useState(false);
    const [interestedIds, setInterestedIds] = useState([]);

    useEffect(() => {
      const fetchUserInterested = async () => {
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
            const ids = data.interested_ids
              ? data.interested_ids
                  .split(",")
                  .map((id) => id.trim())
                  .filter(Boolean)
              : [];
            setInterestedIds(ids);
            setIsActive(ids.includes(String(eventId)));
          }
        } catch (error) {
          console.error("Error fetching user interested_ids:", error);
        }
      };

      fetchUserInterested();
    }, [eventId]);

    const toggleCheck = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        const userId = await AsyncStorage.getItem("userId");
        if (!token || !userId) return;

        const newIds = isActive
          ? interestedIds.filter((id) => id !== String(eventId))
          : [...interestedIds, String(eventId)];

        const newInterestedStr = newIds.join(",");

        const response = await fetch(`${apiUrl}/api/user/${userId}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            interested_ids: newInterestedStr,
          }),
        });

        if (response.ok) {
          setInterestedIds(newIds);
          setIsActive(!isActive);
        }
      } catch (error) {
        console.error("Error toggling check:", error);
      }
    };

    return (
      <TouchableOpacity onPress={toggleCheck} style={styles.checkContainer}>
        <FontAwesome
          name="check-square"
          size={32}
          color={isActive ? "#0000FF" : "#808080"}
        />
      </TouchableOpacity>
    );
  }

  const renderImageItem = ({ item }) => (
    <View style={styles.imageItem}>
      <Image
        source={{ uri: item }}
        style={styles.fullScreenImage}
        contentFit="contain"
        placeholder={{ uri: `${IMAGE_DOMAIN}/placeholder.jpg` }}
        onError={(e) => console.log("Image load error:", e.nativeEvent.error)}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.eventImageContainer}>
        <TouchableOpacity
          onPress={openImageModal}
          activeOpacity={0.8}
          style={styles.imageWrapper}
          accessibilityLabel="View event image full screen"
        >
          <Image
            source={{ uri: event.images[0] }}
            style={styles.eventImage}
            contentFit="cover"
            placeholder={{ uri: `${IMAGE_DOMAIN}/placeholder.jpg` }}
            onError={(e) =>
              console.log("Image load error:", e.nativeEvent.error)
            }
          />
        </TouchableOpacity>
        <View style={styles.textContainer}>
          <View style={styles.textContent}>
            <Text style={styles.eventTitle}>{event.title}</Text>
            <Text style={styles.eventBody}>{venue?.title || "Unknown"}</Text>
            <Text style={styles.eventTime}>{event.time}</Text>
          </View>
          {userType === "1" && <CheckIcon />}
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
            data={event.images}
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
          {event.images.length > 1 && (
            <View style={styles.dotsContainer}>
              {event.images.map((_, i) => (
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
          name="Details"
          component={DetailsScreen}
          options={{ title: "Details" }}
        />
        <Tab.Screen
          name="Tickets"
          component={TicketsScreen}
          options={{ title: "Tickets" }}
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
  eventImageContainer: {
    height: 200,
    width: "100%",
    borderWidth: 1,
    borderColor: "#333333",
    position: "relative",
  },
  imageWrapper: {
    flex: 1,
  },
  eventImage: {
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
    justifyContent: "flex-end",
  },
  textContent: {
    alignSelf: "flex-start",
  },
  checkContainer: {
    position: "absolute",
    right: 10,
    bottom: 10,
    zIndex: 3,
  },
  eventTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  eventBody: {
    fontSize: 16,
    color: "#E0E0E0",
    marginTop: 5,
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  eventTime: {
    fontSize: 16,
    color: "#E0E0E0",
    marginTop: 5,
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  tabContent: {
    flex: 1,
    padding: 20,
    backgroundColor: "#121212",
  },
  tabContentLabel: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 5,
  },
  tabContentValue: {
    fontSize: 16,
    color: "#E0E0E0",
    paddingLeft: 10,
    marginBottom: 15,
    flexWrap: "wrap",
  },
  tabContentText: {
    fontSize: 18,
    color: "#FFFFFF",
  },
  detailItem: {
    marginBottom: 10,
  },
  errorText: {
    fontSize: 18,
    color: "#FFFFFF",
    textAlign: "center",
    marginTop: 20,
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
