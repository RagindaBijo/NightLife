import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from "react-native";
import OptionsSheet from "../../components/OptionsSheet";
import PostCard from "../../components/PostCard";
import ReportSheet from "../../components/ReportSheet";
import { api } from "../../lib/api";
import UserSearchResults from "../../components/UserSearchResults";
import { openProfile } from "../../lib/openProfile";
import { useUserType } from "../../lib/session-context";
import { usePostFeed } from "../../lib/usePostFeed";
import { useI18n } from "../../lib/i18n";
import { useNotificationCount } from "../../lib/notifications";
import { makeStyles, useTheme } from "../../lib/theme-context";

export default function Social() {
  const { colors: COLORS, gradients: GRADIENTS } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  const navigation = useNavigation();
  const router = useRouter();
  const isUser = useUserType() === "1";
  const { posts, error, isMine, refreshing, refresh, reload, toggleLike, confirmDelete } =
    usePostFeed();
  const [optionsPost, setOptionsPost] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [reportTarget, setReportTarget] = useState(null);
  const searching = searchQuery.trim().length > 0;
  const notificationCount = useNotificationCount();

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const openCreatePost = () => router.push("/protected/profile-folder/create-post");

  // Tap a post's author: their profile (or a venue's page, or your own profile)
  const openAuthor = useCallback(
    (post) =>
      openProfile(router, { userId: post.user_id, userType: post.user_type, isMine: isMine(post) }),
    [router, isMine],
  );

  const renderPost = useCallback(
    ({ item }) => (
      <PostCard
        post={item}
        onToggleLike={toggleLike}
        onOptions={setOptionsPost}
        onAuthorPress={openAuthor}
      />
    ),
    [toggleLike, openAuthor],
  );

  // Block a post's author: their posts disappear from your feed
  const blockAuthor = (post) => {
    const name = post.username || t("social.thisUser");
    Alert.alert(t("block.confirmTitle", { name }), t("block.confirmMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("block.block"),
        style: "destructive",
        onPress: async () => {
          try {
            await api(`/api/users/${post.user_id}/block`, { method: "PUT" });
            reload();
          } catch (err) {
            Alert.alert(t("block.error"), err.message);
          }
        },
      },
    ]);
  };

  // ⋯ menu: delete your own post, or report / block someone else's
  const postOptions = !optionsPost
    ? []
    : isMine(optionsPost)
      ? [
          {
            label: t("post.deletePost"),
            icon: "delete-outline",
            destructive: true,
            onPress: () => confirmDelete(optionsPost),
          },
        ]
      : [
          {
            label: t("report.reportPost"),
            icon: "flag",
            onPress: () => setReportTarget({ type: "post", id: optionsPost.id }),
          },
          {
            label: t("block.blockName", { name: optionsPost.username || t("social.thisUser") }),
            icon: "block",
            destructive: true,
            onPress: () => blockAuthor(optionsPost),
          },
        ];

  const searchBar = (
    <View style={styles.searchBar}>
      <MaterialIcons name="search" size={22} color={COLORS.textSecondary} />
      <TextInput
        style={styles.searchInput}
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder={t("social.searchPlaceholder")}
        placeholderTextColor={COLORS.placeholder}
        selectionColor={COLORS.accent}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      {searching && (
        <Pressable
          onPress={() => setSearchQuery("")}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t("common.clearSearch")}
        >
          <MaterialIcons name="cancel" size={20} color={COLORS.textSecondary} />
        </Pressable>
      )}
    </View>
  );

  const header = (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text style={styles.title}>{t("social.title")}</Text>
        <Text style={styles.subtitle}>{t("social.subtitle")}</Text>
      </View>
      {/* Notifications: follow requests, new followers, likes */}
      <Pressable
        onPress={() => router.push("/notifications")}
        hitSlop={8}
        style={({ pressed }) => [styles.bell, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={t("notifications.title")}
      >
        <MaterialIcons name="notifications-none" size={26} color={COLORS.text} />
        {notificationCount > 0 && (
          <View style={styles.bellBadge}>
            <Text style={styles.bellBadgeText}>{notificationCount > 99 ? "99+" : notificationCount}</Text>
          </View>
        )}
      </Pressable>
      {isUser && (
        <Pressable
          onPress={openCreatePost}
          style={({ pressed }) => pressed && styles.pressed}
          accessibilityRole="button"
          accessibilityLabel={t("social.createPost")}
        >
          <LinearGradient
            colors={GRADIENTS.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.createButton}
          >
            <MaterialIcons name="add" size={20} color={COLORS.onImage} />
            <Text style={styles.createText}>{t("social.post")}</Text>
          </LinearGradient>
        </Pressable>
      )}
    </View>
  );

  // While searching, people results replace the feed
  if (searching) {
    return (
      <View style={styles.container}>
        {header}
        {searchBar}
        <UserSearchResults
          query={searchQuery}
          onSelect={(person) => openProfile(router, { userId: person.id, userType: 1 })}
        />
      </View>
    );
  }

  if (!posts) {
    return (
      <View style={styles.container}>
        {header}
        {searchBar}
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
      {searchBar}
      <FlatList
        data={posts}
        keyExtractor={(post) => String(post.id)}
        renderItem={renderPost}
        contentContainerStyle={posts.length === 0 ? styles.emptyContainer : styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
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
            <View style={styles.emptyIcon}>
              <MaterialIcons name="photo-camera" size={34} color={COLORS.accent} />
            </View>
            <Text style={styles.emptyTitle}>{t("social.noPosts")}</Text>
            <Text style={styles.message}>{t("social.noPostsHint")}</Text>
            {isUser && (
              <Pressable
                onPress={openCreatePost}
                style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
              >
                <Text style={styles.retryText}>{t("social.createAPost")}</Text>
              </Pressable>
            )}
          </View>
        }
      />

      <OptionsSheet
        visible={!!optionsPost}
        title={optionsPost && isMine(optionsPost) ? t("post.yourPost") : undefined}
        onClose={() => setOptionsPost(null)}
        options={postOptions}
      />
      <ReportSheet target={reportTarget} onClose={() => setReportTarget(null)} />
    </View>
  );
}

const useStyles = makeStyles((COLORS) => ({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  pressed: {
    opacity: 0.7,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
  },
  searchInput: {
    flex: 1,
    height: "100%",
    color: COLORS.text,
    fontSize: 15,
  },
  bell: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  bellBadge: {
    position: "absolute",
    top: 2,
    right: 0,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.accentPink,
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  bellBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 20,
    paddingVertical: 8,
    paddingLeft: 10,
    paddingRight: 14,
  },
  createText: {
    color: COLORS.onImage,
    fontSize: 14,
    fontWeight: "700",
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
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: COLORS.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "700",
    marginTop: 16,
  },
  message: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 8,
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
