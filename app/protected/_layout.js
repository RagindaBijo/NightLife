import { Entypo, FontAwesome, MaterialCommunityIcons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getSession } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { useNotificationPolling } from "../../lib/notifications";
import { usePushNotifications } from "../../lib/push";
import { UserTypeContext } from "../../lib/session-context";
import { useUnreadCount, useUnreadPolling } from "../../lib/unread";
import { useTheme } from "../../lib/theme-context";

export default function Layout() {
  const { colors: COLORS } = useTheme();
  const { t } = useI18n();
  const [authState, setAuthState] = useState("checking"); // checking | in | out
  const [userType, setUserType] = useState(null); // "1" = user, "2" = venue
  const isVenue = userType === "2";

  useEffect(() => {
    getSession()
      .then((session) => {
        setUserType(session?.userType ?? null);
        setAuthState(session ? "in" : "out");
      })
      .catch((error) => {
        console.error("Failed to read session:", error);
        setAuthState("out");
      });
  }, []);

  // Push notifications for matches, requests and messages (personal accounts)
  usePushNotifications({ enabled: authState === "in" && userType === "1" });
  // Badge on the Chat tab: unread messages + waiting requests
  useUnreadPolling({ enabled: authState === "in" && userType === "1" });
  const unread = useUnreadCount();
  // Badge on the notifications bell (everyone, venues too)
  useNotificationPolling({ enabled: authState === "in" });

  // Auth guard: protected screens need a logged-in session
  if (authState === "checking") {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }
  if (authState === "out") {
    return <Redirect href="/login" />;
  }

  return (
    <UserTypeContext.Provider value={userType}>
      <SafeAreaView
        style={{ flex: 1, backgroundColor: COLORS.background }}
        edges={["top"]}
      >
        <Tabs
          // Android back goes to the previous tab (Settings is opened from Profile)
          backBehavior="history"
          screenOptions={{
            headerShown: false,
            tabBarHideOnKeyboard: true,
            tabBarStyle: {
              backgroundColor: COLORS.background,
              borderTopColor: COLORS.border,
            },
            tabBarActiveTintColor: COLORS.accent,
            tabBarInactiveTintColor: COLORS.textSecondary,
          }}
        >
          <Tabs.Screen
            name="home"
            options={{
              title: t("tabs.home"),
              tabBarIcon: ({ color, size }) => (
                <FontAwesome name="home" size={size} color={color} />
              ),
              unmountOnBlur: true,
            }}
          />

          <Tabs.Screen
            name="maps"
            options={{
              title: t("tabs.map"),
              tabBarIcon: ({ color, size }) => (
                <FontAwesome name="map" size={size} color={color} />
              ),
            }}
          />

          <Tabs.Screen
            name="social"
            options={{
              title: t("tabs.social"),
              tabBarIcon: ({ color, size }) => (
                <Entypo name="network" size={size} color={color} />
              ),
            }}
          />

          {/* Discover and Chat are for people (18+), not venues */}
          <Tabs.Screen
            name="discover"
            options={{
              title: t("tabs.discover"),
              href: isVenue ? null : undefined,
              tabBarIcon: ({ color, size }) => (
                <MaterialCommunityIcons name="cards" size={size} color={color} />
              ),
            }}
          />

          <Tabs.Screen
            name="chat-folder"
            options={{
              title: t("tabs.chat"),
              href: isVenue ? null : undefined,
              tabBarBadge: unread > 0 ? (unread > 99 ? "99+" : unread) : undefined,
              tabBarBadgeStyle: { backgroundColor: COLORS.accentPink, color: "#FFFFFF", fontSize: 11 },
              tabBarIcon: ({ color, size }) => (
                <FontAwesome name="wechat" size={size} color={color} />
              ),
            }}
          />

          <Tabs.Screen
            name="profile-folder"
            options={{
              title: t("tabs.profile"),
              tabBarIcon: ({ color, size }) => (
                <FontAwesome name="user" size={size} color={color} />
              ),
              // Only the profile matching the account type exists (see profile-folder/_layout.js)
              href: isVenue
                ? "/protected/profile-folder/venue-profile"
                : "/protected/profile-folder/profile",
            }}
          />

          {/* Not in the tab bar: opened from the gear on the profile */}
          <Tabs.Screen name="settings-folder" options={{ href: null }} />
        </Tabs>
      </SafeAreaView>
    </UserTypeContext.Provider>
  );
}
