import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import SocialGate from "../../components/social/SocialGate";
import VibeCard from "../../components/social/VibeCard";
import { api } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { makeStyles, useTheme } from "../../lib/theme-context";

const LOAD_MORE_AT = 3; // fetch more people when this few are left
const SWIPE_DISTANCE = 110; // drag this far (px) to decide
const SWIPE_SPEED = 0.8; // or flick this fast
const NEXT_SCALE = 0.94; // size of the card waiting behind

export default function Discover() {
  const styles = useStyles();
  return (
    <View style={styles.container}>
      <SocialGate>
        <Deck />
      </SocialGate>
    </View>
  );
}

/**
 * One person at a time as a "pass" card. "Let's go out" = like, "Skip" = pass.
 * Two people who both pick "Let's go out" get a chat (the match logic is on the server).
 */
function Deck() {
  const { colors: COLORS, gradients: GRADIENTS } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  const router = useRouter();
  const [people, setPeople] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [match, setMatch] = useState(null); // { chat_id, user, person }
  const [busy, setBusy] = useState(false); // during the card animation
  const seen = useRef(new Set()); // ids already shown, so a refill never repeats them
  const { width } = useWindowDimensions();
  // Card animation: drag position (tilts with it) and the next card growing into place
  const [pan] = useState(() => new Animated.ValueXY());
  const [scale] = useState(() => new Animated.Value(1));
  const decideRef = useRef(null);
  const rotate = pan.x.interpolate({ inputRange: [-width, 0, width], outputRange: ["-12deg", "0deg", "12deg"] });

  // Drag the card: right = connect, left = skip, a short drag springs back.
  // decideRef is only read inside the gesture callbacks, never while rendering
  // eslint-disable-next-line react-hooks/refs
  const [responder] = useState(() =>
    PanResponder.create({
      // Sideways drags belong to the swipe (taken before the card's vertical scroll
      // can claim them); up/down drags scroll the card
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_, g) => {
        if (g.dx > SWIPE_DISTANCE || g.vx > SWIPE_SPEED) decideRef.current?.(true);
        else if (g.dx < -SWIPE_DISTANCE || g.vx < -SWIPE_SPEED) decideRef.current?.(false);
        else Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, friction: 6 }).start();
      },
      onPanResponderTerminate: () =>
        Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, friction: 6 }).start(),
    }),
  );

  const loadMore = useCallback(() => {
    return Promise.resolve()
      .then(() => {
        setLoading(true);
        return api("/api/discover");
      })
      .then((data) => {
        const fresh = data.filter((p) => !seen.current.has(p.id));
        fresh.forEach((p) => seen.current.add(p.id));
        setPeople((prev) => [...(prev ?? []), ...fresh]);
        setError(null);
      })
      .catch((err) => {
        setError(err.status === 0 ? t("common.cantConnect") : err.message);
        setPeople((prev) => prev ?? []);
      })
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    loadMore();
  }, [loadMore]);

  // The card flies off (right = connect, left = skip) and the next one grows into place
  const decide = (like) => {
    const person = people?.[0];
    if (!person || busy) return;
    setBusy(true);
    Animated.timing(pan, {
      toValue: { x: (like ? 1 : -1) * width * 1.5, y: 40 },
      duration: 260,
      useNativeDriver: false,
    }).start(() => {
      const rest = people.filter((p) => p.id !== person.id);
      setPeople(rest);
      if (rest.length <= LOAD_MORE_AT && !loading) loadMore();
      pan.setValue({ x: 0, y: 0 });
      scale.setValue(NEXT_SCALE);
      Animated.spring(scale, { toValue: 1, useNativeDriver: false, bounciness: 4 }).start(() => setBusy(false));

      api("/api/discover/swipe", { method: "POST", body: { target_id: person.id, like } })
        .then((result) => {
          if (result.match) setMatch({ chat_id: result.chat_id, user: result.user, person });
        })
        .catch((err) => {
          if (err.code !== "not_available") Alert.alert(t("discover.swipeError"), err.message);
        });
    });
  };

  // The drag handler always calls the latest decide()
  useEffect(() => {
    decideRef.current = decide;
  });

  const refresh = () => {
    seen.current = new Set();
    setPeople(null);
    loadMore();
  };

  const header = (
    <View style={styles.header}>
      <Text style={styles.title}>{t("discover.title")}</Text>
      <Text style={styles.subtitle}>{t("discover.subtitle")}</Text>
    </View>
  );

  if (!people) {
    return (
      <>
        {header}
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      </>
    );
  }

  const person = people[0];
  const nextPerson = people[1];

  return (
    <>
      {header}
      <View style={styles.deck}>
        {!person ? (
          <View style={styles.centered}>
            {loading ? (
              <ActivityIndicator size="large" color={COLORS.accent} />
            ) : (
              <>
                <View style={styles.emptyIcon}>
                  <MaterialIcons name={error ? "cloud-off" : "people-outline"} size={36} color={COLORS.accent} />
                </View>
                <Text style={styles.emptyTitle}>{error ? error : t("discover.emptyTitle")}</Text>
                {!error && <Text style={styles.emptyText}>{t("discover.emptyText")}</Text>}
                <Pressable onPress={refresh} style={({ pressed }) => [styles.refresh, pressed && styles.pressed]}>
                  <MaterialIcons name="refresh" size={20} color={COLORS.text} />
                  <Text style={styles.refreshText}>{t("discover.refresh")}</Text>
                </Pressable>
              </>
            )}
          </View>
        ) : (
          <>
            {/* The next person waits behind, slightly smaller */}
            {!!nextPerson && (
              <View
                key={`next-${nextPerson.id}`}
                style={[StyleSheet.absoluteFill, { transform: [{ scale: NEXT_SCALE }] }]}
                pointerEvents="none"
              >
                <VibeCard person={nextPerson} />
              </View>
            )}
            <Animated.View
              key={person.id}
              {...responder.panHandlers}
              style={[
                styles.cardWrap,
                { transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate }, { scale }] },
              ]}
            >
              <VibeCard person={person} />
            </Animated.View>
          </>
        )}
      </View>

      {!!person && (
        <View style={styles.actions}>
          <Pressable
            onPress={() => decide(false)}
            disabled={busy}
            style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <MaterialIcons name="close" size={22} color={COLORS.text} />
            <Text style={styles.skipText}>{t("discover.skip")}</Text>
          </Pressable>
          <Pressable
            onPress={() => decide(true)}
            disabled={busy}
            style={({ pressed }) => [styles.goWrap, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <LinearGradient
              colors={GRADIENTS.brand}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.goButton}
            >
              <MaterialCommunityIcons name="hand-wave" size={22} color={COLORS.onImage} />
              <Text style={styles.goText}>{t("discover.connect")}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      )}

      <Modal visible={!!match} transparent animationType="fade" onRequestClose={() => setMatch(null)}>
        <View style={styles.matchBackdrop}>
          <View style={styles.matchCard}>
            <MaterialCommunityIcons name="hand-wave" size={34} color={COLORS.accentPink} />
            <Text style={styles.matchTitle}>{t("discover.matchTitle")}</Text>
            {match?.user?.profile_photo || match?.person?.profile_photo ? (
              <Image
                source={{ uri: match.user?.profile_photo || match.person.profile_photo }}
                style={styles.matchPhoto}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.matchPhoto, styles.matchPhotoEmpty]}>
                <MaterialIcons name="person" size={56} color={COLORS.textSecondary} />
              </View>
            )}
            <Text style={styles.matchText}>
              {t("discover.matchText", { name: match?.person?.first_name || match?.person?.username || "" })}
            </Text>
            <Pressable
              onPress={() => {
                const chatId = match.chat_id;
                setMatch(null);
                router.push(`/protected/chat-folder/${chatId}`, { withAnchor: true });
              }}
              style={({ pressed }) => [styles.matchPrimary, pressed && styles.pressed]}
            >
              <Text style={styles.matchPrimaryText}>{t("discover.sendMessage")}</Text>
            </Pressable>
            <Pressable onPress={() => setMatch(null)} style={({ pressed }) => [styles.matchSecondary, pressed && styles.pressed]}>
              <Text style={styles.matchSecondaryText}>{t("discover.keepSwiping")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const useStyles = makeStyles((COLORS) => ({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
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
  deck: {
    flex: 1,
    marginHorizontal: 16,
  },
  cardWrap: {
    flex: 1,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  skipButton: {
    flex: 1,
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 27,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  skipText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
  },
  goWrap: {
    flex: 1.6,
  },
  goButton: {
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 27,
  },
  goText: {
    color: COLORS.onImage,
    fontSize: 16,
    fontWeight: "800",
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
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.accentSoft,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 16,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 8,
  },
  refresh: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 18,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
  },
  refreshText: {
    color: COLORS.text,
    fontWeight: "700",
  },
  matchBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
  },
  matchCard: {
    alignSelf: "stretch",
    alignItems: "center",
    padding: 24,
    borderRadius: 28,
    backgroundColor: COLORS.backgroundElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  matchTitle: {
    color: COLORS.accentPink,
    fontSize: 28,
    fontWeight: "900",
    marginTop: 6,
  },
  matchPhoto: {
    width: 130,
    height: 130,
    borderRadius: 65,
    marginTop: 18,
    borderWidth: 3,
    borderColor: COLORS.accent,
  },
  matchPhotoEmpty: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
  },
  matchText: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 16,
  },
  matchPrimary: {
    alignSelf: "stretch",
    height: 50,
    marginTop: 20,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.accent,
  },
  matchPrimaryText: {
    color: COLORS.onAccent,
    fontSize: 16,
    fontWeight: "700",
  },
  matchSecondary: {
    marginTop: 12,
    padding: 8,
  },
  matchSecondaryText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontWeight: "600",
  },
}));
