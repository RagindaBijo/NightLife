import { Stack } from 'expo-router';

export default function ProtectedLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#121212', // Dark background
        },
        headerTintColor: '#FFFFFF', // White back arrow
        headerTitleStyle: {
          fontFamily: 'Helvetica Neue',
          fontSize: 16,
          fontWeight: '600',
          color: '#FFFFFF',
        },
        headerShadowVisible: false, // Remove shadow for clean look
        headerBackTitleVisible: false, // Remove back button text
      }}
    >
     
      <Stack.Screen
        name="chat"
        options={{ title: 'Messages' }}
      />
      <Stack.Screen
        name="[chatId]"
        options={{ headerShown: false }} // Hide navigation header
      />
    </Stack>
  );
}