import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import OptionsSheet from "../../../components/OptionsSheet";
import PostCard from "../../../components/PostCard";
import { usePostFeed } from "../../../lib/usePostFeed";
import { useI18n } from "../../../lib/i18n";
import { makeStyles, useTheme } from "../../../lib/theme-context";

/**
 * A user's posts as a feed (opened from the profile grid), scrolled to the
 * post that was tapped.
 */
export default function PostList() {
  const { colors: COLORS } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  const { userId, postId } = useLocalSearchParams();
  const navigation = useNavigation();
  const router = useRouter();
  const listRef = useRef(null);
  const scrolledToStart = useRef(false);
  const { posts, error, isMine, refreshing, refresh, reload, toggleLike, confirmDelete } =
    usePostFeed({ userId });
  const [optionsPost, setOptionsPost] = useState(null);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  // Jump to the tapped post once the list has loaded
  useEffect(() => {
    if (!posts || scrolledToStart.current || !postId) return;
    const index = posts.findIndex((post) => String(post.id) === String(postId));
    scrolledToStart.current = true;
    if (index > 0) {
      requestAnimationFrame(() =>
        listRef.current?.scrollToIndex({ index, animated: false }),
      );
    }
  }, [posts, postId]);

  const renderPost = useCallback(
    ({ item }) => (
      <PostCard
        post={item}
        onToggleLike={toggleLike}
        onOptions={isMine(item) ? setOptionsPost : undefined}
      />
    ),
    [toggleLike, isMine],
  );

  const handleDelete = (post) =>
    confirmDelete(post, () => {
      // Leave the viewer when the last post is gone
      if (posts.length <= 1) router.back();
    });

  const header = (
    <View style={styles.header}>
      <Pressable
        onPress={() => router.back()}
        hitSlop={10}
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={t("common.goBack")}
      >
        <MaterialIcons name="arrow-back" size={24} color={COLORS.text} />
      </Pressable>
      <View>
        <Text style={styles.headerTitle}>{t("profile.posts")}</Text>
        {posts?.[0]?.username && (
          <Text style={styles.headerSubtitle}>@{posts[0].username}</Text>
        )}
      </View>
    </View>
  );

  if (!posts) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.centered}>
          {error ? (
            <>
              <MaterialIcons name="cloud-off" size={48} color={COLORS.textSecondary} />
              <Text style={styles.message}>{error}</Text>
              <Pressable
                onPress={reload}
                style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
              >
                <Text style={styles.retryText}>{t("common.tryAgain")}</Text>
              </Pressable>
            </>
          ) : (
            <ActivityIndicator size="large" color={COLORS.accent} />
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {header}
      <FlatList
        ref={listRef}
        data={posts}
        keyExtractor={(post) => String(post.id)}
        renderItem={renderPost}
        contentContainerStyle={posts.length === 0 ? styles.emptyContainer : styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
        onScrollToIndexFailed={({ index, averageItemLength }) => {
          // Rows aren't measured yet: jump close, then retry precisely
          listRef.current?.scrollToOffset({ offset: index * averageItemLength, animated: false });
          setTimeout(() => listRef.current?.scrollToIndex({ index, animated: false }), 100);
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={COLORS.accent}
            colors={[COLORS.accent]}
          />
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <MaterialIcons name="photo-library" size={44} color={COLORS.textSecondary} />
            <Text style={styles.message}>{t("post.noPostsHere")}</Text>
          </View>
        }
      />

      <OptionsSheet
        visible={!!optionsPost}
        title={t("post.yourPost")}
        onClose={() => setOptionsPost(null)}
        options={[
          {
            label: t("post.deletePost"),
            icon: "delete-outline",
            destructive: true,
            onPress: () => handleDelete(optionsPost),
          },
        ]}
      />
    </View>
  );
}

const useStyles = makeStyles((COLORS) => ({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  pressed: {
    opacity: 0.6,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "800",
  },
  headerSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  list: {
    paddingTop: 4,
    paddingBottom: 24,
  },
  separator: {
    height: 14,
  },
  emptyContainer: {
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  message: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: "center",
    marginTop: 10,
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  retryText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
  },
}));
