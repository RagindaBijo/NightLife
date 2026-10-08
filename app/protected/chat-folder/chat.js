import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import SocialGate from "../../../components/social/SocialGate";
import { api, getSession } from "../../../lib/api";
import { formatTimeLeft } from "../../../lib/format";
import { refreshUnread } from "../../../lib/unread";
import { useI18n } from "../../../lib/i18n";
import { makeStyles, useTheme } from "../../../lib/theme-context";

export default function Chat() {
  const styles = useStyles();
  return (
    <View style={styles.container}>
      <SocialGate>
        <ChatList />
      </SocialGate>
    </View>
  );
}

function Avatar({ uri, size = 52 }) {
  const { colors: COLORS } = useTheme();
  const styles = useStyles();
  const box = { width: size, height: size, borderRadius: size / 2 };
  return uri ? (
    <Image source={{ uri }} style={[styles.avatar, box]} contentFit="cover" />
  ) : (
    <View style={[styles.avatar, styles.avatarEmpty, box]}>
      <MaterialIcons name="person" size={size * 0.5} color={COLORS.textSecondary} />
    </View>
  );
}

function ChatList() {
  const { colors: COLORS } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  const router = useRouter();
  const [data, setData] = useState(null); // { chats, requests, me }
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [answering, setAnswering] = useState(null); // request id being answered

  const load = useCallback(
    () =>
      Promise.all([api("/api/chats"), api("/api/chat-requests"), getSession()]).then(
        ([chats, requests, session]) => {
          setData({ chats, requests, me: Number(session?.userId) });
          setError(null);
          refreshUnread();
        },
        (err) => setError(err.status === 0 ? t("common.cantConnect") : err.message),
      ),
    [t],
  );

  // New messages and requests show up whenever the tab is opened
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
      await load();
      if (accept && result.chat_id) router.push(`/protected/chat-folder/${result.chat_id}`);
    } catch (err) {
      Alert.alert(t("chat.requestError"), err.message);
    } finally {
      setAnswering(null);
    }
  };

  const header = (
    <View style={styles.header}>
      <Text style={styles.title}>{t("chat.messages")}</Text>
      <Text style={styles.subtitle}>{t("chat.disappearHint", { count: 24 })}</Text>
    </View>
  );

  if (!data) {
    return (
      <>
        {header}
        <View style={styles.centered}>
          {error ? (
            <>
              <Text style={styles.emptyText}>{error}</Text>
              <Pressable onPress={load} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
                <Text style={styles.buttonText}>{t("common.tryAgain")}</Text>
              </Pressable>
            </>
          ) : (
            <ActivityIndicator size="large" color={COLORS.accent} />
          )}
        </View>
      </>
    );
  }

  const requests =
    data.requests.length > 0 ? (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("chat.requests", { count: data.requests.length })}</Text>
        {data.requests.map((request) => (
          <View key={request.id} style={styles.requestRow}>
            <Pressable
              onPress={() => router.push(`/user/${request.user_id}`)}
              style={styles.requestPerson}
              accessibilityRole="button"
            >
              <Avatar uri={request.profile_photo} size={46} />
              <View style={styles.rowText}>
                <Text style={styles.name} numberOfLines={1}>
                  {request.username}
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
                  style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={t("chat.decline")}
                >
                  <MaterialIcons name="close" size={22} color={COLORS.text} />
                </Pressable>
                <Pressable
                  onPress={() => answer(request, true)}
                  style={({ pressed }) => [styles.roundButton, styles.acceptButton, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={t("chat.accept")}
                >
                  <MaterialIcons name="check" size={22} color={COLORS.onAccent} />
                </Pressable>
              </View>
            )}
          </View>
        ))}
      </View>
    ) : null;

  return (
    <FlatList
      data={data.chats}
      keyExtractor={(chat) => String(chat.id)}
      contentContainerStyle={data.chats.length === 0 ? styles.grow : styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={COLORS.accent} colors={[COLORS.accent]} />
      }
      ListHeaderComponent={
        <>
          {header}
          {requests}
          {data.chats.length > 0 && <Text style={styles.sectionTitle}>{t("chat.chats")}</Text>}
        </>
      }
      ListEmptyComponent={
        <View style={styles.centered}>
          <View style={styles.emptyIcon}>
            <MaterialIcons name="forum" size={34} color={COLORS.accent} />
          </View>
          <Text style={styles.emptyTitle}>{t("chat.noChats")}</Text>
          <Text style={styles.emptyText}>{t("chat.noChatsHint")}</Text>
          <Pressable
            onPress={() => router.navigate("/protected/discover")}
            style={({ pressed }) => [styles.button, styles.primary, pressed && styles.pressed]}
          >
            <Text style={[styles.buttonText, styles.primaryText]}>{t("chat.goToDiscover")}</Text>
          </Pressable>
        </View>
      }
      renderItem={({ item }) => {
        const mine = item.last_sender_id === data.me;
        return (
          <Pressable
            onPress={() => router.push(`/protected/chat-folder/${item.id}`)}
            style={({ pressed }) => [styles.chatRow, pressed && styles.rowPressed]}
            accessibilityRole="button"
            accessibilityLabel={item.username}
          >
            <Avatar uri={item.profile_photo} />
            <View style={styles.rowText}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.first_name || item.username}
                </Text>
                <Text style={styles.timeLeft}>{formatTimeLeft(item.expires_at)}</Text>
              </View>
              <View style={styles.nameRow}>
                <Text style={[styles.preview, item.unread > 0 && styles.previewUnread]} numberOfLines={1}>
                  {item.last_body
                    ? `${mine ? `${t("chat.you")}: ` : ""}${item.last_body}`
                    : item.source === "match"
                      ? t("chat.newMatch")
                      : t("chat.sayHi")}
                </Text>
                {item.unread > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.unread > 99 ? "99+" : item.unread}</Text>
                  </View>
                )}
              </View>
            </View>
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
  header: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  grow: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginTop: 8,
  },
  sectionTitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 16,
    marginBottom: 8,
  },
  requestRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    marginBottom: 8,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
  },
  requestPerson: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  requestActions: {
    flexDirection: "row",
    gap: 8,
  },
  roundButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surfacePressed,
  },
  acceptButton: {
    backgroundColor: COLORS.accent,
  },
  chatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 16,
  },
  rowPressed: {
    backgroundColor: COLORS.surfacePressed,
  },
  avatar: {
    backgroundColor: COLORS.surface,
  },
  avatarEmpty: {
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  name: {
    flex: 1,
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
  },
  timeLeft: {
    color: COLORS.accentPink,
    fontSize: 12,
    fontWeight: "600",
  },
  preview: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  previewUnread: {
    color: COLORS.text,
    fontWeight: "600",
  },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.accent,
  },
  badgeText: {
    color: COLORS.onAccent,
    fontSize: 12,
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
  button: {
    marginTop: 18,
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
  },
  primary: {
    backgroundColor: COLORS.accent,
  },
  buttonText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "700",
  },
  primaryText: {
    color: COLORS.onAccent,
  },
  pressed: {
    opacity: 0.7,
  },
}));
