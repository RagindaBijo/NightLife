import { MaterialIcons } from "@expo/vector-icons";
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

export default function Venues() {
  const [posts, setPosts] = useState([]);
  const [filteredPosts, setFilteredPosts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userType, setUserType] = useState(null);
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const apiUrl = "https://night-life-api.elevator-rand.workers.dev";

  const fetchVenues = async () => {
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

      const response = await fetch(`${apiUrl}/api/venues`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch venues: ${response.status}`);
      }

      const data = await response.json();
      const venues = data.map((venue, index) => ({
        id: venue.id.toString(),
        title: venue.title || `Venue ${index + 1}`,
        address: venue.address || "No address provided",
        openHours: venue.open_hours || "Mon-Sun: 10AM-10PM",
        image: venue.photo_ids
          ? venue.photo_ids
              .split(",")
              .filter((id) => id.trim())[0]
              ?.trim()
          : `https://picsum.photos/800/600?random=${index + 1}`,
      }));
      setPosts(venues);
      setFilteredPosts(venues);

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
            const ids = userData.favorite_ids
              ? userData.favorite_ids
                  .split(",")
                  .map((id) => id.trim())
                  .filter(Boolean)
              : [];
            setFavoriteIds(ids);
          } else {
            console.warn("Failed to fetch user favorite_ids");
          }
        }
      }
    } catch (err) {
      console.error("Error fetching venues:", err);
      setError("Failed to load venues. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchVenues();
  }, []);

  useEffect(() => {
    const filtered = posts.filter((post) =>
      post.title.toLowerCase().includes(searchQuery.toLowerCase()),
    );
    setFilteredPosts(filtered);
  }, [searchQuery, posts]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchVenues();
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
        contentContainerStyle={styles.contentContainer}
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
          <Text style={styles.statusText}>Loading venues...</Text>
        ) : error ? (
          <Text style={styles.statusText}>{error}</Text>
        ) : filteredPosts.length === 0 ? (
          <Text style={styles.statusText}>
            {searchQuery
              ? "No venues match your search"
              : "No public venues available"}
          </Text>
        ) : (
          filteredPosts.map((post) => (
            <Link
              href={`/protected/home/venueId/${post.id}`}
              key={post.id}
              asChild
            >
              <TouchableOpacity style={styles.post}>
                <Image
                  source={{ uri: post.image }}
                  style={styles.postImage}
                  contentFit="cover"
                />
                <View style={styles.textContainer}>
                  <Text style={styles.postTitle}>{post.title}</Text>
                  <Text style={styles.postBody}>{post.address}</Text>
                  <Text style={styles.postBody}>{post.openHours}</Text>
                  {userType === "1" && (
                    <StarIcon
                      venueId={post.id}
                      favoriteIds={favoriteIds}
                      setFavoriteIds={setFavoriteIds}
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

function StarIcon({ venueId, favoriteIds, setFavoriteIds }) {
  const apiUrl = "https://night-life-api.elevator-rand.workers.dev";
  const isStarred = favoriteIds.includes(String(venueId));

  const toggleStar = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const userId = await AsyncStorage.getItem("userId");
      if (!token || !userId) {
        console.warn("Missing token or userId");
        return;
      }

      const previousIds = [...favoriteIds];
      const venueStr = String(venueId);
      let newIds;

      if (isStarred) {
        newIds = favoriteIds.filter((id) => id !== venueStr);
      } else {
        newIds = [...favoriteIds, venueStr];
      }

      setFavoriteIds(newIds);

      const newFavoriteStr = newIds.length > 0 ? newIds.join(",") : "";

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

      if (!response.ok) {
        setFavoriteIds(previousIds);
        console.error("Failed to update favorite_ids:", await response.text());
        return;
      }

      const refetchResponse = await fetch(`${apiUrl}/api/user/${userId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (refetchResponse.ok) {
        const updatedData = await refetchResponse.json();
        const updatedIds = updatedData.favorite_ids
          ? updatedData.favorite_ids
              .split(",")
              .map((id) => id.trim())
              .filter(Boolean)
          : [];
        setFavoriteIds(updatedIds);
      } else {
        setFavoriteIds(previousIds);
        console.error(
          "Failed to refetch favorite_ids:",
          await refetchResponse.text(),
        );
      }
    } catch (error) {
      setFavoriteIds(favoriteIds);
      console.error("Error toggling star:", error);
    }
  };

  return (
    <TouchableOpacity onPress={toggleStar} style={styles.starContainer}>
      <Text
        style={[styles.starIcon, { color: isStarred ? "#FFD700" : "#FFFFFF" }]}
      >
        ★
      </Text>
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
  contentContainer: {},
  post: {
    height: 200,
    width: "100%",
    marginBottom: 2,
    borderWidth: 1,
    borderColor: "#333333",
    position: "relative",
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
    backgroundColor: "rgba(0, 0, 0, 0.3)", // Less-tinted background
    zIndex: 2,
    justifyContent: "flex-end",
  },
  starContainer: {
    position: "absolute",
    right: 10,
    bottom: 10,
    zIndex: 3,
  },
  starIcon: {
    fontSize: 32,
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  postTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  postBody: {
    fontSize: 14,
    color: "#E0E0E0",
    marginTop: 5,
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  statusText: {
    fontSize: 18,
    color: "#FFFFFF",
    textAlign: "center",
    marginTop: 20,
  },
});
