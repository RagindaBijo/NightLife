import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { memo, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { translate, useI18n } from "../lib/i18n";
import { makeStyles, useTheme } from "../lib/theme-context";

const DOUBLE_TAP_MS = 280;

/**
 * Parses API dates. DB defaults look like "2025-09-05 12:00:00" (UTC, no
 * zone), which some JS engines can't parse – turn them into ISO first.
 */
function parseDate(value) {
  if (!value) return null;
  const hasZone = /[zZ]$|[+-]\d\d:?\d\d$/.test(value);
  const date = new Date(hasZone ? value : `${value.replace(" ", "T")}Z`);
  return isNaN(date.getTime()) ? null : date;
}

export function timeAgo(value) {
  const date = parseDate(value);
  if (!date) return "";
  const seconds = Math.max(0, (Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return translate("time.now");
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return translate("time.minutes", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return translate("time.hours", { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return translate("time.days", { count: days });
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(translate("format.locale"), {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/**
 * A post: author, photo (double-tap to like), like button, caption.
 * Pass onOptions to show the ⋯ menu (e.g. for the author's own posts) and
 * onAuthorPress to make the author tappable (opens their profile).
 */
const PostCard = memo(function PostCard({ post, onToggleLike, onOptions, onAuthorPress }) {
  const { colors: COLORS, gradients: GRADIENTS } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  const lastTap = useRef(0);
  const [burst] = useState(() => new Animated.Value(0));
  const [likeScale] = useState(() => new Animated.Value(1));
  const name = post.username || `User${post.user_id}`;

  const popLike = () => {
    likeScale.setValue(0.8);
    Animated.spring(likeScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 12,
    }).start();
  };

  const showBurst = () => {
    burst.setValue(0);
    Animated.sequence([
      Animated.spring(burst, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 10 }),
      Animated.timing(burst, { toValue: 0, duration: 250, delay: 350, useNativeDriver: true }),
    ]).start();
  };

  // Double-tap the photo to like (never unlikes, like Instagram)
  const handleImagePress = () => {
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      showBurst();
      if (!post.isLiked) {
        popLike();
        onToggleLike(post);
      }
    } else {
      lastTap.current = now;
    }
  };

  return (
    <View style={styles.card}>
      {/* Author */}
      <View style={styles.header}>
        <Pressable
          onPress={onAuthorPress ? () => onAuthorPress(post) : undefined}
          disabled={!onAuthorPress}
          style={({ pressed }) => [styles.authorPress, pressed && styles.authorPressed]}
          accessibilityRole={onAuthorPress ? "button" : undefined}
          accessibilityLabel={onAuthorPress ? t("post.openProfile", { name }) : undefined}
        >
        <LinearGradient colors={GRADIENTS.brand} style={styles.avatarRing}>
          <Image source={{ uri: post.user_image }} style={styles.avatar} contentFit="cover" />
        </LinearGradient>
        <View style={styles.author}>
          <Text style={styles.username} numberOfLines={1}>
            {name}
          </Text>
          {!!post.location_tag && (
            <View style={styles.location}>
              <MaterialIcons name="place" size={12} color={COLORS.accent} />
              <Text style={styles.locationText} numberOfLines={1}>
                {post.location_tag}
              </Text>
            </View>
          )}
        </View>
        </Pressable>
        <Text style={styles.time}>{timeAgo(post.date)}</Text>
        {onOptions && (
          <Pressable
            onPress={() => onOptions(post)}
            hitSlop={10}
            style={styles.optionsButton}
            accessibilityRole="button"
            accessibilityLabel={t("post.options")}
          >
            <MaterialIcons name="more-horiz" size={22} color={COLORS.textSecondary} />
          </Pressable>
        )}
      </View>

      {/* Photo */}
      <Pressable
        onPress={handleImagePress}
        style={styles.imageWrap}
        accessibilityHint={t("post.doubleTapHint")}
      >
        {post.post_image ? (
          <Image source={{ uri: post.post_image }} style={styles.image} contentFit="cover" transition={250} />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <MaterialIcons name="image" size={40} color={COLORS.textSecondary} />
          </View>
        )}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.burst,
            {
              opacity: burst,
              transform: [{ scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
            },
          ]}
        >
          <Ionicons name="heart" size={96} color={COLORS.onImage} />
        </Animated.View>
      </Pressable>

      {/* Like + caption */}
      <View style={styles.footer}>
        <Pressable
          onPress={() => {
            popLike();
            onToggleLike(post);
          }}
          hitSlop={8}
          style={[styles.likePill, post.isLiked && styles.likePillActive]}
          accessibilityRole="button"
          accessibilityLabel={`${post.isLiked ? t("post.unlike") : t("post.like")}, ${t("post.likeCount", { count: post.likes })}`}
        >
          <Animated.View style={{ transform: [{ scale: likeScale }] }}>
            <Ionicons
              name={post.isLiked ? "heart" : "heart-outline"}
              size={20}
              color={post.isLiked ? COLORS.like : COLORS.text}
            />
          </Animated.View>
          <Text style={[styles.likeCount, post.isLiked && styles.likeCountActive]}>
            {post.likes}
          </Text>
        </Pressable>
        {!!post.caption && (
          <Text style={styles.caption}>
            <Text style={styles.captionUser}>{name}</Text> {post.caption}
          </Text>
        )}
      </View>
    </View>
  );
});

export default PostCard;

const useStyles = makeStyles((COLORS) => ({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    padding: 12,
    marginHorizontal: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
  },
  authorPress: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  authorPressed: {
    opacity: 0.6,
  },
  avatarRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    padding: 2,
  },
  avatar: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: COLORS.surface,
    backgroundColor: COLORS.surfacePressed,
  },
  author: {
    flex: 1,
    marginLeft: 10,
  },
  username: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "700",
  },
  location: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: 2,
  },
  locationText: {
    flexShrink: 1,
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  time: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginLeft: 8,
  },
  optionsButton: {
    marginLeft: 8,
  },
  // The 4:5 shape lives on the wrapper and the photo fills it, so the rounded
  // corners always clip the photo itself (no empty space below it)
  imageWrap: {
    width: "100%",
    aspectRatio: 4 / 5,
    marginTop: 10,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: COLORS.surfacePressed,
  },
  image: {
    ...StyleSheet.absoluteFill,
  },
  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  burst: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    marginTop: 10,
    gap: 8,
  },
  likePill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.surfacePressed,
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  likePillActive: {
    backgroundColor: "rgba(244, 63, 94, 0.15)",
  },
  likeCount: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
  },
  likeCountActive: {
    color: COLORS.like,
  },
  caption: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 20,
  },
  captionUser: {
    fontWeight: "700",
  },
}));
