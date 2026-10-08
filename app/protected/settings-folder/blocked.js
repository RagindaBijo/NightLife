import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from "react-native";
import { api } from "../../../lib/api";
import { useI18n } from "../../../lib/i18n";
import { makeStyles, useTheme } from "../../../lib/theme-context";

/** People you've blocked, with an Unblock button for each. */
export default function BlockedAccounts() {
  const { colors: COLORS } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  const [people, setPeople] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(
    () =>
      api("/api/blocks").then(
        (data) => {
          setPeople(data);
          setError(null);
        },
        (err) => setError(err.status === 0 ? t("common.cantConnect") : t("block.loadError")),
      ),
    [t],
  );

  useEffect(() => {
    load();
  }, [load]);

  const unblock = async (person) => {
    try {
      await api(`/api/users/${person.id}/block`, { method: "DELETE" });
      setPeople((prev) => prev.filter((p) => p.id !== person.id));
    } catch (err) {
      Alert.alert(t("block.error"), err.message);
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
      contentContainerStyle={people.length === 0 ? styles.emptyContainer : styles.list}
      ListHeaderComponent={
        people.length > 0 ? <Text style={styles.hint}>{t("block.listHint")}</Text> : null
      }
      ListEmptyComponent={
        <View style={styles.centered}>
          <View style={styles.emptyIcon}>
            <MaterialIcons name="block" size={32} color={COLORS.accent} />
          </View>
          <Text style={styles.emptyTitle}>{t("block.noneTitle")}</Text>
          <Text style={styles.message}>{t("block.noneText")}</Text>
        </View>
      }
      renderItem={({ item }) => {
        const name = `${item.first_name || ""} ${item.last_name || ""}`.trim();
        return (
          <View style={styles.row}>
            {item.profile_photo ? (
              <Image source={{ uri: item.profile_photo }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <MaterialIcons name="person" size={24} color={COLORS.textSecondary} />
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
            <Pressable
              onPress={() => unblock(item)}
              style={({ pressed }) => [styles.unblock, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Text style={styles.unblockText}>{t("block.unblock")}</Text>
            </Pressable>
          </View>
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
    padding: 16,
    gap: 10,
  },
  emptyContainer: {
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    backgroundColor: COLORS.background,
  },
  hint: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surfacePressed,
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
    fontSize: 13,
    marginTop: 2,
  },
  unblock: {
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
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: COLORS.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "700",
    marginTop: 14,
  },
  message: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 6,
  },
  retry: {
    marginTop: 14,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  retryText: {
    color: COLORS.text,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.6,
  },
}));
