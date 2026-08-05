import { FontAwesome, MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function Events() {
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userType, setUserType] = useState(null);
  const [interestedIds, setInterestedIds] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const apiUrl = "https://night-life-api.elevator-rand.workers.dev";

  const fetchEvents = async () => {
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

      const response = await fetch(`${apiUrl}/api/events`, {
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
      const eventsWithVenue = await Promise.all(
        data.map(async (event, index) => {
          let venueName = "Unknown";
          if (event.venue_id) {
            try {
              const venueResponse = await fetch(
                `${apiUrl}/api/venue/${event.venue_id}`,
                {
                  method: "GET",
                  headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                  },
                },
              );
              if (venueResponse.ok) {
                const venueData = await venueResponse.json();
                venueName = venueData.title || "Unknown";
              } else {
                console.warn(
                  `Failed to fetch venue ${event.venue_id}: ${venueResponse.status}`,
                );
              }
            } catch (err) {
              console.warn(`Error fetching venue ${event.venue_id}:`, err);
            }
          }
          return {
            id: event.id.toString(),
            title: event.title || `Event ${index + 1}`,
            venueName,
            time: event.time || "No time provided",
            image:
              event.photo_id ||
              `https://picsum.photos/200/200?random=${index + 1}`,
          };
        }),
      );
      setEvents(eventsWithVenue);
      setFilteredEvents(eventsWithVenue);

      if (storedUserType === "1") {
        const userId = await AsyncStorage.getItem("userId");
        if (userId) {
          const userResponse = await fetch(`${apiUrl}/api/user/${userId}`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          });
          if (userResponse.ok) {
            const userData = await userResponse.json();
            const ids = userData.interested_ids
              ? userData.interested_ids
                  .split(",")
                  .map((id) => id.trim())
                  .filter(Boolean)
              : [];
            setInterestedIds(ids);
          } else {
            console.warn("Failed to fetch user interested_ids");
          }
        }
      }
    } catch (err) {
      console.error("Error fetching events:", err);
      setError("Failed to load events. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    const filtered = events.filter((event) =>
      event.title.toLowerCase().includes(searchQuery.toLowerCase()),
    );
    setFilteredEvents(filtered);
  }, [searchQuery, events]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchEvents();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <MaterialIcons
          name="search"
          size={24}
          color="#888888"
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchBar}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search"
          placeholderTextColor="#888888"
        />
      </View>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#BB86FC"
            colors={["#BB86FC"]}
          />
        }
      >
        {loading ? (
          <Text style={styles.statusText}>Loading events...</Text>
        ) : error ? (
          <Text style={styles.statusText}>{error}</Text>
        ) : filteredEvents.length === 0 ? (
          <Text style={styles.statusText}>
            {searchQuery
              ? "No events match your search"
              : "No events available"}
          </Text>
        ) : (
          filteredEvents.map((event) => (
            <Link
              href={`/protected/home/eventId/${event.id}`}
              key={event.id}
              asChild
            >
              <TouchableOpacity style={styles.post}>
                <Image
                  source={{ uri: event.image }}
                  style={styles.postImage}
                  contentFit="cover"
                />
                <View style={styles.textContainer}>
                  <View style={styles.textContent}>
                    <Text style={styles.postTitle}>{event.title}</Text>
                    <Text style={styles.postBody}>{event.venueName}</Text>
                    <Text style={styles.postTime}>{event.time}</Text>
                  </View>
                  {userType === "1" && (
                    <CheckIcon
                      eventId={event.id}
                      interestedIds={interestedIds}
                      setInterestedIds={setInterestedIds}
                    />
                  )}
                </View>
              </TouchableOpacity>
            </Link>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function CheckIcon({ eventId, interestedIds, setInterestedIds }) {
  const apiUrl = "https://night-life-api.elevator-rand.workers.dev";
  const isActive = interestedIds.includes(String(eventId));

  const toggleCheck = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const userId = await AsyncStorage.getItem("userId");
      if (!token || !userId) return;

      const previousIds = [...interestedIds];
      const eventStr = String(eventId);
      let newIds = [...previousIds];

      if (isActive) {
        newIds = newIds.filter((id) => id !== eventStr);
      } else {
        if (!newIds.includes(eventStr)) {
          newIds.push(eventStr);
        }
      }

      setInterestedIds(newIds);

      const newInterestedStr = newIds.length > 0 ? newIds.join(",") : "";

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
        const refetchResponse = await fetch(`${apiUrl}/api/user/${userId}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (refetchResponse.ok) {
          const updatedData = await refetchResponse.json();
          const updatedIds = updatedData.interested_ids
            ? updatedData.interested_ids
                .split(",")
                .map((id) => id.trim())
                .filter(Boolean)
            : [];
          setInterestedIds(updatedIds);
        } else {
          setInterestedIds(previousIds);
        }
      } else {
        setInterestedIds(previousIds);
        console.error(
          "Failed to update interested_ids:",
          await response.text(),
        );
      }
    } catch (error) {
      setInterestedIds(interestedIds);
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    paddingVertical: 2,
    paddingHorizontal: 5,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2A2A2A",
    borderRadius: 10,
    marginTop: 2,
    marginBottom: 4,
    paddingHorizontal: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchBar: {
    flex: 1,
    padding: 10,
    color: "#FFFFFF",
    fontSize: 16,
    backgroundColor: "#2A2A2A",
  },
  scrollView: {
    flex: 1,
  },
  post: {
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
  postImage: {
    width: 80,
    height: "100%",
    borderRadius: 8,
  },
  textContainer: {
    flex: 1,
    paddingLeft: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  textContent: {
    flex: 1,
  },
  checkContainer: {
    paddingRight: 10,
  },
  postTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  postBody: {
    fontSize: 12,
    color: "#E0E0E0",
    marginTop: 5,
  },
  postTime: {
    fontSize: 12,
    color: "#E0E0E0",
    marginTop: 5,
  },
  statusText: {
    fontSize: 18,
    color: "#FFFFFF",
    textAlign: "center",
    marginTop: 20,
  },
});
