import { Stack } from 'expo-router';
import { useI18n } from '../../../lib/i18n';
import { useUserType } from '../../../lib/session-context';
import { useTheme } from '../../../lib/theme-context';

export default function ProfileFolderLayout() {
  const { colors: COLORS } = useTheme();
  const { t } = useI18n();
  // Only the profile matching the account type exists in this stack
  const isVenue = useUserType() === '2';

  return (
    <Stack
      screenOptions={{
        headerShown: false, // No header by default
        headerStyle: { backgroundColor: COLORS.background }, // Dark header background
        headerTintColor: COLORS.text, // White text/icons
      }}
    >
      {/* <Stack.Screen name="redirect" /> */}
      <Stack.Protected guard={!isVenue}>
        <Stack.Screen name="profile" />
      </Stack.Protected>
      <Stack.Protected guard={isVenue}>
        <Stack.Screen name="venue-profile" />
      </Stack.Protected>
      <Stack.Screen name="follow" />
      <Stack.Screen name="edit-profile" options={{ headerShown: true, title: t('editProfile.title') }} />
      <Stack.Screen name="create-event" options={{ headerShown: true, title: t('createEvent.newEvent') }} />
      <Stack.Screen name="create-post" options={{ headerShown: true, title: t('createPost.title') }} />
      <Stack.Screen name="post-list" options={{ headerShown: true, title: t('profile.posts') }} />
      <Stack.Screen name="maps" options={{ headerShown: false }} />
    </Stack>
  );
}
