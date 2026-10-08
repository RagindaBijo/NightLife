import { createMaterialTopTabNavigator } from "expo-router/js-top-tabs";
import Events from "./events";
import Venues from "./venues";
import { useI18n } from "../../../../lib/i18n";
import { useTheme } from "../../../../lib/theme-context";

const Tab = createMaterialTopTabNavigator();

export default function ListsLayout() {
  const { colors: COLORS } = useTheme();
  const { t } = useI18n();
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarPosition: "top",
        tabBarStyle: {
          backgroundColor: COLORS.background, // Dark background for top tab bar
          borderBottomColor: COLORS.border, // Subtle border for contrast
        },
        tabBarLabelStyle: {
          fontSize: 16,
          fontWeight: "bold",
          color: COLORS.text, // Light text for labels
        },
        tabBarActiveTintColor: COLORS.accent, // Accent color for active tab
        tabBarInactiveTintColor: COLORS.textSecondary, // Muted color for inactive tabs
        tabBarIndicatorStyle: {
          backgroundColor: COLORS.accent, // Indicator matches active tint
        },
      }}
    >
      <Tab.Screen
        name="venues"
        component={Venues}
        options={{ title: t("home.venuesTab") }}
      />
      <Tab.Screen
        name="events"
        component={Events}
        options={{ title: t("home.eventsTab") }}
      />
    </Tab.Navigator>
  );
}
