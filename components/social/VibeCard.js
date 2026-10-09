import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { formatEventTime } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import { musicIcon, musicLabel, placeIcon, placeLabel } from "../../lib/preferences";
import { makeStyles, useTheme } from "../../lib/theme-context";

const DETAILS_MAX = 0.36; // the scrolling details take at most this share of the card

/**
 * A person in Discover. The photo fills the whole card top to bottom (a wider
 * photo loses a little at the sides, never leaves a gap). Name and taste match
 * sit at the top; plans and taste sit at the bottom in a see-through box that
 * scrolls on its own.
 * Tap the right / left half of the photo to flip through photos.
 */
export default function VibeCard({ person }) {
  const { colors: COLORS } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  const [photoIndex, setPhotoIndex] = useState(0);
  const [card, setCard] = useState({ width: 0, height: 0 });
  const photos = [person.profile_photo, ...(person.photos ?? [])].filter(Boolean);
  const photo = photos[photoIndex];

  const tapPhoto = (event) => {
    if (photos.length < 2) return;
    const next = event.nativeEvent.locationX > card.width / 2;
    setPhotoIndex((i) => (next ? Math.min(i + 1, photos.length - 1) : Math.max(i - 1, 0)));
  };

  // Shared tastes first, highlighted
  const sortShared = (list, shared) => [...list].sort((a, b) => shared.includes(b) - shared.includes(a));
  const music = sortShared(person.music ?? [], person.shared_music ?? []);
  const places = sortShared(person.venue_types ?? [], person.shared_venue_types ?? []);
  const event = person.shared_events?.[0];

  const chips = (list, shared, icon, label) => (
    <View style={styles.chips}>
      {list.map((key) => {
        const isShared = shared?.includes(key);
        return (
          <View key={key} style={[styles.chip, isShared && styles.chipShared]}>
            <MaterialCommunityIcons name={icon(key)} size={13} color="#FFFFFF" />
            <Text style={styles.chipText}>{label(key)}</Text>
          </View>
        );
      })}
    </View>
  );

  return (
    <View
      style={styles.card}
      onLayout={(e) => setCard({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      {/* Photo: fills the whole card (the sides of a wider photo are trimmed) */}
      <Pressable
        onPress={tapPhoto}
        style={StyleSheet.absoluteFill}
        accessibilityRole="imagebutton"
        accessibilityLabel={t("discover.photosHint")}
      >
        {photo ? (
          <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.noPhoto]}>
            <MaterialIcons name="person" size={80} color={COLORS.textSecondary} />
          </View>
        )}
      </Pressable>

      {/* Darkening so the text stays readable: top for the name, bottom for the details */}
      <LinearGradient
        colors={["rgba(0,0,0,0.55)", "transparent", "transparent", "rgba(0,0,0,0.9)"]}
        locations={[0, 0.2, 0.5, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {photos.length > 1 && (
        <View style={styles.dots} pointerEvents="none">
          {photos.map((uri, i) => (
            <View key={`${uri}-${i}`} style={[styles.dot, i === photoIndex && styles.dotActive]} />
          ))}
        </View>
      )}

      {/* Top row: who they are, and how much of your music and places you share */}
      <View style={styles.topRow} pointerEvents="none">
        <View style={styles.identity}>
          <Text style={styles.name} numberOfLines={1}>
            {person.first_name || person.username}
            {person.age ? <Text style={styles.age}>{`, ${person.age}`}</Text> : null}
          </Text>
          <Text style={styles.username} numberOfLines={1}>
            @{person.username}
          </Text>
        </View>
        <View style={styles.match}>
          <MaterialCommunityIcons name="account-heart-outline" size={15} color="#FFFFFF" />
          <Text style={styles.matchText}>{t("discover.tasteMatch", { percent: person.vibe ?? 0 })}</Text>
        </View>
      </View>

      {/* See-through details at the bottom, scrolling on their own */}
      <View style={styles.overlay}>
        <ScrollView
          style={{ maxHeight: card.height * DETAILS_MAX }}
          contentContainerStyle={styles.details}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          {!!event && (
            <View style={styles.infoRow}>
              <MaterialIcons name="event-available" size={16} color={COLORS.accentPink} />
              <Text style={styles.infoText} numberOfLines={2}>
                {t("discover.bothGoing", { title: event.title, when: formatEventTime(event.starts_at) })}
              </Text>
            </View>
          )}
          {person.shared_venues?.length > 0 && (
            <View style={styles.infoRow}>
              <MaterialIcons name="place" size={16} color={COLORS.accentPink} />
              <Text style={styles.infoText} numberOfLines={2}>
                {t("discover.bothLike", { venues: person.shared_venues.map((v) => v.title).join(", ") })}
              </Text>
            </View>
          )}

          {music.length > 0 && (
            <View style={styles.group}>
              <View style={styles.groupHeader}>
                <MaterialCommunityIcons name="music-note" size={14} color={COLORS.accent} />
                <Text style={styles.groupLabel}>{t("discover.music")}</Text>
              </View>
              {chips(music, person.shared_music, musicIcon, musicLabel)}
            </View>
          )}
          {places.length > 0 && (
            <View style={styles.group}>
              <View style={styles.groupHeader}>
                <MaterialCommunityIcons name="map-marker-outline" size={14} color={COLORS.accent} />
                <Text style={styles.groupLabel}>{t("discover.places")}</Text>
              </View>
              {chips(places, person.shared_venue_types, placeIcon, placeLabel)}
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const useStyles = makeStyles((COLORS) => ({
  card: {
    flex: 1,
    borderRadius: 26,
    backgroundColor: "#0E0B16",
    overflow: "hidden",
  },
  noPhoto: {
    alignItems: "center",
    justifyContent: "center",
  },
  dots: {
    position: "absolute",
    top: 10,
    left: 14,
    right: 14,
    flexDirection: "row",
    gap: 4,
  },
  dot: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  dotActive: {
    backgroundColor: "#FFFFFF",
  },
  topRow: {
    position: "absolute",
    top: 22,
    left: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  identity: {
    flex: 1,
  },
  name: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "900",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 6,
  },
  age: {
    fontWeight: "500",
  },
  username: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 4,
  },
  match: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: COLORS.accentPink,
    backgroundColor: "rgba(14, 11, 22, 0.7)",
  },
  matchText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  overlay: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 14,
  },
  details: {
    gap: 8,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    maxWidth: "100%",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  infoText: {
    flexShrink: 1,
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  group: {
    gap: 5,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  groupLabel: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  chipShared: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  chipText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
}));
