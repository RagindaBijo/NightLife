import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, Text, View } from "react-native";
import SocialGate from "../../components/social/SocialGate";
import SwipeCard from "../../components/social/SwipeCard";
import { api } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { makeStyles, useTheme } from "../../lib/theme-context";

const LOAD_MORE_AT = 3; // fetch more people when this few are left

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

function Deck() {
  const { colors: COLORS, gradients: GRADIENTS } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  const router = useRouter();
  const topCard = useRef(null);
  const [people, setPeople] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [match, setMatch] = useState(null); // { chat_id, user }
  const seen = useRef(new Set()); // ids already shown, so a refill never repeats them

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

  const swiped = (person, like) => {
    const rest = people.filter((p) => p.id !== person.id);
    setPeople(rest);
    if (rest.length <= LOAD_MORE_AT && !loading) loadMore();
    api("/api/discover/swipe", { method: "POST", body: { target_id: person.id, like } })
      .then((result) => {
        if (result.match) setMatch({ chat_id: result.chat_id, user: result.user, person });
      })
      .catch((err) => {
        if (err.code !== "not_available") Alert.alert(t("discover.swipeError"), err.message);
      });
  };

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

  const visible = people.slice(0, 2);

  return (
    <>
      {header}
      <View style={styles.deck}>
        {visible.length === 0 ? (
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
          // Drawn back to front, so the top card is the last one
          [...visible].reverse().map((person, index) => {
            const isTop = index === visible.length - 1;
            return (
              <View key={person.id} style={[styles.cardSlot, !isTop && styles.cardBehind]}>
                <SwipeCard
                  ref={isTop ? topCard : undefined}
                  person={person}
                  active={isTop}
                  onSwiped={(like) => swiped(person, like)}
                />
              </View>
            );
          })
        )}
      </View>

      {visible.length > 0 && (
        <View style={styles.actions}>
          <Pressable
            onPress={() => topCard.current?.swipe(false)}
            style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t("discover.pass")}
          >
            <MaterialIcons name="close" size={32} color={COLORS.danger} />
          </Pressable>
          <Pressable
            onPress={() => topCard.current?.swipe(true)}
            style={({ pressed }) => [pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t("discover.likeButton")}
          >
            <LinearGradient colors={GRADIENTS.brand} style={[styles.actionButton, styles.likeButton]}>
              <MaterialIcons name="favorite" size={32} color={COLORS.onImage} />
            </LinearGradient>
          </Pressable>
        </View>
      )}

      <Modal visible={!!match} transparent animationType="fade" onRequestClose={() => setMatch(null)}>
        <View style={styles.matchBackdrop}>
          <View style={styles.matchCard}>
            <Text style={styles.matchTitle}>{t("discover.matchTitle")}</Text>
            {match?.person?.profile_photo || match?.user?.profile_photo ? (
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
                router.push(`/protected/chat-folder/${chatId}`);
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
  cardSlot: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  cardBehind: {
    transform: [{ scale: 0.95 }, { translateY: 10 }],
    opacity: 0.85,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 28,
    paddingVertical: 16,
  },
  actionButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  likeButton: {
    borderWidth: 0,
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
    fontSize: 30,
    fontWeight: "900",
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
