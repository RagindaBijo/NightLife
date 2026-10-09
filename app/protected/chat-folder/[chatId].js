import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
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
import { musicIcon, musicLabel, placeIcon, placeLabel } from "../../../lib/preferences";
import { makeStyles, useTheme } from "../../../lib/theme-context";
import { refreshUnread } from "../../../lib/unread";

const WS_URL = API_URL.replace(/^http/, "ws");
const MESSAGE_MAX = 1000;
const GROUP_GAP_MS = 5 * 60 * 1000; // messages closer than this stack together
const SEPARATOR_GAP_MS = 30 * 60 * 1000; // a time label after a longer pause

export default function ChatDetail() {
  const { chatId } = useLocalSearchParams();
  const router = useRouter();
  const { colors: COLORS, gradients: GRADIENTS } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  const [chat, setChat] = useState(null); // { id, created_at, expires_at, user, source }
  const [me, setMe] = useState(null);
  const [shared, setShared] = useState({ music: [], places: [] }); // tastes in common
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

  // First load: chat info, latest messages, who I am, and what we both like
  useEffect(() => {
    Promise.all([api(`/api/chats/${chatId}`), api(`/api/chats/${chatId}/messages`), getSession()])
      .then(async ([info, latest, session]) => {
        setChat(info);
        setMe(Number(session?.userId));
        addMessages(latest);
        setHasOlder(latest.length === 50);
        // Tastes in common for the intro card (a failure just hides that part)
        try {
          const [mine, theirs] = await Promise.all([
            api(`/api/user/${session.userId}`),
            api(`/api/user/${info.user.id}`),
          ]);
          setShared({
            music: (theirs.music ?? []).filter((key) => (mine.music ?? []).includes(key)),
            places: (theirs.venue_types ?? []).filter((key) => (mine.venue_types ?? []).includes(key)),
          });
        } catch {
          // intro card without the "you both like" part
        }
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
          refreshUnread();
          router.back(); // to the chat list, which reloads when shown
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
  const total = chat ? new Date(chat.expires_at) - new Date(chat.created_at) : 1;
  const left = chat ? Math.max(0, new Date(chat.expires_at) - now) : 0;

  const header = (
    <View style={styles.headerWrap}>
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
          <Pressable onPress={() => router.push(`/user/${person.id}`)} style={styles.headerPerson} accessibilityRole="button">
            <LinearGradient colors={GRADIENTS.brand} style={styles.headerRing}>
              {person.profile_photo ? (
                <Image source={{ uri: person.profile_photo }} style={styles.headerAvatar} contentFit="cover" />
              ) : (
                <View style={[styles.headerAvatar, styles.avatarEmpty]}>
                  <MaterialIcons name="person" size={20} color={COLORS.textSecondary} />
                </View>
              )}
            </LinearGradient>
            <View style={styles.headerText}>
              <Text style={styles.headerName} numberOfLines={1}>
                {person.first_name || person.username}
              </Text>
              <View style={styles.headerSubRow}>
                <MaterialIcons name="hourglass-bottom" size={12} color={COLORS.accentPink} />
                <Text style={styles.headerSub} numberOfLines={1}>
                  {isEnded ? t("chat.ended") : t("chat.disappearsIn", { time: formatTimeLeft(chat.expires_at, now) })}
                </Text>
              </View>
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
      {/* Time left: drains as the chat gets older */}
      {!!chat && (
        <View style={styles.timerTrack}>
          <LinearGradient
            colors={GRADIENTS.brand}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.timerFill, { width: `${isEnded ? 0 : Math.max(2, (left / total) * 100)}%` }]}
          />
        </View>
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

  // Grouping: consecutive messages from the same person stick together, and a
  // time label appears after a longer pause
  const rows = messages.map((message, i) => {
    const prev = messages[i - 1];
    const next = messages[i + 1];
    const time = new Date(message.create_date).getTime();
    const gapBefore = prev ? time - new Date(prev.create_date).getTime() : Infinity;
    const gapAfter = next ? new Date(next.create_date).getTime() - time : Infinity;
    return {
      message,
      mine: message.sender_id === me,
      separator: gapBefore > SEPARATOR_GAP_MS,
      first: !prev || prev.sender_id !== message.sender_id || gapBefore > GROUP_GAP_MS,
      last: !next || next.sender_id !== message.sender_id || gapAfter > GROUP_GAP_MS,
    };
  });

  const intro = (
    <View style={styles.intro}>
      <LinearGradient colors={GRADIENTS.brand} style={styles.introRing}>
        {person.profile_photo ? (
          <Image source={{ uri: person.profile_photo }} style={styles.introAvatar} contentFit="cover" />
        ) : (
          <View style={[styles.introAvatar, styles.avatarEmpty]}>
            <MaterialIcons name="person" size={44} color={COLORS.textSecondary} />
          </View>
        )}
      </LinearGradient>
      <Text style={styles.introTitle}>
        {t(`chat.introTitle.${chat.source}`, { name: person.first_name || person.username })}
      </Text>
      <Text style={styles.introText}>{t("chat.introText", { count: Math.round(total / 3600000) })}</Text>
      {(shared.music.length > 0 || shared.places.length > 0) && (
        <>
          <Text style={styles.introLabel}>{t("chat.bothLike")}</Text>
          <View style={styles.introChips}>
            {shared.music.map((key) => (
              <View key={`m-${key}`} style={styles.introChip}>
                <MaterialCommunityIcons name={musicIcon(key)} size={13} color={COLORS.accent} />
                <Text style={styles.introChipText}>{musicLabel(key)}</Text>
              </View>
            ))}
            {shared.places.map((key) => (
              <View key={`p-${key}`} style={styles.introChip}>
                <MaterialCommunityIcons name={placeIcon(key)} size={13} color={COLORS.accent} />
                <Text style={styles.introChipText}>{placeLabel(key)}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );

  return (
    // "padding" on Android too: with edge-to-edge the system no longer resizes the screen for the keyboard
    <KeyboardAvoidingView style={styles.container} behavior="padding">
      {header}

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={[...rows].reverse()}
        inverted
        keyExtractor={(row) => String(row.message.id)}
        onEndReached={loadOlder}
        onEndReachedThreshold={0.3}
        keyboardDismissMode="on-drag"
        // The list is upside down, so the "footer" is at the top: the intro card
        ListFooterComponent={hasOlder && messages.length >= 50 ? null : intro}
        renderItem={({ item }) => (
          <View>
            {item.separator && (
              <View style={styles.separator}>
                <Text style={styles.separatorText}>{dayAndTime(item.message.create_date, t)}</Text>
              </View>
            )}
            <View
              style={[
                styles.bubbleRow,
                item.mine && styles.bubbleRowMine,
                item.first ? styles.groupStart : styles.groupMiddle,
              ]}
            >
              {item.mine ? (
                <LinearGradient
                  colors={GRADIENTS.brand}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.bubble, styles.bubbleMine, !item.last && styles.bubbleMineJoined]}
                >
                  <Text style={styles.bubbleTextMine}>{item.message.body}</Text>
                </LinearGradient>
              ) : (
                <View style={[styles.bubble, styles.bubbleTheirs, !item.last && styles.bubbleTheirsJoined]}>
                  <Text style={styles.bubbleText}>{item.message.body}</Text>
                </View>
              )}
            </View>
            {item.last && (
              <Text style={[styles.bubbleTime, item.mine && styles.bubbleTimeMine]}>
                {formatClock(new Date(item.message.create_date))}
              </Text>
            )}
          </View>
        )}
      />

      {isEnded ? (
        <View style={styles.endedBar}>
          <EndedNotice onBack={() => router.back()} />
        </View>
      ) : (
        <View style={styles.inputBar}>
          <View style={styles.inputPill}>
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
            {text.length > MESSAGE_MAX - 100 && (
              <Text style={styles.counter}>{MESSAGE_MAX - text.length}</Text>
            )}
          </View>
          <Pressable
            onPress={send}
            disabled={!text.trim() || sending}
            style={({ pressed }) => [(!text.trim() || sending) && styles.disabled, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t("chat.send")}
          >
            <LinearGradient colors={GRADIENTS.brand} style={styles.sendButton}>
              {sending ? (
                <ActivityIndicator color={COLORS.onImage} size="small" />
              ) : (
                <MaterialIcons name="arrow-upward" size={22} color={COLORS.onImage} />
              )}
            </LinearGradient>
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

/** "Today · 21:04", "Yesterday · 23:10" or "3 Oct · 01:15". */
function dayAndTime(iso, t) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const day =
    date.toDateString() === today.toDateString()
      ? t("time.today")
      : date.toDateString() === yesterday.toDateString()
        ? t("chat.yesterday")
        : `${date.getDate()} ${t("months.short")[date.getMonth()]}`;
  return `${day} · ${formatClock(date)}`;
}

function EndedNotice({ onBack }) {
  const { colors: COLORS } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  return (
    <View style={styles.ended}>
      <View style={styles.endedIcon}>
        <MaterialIcons name="hourglass-bottom" size={24} color={COLORS.accentPink} />
      </View>
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
  headerWrap: {
    backgroundColor: COLORS.backgroundElevated,
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
  headerPerson: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerRing: {
    padding: 2,
    borderRadius: 22,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
  },
  avatarEmpty: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
  },
  headerText: {
    flex: 1,
  },
  headerName: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "800",
  },
  headerSubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 1,
  },
  headerSub: {
    color: COLORS.accentPink,
    fontSize: 12,
    fontWeight: "700",
  },
  timerTrack: {
    height: 3,
    backgroundColor: COLORS.surfacePressed,
  },
  timerFill: {
    height: "100%",
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexGrow: 1,
  },
  intro: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  introRing: {
    padding: 3,
    borderRadius: 50,
  },
  introAvatar: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 3,
    borderColor: COLORS.background,
  },
  introTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 12,
  },
  introText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
  },
  introLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginTop: 16,
  },
  introChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
    marginTop: 8,
  },
  introChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: COLORS.accentSoft,
  },
  introChipText: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: "700",
  },
  separator: {
    alignSelf: "center",
    marginVertical: 12,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
  },
  separatorText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  bubbleRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  bubbleRowMine: {
    justifyContent: "flex-end",
  },
  groupStart: {
    marginTop: 10,
  },
  groupMiddle: {
    marginTop: 3,
  },
  bubble: {
    maxWidth: "78%",
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  bubbleMine: {
    borderBottomRightRadius: 6,
  },
  bubbleMineJoined: {
    borderBottomRightRadius: 20,
    borderTopRightRadius: 8,
  },
  bubbleTheirs: {
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: 6,
  },
  bubbleTheirsJoined: {
    borderBottomLeftRadius: 20,
    borderTopLeftRadius: 8,
  },
  bubbleText: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 21,
  },
  bubbleTextMine: {
    color: "#FFFFFF",
    fontSize: 15,
    lineHeight: 21,
  },
  bubbleTime: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 3,
    marginLeft: 6,
  },
  bubbleTimeMine: {
    alignSelf: "flex-end",
    marginRight: 6,
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
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: COLORS.backgroundElevated,
  },
  inputPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    paddingTop: 11,
    paddingBottom: 11,
    color: COLORS.text,
    fontSize: 15,
  },
  counter: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginBottom: 13,
    marginLeft: 6,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: {
    opacity: 0.4,
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
    backgroundColor: COLORS.backgroundElevated,
  },
  ended: {
    alignItems: "center",
    gap: 6,
  },
  endedIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
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
    borderRadius: 14,
    backgroundColor: COLORS.surface,
  },
  endedButtonText: {
    color: COLORS.text,
    fontWeight: "700",
  },
}));
