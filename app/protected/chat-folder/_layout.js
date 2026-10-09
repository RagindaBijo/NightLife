import { Stack } from 'expo-router';
import { useTheme } from '../../../lib/theme-context';

// A conversation opened from elsewhere (Discover, a profile, a notification)
// still has the chat list under it, so going back lands on a fresh list
export const unstable_settings = {
  initialRouteName: 'chat',
};

// Chat list and conversation draw their own headers
export default function ChatLayout() {
  const { colors: COLORS } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.background },
      }}
    >
      <Stack.Screen name="chat" />
      <Stack.Screen name="requests" />
      <Stack.Screen name="[chatId]" />
    </Stack>
  );
}
