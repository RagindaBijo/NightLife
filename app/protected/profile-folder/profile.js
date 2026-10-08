import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import CompleteProfileNotice, { missingProfileFields } from "../../../components/CompleteProfileNotice";
import FavoriteStar from "../../../components/FavoriteStar";
import InterestCheck from "../../../components/InterestCheck";
import SwipeableTabContent from "../../../components/SwipeableTabContent";
import { api, getSession } from "../../../lib/api";
import { eventStart, formatEventTime } from "../../../lib/format";
import { translate, useI18n } from "../../../lib/i18n";
import { favorites, interests } from "../../../lib/toggles";
import { makeStyles, useTheme } from "../../../lib/theme-context";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const GRID_GAP = 2;
const TILE_WIDTH = (SCREEN_WIDTH - GRID_GAP * 2) / 3;
const TILE_HEIGHT = (TILE_WIDTH * 5) / 4; // 4:5, same as posts in the feed

const TABS = [
  { key: "posts", labelKey: "profile.posts", icon: "grid-on", activeIcon: "grid-on" },
  { key: "favorites", labelKey: "profile.favorites", icon: "star-border", activeIcon: "star" },
  { key: "interested", labelKey: "profile.interested", icon: "event-available", activeIcon: "event-available" },
];

// ── Data loaders for each tab ────────────────────

async function loadPosts(userId) {
  const data = await api(`/api/posts?user_id=${encodeURIComponent(userId)}`);
  return data.map((post) => ({ id: String(post.id), image: post.post_image }));
}

async function loadFavorites() {
  const data = await api("/api/venues");
  favorites.seed(data, "is_favorite");
  return data
    .filter((venue) => venue.is_favorite)
    .map((venue) => ({
      id: String(venue.id),
      title: venue.title || translate("venue.fallbackTitle"),
      subtitle: venue.address || translate("venue.noAddress"),
      meta: venue.open_hours || translate("venue.defaultHours"),
      image: venue.photo_ids[0] || null,
    }));
}

async function loadInterested() {
  const data = await api("/api/events");
  interests.seed(data, "is_interested");

  // Look each venue up once, even if several events share it
  const venueNames = new Map();
  const venueName = async (venueId) => {
    if (!venueNames.has(venueId)) {
      venueNames.set(
        venueId,
        api(`/api/venue/${venueId}`)
          .then((venue) => venue.title || translate("event.unknownVenue"))
          .catch(() => translate("event.unknownVenue")),
      );
    }
    return venueNames.get(venueId);
  };

  return Promise.all(
    data
      .filter((event) => event.is_interested)
      .map(async (event) => ({
        id: String(event.id),
        title: event.title || translate("event.fallbackTitle"),
        subtitle: await venueName(event.venue_id),
        meta: eventStart(event) ? formatEventTime(eventStart(event)) : translate("event.noTime"),
        image: event.photo_id || null,
      })),
  );
}

const TAB_LOADERS = {
  posts: loadPosts,
  favorites: loadFavorites,
  interested: loadInterested,
};

// ── Small UI pieces ──────────────────────────────

function Stat({ value, label, onPress }) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.stat, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}`}
    >
      <Text style={styles.statValue}>{value ?? 0}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Pressable>
  );
}

function ActionButton({ label, onPress }) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
      accessibilityRole="button"
    >
      <Text style={styles.actionButtonText}>{label}</Text>
    </Pressable>
  );
}

function EmptyState({ icon, title, message, actionLabel, onAction }) {
  const { colors: COLORS } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconCircle}>
        <MaterialIcons name={icon} size={36} color={COLORS.text} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
      {actionLabel && (
        <Pressable
          onPress={onAction}
          style={({ pressed }) => [styles.emptyAction, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.emptyActionText}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

function ImageOrPlaceholder({ uri, style, icon }) {
  const { colors: COLORS } = useTheme();
  const styles = useStyles();
  if (!uri) {
    return (
      <View style={[style, styles.imagePlaceholder]}>
        <MaterialIcons name={icon} size={24} color={COLORS.textSecondary} />
      </View>
    );
  }
  return <Image source={{ uri }} style={style} contentFit="cover" transition={200} />;
}

function ItemCard({ item, icon, onPress, toggle }) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole="button"
      accessibilityLabel={item.title}
    >
      <ImageOrPlaceholder uri={item.image} style={styles.cardImage} icon={icon} />
      <View style={styles.cardText}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.cardSubtitle} numberOfLines={1}>
          {item.subtitle}
        </Text>
        <Text style={styles.cardMeta} numberOfLines={1}>
          {item.meta}
        </Text>
      </View>
      {toggle}
    </Pressable>
  );
}

// ── Screen ───────────────────────────────────────

export default function Profile() {
  const { colors: COLORS } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  const navigation = useNavigation();
  const router = useRouter();
  const [userId, setUserId] = useState(null);
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("posts");
  const [tabState, setTabState] = useState({}); // key → { items, loading, error }
  const activeTabRef = useRef("posts");
  const [indicatorX] = useState(() => new Animated.Value(0));

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const fetchUser = useCallback(async () => {
    try {
      const session = await getSession();
      if (!session) {
        setError(t("api.loginAgain"));
        return null;
      }

      // Counts and private lists come from the API
      const userData = await api(`/api/user/${session.userId}`);

      favorites.seedIds(userData.favorite_ids ?? []);
      interests.seedIds(userData.interested_ids ?? []);
      setUserId(session.userId);
      setUser({
        name:
          `${userData.first_name || ""} ${userData.last_name || ""}`.trim() ||
          t("profile.unnamedUser"),
        username: userData.username || "",
        bio: userData.bio_text || "",
        profileImage: userData.profile_photo || null,
        followers: userData.followers_count,
        following: userData.following_count,
        posts: userData.posts_count,
        // Photo, names and username: until all are set the profile is hidden
        missing: userData.profile_complete === false ? missingProfileFields(userData) : [],
      });
      setError(null);
      return session.userId;
    } catch (err) {
      console.error("Error fetching user profile:", err.message);
      setError(
        err.status === 0
          ? t("common.cantConnect")
          : t("profile.loadError"),
      );
      return null;
    }
  }, [t]);

  // Loads a tab's items; cached items stay visible while it refreshes
  const fetchTab = useCallback(async (key, id) => {
    if (!id) return;
    setTabState((prev) => ({
      ...prev,
      [key]: { items: prev[key]?.items ?? null, loading: true, error: null },
    }));
    try {
      const items = await TAB_LOADERS[key](id);
      setTabState((prev) => ({ ...prev, [key]: { items, loading: false, error: null } }));
    } catch (err) {
      console.error(`Error loading ${key}:`, err.message);
      setTabState((prev) => ({
        ...prev,
        [key]: {
          items: prev[key]?.items ?? null,
          loading: false,
          error: err.status === 0 ? t("profile.tabConnectError") : t("profile.tabLoadError"),
        },
      }));
    }
  }, [t]);

  // Long-press on a grid photo: confirm, delete the post, refresh counts + grid
  const confirmDeletePost = (post) =>
    Alert.alert(t("post.deleteTitle"), t("post.deleteMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          try {
            await api(`/api/posts/${post.id}`, { method: "DELETE" });
            setTabState((prev) => ({
              ...prev,
              posts: {
                ...prev.posts,
                items: prev.posts.items.filter((item) => item.id !== post.id),
              },
            }));
            fetchUser();
          } catch (err) {
            console.error("Delete post error:", err.message);
            Alert.alert(t("common.deleteError"), t("common.pleaseTryAgain"));
          }
        },
      },
    ]);

  // Refresh whenever the screen comes back into view (e.g. after editing the
  // profile or creating a post)
  useFocusEffect(
    useCallback(() => {
      fetchUser().then((id) => fetchTab(activeTabRef.current, id));
    }, [fetchUser, fetchTab]),
  );

  const selectTab = (key) => {
    const index = TABS.findIndex((tab) => tab.key === key);
    Animated.spring(indicatorX, {
      toValue: index * (SCREEN_WIDTH / TABS.length),
      useNativeDriver: true,
      speed: 20,
      bounciness: 4,
    }).start();
    activeTabRef.current = key;
    setActiveTab(key);
    fetchTab(key, userId);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    const id = await fetchUser();
    await fetchTab(activeTabRef.current, id);
    setRefreshing(false);
  };

  const retry = () => {
    setError(null);
    onRefresh();
  };

  // ── Full-screen states ──

  if (!user && error) {
    return (
      <View style={styles.centered}>
        <MaterialIcons name="cloud-off" size={48} color={COLORS.textSecondary} />
        <Text style={styles.errorText}>{error}</Text>
        <Pressable
          onPress={retry}
          style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
        >
          <Text style={styles.retryButtonText}>{t("common.tryAgain")}</Text>
        </Pressable>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  // ── Tab content ──

  const renderTabContent = () => {
    const state = tabState[activeTab];
    const items = state?.items;

    if (!items && state?.error) {
      return (
        <View style={styles.tabMessage}>
          <Text style={styles.errorText}>{state.error}</Text>
          <Pressable
            onPress={() => fetchTab(activeTab, userId)}
            style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
          >
            <Text style={styles.retryButtonText}>{t("common.tryAgain")}</Text>
          </Pressable>
        </View>
      );
    }

    if (!items) {
      return (
        <View style={styles.tabMessage}>
          <ActivityIndicator color={COLORS.accent} />
        </View>
      );
    }

    if (activeTab === "posts") {
      if (items.length === 0) {
        return (
          <EmptyState
            icon="photo-camera"
            title={t("profile.noPosts")}
            message={t("profile.noPostsHint")}
            actionLabel={t("profile.createPost")}
            onAction={() => router.push("/protected/profile-folder/create-post")}
          />
        );
      }
      return (
        <View style={styles.grid}>
          {items.map((post, index) => (
            <Pressable
              key={post.id}
              onPress={() =>
                router.push({
                  pathname: "/protected/profile-folder/post-list",
                  params: { userId: String(userId), postId: post.id },
                })
              }
              onLongPress={() => confirmDeletePost(post)}
              delayLongPress={350}
              style={({ pressed }) => [
                styles.tile,
                (index + 1) % 3 !== 0 && { marginRight: GRID_GAP },
                pressed && styles.pressed,
              ]}
              accessibilityRole="imagebutton"
              accessibilityLabel={t("profile.openPost")}
              accessibilityHint={t("profile.longPressDelete")}
            >
              <ImageOrPlaceholder uri={post.image} style={styles.tileImage} icon="image" />
            </Pressable>
          ))}
        </View>
      );
    }

    if (activeTab === "favorites") {
      if (items.length === 0) {
        return (
          <EmptyState
            icon="star-border"
            title={t("profile.noFavorites")}
            message={t("profile.noFavoritesHint")}
            actionLabel={t("profile.exploreVenues")}
            onAction={() => router.push("/protected/home")}
          />
        );
      }
      return (
        <View style={styles.cardList}>
          {items.map((venue) => (
            <ItemCard
              key={venue.id}
              item={venue}
              icon="storefront"
              onPress={() => router.push(`/protected/home/venueId/${venue.id}`)}
              toggle={
                <FavoriteStar
                  venueId={venue.id}
                  style={styles.cardToggle}
                  inactiveColor={COLORS.placeholder}
                />
              }
            />
          ))}
        </View>
      );
    }

    if (items.length === 0) {
      return (
        <EmptyState
          icon="event-available"
          title={t("profile.noEvents")}
          message={t("profile.noEventsHint")}
          actionLabel={t("profile.exploreEvents")}
          onAction={() => router.push("/protected/home")}
        />
      );
    }
    return (
      <View style={styles.cardList}>
        {items.map((event) => (
          <ItemCard
            key={event.id}
            item={event}
            icon="event"
            onPress={() => router.push(`/protected/home/eventId/${event.id}`)}
            toggle={<InterestCheck eventId={event.id} style={styles.cardToggle} />}
          />
        ))}
      </View>
    );
  };

  // ── Layout ──

  return (
    <ScrollView
      style={styles.container}
      stickyHeaderIndices={[1]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={COLORS.accent}
          colors={[COLORS.accent]}
        />
      }
    >
      {/* Profile header */}
      <View style={styles.header}>
        <View style={styles.topBar}>
          <Text style={styles.handle} numberOfLines={1}>
            {user.username ? `@${user.username}` : user.name}
          </Text>
          <Pressable
            onPress={() => router.push("/protected/profile-folder/create-post")}
            hitSlop={10}
            style={({ pressed }) => pressed && styles.pressed}
            accessibilityRole="button"
            accessibilityLabel={t("profile.createPost")}
          >
            <MaterialIcons name="add-box" size={28} color={COLORS.text} />
          </Pressable>
          <Pressable
            onPress={() => router.push("/protected/settings-folder/settings")}
            hitSlop={10}
            style={({ pressed }) => [styles.settingsButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t("tabs.settings")}
          >
            <MaterialIcons name="settings" size={26} color={COLORS.text} />
          </Pressable>
        </View>

        <View style={styles.identityRow}>
          <LinearGradient
            colors={[COLORS.accent, COLORS.accentPink]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatarRing}
          >
            <View style={styles.avatarInner}>
              {user.profileImage ? (
                <Image
                  source={{ uri: user.profileImage }}
                  style={styles.avatar}
                  contentFit="cover"
                  transition={200}
                />
              ) : (
                <MaterialIcons name="person" size={52} color={COLORS.textSecondary} />
              )}
            </View>
          </LinearGradient>

          <View style={styles.stats}>
            <Stat value={user.posts} label={t("profile.posts")} onPress={() => selectTab("posts")} />
            <Stat
              value={user.followers}
              label={t("profile.followers")}
              onPress={() =>
                router.push({
                  pathname: "/protected/profile-folder/follow",
                  params: { tab: "followers", username: user.username },
                })
              }
            />
            <Stat
              value={user.following}
              label={t("profile.following")}
              onPress={() =>
                router.push({
                  pathname: "/protected/profile-folder/follow",
                  params: { tab: "following", username: user.username },
                })
              }
            />
          </View>
        </View>

        <Text style={styles.name}>{user.name}</Text>
        {!!user.bio && <Text style={styles.bio}>{user.bio}</Text>}

        {user.missing.length > 0 && <CompleteProfileNotice missing={user.missing} compact />}

        <View style={styles.actions}>
          <ActionButton
            label={t("profile.editProfile")}
            onPress={() => router.push("/protected/profile-folder/edit-profile")}
          />
          <ActionButton
            label={t("profile.tickets")}
            onPress={() => console.log("Tickets button pressed")}
          />
        </View>
      </View>

      {/* Sticky tab bar – React Native replaces the style of a sticky child,
          so the row layout lives on an inner view */}
      <View style={styles.tabBarSticky}>
        <View style={styles.tabBar}>
          {TABS.map((tab) => {
            const isActive = tab.key === activeTab;
            return (
              <Pressable
                key={tab.key}
                onPress={() => selectTab(tab.key)}
                style={styles.tabButton}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={t(tab.labelKey)}
              >
                <MaterialIcons
                  name={isActive ? tab.activeIcon : tab.icon}
                  size={24}
                  color={isActive ? COLORS.text : COLORS.textSecondary}
                />
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                  {t(tab.labelKey)}
                </Text>
              </Pressable>
            );
          })}
          <Animated.View
            style={[styles.tabIndicator, { transform: [{ translateX: indicatorX }] }]}
          />
        </View>
      </View>

      {/* Active tab */}
      <SwipeableTabContent
        style={styles.tabContent}
        index={TABS.findIndex((tab) => tab.key === activeTab)}
        count={TABS.length}
        onChange={(index) => selectTab(TABS[index].key)}
      >
        {renderTabContent()}
      </SwipeableTabContent>
    </ScrollView>
  );
}

const useStyles = makeStyles((COLORS) => ({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centered: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  pressed: {
    opacity: 0.6,
  },

  // Header
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: COLORS.background,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  settingsButton: {
    marginLeft: 16,
  },
  handle: {
    flex: 1,
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "700",
    marginRight: 12,
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  avatarRing: {
    width: 92,
    height: 92,
    borderRadius: 46,
    padding: 3,
  },
  avatarInner: {
    flex: 1,
    borderRadius: 43,
    backgroundColor: COLORS.surface,
    borderWidth: 3,
    borderColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  stats: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-around",
    marginLeft: 12,
  },
  stat: {
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 4,
    minWidth: 64,
  },
  statValue: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "700",
  },
  statLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  name: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "600",
    marginTop: 12,
  },
  bio: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: "center",
  },
  actionButtonPressed: {
    backgroundColor: COLORS.surfacePressed,
  },
  actionButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
  },

  // Tab bar
  tabBarSticky: {
    backgroundColor: COLORS.background,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: COLORS.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
  },
  tabLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  tabLabelActive: {
    color: COLORS.text,
    fontWeight: "600",
  },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: SCREEN_WIDTH / TABS.length,
    height: 2,
    backgroundColor: COLORS.accent,
  },

  // Tab content
  tabContent: {
    minHeight: SCREEN_HEIGHT * 0.5,
    paddingTop: GRID_GAP,
  },
  tabMessage: {
    alignItems: "center",
    paddingTop: 48,
    paddingHorizontal: 24,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  tile: {
    width: TILE_WIDTH,
    height: TILE_HEIGHT,
    marginBottom: GRID_GAP,
    backgroundColor: COLORS.surface,
  },
  tileImage: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
  },
  cardList: {
    padding: 12,
    gap: 10,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 10,
  },
  cardPressed: {
    backgroundColor: COLORS.surfacePressed,
  },
  cardImage: {
    width: 64,
    height: 64,
    borderRadius: 10,
  },
  cardText: {
    flex: 1,
    marginLeft: 12,
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "600",
  },
  cardSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 3,
  },
  cardMeta: {
    color: COLORS.accent,
    fontSize: 12,
    marginTop: 3,
  },
  cardToggle: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  // Empty / error states
  emptyState: {
    alignItems: "center",
    paddingTop: 48,
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: COLORS.text,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "700",
    marginTop: 16,
  },
  emptyMessage: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 20,
  },
  emptyAction: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  emptyActionText: {
    color: COLORS.accent,
    fontSize: 15,
    fontWeight: "600",
  },
  errorText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    textAlign: "center",
    marginTop: 12,
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  retryButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
  },
}));
