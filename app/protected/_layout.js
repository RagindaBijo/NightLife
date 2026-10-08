import { Entypo, FontAwesome, Fontisto } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getSession } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { UserTypeContext } from "../../lib/session-context";
import { useTheme } from "../../lib/theme-context";

export default function Layout() {
  const { colors: COLORS } = useTheme();
  const { t } = useI18n();
  const [authState, setAuthState] = useState("checking"); // checking | in | out
  const [userType, setUserType] = useState(null); // "1" = user, "2" = venue

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
          screenOptions={{
            headerShown: false,
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
            name="chat-folder"
            options={{
              title: t("tabs.chat"),
              tabBarIcon: ({ color, size }) => (
                <FontAwesome name="wechat" size={size} color={color} />
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

          <Tabs.Screen
            name="profile-folder"
            options={{
              title: t("tabs.profile"),
              tabBarIcon: ({ color, size }) => (
                <FontAwesome name="user" size={size} color={color} />
              ),
              // Only the profile matching the account type exists (see profile-folder/_layout.js)
              href:
                userType === "2"
                  ? "/protected/profile-folder/venue-profile"
                  : "/protected/profile-folder/profile",
            }}
          />

          <Tabs.Screen
            name="settings-folder"
            options={{
              title: t("tabs.settings"),
              tabBarIcon: ({ color, size }) => (
                <Fontisto name="player-settings" size={size} color={color} />
              ),
            }}
          />
        </Tabs>
      </SafeAreaView>
    </UserTypeContext.Provider>
  );
}
