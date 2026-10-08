import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { createMaterialTopTabNavigator } from 'expo-router/js-top-tabs';
import { Pressable, Text, View } from 'react-native';
import Followers from './followers';
import Following from './following';
import { useI18n } from '../../../../lib/i18n';
import { makeStyles, useTheme } from '../../../../lib/theme-context';

const Tab = createMaterialTopTabNavigator();

/**
 * Followers / Following tabs.
 * Params: tab ("followers" | "following") to open, username for the title,
 * userId for someone else's lists (defaults to yours).
 */
export default function FollowLayout() {
  const { colors: COLORS } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  const router = useRouter();
  const { tab, username, userId } = useLocalSearchParams();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t('common.goBack')}
        >
          <MaterialIcons name="arrow-back" size={24} color={COLORS.text} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {username ? `@${username}` : t('follow.title')}
        </Text>
        <View style={styles.backButton} />
      </View>

      <Tab.Navigator
        initialRouteName={tab === 'following' ? 'following' : 'followers'}
        screenOptions={{
          tabBarPosition: 'top',
          tabBarStyle: {
            backgroundColor: COLORS.background,
            borderBottomColor: COLORS.border,
          },
          tabBarLabelStyle: {
            fontSize: 16,
            fontWeight: 'bold',
            textTransform: 'none',
          },
          tabBarActiveTintColor: COLORS.accent,
          tabBarInactiveTintColor: COLORS.textSecondary,
          tabBarIndicatorStyle: {
            backgroundColor: COLORS.accent,
          },
        }}
      >
        <Tab.Screen name="followers" options={{ title: t('profile.followers') }}>
          {() => <Followers userId={userId} />}
        </Tab.Screen>
        <Tab.Screen name="following" options={{ title: t('profile.following') }}>
          {() => <Following userId={userId} />}
        </Tab.Screen>
      </Tab.Navigator>
    </View>
  );
}

const useStyles = makeStyles((COLORS) => ({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.6,
  },
}));
