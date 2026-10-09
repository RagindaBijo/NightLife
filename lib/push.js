import Constants from "expo-constants";
import { router } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";
import { api } from "./api";
import { useI18n } from "./i18n";
import { refreshUnread } from "./unread";

// Expo Go can't receive remote push (it needs a development or store build),
// so push is skipped there entirely instead of logging errors.
const IN_EXPO_GO = Constants.executionEnvironment === "storeClient";

let registeredToken = null;

/**
 * Registers this device for push (matches, chat requests, messages) and opens
 * the right screen when a notification is tapped. The server texts follow the
 * app language, so the token is re-sent when the language changes.
 */
export function usePushNotifications({ enabled }) {
  const { language } = useI18n();

  useEffect(() => {
    if (!enabled || IN_EXPO_GO) return undefined;
    // Loaded only outside Expo Go
    const Notifications = require("expo-notifications");

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    register(Notifications, language).catch((err) =>
      console.warn("Push registration failed:", err?.message),
    );

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data ?? {};
      if (data.chat_id) router.push(`/protected/chat-folder/${data.chat_id}`, { withAnchor: true });
      else if (data.screen === "requests") router.push("/protected/chat-folder/requests", { withAnchor: true });
    });
    const received = Notifications.addNotificationReceivedListener(() => refreshUnread());
    return () => {
      subscription.remove();
      received.remove();
    };
  }, [enabled, language]);
}

async function register(Notifications, language) {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== "granted") return;

  // Set by `eas init` (app.json → extra.eas.projectId)
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    console.warn("Push: no EAS projectId yet – run `eas init` to enable push notifications");
    return;
  }
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  registeredToken = token;
  await api("/api/push-token", {
    method: "PUT",
    body: { token, platform: Platform.OS, language },
  });
}

/** Stops push to this device (call before signing out). */
export async function unregisterPush() {
  if (!registeredToken) return;
  try {
    await api("/api/push-token", { method: "DELETE", body: { token: registeredToken } });
  } catch {
    // signing out anyway
  }
  registeredToken = null;
}
