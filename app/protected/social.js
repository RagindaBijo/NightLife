import { FontAwesome } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { useNavigation } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function Social() {
  const navigation = useNavigation();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const apiUrl = "https://night-life-api.elevator-rand.workers.dev";

  useEffect(() => {
    // Hide the default navigation header to avoid duplication
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Error", "Authentication required. Please log in.");
        return;
      }
      const response = await fetch(`${apiUrl}/api/posts`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Fetch posts error:", errorData);
        Alert.alert("Error", errorData.error || "Failed to fetch posts.");
        return;
      }
      const data = await response.json();
      setPosts(data);
    } catch (err) {
      console.error("Fetch posts error:", err);
      Alert.alert(
        "Error",
        "Failed to fetch posts due to a network or server issue.",
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleLike = async (postId) => {
    try {
      const token = await AsyncStorage.getItem("token");
      const userId = await AsyncStorage.getItem("userId");
      if (!token || !userId) {
        Alert.alert("Error", "Authentication required. Please log in.");
        return;
      }
      const post = posts.find((p) => p.id === postId);
      if (!post) return;
      const likeIds = post.like_ids
        ? post.like_ids.split(",").filter((id) => id)
        : [];
      const isLiked = likeIds.includes(userId);
      const updatedLikeIds = isLiked
        ? likeIds.filter((id) => id !== userId).join(",")
        : [...likeIds, userId].join(",");
      const response = await fetch(`${apiUrl}/api/posts/${postId}/like`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ like_ids: updatedLikeIds }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Toggle like error:", errorData);
        Alert.alert("Error", errorData.error || "Failed to update like.");
        return;
      }
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                like_ids: updatedLikeIds,
                likes: updatedLikeIds
                  ? updatedLikeIds.split(",").filter((id) => id).length
                  : 0,
                isLiked: !isLiked,
              }
            : p,
        ),
      );
    } catch (err) {
      console.error("Toggle like error:", err);
      Alert.alert(
        "Error",
        "Failed to update like due to a network or server issue.",
      );
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.toLocaleString("default", { month: "short" });
    return `${day} ${month}`;
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Social</Text>
        </View>
        <View style={styles.content}>
          <Text style={styles.loadingText}>Loading posts...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Social</Text>
      </View>
      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {posts.length === 0 ? (
          <Text style={styles.noPostsText}>No posts available.</Text>
        ) : (
          posts.map((post) => (
            <View key={post.id} style={styles.postContainer}>
              <View style={styles.postHeader}>
                <Image
                  source={{ uri: post.user_image }}
                  style={styles.userImage}
                  contentFit="cover"
                />
                <Text style={styles.userName}>
                  {post.username || `User${post.user_id}`}
                </Text>
              </View>
              <View style={styles.imageContainer}>
                <Image
                  source={{ uri: post.post_image }}
                  style={styles.postImage}
                  contentFit="cover"
                />
                <Text style={styles.caption}>
                  <Text style={styles.captionUser}>
                    {post.username || `User${post.user_id}`}
                  </Text>{" "}
                  {post.caption}
                </Text>
              </View>
              <View style={styles.footer}>
                <View style={styles.likeContainer}>
                  <TouchableOpacity
                    onPress={() => toggleLike(post.id)}
                    style={styles.likeButton}
                  >
                    <FontAwesome
                      name={post.isLiked ? "heart" : "heart-o"}
                      size={20}
                      color={post.isLiked ? "#FF4D4D" : "#B0B0B0"}
                    />
                  </TouchableOpacity>
                  <Text style={styles.likeCount}>
                    {post.likes} {post.likes === 1 ? "like" : "likes"}
                  </Text>
                </View>
                <Text style={styles.postDate}>{formatDate(post.date)}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  header: {
    backgroundColor: "#121212",
    borderBottomColor: "#333333",
    paddingVertical: 8,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "bold",
    fontFamily: "Helvetica Neue",
  },
  content: {
    flex: 1,
    backgroundColor: "#121212",
  },
  postContainer: {
    marginBottom: 40, // Large gap between posts
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  userImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  userName: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "500",
    marginLeft: 8,
    fontFamily: "Helvetica Neue",
  },
  imageContainer: {
    position: "relative",
  },
  postImage: {
    width: "100%",
    height: undefined,
    aspectRatio: 1080 / 1350, // 4:5 aspect ratio (1080x1350)
  },
  caption: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "400",
    fontFamily: "Helvetica Neue",
    maxWidth: "80%",
    marginTop: 8,
    marginHorizontal: 8,
  },
  captionUser: {
    fontWeight: "600",
    fontFamily: "Helvetica Neue",
  },
  footer: {
    flexDirection: "column",
    alignItems: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  likeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  likeButton: {
    paddingRight: 10,
  },
  likeCount: {
    color: "#B0B0B0",
    fontSize: 11,
    fontWeight: "500",
    fontFamily: "Helvetica Neue",
  },
  postDate: {
    color: "#B0B0B0",
    fontSize: 11,
    fontWeight: "400",
    fontFamily: "Helvetica Neue",
    marginTop: 4,
  },
  loadingText: {
    color: "#FFFFFF",
    fontSize: 16,
    textAlign: "center",
    marginTop: 20,
  },
  noPostsText: {
    color: "#FFFFFF",
    fontSize: 16,
    textAlign: "center",
    marginTop: 20,
  },
});
