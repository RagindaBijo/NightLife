import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { api } from "../lib/api";
import { useI18n } from "../lib/i18n";
import { makeStyles, useTheme } from "../lib/theme-context";

const MIN_QUERY = 2;

/**
 * People matching `query` (username or name), fetched shortly after typing stops.
 * onSelect(user) is called when a row is tapped.
 */
export default function UserSearchResults({ query, onSelect }) {
  const { colors: COLORS } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  const trimmed = query.trim();
  const [result, setResult] = useState({ query: null, users: [], error: false });

  useEffect(() => {
    if (trimmed.length < MIN_QUERY) return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      api(`/api/users/search?q=${encodeURIComponent(trimmed)}`)
        .then((users) => !cancelled && setResult({ query: trimmed, users, error: false }))
        .catch(() => !cancelled && setResult({ query: trimmed, users: [], error: true }));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed]);

  if (trimmed.length < MIN_QUERY) {
    return <Text style={styles.hint}>{t("social.searchHint")}</Text>;
  }
  if (result.query !== trimmed) {
    return <ActivityIndicator style={styles.loader} color={COLORS.accent} />;
  }
  if (result.error) {
    return <Text style={styles.hint}>{t("common.cantConnect")}</Text>;
  }
  if (result.users.length === 0) {
    return (
      <View style={styles.empty}>
        <MaterialIcons name="person-search" size={40} color={COLORS.textSecondary} />
        <Text style={styles.emptyText}>{t("social.noUsersFound")}</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={result.users}
      keyExtractor={(user) => String(user.id)}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={styles.list}
      renderItem={({ item }) => {
        const fullName = `${item.first_name || ""} ${item.last_name || ""}`.trim();
        return (
          <Pressable
            onPress={() => onSelect(item)}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            accessibilityRole="button"
            accessibilityLabel={item.username}
          >
            {item.profile_photo ? (
              <Image source={{ uri: item.profile_photo }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <MaterialIcons name="person" size={24} color={COLORS.textSecondary} />
              </View>
            )}
            <View style={styles.text}>
              <Text style={styles.username} numberOfLines={1}>
                {item.username}
              </Text>
              {!!fullName && (
                <Text style={styles.name} numberOfLines={1}>
                  {fullName}
                </Text>
              )}
            </View>
            {item.is_following && (
              <Text style={styles.following}>{t("userProfile.following")}</Text>
            )}
          </Pressable>
        );
      }}
    />
  );
}

const useStyles = makeStyles((COLORS) => ({
  list: {
    paddingHorizontal: 8,
    paddingBottom: 24,
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
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.surface,
  },
  avatarPlaceholder: {
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
  following: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  hint: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: "center",
    marginTop: 32,
    paddingHorizontal: 32,
  },
  loader: {
    marginTop: 32,
  },
  empty: {
    alignItems: "center",
    gap: 10,
    marginTop: 48,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 15,
  },
}));
