import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { timeAgo } from "../components/PostCard";
import { api } from "../lib/api";
import { answerFollowRequest, followLabelKey, pressFollow } from "../lib/follow";
import { useI18n } from "../lib/i18n";
import { setNotificationCount } from "../lib/notifications";
import { openProfile } from "../lib/openProfile";
import { makeStyles, useTheme } from "../lib/theme-context";

/**
 * Follow requests (accept / decline), new followers (follow back), accepted
 * requests and likes on your photos, newest first. Opening the screen marks
 * everything as read.
 */
export default function Notifications() {
  const { colors: COLORS, gradients: GRADIENTS } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(null); // key of the row being answered

  const load = useCallback(
    () =>
      api("/api/notifications").then(
        (data) => {
          setItems(data.items);
          setError(null);
          // Seen now: the badge clears, the highlight stays until next time
          if (data.unread > 0) api("/api/notifications/seen", { method: "PUT" }).catch(() => {});
          setNotificationCount(0);
        },
        (err) => setError(err.status === 0 ? t("common.cantConnect") : err.message),
      ),
    [t],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const keyOf = (item) => `${item.type}-${item.user.id}-${item.post_id ?? ""}-${item.date}`;

  const answer = async (item, accept) => {
    setBusy(keyOf(item));
    try {
      const result = await answerFollowRequest(item.user, { accept, iFollowThem: item.is_following });
      if (result) await load();
    } catch (err) {
      Alert.alert(t("follow.error"), err.message);
    } finally {
      setBusy(null);
    }
  };

  const followBack = async (item) => {
    setBusy(keyOf(item));
    try {
      const result = await pressFollow({
        ...item.user,
        follow_status: item.follow_status,
        follows_you: true,
      });
      if (result) {
        setItems((prev) =>
          prev.map((n) =>
            n.user.id === item.user.id ? { ...n, is_following: result.following, follow_status: result.status } : n,
          ),
        );
      }
    } catch (err) {
      Alert.alert(t("follow.error"), err.message);
    } finally {
      setBusy(null);
    }
  };

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
      <Pressable
        onPress={() => router.back()}
        hitSlop={10}
        style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={t("common.goBack")}
      >
        <MaterialIcons name="arrow-back" size={24} color={COLORS.text} />
      </Pressable>
      <Text style={styles.title}>{t("notifications.title")}</Text>
    </View>
  );

  if (!items) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.centered}>
          {error ? (
            <>
              <Text style={styles.emptyText}>{error}</Text>
              <Pressable onPress={load} style={({ pressed }) => [styles.retry, pressed && styles.pressed]}>
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

  const renderAction = (item) => {
    if (busy === keyOf(item)) return <ActivityIndicator color={COLORS.accent} />;
    if (item.type === "follow_request") {
      return (
        <View style={styles.actions}>
          <Pressable
            onPress={() => answer(item, false)}
            style={({ pressed }) => [styles.declineButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t("notifications.decline")}
          >
            <MaterialIcons name="close" size={18} color={COLORS.text} />
          </Pressable>
          <Pressable onPress={() => answer(item, true)} style={({ pressed }) => pressed && styles.pressed} accessibilityRole="button">
            <LinearGradient colors={GRADIENTS.brand} style={styles.primaryButton}>
              <Text style={styles.primaryText}>{t("notifications.accept")}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      );
    }
    if (item.type === "follow" && item.follow_status !== "following") {
      const requested = item.follow_status === "requested";
      return (
        <Pressable onPress={() => followBack(item)} style={({ pressed }) => pressed && styles.pressed} accessibilityRole="button">
          {requested ? (
            <View style={[styles.primaryButton, styles.secondaryButton]}>
              <Text style={styles.secondaryText}>{t("follow.requested")}</Text>
            </View>
          ) : (
            <LinearGradient colors={GRADIENTS.brand} style={styles.primaryButton}>
              <Text style={styles.primaryText}>
                {t(followLabelKey({ follow_status: item.follow_status, follows_you: true }))}
              </Text>
            </LinearGradient>
          )}
        </Pressable>
      );
    }
    if (item.type === "like" && item.post_image) {
      return <Image source={{ uri: item.post_image }} style={styles.thumb} contentFit="cover" />;
    }
    return null;
  };

  return (
    <View style={styles.container}>
      {header}
      <FlatList
        data={items}
        keyExtractor={keyOf}
        contentContainerStyle={items.length ? styles.list : styles.grow}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={COLORS.accent} colors={[COLORS.accent]} />
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name="notifications-none" size={34} color={COLORS.accent} />
            </View>
            <Text style={styles.emptyTitle}>{t("notifications.empty")}</Text>
            <Text style={styles.emptyText}>{t("notifications.emptyHint")}</Text>
          </View>
        }
        renderItem={({ item }) => {
          const name = item.user.username || item.user.first_name || t("social.thisUser");
          return (
            <Pressable
              onPress={() => openProfile(router, { userId: item.user.id, userType: item.user.user_type })}
              style={({ pressed }) => [styles.row, item.unread && styles.rowUnread, pressed && styles.rowPressed]}
              accessibilityRole="button"
            >
              {item.user.profile_photo ? (
                <Image source={{ uri: item.user.profile_photo }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={[styles.avatar, styles.avatarEmpty]}>
                  <MaterialIcons
                    name={item.user.user_type === 2 ? "storefront" : "person"}
                    size={22}
                    color={COLORS.textSecondary}
                  />
                </View>
              )}
              <Text style={styles.text} numberOfLines={3}>
                <Text style={styles.name}>{name}</Text> {t(`notifications.${item.type}`)}{" "}
                <Text style={styles.time}>{timeAgo(item.date)}</Text>
              </Text>
              {renderAction(item)}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const useStyles = makeStyles((COLORS) => ({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "800",
  },
  list: {
    paddingBottom: 24,
  },
  grow: {
    flexGrow: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  rowUnread: {
    backgroundColor: COLORS.accentSoft,
  },
  rowPressed: {
    backgroundColor: COLORS.surfacePressed,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  avatarEmpty: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
  },
  text: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 19,
  },
  name: {
    fontWeight: "800",
  },
  time: {
    color: COLORS.textSecondary,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  declineButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
  },
  primaryButton: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    color: COLORS.onImage,
    fontSize: 13,
    fontWeight: "800",
  },
  secondaryButton: {
    backgroundColor: COLORS.surface,
  },
  secondaryText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.accentSoft,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: "800",
    marginTop: 14,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 8,
  },
  retry: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
  },
  retryText: {
    color: COLORS.text,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.7,
  },
}));
