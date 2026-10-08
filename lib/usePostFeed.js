import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import { api, getSession } from "./api";
import { translate as t } from "./i18n";

/**
 * Loads posts (optionally only one user's) with instant likes and deleting.
 * Returns { posts, error, myUserId, refreshing, refresh, reload, toggleLike, confirmDelete }.
 */
export function usePostFeed({ userId } = {}) {
  const [posts, setPosts] = useState(null);
  const [error, setError] = useState(null);
  const [myUserId, setMyUserId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const reload = useCallback(
    () =>
      Promise.all([getSession(), api("/api/posts")]).then(
        ([session, data]) => {
          setMyUserId(session?.userId ?? null);
          setPosts(
            userId ? data.filter((post) => String(post.user_id) === String(userId)) : data,
          );
          setError(null);
        },
        (err) => {
          console.error("Fetch posts error:", err.message);
          setError(
            err.status === 0
              ? t("common.cantConnect")
              : t("post.loadError"),
          );
        },
      ),
    [userId],
  );

  useEffect(() => {
    reload();
  }, [reload]);

  const refresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  // Optimistic like: update instantly, roll back if the server refuses
  const toggleLike = useCallback(async (post) => {
    const wasLiked = post.isLiked;
    const update = (isLiked, likes) =>
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, isLiked, likes } : p)));

    update(!wasLiked, post.likes + (wasLiked ? -1 : 1));
    try {
      const result = await api(`/api/posts/${post.id}/like`, {
        method: wasLiked ? "DELETE" : "PUT",
      });
      update(result.isLiked, result.likes);
    } catch (err) {
      console.error("Toggle like error:", err.message);
      update(wasLiked, post.likes);
      Alert.alert(t("post.likeError"), t("common.pleaseTryAgain"));
    }
  }, []);

  /** Asks for confirmation, then deletes the post (its image is removed by the server). */
  const confirmDelete = useCallback(
    (post, onDeleted) =>
      Alert.alert(t("post.deleteTitle"), t("post.deleteMessage"), [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await api(`/api/posts/${post.id}`, { method: "DELETE" });
              setPosts((prev) => prev.filter((p) => p.id !== post.id));
              onDeleted?.();
            } catch (err) {
              console.error("Delete post error:", err.message);
              Alert.alert(t("common.deleteError"), t("common.pleaseTryAgain"));
            }
          },
        },
      ]),
    [],
  );

  const isMine = useCallback(
    (post) => myUserId !== null && String(post.user_id) === String(myUserId),
    [myUserId],
  );

  return { posts, error, myUserId, isMine, refreshing, refresh, reload, toggleLike, confirmDelete };
}
