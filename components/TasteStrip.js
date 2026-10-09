import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Animated, LayoutAnimation, Pressable, Text, View } from "react-native";
import { useI18n } from "../lib/i18n";
import { musicIcon, musicLabel, placeIcon, placeLabel } from "../lib/preferences";
import { makeStyles, useTheme } from "../lib/theme-context";

const PREVIEW = 2; // names shown per group while folded

/**
 * Someone's music and places on a profile, folded into one slim line
 * ("♪ Techno · House +3   ⌖ Rooftop · Bar +1"). Tap to unfold every chip.
 * mine: the viewer's own tastes; when given, shared ones are highlighted and
 * counted ("3 in common").
 */
export default function TasteStrip({ music = [], places = [], mine }) {
  const { colors: COLORS } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const [turn] = useState(() => new Animated.Value(0));

  if (music.length === 0 && places.length === 0) return null;

  const sharedMusic = mine ? music.filter((key) => mine.music?.includes(key)) : [];
  const sharedPlaces = mine ? places.filter((key) => mine.places?.includes(key)) : [];
  const inCommon = sharedMusic.length + sharedPlaces.length;
  // Shared ones first
  const sorted = (list, shared) => [...list].sort((a, b) => shared.includes(b) - shared.includes(a));
  const musicList = sorted(music, sharedMusic);
  const placeList = sorted(places, sharedPlaces);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Animated.timing(turn, { toValue: open ? 0 : 1, duration: 200, useNativeDriver: true }).start();
    setOpen((value) => !value);
  };
  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });

  const preview = (list, label) => {
    const names = list.slice(0, PREVIEW).map(label).join(" · ");
    const more = list.length - PREVIEW;
    return more > 0 ? `${names} +${more}` : names;
  };

  const group = (title, icon, list, shared, iconOf, label) =>
    list.length > 0 && (
      <View style={styles.group}>
        <View style={styles.groupHeader}>
          <MaterialCommunityIcons name={icon} size={14} color={COLORS.accent} />
          <Text style={styles.groupTitle}>{title}</Text>
        </View>
        <View style={styles.chips}>
          {list.map((key) => {
            const isShared = shared.includes(key);
            return (
              <View key={key} style={[styles.chip, isShared && styles.chipShared]}>
                <MaterialCommunityIcons name={iconOf(key)} size={13} color={isShared ? COLORS.onAccent : COLORS.accent} />
                <Text style={[styles.chipText, isShared && styles.chipTextShared]}>{label(key)}</Text>
              </View>
            );
          })}
        </View>
      </View>
    );

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={toggle}
        style={({ pressed }) => [styles.strip, open && styles.stripOpen, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={t("taste.title")}
      >
        {open ? (
          <Text style={styles.openTitle}>{t("taste.title")}</Text>
        ) : (
          <View style={styles.previewRow}>
            {musicList.length > 0 && (
              <View style={styles.segment}>
                <MaterialCommunityIcons name="music-note" size={14} color={COLORS.accent} />
                <Text style={styles.previewText} numberOfLines={1}>
                  {preview(musicList, musicLabel)}
                </Text>
              </View>
            )}
            {placeList.length > 0 && (
              <View style={styles.segment}>
                <MaterialCommunityIcons name="map-marker-outline" size={14} color={COLORS.accent} />
                <Text style={styles.previewText} numberOfLines={1}>
                  {preview(placeList, placeLabel)}
                </Text>
              </View>
            )}
          </View>
        )}
        {inCommon > 0 && (
          <View style={styles.common}>
            <Text style={styles.commonText}>{t("taste.inCommon", { count: inCommon })}</Text>
          </View>
        )}
        <Animated.View style={{ transform: [{ rotate }] }}>
          <MaterialIcons name="expand-more" size={20} color={COLORS.textSecondary} />
        </Animated.View>
      </Pressable>

      {open && (
        <View style={styles.panel}>
          {group(t("discover.music"), "music-note", musicList, sharedMusic, musicIcon, musicLabel)}
          {group(t("discover.places"), "map-marker-outline", placeList, sharedPlaces, placeIcon, placeLabel)}
          {inCommon > 0 && <Text style={styles.hint}>{t("taste.sharedHint")}</Text>}
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((COLORS) => ({
  wrap: {
    marginTop: 10,
  },
  strip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 36,
    paddingLeft: 12,
    paddingRight: 6,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  stripOpen: {
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
  previewRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  segment: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  previewText: {
    flexShrink: 1,
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "600",
  },
  openTitle: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  common: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: COLORS.accentSoft,
  },
  commonText: {
    color: COLORS.accent,
    fontSize: 11,
    fontWeight: "800",
  },
  panel: {
    marginTop: 2,
    padding: 12,
    gap: 12,
    borderRadius: 18,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  group: {
    gap: 7,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  groupTitle: {
    color: COLORS.textSecondary,
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
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipShared: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  chipText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "600",
  },
  chipTextShared: {
    color: COLORS.onAccent,
  },
  hint: {
    color: COLORS.textSecondary,
    fontSize: 11,
  },
  pressed: {
    opacity: 0.75,
  },
}));
