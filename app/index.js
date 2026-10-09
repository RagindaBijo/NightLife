import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { api, getSession, saveSession } from "../lib/api";

export default function Index() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const session = await getSession();
        if (!session) {
          setIsAuthenticated(false);
          return;
        }

        // Fetch user data from /api/login/:id (a 401 signs the user out)
        const data = await api(`/api/login/${session.userId}`);
        if (data.user_type) {
          await saveSession({ ...session, userType: data.user_type });
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      } catch (error) {
        // Offline: stay logged in with the saved session
        if (error.status === 0) {
          setIsAuthenticated(true);
        } else {
          console.error("Auth check failed:", error.message);
          setIsAuthenticated(false);
        }
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return isAuthenticated ? (
    <Redirect href="/protected" />
  ) : (
    <Redirect href="/login" />
  );
}
