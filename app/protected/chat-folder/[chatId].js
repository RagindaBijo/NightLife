import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import OptionsSheet from "../../../components/OptionsSheet";
import ReportSheet from "../../../components/ReportSheet";
import { API_URL, api, getSession } from "../../../lib/api";
import { formatClock, formatTimeLeft } from "../../../lib/format";
import { useI18n } from "../../../lib/i18n";
import { refreshUnread } from "../../../lib/unread";
import { makeStyles, useTheme } from "../../../lib/theme-context";

const WS_URL = API_URL.replace(/^http/, "ws");
const MESSAGE_MAX = 1000;

export default function ChatDetail() {
  const { chatId } = useLocalSearchParams();
  const router = useRouter();
  const { colors: COLORS } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  const [chat, setChat] = useState(null); // { id, expires_at, user, source }
  const [me, setMe] = useState(null);
  const [messages, setMessages] = useState([]); // oldest → newest
  const [hasOlder, setHasOlder] = useState(true);
  const [ended, setEnded] = useState(false);
  const [error, setError] = useState(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const loadingOlder = useRef(false);

  const addMessages = useCallback(
    (incoming) =>
      setMessages((prev) => {
        const ids = new Set(prev.map((m) => m.id));
        const fresh = incoming.filter((m) => !ids.has(m.id));
        return fresh.length ? [...prev, ...fresh].sort((a, b) => a.id - b.id) : prev;
      }),
    [],
  );

  const handleError = useCallback(
    (err) => {
      if (err.code === "chat_ended" || err.status === 410) setEnded(true);
      else setError(err.status === 0 ? t("common.cantConnect") : err.message);
    },
    [t],
  );

  // First load: chat info, latest messages, who I am
  useEffect(() => {
    Promise.all([api(`/api/chats/${chatId}`), api(`/api/chats/${chatId}/messages`), getSession()])
      .then(([info, latest, session]) => {
        setChat(info);
        setMe(Number(session?.userId));
        addMessages(latest);
        setHasOlder(latest.length === 50);
      })
      .catch(handleError);
  }, [chatId, addMessages, handleError]);

  // Live updates over a WebSocket (reconnects while the screen is open)
  useEffect(() => {
    if (!chat || ended) return undefined;
    let socket = null;
    let pingTimer = null;
    let retryTimer = null;
    let closed = false;
    let attempt = 0;

    const connect = async () => {
      const session = await getSession();
      if (closed || !session) return;
      socket = new WebSocket(`${WS_URL}/api/chats/${chatId}/ws`, null, {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      socket.onopen = () => {
        attempt = 0;
        pingTimer = setInterval(() => socket?.readyState === 1 && socket.send("ping"), 30000);
        // Catch up on anything sent while disconnected
        api(`/api/chats/${chatId}/messages`).then(addMessages, handleError);
      };
      socket.onmessage = (event) => {
        if (event.data === "pong") return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === "message") addMessages([data.message]);
          if (data.type === "ended") setEnded(true);
        } catch {
          // not ours
        }
      };
      socket.onclose = () => {
        clearInterval(pingTimer);
        if (closed) return;
        attempt += 1;
        retryTimer = setTimeout(connect, Math.min(30000, 1000 * 2 ** attempt));
      };
    };
    connect();

    return () => {
      closed = true;
      clearInterval(pingTimer);
      clearTimeout(retryTimer);
      socket?.close();
    };
  }, [chat, chatId, ended, addMessages, handleError]);

  // Mark the newest message from the other person as read
  const lastTheirs = [...messages].reverse().find((m) => m.sender_id !== me);
  useEffect(() => {
    if (!lastTheirs || ended) return;
    api(`/api/chats/${chatId}/read`, { method: "PUT", body: { message_id: lastTheirs.id } })
      .then(refreshUnread)
      .catch(() => {});
  }, [lastTheirs?.id, chatId, ended]); // eslint-disable-line react-hooks/exhaustive-deps

  // Countdown: refresh every minute, and end the chat when time is up
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const timeUp = !!chat && new Date(chat.expires_at).getTime() <= now;
  const isEnded = ended || timeUp;

  const loadOlder = () => {
    if (!hasOlder || loadingOlder.current || messages.length === 0) return;
    loadingOlder.current = true;
    api(`/api/chats/${chatId}/messages?before=${messages[0].id}`)
      .then((older) => {
        addMessages(older);
        setHasOlder(older.length === 50);
      })
      .catch(handleError)
      .finally(() => {
        loadingOlder.current = false;
      });
  };

  const send = async () => {
    const body = text.trim();
    if (!body || sending || isEnded) return;
    setSending(true);
    try {
      addMessages([await api(`/api/chats/${chatId}/messages`, { method: "POST", body: { body } })]);
      setText("");
    } catch (err) {
      if (err.code === "chat_ended" || err.status === 410) setEnded(true);
      else Alert.alert(t("chat.sendError"), err.message);
    } finally {
      setSending(false);
    }
  };

  const endChat = () =>
    Alert.alert(t("chat.endTitle"), t("chat.endMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("chat.endChat"),
        style: "destructive",
        onPress: async () => {
          try {
            await api(`/api/chats/${chatId}`, { method: "DELETE" });
          } catch {
            // already ended
          }
          router.back();
        },
      },
    ]);

  const block = () =>
    Alert.alert(t("block.confirmTitle", { name: chat.user.username }), t("block.confirmMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("block.block"),
        style: "destructive",
        onPress: async () => {
          try {
            await api(`/api/users/${chat.user.id}/block`, { method: "PUT" });
            router.back();
          } catch (err) {
            Alert.alert(t("block.error"), err.message);
          }
        },
      },
    ]);

  const person = chat?.user;

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
      {person && (
        <Pressable
          onPress={() => router.push(`/user/${person.id}`)}
          style={styles.headerPerson}
          accessibilityRole="button"
        >
          {person.profile_photo ? (
            <Image source={{ uri: person.profile_photo }} style={styles.headerAvatar} contentFit="cover" />
          ) : (
            <View style={[styles.headerAvatar, styles.avatarEmpty]}>
              <MaterialIcons name="person" size={20} color={COLORS.textSecondary} />
            </View>
          )}
          <View style={styles.headerText}>
            <Text style={styles.headerName} numberOfLines={1}>
              {person.first_name || person.username}
            </Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {isEnded ? t("chat.ended") : t("chat.disappearsIn", { time: formatTimeLeft(chat.expires_at, now) })}
            </Text>
          </View>
        </Pressable>
      )}
      {person && (
        <Pressable
          onPress={() => setMenuOpen(true)}
          hitSlop={10}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t("block.moreOptions")}
        >
          <MaterialIcons name="more-horiz" size={26} color={COLORS.text} />
        </Pressable>
      )}
    </View>
  );

  if (!chat) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.centered}>
          {ended ? (
            <EndedNotice onBack={() => router.back()} />
          ) : error ? (
            <Text style={styles.notice}>{error}</Text>
          ) : (
            <ActivityIndicator size="large" color={COLORS.accent} />
          )}
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {header}

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={[...messages].reverse()}
        inverted
        keyExtractor={(m) => String(m.id)}
        onEndReached={loadOlder}
        onEndReachedThreshold={0.3}
        keyboardDismissMode="on-drag"
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <Text style={styles.notice}>
              {chat.source === "match" ? t("chat.matchStart") : t("chat.startHint")}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const mine = item.sender_id === me;
          return (
            <View style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.body}</Text>
                <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>
                  {formatClock(new Date(item.create_date))}
                </Text>
              </View>
            </View>
          );
        }}
      />

      {isEnded ? (
        <View style={styles.endedBar}>
          <EndedNotice onBack={() => router.back()} />
        </View>
      ) : (
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder={t("chat.messagePlaceholder")}
            placeholderTextColor={COLORS.placeholder}
            selectionColor={COLORS.accent}
            multiline
            maxLength={MESSAGE_MAX}
          />
          <Pressable
            onPress={send}
            disabled={!text.trim() || sending}
            style={({ pressed }) => [styles.sendButton, (!text.trim() || sending) && styles.disabled, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t("chat.send")}
          >
            {sending ? (
              <ActivityIndicator color={COLORS.onAccent} size="small" />
            ) : (
              <MaterialIcons name="send" size={20} color={COLORS.onAccent} />
            )}
          </Pressable>
        </View>
      )}

      <OptionsSheet
        visible={menuOpen}
        title={person ? `@${person.username}` : undefined}
        onClose={() => setMenuOpen(false)}
        options={[
          { label: t("chat.viewProfile"), icon: "person-outline", onPress: () => router.push(`/user/${person.id}`) },
          {
            label: t("report.reportUser"),
            icon: "flag",
            onPress: () => setReportTarget({ type: "user", id: person.id, name: `@${person.username}` }),
          },
          { label: t("block.block"), icon: "block", destructive: true, onPress: block },
          ...(isEnded ? [] : [{ label: t("chat.endChat"), icon: "logout", destructive: true, onPress: endChat }]),
        ]}
      />
      <ReportSheet target={reportTarget} onClose={() => setReportTarget(null)} />
    </KeyboardAvoidingView>
  );
}

function EndedNotice({ onBack }) {
  const { colors: COLORS } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  return (
    <View style={styles.ended}>
      <MaterialIcons name="hourglass-bottom" size={26} color={COLORS.textSecondary} />
      <Text style={styles.endedTitle}>{t("chat.endedTitle")}</Text>
      <Text style={styles.notice}>{t("chat.endedText")}</Text>
      <Pressable onPress={onBack} style={({ pressed }) => [styles.endedButton, pressed && styles.pressed]}>
        <Text style={styles.endedButtonText}>{t("chat.backToChats")}</Text>
      </Pressable>
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
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerPerson: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.surface,
  },
  avatarEmpty: {
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
  },
  headerName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
  },
  headerSub: {
    color: COLORS.accentPink,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 12,
    gap: 6,
    flexGrow: 1,
  },
  bubbleRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  bubbleRowMine: {
    justifyContent: "flex-end",
  },
  bubble: {
    maxWidth: "80%",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 18,
  },
  bubbleTheirs: {
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: 6,
  },
  bubbleMine: {
    backgroundColor: COLORS.accent,
    borderBottomRightRadius: 6,
  },
  bubbleText: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 20,
  },
  bubbleTextMine: {
    color: COLORS.onAccent,
  },
  bubbleTime: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 3,
    alignSelf: "flex-end",
  },
  bubbleTimeMine: {
    color: COLORS.onAccent,
    opacity: 0.7,
  },
  emptyChat: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    // The list is inverted, so flip the empty message back upright
    transform: [{ scaleY: -1 }],
  },
  notice: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 11,
    borderRadius: 21,
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    fontSize: 15,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.accent,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.7,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  endedBar: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  ended: {
    alignItems: "center",
    gap: 6,
  },
  endedTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "800",
  },
  endedButton: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
  },
  endedButtonText: {
    color: COLORS.text,
    fontWeight: "700",
  },
}));
