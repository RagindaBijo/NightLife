import { Stack } from 'expo-router';
import { useI18n } from '../../../lib/i18n';
import { useTheme } from '../../../lib/theme-context';

export default function ProtectedLayout() {
  const { colors: COLORS } = useTheme();
  const { t } = useI18n();
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.background, // Dark background
        },
        headerTintColor: COLORS.text, // White back arrow
        headerTitleStyle: {
          fontFamily: 'Helvetica Neue',
          fontSize: 16,
          fontWeight: '600',
          color: COLORS.text,
        },
        headerShadowVisible: false, // Remove shadow for clean look
        headerBackTitleVisible: false, // Remove back button text
      }}
    >
     
      <Stack.Screen
        name="chat"
        options={{ title: t('chat.messages') }}
      />
      <Stack.Screen
        name="[chatId]"
        options={{ headerShown: false }} // Hide navigation header
      />
    </Stack>
  );
}