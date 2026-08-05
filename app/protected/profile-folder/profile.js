import { FontAwesome, MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { Image } from "expo-image";
import { Link, useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const Tab = createMaterialTopTabNavigator();

export default function Profile() {
  const navigation = useNavigation();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [interestedIds, setInterestedIds] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const apiUrl = "https://night-life-api.elevator-rand.workers.dev";
  const imageDomain = `${apiUrl}/images`;

  const fetchUser = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const userId = await AsyncStorage.getItem("userId");
      if (!token || !userId) {
        setError("No token or user ID found. Please log in again.");
        return;
      }

      // Fetch user profile
      const userResponse = await fetch(`${apiUrl}/api/user/${userId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!userResponse.ok) {
        setError(`Failed to fetch user profile: HTTP ${userResponse.status}`);
        return;
      }

      const userData = await userResponse.json();
      if (userData.error) {
        setError("User profile not found in database.");
        return;
      }

      // Fetch posts to count user-specific posts
      const postsResponse = await fetch(`${apiUrl}/api/posts`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      let postCount = 0;
      if (postsResponse.ok) {
        const postsData = await postsResponse.json();
        postCount = postsData.filter(
          (post) => post.user_id.toString() === userId.toString(),
        ).length;
      } else {
        console.warn(`Failed to fetch posts: HTTP ${postsResponse.status}`);
      }

      const followersCount = userData.follower_ids
        ? userData.follower_ids.split(",").filter((id) => id.trim() !== "")
            .length
        : 0;
      const followingCount = userData.following_ids
        ? userData.following_ids.split(",").filter((id) => id.trim() !== "")
            .length
        : 0;
      const favIds = userData.favorite_ids
        ? userData.favorite_ids
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean)
        : [];
      const intIds = userData.interested_ids
        ? userData.interested_ids
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean)
        : [];

      setUser({
        name:
          `${userData.first_name || ""} ${userData.last_name || ""}`.trim() ||
          "Unnamed User",
        bio: userData.bio_text || "",
        profileImage: userData.profile_photo
          ? `${imageDomain}/${userData.profile_photo}`
          : "https://picsum.photos/800/600?random=11",
        followers: followersCount,
        following: followingCount,
        posts: postCount,
      });
      setFavoriteIds(favIds);
      setInterestedIds(intIds);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      setError("Error fetching user profile: Network or server issue.");
    }
  };

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  useEffect(() => {
    fetchUser();
  }, []);

  const PostsScreen = ({ refreshTrigger }) => {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const router = useRouter();

    const fetchUserPosts = async () => {
      try {
        setLoading(true);
        setError(null);
        const token = await AsyncStorage.getItem("token");
        const userId = await AsyncStorage.getItem("userId");
        if (!token || !userId) {
          setError("Authentication token or user ID not found. Please log in.");
          return;
        }

        console.log("PostsScreen userId:", userId); // Debug log

        const response = await fetch(`${apiUrl}/api/posts`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch posts: ${response.status}`);
        }

        const data = await response.json();
        console.log("PostsScreen API posts response:", data); // Debug log
        const userPosts = data
          .filter((post) => {
            const match = post.user_id.toString() === userId.toString();
            console.log(
              `Post ${post.id}: user_id=${post.user_id}, currentUserId=${userId}, match=${match}`,
            );
            return match;
          })
          .map((post, index) => {
            const imageUrl =
              post.post_image ||
              `https://picsum.photos/800/600?random=${index}`;
            if (!post.post_image) {
              console.warn(
                `Post ${post.id} has no valid post_image, using placeholder: ${imageUrl}`,
              );
            }
            return {
              id: `${post.id}-${index}`,
              url: imageUrl,
              postId: post.id,
              userId: userId.toString(), // Ensure userId is a string
            };
          });

        setPosts(userPosts);
      } catch (err) {
        console.error("Error fetching user posts:", err);
        setError("Failed to load posts. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    useEffect(() => {
      fetchUserPosts();
    }, [refreshTrigger]);

    const numColumns = 3;
    const screenWidth = Dimensions.get("window").width - 20;
    const imageWidth = (screenWidth - (numColumns - 1) * 2) / numColumns;
    const imageHeight = (imageWidth * 5) / 4;

    return (
      <View style={[styles.container, { padding: 8 }]}>
        {loading ? (
          <Text style={styles.statusText}>Loading posts...</Text>
        ) : error ? (
          <Text style={styles.statusText}>{error}</Text>
        ) : posts.length === 0 ? (
          <Text style={styles.statusText}>No posts available</Text>
        ) : (
          <ScrollView
            style={styles.gridScrollContainer}
            contentContainerStyle={styles.gridContentContainer}
            nestedScrollEnabled={true}
          >
            <View style={styles.gridContainer}>
              {posts.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.gridImageContainer,
                    { width: imageWidth, height: imageHeight },
                  ]}
                  onPress={() => {
                    console.log(
                      "Navigating to post-list with userId:",
                      item.userId,
                    ); // Debug log
                    router.push({
                      pathname: "/protected/profile-folder/post-list",
                      params: { userId: item.userId },
                    });
                  }}
                >
                  <Image
                    source={{ uri: item.url }}
                    style={styles.gridImage}
                    contentFit="cover"
                    cachePolicy="none"
                    backgroundColor="#808080"
                    onError={(e) =>
                      console.log(
                        `Failed to load image ${item.url}:`,
                        e.nativeEvent.error,
                      )
                    }
                    onLoad={() => console.log(`Image loaded: ${item.url}`)}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}
      </View>
    );
  };

  const FavoritesScreen = ({ refreshTrigger }) => {
    const [venues, setVenues] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchFavoriteVenues = async () => {
      try {
        setLoading(true);
        setError(null);
        const token = await AsyncStorage.getItem("token");
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
        const favoriteVenues = data
          .filter((venue) => favoriteIds.includes(venue.id.toString()))
          .map((venue, index) => ({
            id: venue.id.toString(),
            title: venue.title || `Venue ${index + 1}`,
            address: venue.address || "No address provided",
            openHours: venue.open_hours || "Mon-Sun: 10AM-10PM",
            image: venue.photo_ids
              ? `${imageDomain}/${venue.photo_ids
                  .split(",")
                  .filter((id) => id.trim())[0]
                  ?.trim()}`
              : "https://picsum.photos/800/600?random=${index + 1}",
          }));

        setVenues(favoriteVenues);
      } catch (err) {
        console.error("Error fetching favorite venues:", err);
        setError("Failed to load favorite venues. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    useEffect(() => {
      fetchFavoriteVenues();
    }, [refreshTrigger]);

    return (
      <ScrollView style={[styles.container, { padding: 10 }]}>
        {loading ? (
          <Text style={styles.statusText}>Loading favorite venues...</Text>
        ) : error ? (
          <Text style={styles.statusText}>{error}</Text>
        ) : venues.length === 0 ? (
          <Text style={styles.statusText}>No favorite venues</Text>
        ) : (
          venues.map((venue) => (
            <Link
              href={`/protected/home/venueId/${venue.id}`}
              key={venue.id}
              asChild
            >
              <TouchableOpacity style={styles.postEvent}>
                <Image
                  source={{ uri: venue.image }}
                  style={styles.postImageEvent}
                  contentFit="cover"
                  backgroundColor="#808080"
                />
                <View style={styles.textContainerEvent}>
                  <View style={styles.textContentEvent}>
                    <Text style={styles.postTitleEvent}>{venue.title}</Text>
                    <Text style={styles.postBodyEvent}>{venue.address}</Text>
                    <Text style={styles.postBodyEvent}>{venue.openHours}</Text>
                  </View>
                  <StarIcon
                    venueId={venue.id}
                    favoriteIds={favoriteIds}
                    setFavoriteIds={setFavoriteIds}
                  />
                </View>
              </TouchableOpacity>
            </Link>
          ))
        )}
      </ScrollView>
    );
  };

  const InterestedScreen = ({ refreshTrigger }) => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchInterestedEvents = async () => {
      try {
        setLoading(true);
        setError(null);
        const token = await AsyncStorage.getItem("token");
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
        const interestedEvents = await Promise.all(
          data
            .filter((event) => interestedIds.includes(event.id.toString()))
            .map(async (event, index) => {
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
                image: event.photo_ids
                  ? `${imageDomain}/${event.photo_ids
                      .split(",")
                      .filter((id) => id.trim())[0]
                      ?.trim()}`
                  : "https://picsum.photos/200/200?random=${index + 1}",
              };
            }),
        );

        setEvents(interestedEvents);
      } catch (err) {
        console.error("Error fetching interested events:", err);
        setError("Failed to load interested events. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    useEffect(() => {
      fetchInterestedEvents();
    }, [refreshTrigger]);

    return (
      <ScrollView style={[styles.container, { padding: 10 }]}>
        {loading ? (
          <Text style={styles.statusText}>Loading interested events...</Text>
        ) : error ? (
          <Text style={styles.statusText}>{error}</Text>
        ) : events.length === 0 ? (
          <Text style={styles.statusText}>No interested events</Text>
        ) : (
          events.map((event) => (
            <Link
              href={`/protected/home/eventId/${event.id}`}
              key={event.id}
              asChild
            >
              <TouchableOpacity style={styles.postEvent}>
                <Image
                  source={{ uri: event.image }}
                  style={styles.postImageEvent}
                  contentFit="cover"
                  backgroundColor="#808080"
                />
                <View style={styles.textContainerEvent}>
                  <View style={styles.textContentEvent}>
                    <Text style={styles.postTitleEvent}>{event.title}</Text>
                    <Text style={styles.postBodyEvent}>{event.venueName}</Text>
                    <Text style={styles.postTimeEvent}>{event.time}</Text>
                  </View>
                  <CheckIcon
                    eventId={event.id}
                    interestedIds={interestedIds}
                    setInterestedIds={setInterestedIds}
                  />
                </View>
              </TouchableOpacity>
            </Link>
          ))
        )}
      </ScrollView>
    );
  };

  const PostsScreenWrapper = (props) => (
    <PostsScreen {...props} refreshTrigger={refreshing} />
  );

  const FavoritesScreenWrapper = (props) => (
    <FavoritesScreen {...props} refreshTrigger={refreshing} />
  );

  const InterestedScreenWrapper = (props) => (
    <InterestedScreen {...props} refreshTrigger={refreshing} />
  );

  function StarIcon({ venueId, favoriteIds, setFavoriteIds }) {
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
          console.error(
            "Failed to update favorite_ids:",
            await response.text(),
          );
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
      <TouchableOpacity onPress={toggleStar} style={styles.checkContainer}>
        <Text
          style={[
            styles.starIcon,
            { color: isStarred ? "#FFD700" : "#808080" },
          ]}
        >
          ★
        </Text>
      </TouchableOpacity>
    );
  }

  function CheckIcon({ eventId, interestedIds, setInterestedIds }) {
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
            console.error(
              "Failed to update interested_ids:",
              await response.text(),
            );
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

  const handleButtonPress = (buttonName) => {
    if (buttonName === "Add Image") {
      router.push("/protected/profile-folder/create-post");
    } else {
      console.log(`${buttonName} button pressed`);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([fetchUser()]).then(() => setRefreshing(false));
  }, []);

  if (error) {
    return (
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#BB86FC"
            colors={["#BB86FC"]}
          />
        }
      >
        <Text style={styles.tabContentText}>{error}</Text>
      </ScrollView>
    );
  }

  if (!user) {
    return (
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#BB86FC"
            colors={["#BB86FC"]}
          />
        }
      >
        <Text style={styles.tabContentText}>Loading...</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ flexGrow: 1 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#BB86FC"
          colors={["#BB86FC"]}
        />
      }
    >
      <View style={styles.profileHeader}>
        <View style={styles.profileImageContainer}>
          <Image
            source={{ uri: user.profileImage }}
            style={styles.profileImage}
            contentFit="cover"
            backgroundColor="#808080"
          />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.profileName}>{user.name}</Text>
          <View style={styles.countsContainer}>
            <View style={styles.countItem}>
              <Text style={styles.countNumber}>{user.posts}</Text>
              <Text style={styles.countLabel}>Posts</Text>
            </View>
            <Link href="/protected/profile-folder/follow" asChild>
              <TouchableOpacity style={styles.countItem}>
                <Text style={styles.countNumber}>{user.followers}</Text>
                <Text style={styles.countLabel}>Followers</Text>
              </TouchableOpacity>
            </Link>
            <Link href="/protected/profile-folder/follow" asChild>
              <TouchableOpacity style={styles.countItem}>
                <Text style={styles.countNumber}>{user.following}</Text>
                <Text style={styles.countLabel}>Following</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </View>
      <Text style={styles.profileBio}>{user.bio}</Text>
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.imageButton}
          onPress={() => handleButtonPress("Add Image")}
        >
          <MaterialIcons name="add-a-photo" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, { flex: 1, marginHorizontal: 5 }]}
          onPress={() => router.push("/protected/profile-folder/edit-profile")}
        >
          <Text style={styles.buttonText}>Edit Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, { flex: 1, marginHorizontal: 5 }]}
          onPress={() => handleButtonPress("Tickets")}
        >
          <Text style={styles.buttonText}>Tickets</Text>
        </TouchableOpacity>
      </View>
      <Tab.Navigator
        screenOptions={{
          tabBarPosition: "top",
          swipeEnabled: true,
          tabBarStyle: {
            backgroundColor: "#1E1E1E",
            borderBottomColor: "#333333",
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: "600",
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
          name="Posts"
          component={PostsScreenWrapper}
          options={{ title: "Posts" }}
        />
        <Tab.Screen
          name="Favorites"
          component={FavoritesScreenWrapper}
          options={{ title: "Favorites" }}
        />
        <Tab.Screen
          name="Interested"
          component={InterestedScreenWrapper}
          options={{ title: "Interested" }}
        />
      </Tab.Navigator>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginLeft: 20,
    marginTop: 20,
    marginBottom: 10,
  },
  profileImageContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  profileImage: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 60,
  },
  textContainer: {
    marginLeft: 20,
    flex: 1,
  },
  profileName: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  profileBio: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#E0E0E0",
    marginLeft: 20,
    marginBottom: 10,
  },
  countsContainer: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginTop: 10,
    marginBottom: 10,
  },
  countItem: {
    alignItems: "center",
    marginRight: 20,
  },
  countNumber: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  countLabel: {
    fontSize: 14,
    color: "#E0E0E0",
  },
  buttonContainer: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginBottom: 10,
    alignItems: "center",
  },
  imageButton: {
    backgroundColor: "#1E1E1E",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    width: 36,
    marginHorizontal: 5,
  },
  actionButton: {
    backgroundColor: "#1E1E1E",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 14,
    color: "#FFFFFF",
    fontWeight: "500",
  },
  tabContent: {
    padding: 20,
    alignItems: "center",
    flex: 1,
    backgroundColor: "#121212",
  },
  tabContentText: {
    fontSize: 18,
    color: "#FFFFFF",
  },
  postEvent: {
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
  postImageEvent: {
    width: 80,
    height: "100%",
    borderRadius: 8,
  },
  textContainerEvent: {
    flex: 1,
    paddingLeft: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  textContentEvent: {
    flex: 1,
  },
  checkContainer: {
    paddingRight: 10,
  },
  starIcon: {
    fontSize: 32,
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  postTitleEvent: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  postBodyEvent: {
    fontSize: 12,
    color: "#E0E0E0",
    marginTop: 5,
  },
  postTimeEvent: {
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
  gridScrollContainer: {
    flex: 1,
  },
  gridContentContainer: {
    paddingBottom: 20,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  gridImageContainer: {
    margin: 1,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#1E1E1E",
    borderWidth: 1,
    borderColor: "#333333",
  },
  gridImage: {
    width: "100%",
    height: "100%",
  },
});
