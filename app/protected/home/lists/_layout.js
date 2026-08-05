import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import Events from './events';
import Venues from './venues';

const Tab = createMaterialTopTabNavigator();

export default function ListsLayout() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarPosition: 'top',
        tabBarStyle: {
          backgroundColor: '#121212', // Dark background for top tab bar
          borderBottomColor: '#333333', // Subtle border for contrast
        },
        tabBarLabelStyle: {
          fontSize: 16,
          fontWeight: 'bold',
          color: '#FFFFFF', // Light text for labels
        },
        tabBarActiveTintColor: '#BB86FC', // Accent color for active tab
        tabBarInactiveTintColor: '#8E8E93', // Muted color for inactive tabs
        tabBarIndicatorStyle: {
          backgroundColor: '#BB86FC', // Indicator matches active tint
        },
      }}
    >
      <Tab.Screen name="venues" component={Venues} options={{ title: 'Venues' }} />
      <Tab.Screen name="events" component={Events} options={{ title: 'Events' }} />
    </Tab.Navigator>
  );
}