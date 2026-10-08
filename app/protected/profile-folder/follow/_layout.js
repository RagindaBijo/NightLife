import { createMaterialTopTabNavigator } from 'expo-router/js-top-tabs';
import Followers from './followers';
import Following from './following';
import { useI18n } from '../../../../lib/i18n';
import { useTheme } from '../../../../lib/theme-context';

const Tab = createMaterialTopTabNavigator();

export default function FollowLayout() {
  const { colors: COLORS } = useTheme();
  const { t } = useI18n();
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarPosition: 'top',
        tabBarStyle: {
          backgroundColor: COLORS.background, // Dark background for top tab bar
          borderBottomColor: COLORS.border, // Subtle border for contrast
        },
        tabBarLabelStyle: {
          fontSize: 16,
          fontWeight: 'bold',
          color: COLORS.text, // Light text for labels
        },
        tabBarActiveTintColor: COLORS.accent, // Accent color for active tab
        tabBarInactiveTintColor: COLORS.textSecondary, // Muted color for inactive tabs
        tabBarIndicatorStyle: {
          backgroundColor: COLORS.accent, // Indicator matches active tint
        },
      }}
    >
      <Tab.Screen name="followers" component={Followers} options={{ title: t('profile.followers') }} />
      <Tab.Screen name="following" component={Following} options={{ title: t('profile.following') }} />
    </Tab.Navigator>
  );
}