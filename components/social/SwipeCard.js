import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Animated, PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { formatEventTime } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import { makeStyles, useTheme } from "../../lib/theme-context";

const SWIPE_DISTANCE = 0.3; // part of the screen width that counts as a swipe
const SWIPE_VELOCITY = 0.6;

/**
 * One person in Discover. Only the top card is draggable (`active`).
 * Drag right = like, left = pass. The parent can also swipe it with the
 * buttons through the ref: ref.current.swipe(true | false).
 */
const SwipeCard = forwardRef(function SwipeCard({ person, active, onSwiped }, ref) {
  const { colors: COLORS } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const [position] = useState(() => new Animated.ValueXY());
  const [photoIndex, setPhotoIndex] = useState(0);
  const photos = [person.profile_photo, ...person.photos].filter(Boolean);

  // Gesture handlers are created once, so they read the latest values from here
  const latest = useRef({ width, onSwiped, active });
  useEffect(() => {
    latest.current = { width, onSwiped, active };
  });

  const flyOut = (like, velocity = 0) => {
    const screen = latest.current.width;
    Animated.timing(position, {
      toValue: { x: (like ? 1 : -1) * screen * 1.5, y: 0 },
      duration: Math.max(160, 300 - Math.abs(velocity) * 80),
      useNativeDriver: true,
    }).start(() => latest.current.onSwiped(like));
  };

  useImperativeHandle(ref, () => ({ swipe: (like) => flyOut(like) }));

  // eslint-disable-next-line react-hooks/refs -- `latest` is only read inside gesture callbacks
  const [panResponder] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        latest.current.active && Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => position.setValue({ x: g.dx, y: g.dy * 0.3 }),
      onPanResponderRelease: (_, g) => {
        const screen = latest.current.width;
        if (g.dx > screen * SWIPE_DISTANCE || g.vx > SWIPE_VELOCITY) flyOut(true, g.vx);
        else if (g.dx < -screen * SWIPE_DISTANCE || g.vx < -SWIPE_VELOCITY) flyOut(false, g.vx);
        else Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: true, bounciness: 8 }).start();
      },
      onPanResponderTerminate: () =>
        Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: true }).start(),
    }),
  );

  const rotate = position.x.interpolate({
    inputRange: [-width, 0, width],
    outputRange: ["-12deg", "0deg", "12deg"],
  });
  const likeOpacity = position.x.interpolate({ inputRange: [20, 120], outputRange: [0, 1], extrapolate: "clamp" });
  const nopeOpacity = position.x.interpolate({ inputRange: [-120, -20], outputRange: [1, 0], extrapolate: "clamp" });

  // Tap the right / left side of the photo to see the next / previous one
  const tapPhoto = (event) => {
    if (photos.length < 2) return;
    const goNext = event.nativeEvent.locationX > (width - 32) / 2;
    setPhotoIndex((i) => (goNext ? Math.min(i + 1, photos.length - 1) : Math.max(i - 1, 0)));
  };

  const event = person.shared_events[0];

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.card,
        { transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }] },
      ]}
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={tapPhoto}>
        {photos.length > 0 ? (
          <Image source={{ uri: photos[photoIndex] }} style={styles.photo} contentFit="cover" transition={150} />
        ) : (
          <View style={[styles.photo, styles.noPhoto]}>
            <MaterialIcons name="person" size={96} color={COLORS.textSecondary} />
          </View>
        )}
      </Pressable>

      {photos.length > 1 && (
        <View style={styles.dots} pointerEvents="none">
          {photos.map((uri, i) => (
            <View key={`${uri}-${i}`} style={[styles.dot, i === photoIndex && styles.dotActive]} />
          ))}
        </View>
      )}

      <Animated.View style={[styles.stamp, styles.stampLike, { opacity: likeOpacity }]} pointerEvents="none">
        <Text style={[styles.stampText, styles.stampLikeText]}>{t("discover.like")}</Text>
      </Animated.View>
      <Animated.View style={[styles.stamp, styles.stampNope, { opacity: nopeOpacity }]} pointerEvents="none">
        <Text style={[styles.stampText, styles.stampNopeText]}>{t("discover.nope")}</Text>
      </Animated.View>

      <LinearGradient
        colors={["transparent", "rgba(0, 0, 0, 0.88)"]}
        style={styles.info}
        pointerEvents="none"
      >
        <Text style={styles.name} numberOfLines={1}>
          {person.first_name || person.username}
          {person.age ? <Text style={styles.age}>{`  ${person.age}`}</Text> : null}
        </Text>
        <Text style={styles.username}>@{person.username}</Text>
        {!!person.bio && (
          <Text style={styles.bio} numberOfLines={2}>
            {person.bio}
          </Text>
        )}
        {!!event && (
          <View style={styles.chip}>
            <MaterialIcons name="event" size={15} color="#FFFFFF" />
            <Text style={styles.chipText} numberOfLines={1}>
              {t("discover.bothGoing", { title: event.title, when: formatEventTime(event.starts_at) })}
            </Text>
          </View>
        )}
        {person.shared_venues.length > 0 && (
          <View style={styles.chip}>
            <MaterialIcons name="place" size={15} color="#FFFFFF" />
            <Text style={styles.chipText} numberOfLines={1}>
              {t("discover.bothLike", { venues: person.shared_venues.map((v) => v.title).join(", ") })}
            </Text>
          </View>
        )}
      </LinearGradient>
    </Animated.View>
  );
});

export default SwipeCard;

const useStyles = makeStyles((COLORS) => ({
  card: {
    ...StyleSheet.absoluteFill,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  photo: {
    width: "100%",
    height: "100%",
  },
  noPhoto: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surfacePressed,
  },
  dots: {
    position: "absolute",
    top: 10,
    left: 12,
    right: 12,
    flexDirection: "row",
    gap: 4,
  },
  dot: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.35)",
  },
  dotActive: {
    backgroundColor: "#FFFFFF",
  },
  stamp: {
    position: "absolute",
    top: 40,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderWidth: 4,
    borderRadius: 12,
  },
  stampLike: {
    left: 24,
    borderColor: COLORS.success,
    transform: [{ rotate: "-14deg" }],
  },
  stampNope: {
    right: 24,
    borderColor: COLORS.danger,
    transform: [{ rotate: "14deg" }],
  },
  stampText: {
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: 2,
  },
  stampLikeText: {
    color: COLORS.success,
  },
  stampNopeText: {
    color: COLORS.danger,
  },
  info: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingTop: 80,
    paddingBottom: 18,
    gap: 6,
  },
  name: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "800",
  },
  age: {
    fontWeight: "400",
  },
  username: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 14,
  },
  bio: {
    color: "#FFFFFF",
    fontSize: 15,
    lineHeight: 20,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    maxWidth: "100%",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "rgba(167, 139, 250, 0.45)",
  },
  chipText: {
    flexShrink: 1,
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
}));
