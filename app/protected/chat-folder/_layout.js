import { Stack } from 'expo-router';
import { useTheme } from '../../../lib/theme-context';

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
      <Stack.Screen name="[chatId]" />
    </Stack>
  );
}
