import { Stack } from 'expo-router';

export default function HomeLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false, // No header
      }}
    >
      <Stack.Screen name="lists" />
      <Stack.Screen name="eventId/[eventId]" />
      <Stack.Screen name="venueId/[id]" />
    </Stack>
  );
}