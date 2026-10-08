import { Stack } from 'expo-router';
import { useI18n } from '../../../lib/i18n';
import { useTheme } from '../../../lib/theme-context';

export default function SettingsLayout() {
  const { colors: COLORS } = useTheme();
  const { t } = useI18n();
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.background, // Dark background for headers
        },
        headerTintColor: COLORS.text, // White text/icons for header
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: COLORS.background },
      }}
    >
      <Stack.Screen name="settings" options={{ headerShown: false }} />
      <Stack.Screen name="feedback" options={{ title: t('settings.sendFeedback') }} />
      <Stack.Screen name="privacy-policy" options={{ title: t('settings.privacyPolicy') }} />
      <Stack.Screen name="terms-conditions" options={{ title: t('settings.termsOfUse') }} />
      <Stack.Screen name="blocked" options={{ title: t('settings.blockedAccounts') }} />
      <Stack.Screen name="change-password" options={{ title: t('settings.changePassword') }} />
    </Stack>
  );
}
