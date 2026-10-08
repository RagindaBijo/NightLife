import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import OptionsSheet from "../../components/OptionsSheet";
import ReportSheet from "../../components/ReportSheet";
import { api, getSession } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { makeStyles, useTheme } from "../../lib/theme-context";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GRID_GAP = 2;
const TILE_WIDTH = (SCREEN_WIDTH - GRID_GAP * 2) / 3;
const TILE_HEIGHT = (TILE_WIDTH * 5) / 4; // 4:5, same as posts in the feed

function Stat({ value, label }) {
  const styles = useStyles();
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${value ?? 0} ${label}`}>
      <Text style={styles.statValue}>{value ?? 0}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/** Another person's profile: header, follow button and their posts. */
export default function UserProfile() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: COLORS, gradients: GRADIENTS } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState(null);
  const [error, setError] = useState(null); // "not_found" | message
  const [refreshing, setRefreshing] = useState(false);
  const [followSaving, setFollowSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [chatBusy, setChatBusy] = useState(false);

  const load = useCallback(
    () =>
      getSession()
        .then((session) => {
          // Your own profile lives in the Profile tab
          if (session && String(session.userId) === String(id)) {
            router.replace("/protected/profile-folder/profile");
            return null;
          }
          return Promise.all([
            api(`/api/user/${encodeURIComponent(id)}`),
            api(`/api/posts?user_id=${encodeURIComponent(id)}`),
          ]);
        })
        .then((result) => {
          if (!result) return;
          const [userData, postData] = result;
          setProfile(userData);
          setPosts(postData.map((post) => ({ id: String(post.id), image: post.post_image })));
          setError(null);
        })
        .catch((err) => {
          console.error("Load user profile error:", err.message);
          setError(
            err.status === 404 || err.status === 400
              ? "not_found"
              : err.status === 0
                ? t("common.cantConnect")
                : t("userProfile.loadError"),
          );
        }),
    [id, router, t],
  );

  useEffect(() => {
    load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Optimistic follow / unfollow, rolled back if the server refuses
  const toggleFollow = async () => {
    const wasFollowing = profile.is_following;
    const update = (isFollowing, followers) =>
      setProfile((prev) => ({ ...prev, is_following: isFollowing, followers_count: followers }));
    update(!wasFollowing, profile.followers_count + (wasFollowing ? -1 : 1));
    setFollowSaving(true);
    try {
      const result = await api(`/api/users/${profile.id}/follow`, {
        method: wasFollowing ? "DELETE" : "PUT",
      });
      update(result.following, result.followers_count);
    } catch (err) {
      console.error("Follow error:", err.message);
      update(wasFollowing, profile.followers_count);
    } finally {
      setFollowSaving(false);
    }
  };

  // Blocking hides you from each other and removes follows both ways
  const block = () =>
    Alert.alert(
      t("block.confirmTitle", { name: profile.username }),
      t("block.confirmMessage"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("block.block"),
          style: "destructive",
          onPress: async () => {
            try {
              await api(`/api/users/${profile.id}/block`, { method: "PUT" });
              setProfile((prev) => ({ ...prev, is_blocked: true, is_following: false }));
            } catch (err) {
              Alert.alert(t("block.error"), err.message);
            }
          },
        },
      ],
    );

  // The chat button: request, accept, or open the chat (all checked again by the server)
  const openChat = (chatId) => router.push(`/protected/chat-folder/${chatId}`);
  const chatAction = async () => {
    setChatBusy(true);
    try {
      const status = profile.chat_status;
      if (status === "active") {
        openChat(profile.chat_id);
      } else if (status === "can_message") {
        openChat((await api("/api/chats", { method: "POST", body: { user_id: profile.id } })).chat_id);
      } else if (status === "incoming") {
        const result = await api(`/api/chat-requests/${profile.request_id}`, {
          method: "PUT",
          body: { accept: true },
        });
        setProfile((prev) => ({ ...prev, chat_status: "active", chat_id: result.chat_id }));
        openChat(result.chat_id);
      } else {
        const result = await api("/api/chat-requests", { method: "POST", body: { to_id: profile.id } });
        if (result.chat_id) {
          setProfile((prev) => ({ ...prev, chat_status: "active", chat_id: result.chat_id }));
          openChat(result.chat_id);
        } else {
          setProfile((prev) => ({ ...prev, chat_status: result.status }));
        }
      }
    } catch (err) {
      Alert.alert(t("chat.requestError"), err.message);
      load();
    } finally {
      setChatBusy(false);
    }
  };

  const unblock = async () => {
    try {
      await api(`/api/users/${profile.id}/block`, { method: "DELETE" });
      load();
    } catch (err) {
      Alert.alert(t("block.error"), err.message);
    }
  };

  const topBar = (
    <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
      <Pressable
        onPress={() => router.back()}
        hitSlop={10}
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={t("common.goBack")}
      >
        <MaterialIcons name="arrow-back" size={24} color={COLORS.text} />
      </Pressable>
      <Text style={styles.topTitle} numberOfLines={1}>
        {profile?.username ? `@${profile.username}` : ""}
      </Text>
      {profile ? (
        <Pressable
          onPress={() => setMenuOpen(true)}
          hitSlop={10}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t("block.moreOptions")}
        >
          <MaterialIcons name="more-horiz" size={26} color={COLORS.text} />
        </Pressable>
      ) : (
        <View style={styles.backButton} />
      )}
    </View>
  );

  if (!profile) {
    return (
      <View style={styles.container}>
        {topBar}
        <View style={styles.centered}>
          {error ? (
            <>
              <MaterialIcons
                name={error === "not_found" ? "person-off" : "cloud-off"}
                size={48}
                color={COLORS.textSecondary}
              />
              <Text style={styles.message}>
                {error === "not_found" ? t("userProfile.notFound") : error}
              </Text>
              {error !== "not_found" && (
                <Pressable
                  onPress={load}
                  style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
                >
                  <Text style={styles.retryText}>{t("common.tryAgain")}</Text>
                </Pressable>
              )}
            </>
          ) : (
            <ActivityIndicator size="large" color={COLORS.accent} />
          )}
        </View>
      </View>
    );
  }

  const name = `${profile.first_name || ""} ${profile.last_name || ""}`.trim();

  return (
    <View style={styles.container}>
      {topBar}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={COLORS.accent}
            colors={[COLORS.accent]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.identityRow}>
            <LinearGradient
              colors={GRADIENTS.brand}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatarRing}
            >
              <View style={styles.avatarInner}>
                {profile.profile_photo ? (
                  <Image
                    source={{ uri: profile.profile_photo }}
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
              <Stat value={profile.posts_count} label={t("profile.posts")} />
              <Stat value={profile.followers_count} label={t("profile.followers")} />
              <Stat value={profile.following_count} label={t("profile.following")} />
            </View>
          </View>

          {!!name && <Text style={styles.name}>{name}</Text>}
          {!!profile.bio_text && <Text style={styles.bio}>{profile.bio_text}</Text>}

          {profile.is_blocked ? (
            <View style={styles.blockedBox}>
              <MaterialIcons name="block" size={22} color={COLORS.danger} />
              <Text style={styles.blockedText}>
                {t("block.youBlocked", { name: profile.username })}
              </Text>
              <Pressable
                onPress={unblock}
                style={({ pressed }) => [styles.unblockButton, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Text style={styles.unblockText}>{t("block.unblock")}</Text>
              </Pressable>
            </View>
          ) : (
          <View style={styles.actionRow}>
          <Pressable
            onPress={toggleFollow}
            disabled={followSaving}
            style={({ pressed }) => [pressed && styles.pressed, styles.followWrap]}
            accessibilityRole="button"
            accessibilityState={{ selected: profile.is_following }}
          >
            {profile.is_following ? (
              <View style={[styles.followButton, styles.followingButton]}>
                <MaterialIcons name="check" size={18} color={COLORS.text} />
                <Text style={styles.followingText}>{t("userProfile.following")}</Text>
              </View>
            ) : (
              <LinearGradient
                colors={GRADIENTS.brand}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.followButton}
              >
                <MaterialIcons name="person-add" size={18} color={COLORS.onImage} />
                <Text style={styles.followText}>{t("userProfile.follow")}</Text>
              </LinearGradient>
            )}
          </Pressable>
          {!!profile.chat_status && profile.chat_status !== "unavailable" && (
            <Pressable
              onPress={chatAction}
              disabled={chatBusy || profile.chat_status === "requested"}
              style={({ pressed }) => [styles.followWrap, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <View
                style={[
                  styles.followButton,
                  styles.followingButton,
                  profile.chat_status === "requested" && styles.chatRequested,
                ]}
              >
                {chatBusy ? (
                  <ActivityIndicator size="small" color={COLORS.accent} />
                ) : (
                  <>
                    <MaterialIcons
                      name={
                        profile.chat_status === "requested"
                          ? "schedule"
                          : profile.chat_status === "none"
                            ? "forum"
                            : "chat-bubble-outline"
                      }
                      size={18}
                      color={COLORS.text}
                    />
                    <Text style={styles.followingText} numberOfLines={1}>
                      {t(`chat.button.${profile.chat_status}`)}
                    </Text>
                  </>
                )}
              </View>
            </Pressable>
          )}
          </View>
          )}
        </View>

        {/* Posts */}
        <View style={styles.postsHeader}>
          <MaterialIcons name="grid-on" size={22} color={COLORS.text} />
        </View>
        {profile.is_blocked ? null : !posts ? (
          <ActivityIndicator style={styles.postsLoader} color={COLORS.accent} />
        ) : posts.length === 0 ? (
          <View style={styles.emptyPosts}>
            <MaterialIcons name="photo-camera" size={36} color={COLORS.textSecondary} />
            <Text style={styles.message}>{t("userProfile.noPosts")}</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {posts.map((post, index) => (
              <Pressable
                key={post.id}
                onPress={() =>
                  router.push({
                    pathname: "/user/posts",
                    params: { userId: String(profile.id), postId: post.id },
                  })
                }
                style={({ pressed }) => [
                  styles.tile,
                  (index + 1) % 3 !== 0 && { marginRight: GRID_GAP },
                  pressed && styles.pressed,
                ]}
                accessibilityRole="imagebutton"
                accessibilityLabel={t("profile.openPost")}
              >
                {post.image ? (
                  <Image source={{ uri: post.image }} style={styles.tileImage} contentFit="cover" />
                ) : (
                  <View style={[styles.tileImage, styles.tilePlaceholder]}>
                    <MaterialIcons name="image" size={24} color={COLORS.textSecondary} />
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <OptionsSheet
        visible={menuOpen}
        title={`@${profile.username}`}
        onClose={() => setMenuOpen(false)}
        options={[
          {
            label: t("report.reportUser"),
            icon: "flag",
            onPress: () =>
              setReportTarget({ type: "user", id: profile.id, name: `@${profile.username}` }),
          },
          profile.is_blocked
            ? { label: t("block.unblock"), icon: "block", onPress: unblock }
            : { label: t("block.block"), icon: "block", destructive: true, onPress: block },
        ]}
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
    opacity: 0.6,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    flex: 1,
    textAlign: "center",
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "700",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  message: {
    color: COLORS.textSecondary,
    fontSize: 15,
    textAlign: "center",
    marginTop: 12,
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
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
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
  },
  statValue: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
  },
  statLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  name: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
    marginTop: 14,
  },
  bio: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  followWrap: {
    flex: 1,
  },
  chatRequested: {
    opacity: 0.6,
  },
  followButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 40,
    borderRadius: 12,
  },
  followingButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  followText: {
    color: COLORS.onImage,
    fontSize: 15,
    fontWeight: "700",
  },
  followingText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "700",
  },
  blockedBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
  },
  blockedText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
  },
  unblockButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  unblockText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
  },
  postsHeader: {
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  postsLoader: {
    marginTop: 32,
  },
  emptyPosts: {
    alignItems: "center",
    paddingVertical: 48,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: GRID_GAP,
  },
  tile: {
    width: TILE_WIDTH,
    height: TILE_HEIGHT,
  },
  tileImage: {
    width: "100%",
    height: "100%",
    backgroundColor: COLORS.surface,
  },
  tilePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
}));
