import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { I18nProvider, useI18n } from '../lib/i18n';
import { AppThemeProvider, useTheme } from '../lib/theme-context';

function ThemedStack() {
  const { scheme, colors } = useTheme();
  const { t } = useI18n();

  // Navigation colours (screen backgrounds during transitions, headers)
  const navigationTheme = useMemo(() => {
    const base = scheme === 'light' ? DefaultTheme : DarkTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.accent,
        background: colors.background,
        card: colors.backgroundElevated,
        text: colors.text,
        border: colors.border,
      },
    };
  }, [scheme, colors]);

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="user-account-add" options={{ headerShown: false }} />
        <Stack.Screen name="venue-account-add" options={{ headerShown: false }} />
        <Stack.Screen name="account-type" options={{ headerShown: false }} />
        <Stack.Screen name="protected" options={{ headerShown: false }} />
        {/* Readable before signing up (linked from the Terms checkbox) */}
        <Stack.Screen name="terms" options={{ title: t('settings.termsOfUse') }} />
        <Stack.Screen name="privacy" options={{ title: t('settings.privacyPolicy') }} />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <I18nProvider>
      <AppThemeProvider>
        <ThemedStack />
      </AppThemeProvider>
    </I18nProvider>
  );
}
