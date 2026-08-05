import { Stack } from 'expo-router';

export default function ProfileFolderLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false, // No header by default
        headerStyle: { backgroundColor: '#121212' }, // Dark header background
        headerTintColor: '#FFFFFF', // White text/icons
      }}
    >
      {/* <Stack.Screen name="redirect" /> */}
      <Stack.Screen name="profile" />
      <Stack.Screen name="venue-profile" />
      <Stack.Screen name="follow" />
      <Stack.Screen name="edit-profile" options={{ headerShown: true, title: 'Edit Profile' }} />
      <Stack.Screen name="create-event" options={{ headerShown: true, title: 'New Event' }} />
      <Stack.Screen name="create-post" options={{ headerShown: true, title: 'New Post' }} />
      <Stack.Screen name="post-list" options={{ headerShown: true, title: 'Posts' }} />
      <Stack.Screen name="maps" options={{ headerShown: false }} />
    </Stack>
  );
}