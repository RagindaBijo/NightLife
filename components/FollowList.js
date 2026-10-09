import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { api, getSession } from "../lib/api";
import { followLabelKey, pressFollow } from "../lib/follow";
import { useI18n } from "../lib/i18n";
import { openProfile } from "../lib/openProfile";
import { makeStyles, useTheme } from "../lib/theme-context";

/**
 * People following an account (kind = "followers") or followed by it
 * (kind = "following"), each with a Follow / Following button.
 * userId: whose list; defaults to the logged-in account.
 */
export default function FollowList({ kind, userId }) {
  const { colors: COLORS } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  const router = useRouter();
  const [people, setPeople] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [mine, setMine] = useState(true); // is this my own list?

  const load = useCallback(
    () =>
      getSession()
        .then((session) => {
          const id = userId ?? session.userId;
          setMine(String(id) === String(session.userId));
          return api(`/api/users/${id}/${kind}`);
        })
        .then((data) => {
          setPeople(data);
          setError(null);
        })
        .catch((err) => setError(err.status === 0 ? t("common.cantConnect") : t("follow.loadError"))),
    [kind, userId, t],
  );

  // Fresh whenever the tab is shown (e.g. after following someone on their profile)
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

  // Follow (a request until they accept), follow back (asks first), unfollow,
  // or take a request back
  const toggleFollow = async (person) => {
    try {
      const result = await pressFollow(person);
      if (!result) return;
      setPeople((prev) =>
        prev.map((p) =>
          p.id === person.id ? { ...p, is_following: result.following, follow_status: result.status } : p,
        ),
      );
    } catch (err) {
      Alert.alert(t("follow.error"), err.message);
    }
  };

  if (!people) {
    return (
      <View style={styles.centered}>
        {error ? (
          <>
            <Text style={styles.message}>{error}</Text>
            <Pressable onPress={load} style={({ pressed }) => [styles.retry, pressed && styles.pressed]}>
              <Text style={styles.retryText}>{t("common.tryAgain")}</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator size="large" color={COLORS.accent} />
        )}
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={people}
      keyExtractor={(person) => String(person.id)}
      contentContainerStyle={people.length === 0 ? styles.grow : styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={COLORS.accent} colors={[COLORS.accent]} />
      }
      ListEmptyComponent={
        <View style={styles.centered}>
          <View style={styles.emptyIcon}>
            <MaterialIcons name={kind === "followers" ? "group" : "person-add-alt"} size={32} color={COLORS.accent} />
          </View>
          <Text style={styles.emptyTitle}>
            {t(kind === "followers" ? "follow.noFollowers" : "follow.noFollowing")}
          </Text>
          {mine && (
            <Text style={styles.message}>
              {t(kind === "followers" ? "follow.noFollowersHint" : "follow.noFollowingHint")}
            </Text>
          )}
        </View>
      }
      renderItem={({ item }) => {
        const name = `${item.first_name || ""} ${item.last_name || ""}`.trim();
        return (
          <Pressable
            onPress={() =>
              openProfile(router, { userId: item.id, userType: item.user_type, isMine: item.is_me })
            }
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            accessibilityRole="button"
            accessibilityLabel={item.username}
          >
            {item.profile_photo ? (
              <Image source={{ uri: item.profile_photo }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, styles.avatarEmpty]}>
                <MaterialIcons
                  name={item.user_type === 2 ? "storefront" : "person"}
                  size={24}
                  color={COLORS.textSecondary}
                />
              </View>
            )}
            <View style={styles.text}>
              <Text style={styles.username} numberOfLines={1}>
                {item.username || t("social.thisUser")}
              </Text>
              {!!name && (
                <Text style={styles.name} numberOfLines={1}>
                  {name}
                </Text>
              )}
            </View>
            {!item.is_me && (
              <Pressable
                onPress={() => toggleFollow(item)}
                hitSlop={6}
                style={({ pressed }) => [
                  styles.followButton,
                  item.follow_status !== "none" ? styles.followingButton : styles.followPrimary,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
              >
                <Text style={[styles.followText, item.follow_status === "none" && styles.followTextPrimary]}>
                  {t(followLabelKey(item))}
                </Text>
              </Pressable>
            )}
          </Pressable>
        );
      }}
    />
  );
}

const useStyles = makeStyles((COLORS) => ({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  list: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  grow: {
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    backgroundColor: COLORS.background,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 14,
  },
  rowPressed: {
    backgroundColor: COLORS.surfacePressed,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.surface,
  },
  avatarEmpty: {
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    flex: 1,
  },
  username: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "700",
  },
  name: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 2,
  },
  followButton: {
    minWidth: 96,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  followPrimary: {
    backgroundColor: COLORS.accent,
  },
  followingButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  followText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
  },
  followTextPrimary: {
    color: COLORS.onAccent,
  },
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.accentSoft,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "700",
    marginTop: 14,
    textAlign: "center",
  },
  message: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 6,
  },
  retry: {
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
  },
  retryText: {
    color: COLORS.text,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.6,
  },
}));
