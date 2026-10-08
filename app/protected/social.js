import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import OptionsSheet from "../../components/OptionsSheet";
import PostCard from "../../components/PostCard";
import { useUserType } from "../../lib/session-context";
import { usePostFeed } from "../../lib/usePostFeed";
import { useI18n } from "../../lib/i18n";
import { makeStyles, useTheme } from "../../lib/theme-context";

export default function Social() {
  const { colors: COLORS, gradients: GRADIENTS } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  const navigation = useNavigation();
  const router = useRouter();
  const isUser = useUserType() === "1";
  const { posts, error, isMine, refreshing, refresh, reload, toggleLike, confirmDelete } =
    usePostFeed();
  const [optionsPost, setOptionsPost] = useState(null);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const openCreatePost = () => router.push("/protected/profile-folder/create-post");

  const renderPost = useCallback(
    ({ item }) => (
      <PostCard
        post={item}
        onToggleLike={toggleLike}
        onOptions={isMine(item) ? setOptionsPost : undefined}
      />
    ),
    [toggleLike, isMine],
  );

  const header = (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text style={styles.title}>{t("social.title")}</Text>
        <Text style={styles.subtitle}>{t("social.subtitle")}</Text>
      </View>
      {isUser && (
        <Pressable
          onPress={openCreatePost}
          style={({ pressed }) => pressed && styles.pressed}
          accessibilityRole="button"
          accessibilityLabel={t("social.createPost")}
        >
          <LinearGradient
            colors={GRADIENTS.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.createButton}
          >
            <MaterialIcons name="add" size={20} color={COLORS.onImage} />
            <Text style={styles.createText}>{t("social.post")}</Text>
          </LinearGradient>
        </Pressable>
      )}
    </View>
  );

  if (!posts) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.centered}>
          {error ? (
            <>
              <MaterialIcons name="cloud-off" size={48} color={COLORS.textSecondary} />
              <Text style={styles.message}>{error}</Text>
              <Pressable
                onPress={reload}
                style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
              >
                <Text style={styles.retryText}>{t("common.tryAgain")}</Text>
              </Pressable>
            </>
          ) : (
            <ActivityIndicator size="large" color={COLORS.accent} />
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {header}
      <FlatList
        data={posts}
        keyExtractor={(post) => String(post.id)}
        renderItem={renderPost}
        contentContainerStyle={posts.length === 0 ? styles.emptyContainer : styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={COLORS.accent}
            colors={[COLORS.accent]}
          />
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name="photo-camera" size={34} color={COLORS.accent} />
            </View>
            <Text style={styles.emptyTitle}>{t("social.noPosts")}</Text>
            <Text style={styles.message}>{t("social.noPostsHint")}</Text>
            {isUser && (
              <Pressable
                onPress={openCreatePost}
                style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
              >
                <Text style={styles.retryText}>{t("social.createAPost")}</Text>
              </Pressable>
            )}
          </View>
        }
      />

      <OptionsSheet
        visible={!!optionsPost}
        title={t("post.yourPost")}
        onClose={() => setOptionsPost(null)}
        options={[
          {
            label: t("post.deletePost"),
            icon: "delete-outline",
            destructive: true,
            onPress: () => confirmDelete(optionsPost),
          },
        ]}
      />
    </View>
  );
}

const useStyles = makeStyles((COLORS) => ({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  pressed: {
    opacity: 0.7,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 20,
    paddingVertical: 8,
    paddingLeft: 10,
    paddingRight: 14,
  },
  createText: {
    color: COLORS.onImage,
    fontSize: 14,
    fontWeight: "700",
  },
  list: {
    paddingTop: 4,
    paddingBottom: 24,
  },
  separator: {
    height: 14,
  },
  emptyContainer: {
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: COLORS.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "700",
    marginTop: 16,
  },
  message: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 8,
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  retryText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
  },
}));
