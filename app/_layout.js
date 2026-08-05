import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="user-account-add" options={{ headerShown: false }} />
      <Stack.Screen name="venue-account-add" options={{ headerShown: false }} />
      <Stack.Screen name="account-type" options={{ headerShown: false }} />
      <Stack.Screen name="protected" options={{ headerShown: false }} />
    </Stack>
  );
}