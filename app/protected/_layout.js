import { Entypo, FontAwesome, Fontisto } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Tabs } from "expo-router";
import { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Layout() {
  const [profileRoute, setProfileRoute] = useState(
    "/protected/profile-folder/profile",
  );

  useEffect(() => {
    AsyncStorage.getItem("userType")
      .then((value) => {
        setProfileRoute(
          value === "2"
            ? "/protected/profile-folder/venue-profile"
            : "/protected/profile-folder/profile",
        );
      })
      .catch((error) => {
        console.error("Failed to fetch userType:", error);
        setProfileRoute("/protected/profile-folder/profile"); // Default to profile
      });
  }, []);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: "#121212" }}
      edges={["top"]}
    >
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: "#121212",
            borderTopColor: "#333333",
          },
          tabBarActiveTintColor: "#BB86FC",
          tabBarInactiveTintColor: "#8E8E93",
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: "Home",
            tabBarIcon: ({ color, size }) => (
              <FontAwesome name="home" size={size} color={color} />
            ),
            unmountOnBlur: true,
          }}
        />

        <Tabs.Screen
          name="maps"
          options={{
            title: "maps",
            tabBarIcon: ({ color, size }) => (
              <FontAwesome name="map" size={size} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="chat-folder"
          options={{
            title: "Chat",
            tabBarIcon: ({ color, size }) => (
              <FontAwesome name="wechat" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="social"
          options={{
            title: "Social",
            tabBarIcon: ({ color, size }) => (
              <Entypo name="network" size={size} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="profile-folder"
          options={{
            title: "Profile",
            tabBarIcon: ({ color, size }) => (
              <FontAwesome name="user" size={size} color={color} />
            ),
            href: profileRoute,
          }}
        />

        <Tabs.Screen
          name="settings-folder"
          options={{
            title: "Settings",
            tabBarIcon: ({ color, size }) => (
              <Fontisto name="player-settings" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </SafeAreaView>
  );
}
