import { FontAwesome, MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

export default function PostList() {
  const { userId } = useLocalSearchParams();
  const navigation = useNavigation();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPostModal, setShowPostModal] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState(null);
  const apiUrl = "https://night-life-api.elevator-rand.workers.dev";
  const postSlideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  useEffect(() => {
    if (showPostModal) {
      Animated.timing(postSlideAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    } else {
      postSlideAnim.setValue(300);
    }
  }, [showPostModal]);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await AsyncStorage.getItem("token");
      const currentUserId = await AsyncStorage.getItem("userId");
      if (!token || !currentUserId) {
        setError("Authentication required. Please log in.");
        Alert.alert("Error", "Authentication required. Please log in.");
        return;
      }

      console.log("PostList userId from params:", userId);
      console.log("PostList currentUserId from AsyncStorage:", currentUserId);

      const effectiveUserId =
        userId && userId !== "[object Object]" ? userId : currentUserId;
      console.log("PostList effectiveUserId:", effectiveUserId);

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
        setError(errorData.error || "Failed to fetch posts.");
        Alert.alert("Error", errorData.error || "Failed to fetch posts.");
        return;
      }

      const data = await response.json();
      console.log("PostList API posts response:", data);

      const filteredPosts = data.filter((post) => {
        const match = post.user_id.toString() === effectiveUserId.toString();
        console.log(
          `Post ${post.id}: user_id=${post.user_id}, filterUserId=${effectiveUserId}, match=${match}`,
        );
        return match;
      });

      if (filteredPosts.length === 0) {
        setError(`No posts found for user ID ${effectiveUserId}.`);
      }

      const postsWithLikes = filteredPosts.map((post) => ({
        ...post,
        isLiked: post.like_ids
          ? post.like_ids.split(",").includes(currentUserId)
          : false,
        likes: post.like_ids
          ? post.like_ids.split(",").filter((id) => id).length
          : 0,
      }));

      setPosts(postsWithLikes);
    } catch (err) {
      console.error("Fetch posts error:", err);
      setError("Failed to fetch posts due to a network or server issue.");
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
      const currentUserId = await AsyncStorage.getItem("userId");
      if (!token || !currentUserId) {
        Alert.alert("Error", "Authentication required. Please log in.");
        return;
      }
      const post = posts.find((p) => p.id === postId);
      if (!post) return;
      const likeIds = post.like_ids
        ? post.like_ids.split(",").filter((id) => id)
        : [];
      const isLiked = likeIds.includes(currentUserId);
      const updatedLikeIds = isLiked
        ? likeIds.filter((id) => id !== currentUserId).join(",")
        : [...likeIds, currentUserId].join(",");
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

  const handleDeletePost = async (postId) => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Error", "Authentication required. Please log in.");
        return;
      }
      const post = posts.find((p) => p.id === postId);
      if (!post) {
        Alert.alert("Error", "Post not found.");
        return;
      }

      // Delete the post from the database
      const postResponse = await fetch(`${apiUrl}/api/posts/${postId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (!postResponse.ok) {
        const errorData = await postResponse.json().catch(() => ({}));
        console.error("Delete post error:", errorData);
        Alert.alert("Error", errorData.error || "Failed to delete post.");
        return;
      }

      // Delete the associated image from R2 if it exists
      if (post.photo_id) {
        const imageResponse = await fetch(
          `${apiUrl}/api/delete-image/${post.photo_id}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          },
        );
        if (!imageResponse.ok) {
          const errorData = await imageResponse.json().catch(() => ({}));
          console.error("Delete image error:", errorData);
          console.warn("Failed to delete image, but post was deleted.");
        }
      }

      // Update local state to remove the post
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      Alert.alert("Success", "Post and associated image deleted successfully.");
    } catch (err) {
      console.error("Delete post or image error:", err);
      Alert.alert(
        "Error",
        "Failed to delete post or image due to a network or server issue.",
      );
    }
    setShowPostModal(false);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.toLocaleString("default", { month: "short" });
    return `${day} ${month}`;
  };

  useEffect(() => {
    fetchPosts();
  }, [userId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Posts</Text>
        </View>
        <View style={styles.content}>
          <Text style={styles.loadingText}>Loading posts...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Posts</Text>
        </View>
        <View style={styles.content}>
          <Text style={styles.noPostsText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Posts</Text>
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
                <TouchableOpacity
                  style={styles.menuButton}
                  onPress={() => {
                    setSelectedPostId(post.id);
                    setShowPostModal(true);
                  }}
                >
                  <FontAwesome name="ellipsis-v" size={20} color="#FFFFFF" />
                </TouchableOpacity>
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
      <Modal
        visible={showPostModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPostModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowPostModal(false)}>
          <View style={styles.bottomSheetContainer}>
            <TouchableWithoutFeedback>
              <Animated.View
                style={[
                  styles.bottomSheetContent,
                  { transform: [{ translateY: postSlideAnim }] },
                ]}
              >
                <Text style={styles.modalTitle}>Post Options</Text>
                <TouchableOpacity
                  style={styles.optionButton}
                  onPress={() => handleDeletePost(selectedPostId)}
                >
                  <MaterialIcons name="delete" size={24} color="#FF4444" />
                  <Text style={styles.optionText}>Delete Post</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.optionButton, { borderTopWidth: 0 }]}
                  onPress={() => setShowPostModal(false)}
                >
                  <Text style={[styles.optionText, { color: "#FF4444" }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
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
    marginBottom: 40,
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
    flex: 1,
  },
  menuButton: {
    padding: 8,
  },
  imageContainer: {
    position: "relative",
  },
  postImage: {
    width: "100%",
    height: undefined,
    aspectRatio: 1080 / 1350,
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
  bottomSheetContainer: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  bottomSheetContent: {
    backgroundColor: "#1E1E1E",
    padding: 18,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 20,
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: "#333333",
  },
  optionText: {
    fontSize: 16,
    color: "#FFFFFF",
    marginLeft: 10,
  },
});
