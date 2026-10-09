import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { api } from "../../../lib/api";
import { useI18n } from "../../../lib/i18n";
import { makeStyles, useTheme } from "../../../lib/theme-context";
import { refreshUnread } from "../../../lib/unread";

/**
 * Chat requests waiting for an answer, opened from the button on the chat list.
 * Accepting one starts the chat and opens it (it then shows up in the normal
 * chat list); declining removes the request.
 */
export default function ChatRequests() {
  const { colors: COLORS, gradients: GRADIENTS } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  const router = useRouter();
  const [requests, setRequests] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [answering, setAnswering] = useState(null); // request id being answered

  const load = useCallback(
    () =>
      api("/api/chat-requests").then(
        (list) => {
          setRequests(list);
          setError(null);
          refreshUnread();
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

  const answer = async (request, accept) => {
    setAnswering(request.id);
    try {
      const result = await api(`/api/chat-requests/${request.id}`, { method: "PUT", body: { accept } });
      setRequests((prev) => prev.filter((r) => r.id !== request.id));
      refreshUnread();
      // Accepting opens the new chat. Going back from it returns here while other
      // requests are waiting, otherwise straight to the chat list
      if (accept && result.chat_id) {
        const href = `/protected/chat-folder/${result.chat_id}`;
        if (requests.length > 1) router.push(href);
        else router.replace(href);
      }
    } catch (err) {
      Alert.alert(t("chat.requestError"), err.message);
    } finally {
      setAnswering(null);
    }
  };

  const header = (
    <View style={styles.header}>
      <Pressable
        onPress={() => router.back()}
        hitSlop={10}
        style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={t("common.goBack")}
      >
        <MaterialIcons name="arrow-back" size={24} color={COLORS.text} />
      </Pressable>
      <Text style={styles.title}>{t("chat.requestsTitle")}</Text>
    </View>
  );

  if (!requests) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.centered}>
          {error ? (
            <Text style={styles.emptyText}>{error}</Text>
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
        data={requests}
        keyExtractor={(request) => String(request.id)}
        contentContainerStyle={requests.length ? styles.list : styles.grow}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={COLORS.accent} colors={[COLORS.accent]} />
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name="mark-chat-unread" size={32} color={COLORS.accent} />
            </View>
            <Text style={styles.emptyTitle}>{t("chat.noRequests")}</Text>
            <Text style={styles.emptyText}>{t("chat.noRequestsHint")}</Text>
          </View>
        }
        renderItem={({ item: request }) => (
          <View style={styles.requestCard}>
            <Pressable
              onPress={() => router.push(`/user/${request.user_id}`)}
              style={styles.requestPerson}
              accessibilityRole="button"
            >
              {request.profile_photo ? (
                <Image source={{ uri: request.profile_photo }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={[styles.avatar, styles.avatarEmpty]}>
                  <MaterialIcons name="person" size={24} color={COLORS.textSecondary} />
                </View>
              )}
              <View style={styles.rowText}>
                <Text style={styles.name} numberOfLines={1}>
                  {request.first_name || request.username}
                </Text>
                <Text style={styles.preview} numberOfLines={1}>
                  {t("chat.wantsToChat")}
                </Text>
              </View>
            </Pressable>
            {answering === request.id ? (
              <ActivityIndicator color={COLORS.accent} />
            ) : (
              <View style={styles.requestActions}>
                <Pressable
                  onPress={() => answer(request, false)}
                  style={({ pressed }) => [styles.declineButton, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={t("chat.decline")}
                >
                  <MaterialIcons name="close" size={20} color={COLORS.text} />
                </Pressable>
                <Pressable
                  onPress={() => answer(request, true)}
                  style={({ pressed }) => pressed && styles.pressed}
                  accessibilityRole="button"
                >
                  <LinearGradient colors={GRADIENTS.brand} style={styles.acceptButton}>
                    <Text style={styles.acceptText}>{t("chat.accept")}</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            )}
          </View>
        )}
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
    paddingVertical: 8,
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
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  grow: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  requestCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    marginBottom: 8,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  requestPerson: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarEmpty: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surfacePressed,
  },
  rowText: {
    flex: 1,
    gap: 3,
  },
  name: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
  },
  preview: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  requestActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  declineButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surfacePressed,
  },
  acceptButton: {
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptText: {
    color: COLORS.onImage,
    fontSize: 14,
    fontWeight: "800",
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
  pressed: {
    opacity: 0.7,
  },
}));
