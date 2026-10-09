import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import SocialGate from "../../../components/social/SocialGate";
import { api, getSession } from "../../../lib/api";
import { formatClock, formatTimeLeft } from "../../../lib/format";
import { useI18n } from "../../../lib/i18n";
import { makeStyles, useTheme } from "../../../lib/theme-context";
import { refreshUnread } from "../../../lib/unread";

const URGENT_MS = 3 * 3600 * 1000; // last 3 hours: the timer turns pink

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

function Avatar({ uri, size = 54, ring }) {
  const { colors: COLORS, gradients: GRADIENTS } = useTheme();
  const styles = useStyles();
  const inner = uri ? (
    <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" />
  ) : (
    <View style={[styles.avatarEmpty, { width: size, height: size, borderRadius: size / 2 }]}>
      <MaterialIcons name="person" size={size * 0.5} color={COLORS.textSecondary} />
    </View>
  );
  if (!ring) return inner;
  return (
    <LinearGradient colors={GRADIENTS.brand} style={{ padding: 2.5, borderRadius: size }}>
      <View style={{ padding: 2, borderRadius: size, backgroundColor: COLORS.background }}>{inner}</View>
    </LinearGradient>
  );
}

/** "21:04" today, "Yesterday", or "3 Oct". */
function shortTime(iso, t) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return formatClock(date);
  if (date.toDateString() === yesterday.toDateString()) return t("chat.yesterday");
  return `${date.getDate()} ${t("months.short")[date.getMonth()]}`;
}

function ChatList() {
  const { colors: COLORS, gradients: GRADIENTS } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  const router = useRouter();
  const [data, setData] = useState(null); // { chats, requests, me }
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    () =>
      Promise.all([api("/api/chats"), api("/api/chat-requests"), getSession()]).then(
        ([chats, requests, session]) => {
          setData({ chats, requests, me: Number(session?.userId), loadedAt: Date.now() });
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

  const openChat = (chat) => router.push(`/protected/chat-folder/${chat.id}`);
  const requestCount = data?.requests.length ?? 0;

  const header = (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{t("chat.messages")}</Text>
        {/* Chat requests live on their own screen; the number shows how many are waiting */}
        <Pressable
          onPress={() => router.push("/protected/chat-folder/requests")}
          style={({ pressed }) => [styles.requestsButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t("chat.requestsTitle")}
        >
          <MaterialIcons name="mark-chat-unread" size={18} color={COLORS.text} />
          <Text style={styles.requestsText}>{t("chat.requestsButton")}</Text>
          {requestCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{requestCount > 99 ? "99+" : requestCount}</Text>
            </View>
          )}
        </Pressable>
      </View>
      <View style={styles.hintRow}>
        <MaterialIcons name="hourglass-bottom" size={14} color={COLORS.accentPink} />
        <Text style={styles.subtitle}>{t("chat.disappearHint", { count: 24 })}</Text>
      </View>
    </View>
  );

  if (!data) {
    return (
      <View style={styles.flex}>
        {header}
        <View style={styles.centered}>
          {error ? (
            <>
              <Text style={styles.emptyText}>{error}</Text>
              <Pressable onPress={load} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                <Text style={styles.secondaryText}>{t("common.tryAgain")}</Text>
              </Pressable>
            </>
          ) : (
            <ActivityIndicator size="large" color={COLORS.accent} />
          )}
        </View>
      </View>
    );
  }

  // Connections without any message yet go to the "New" row
  const fresh = data.chats.filter((chat) => !chat.last_body);
  const conversations = data.chats.filter((chat) => !!chat.last_body);

  const listHeader = (
    <>
      {header}

      {fresh.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("chat.newConnections")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.freshRow}>
            {fresh.map((chat) => (
              <Pressable
                key={chat.id}
                onPress={() => openChat(chat)}
                style={({ pressed }) => [styles.freshItem, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={chat.username}
              >
                <Avatar uri={chat.profile_photo} size={62} ring />
                <Text style={styles.freshName} numberOfLines={1}>
                  {chat.first_name || chat.username}
                </Text>
                <Text style={styles.freshTime}>{formatTimeLeft(chat.expires_at, data.loadedAt)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {conversations.length > 0 && <Text style={[styles.sectionTitle, styles.sectionSpaced]}>{t("chat.chats")}</Text>}
    </>
  );

  const nothingYet = data.chats.length === 0;

  return (
    <FlatList
      data={conversations}
      keyExtractor={(chat) => String(chat.id)}
      contentContainerStyle={nothingYet ? styles.grow : styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={COLORS.accent} colors={[COLORS.accent]} />
      }
      ListHeaderComponent={listHeader}
      ListEmptyComponent={
        nothingYet ? (
          <View style={styles.centered}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name="forum" size={34} color={COLORS.accent} />
            </View>
            <Text style={styles.emptyTitle}>{t("chat.noChats")}</Text>
            <Text style={styles.emptyText}>{t("chat.noChatsHint")}</Text>
            <Pressable onPress={() => router.navigate("/protected/discover")} style={({ pressed }) => pressed && styles.pressed}>
              <LinearGradient colors={GRADIENTS.brand} style={styles.primaryButton}>
                <Text style={styles.primaryText}>{t("chat.goToDiscover")}</Text>
              </LinearGradient>
            </Pressable>
          </View>
        ) : null
      }
      renderItem={({ item }) => {
        const mine = item.last_sender_id === data.me;
        const total = new Date(item.expires_at) - new Date(item.created_at);
        const left = Math.max(0, new Date(item.expires_at) - data.loadedAt);
        const urgent = left < URGENT_MS;
        const unread = item.unread > 0;
        return (
          <Pressable
            onPress={() => openChat(item)}
            style={({ pressed }) => [styles.chatRow, pressed && styles.rowPressed]}
            accessibilityRole="button"
            accessibilityLabel={item.username}
          >
            <Avatar uri={item.profile_photo} ring={unread} />
            <View style={styles.rowText}>
              <View style={styles.nameRow}>
                <Text style={[styles.name, unread && styles.nameUnread]} numberOfLines={1}>
                  {item.first_name || item.username}
                </Text>
                <Text style={styles.time}>{shortTime(item.last_date, t)}</Text>
              </View>
              <View style={styles.nameRow}>
                <Text style={[styles.preview, unread && styles.previewUnread]} numberOfLines={1}>
                  {mine ? `${t("chat.you")}: ` : ""}
                  {item.last_body}
                </Text>
                {unread && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.unread > 99 ? "99+" : item.unread}</Text>
                  </View>
                )}
              </View>
              {/* Time left in this chat */}
              <View style={styles.timerRow}>
                <View style={styles.timerTrack}>
                  <View
                    style={[
                      styles.timerFill,
                      urgent && styles.timerUrgent,
                      { width: `${total > 0 ? Math.max(3, (left / total) * 100) : 0}%` },
                    ]}
                  />
                </View>
                <Text style={[styles.timerText, urgent && styles.timerTextUrgent]}>
                  {formatTimeLeft(item.expires_at, data.loadedAt)}
                </Text>
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
  flex: {
    flex: 1,
  },
  header: {
    paddingTop: 12,
    paddingBottom: 6,
  },
  title: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "800",
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 3,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
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
    marginTop: 14,
  },
  sectionTitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  sectionSpaced: {
    marginTop: 18,
  },
  freshRow: {
    gap: 14,
    paddingRight: 8,
  },
  freshItem: {
    width: 74,
    alignItems: "center",
  },
  freshName: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 6,
  },
  freshTime: {
    color: COLORS.accentPink,
    fontSize: 11,
    fontWeight: "600",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  requestsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  requestsText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
  },
  chatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginHorizontal: -8,
    borderRadius: 18,
  },
  rowPressed: {
    backgroundColor: COLORS.surfacePressed,
  },
  avatarEmpty: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
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
    fontWeight: "600",
  },
  nameUnread: {
    fontWeight: "800",
  },
  time: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  preview: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  previewUnread: {
    color: COLORS.text,
    fontWeight: "700",
  },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.accentPink,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 3,
  },
  timerTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: COLORS.surfacePressed,
    overflow: "hidden",
  },
  timerFill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: COLORS.accent,
  },
  timerUrgent: {
    backgroundColor: COLORS.accentPink,
  },
  timerText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: "600",
  },
  timerTextUrgent: {
    color: COLORS.accentPink,
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
  primaryButton: {
    marginTop: 18,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 22,
  },
  primaryText: {
    color: COLORS.onImage,
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
  },
  secondaryText: {
    color: COLORS.text,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.7,
  },
}));
