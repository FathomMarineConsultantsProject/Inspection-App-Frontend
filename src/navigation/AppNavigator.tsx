import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../theme/colors";


import ShipInfoScreen from "../screens/ShipInfoScreen";
import CreateReportScreen from "../screens/CreateReportScreen";
import ReportPreviewScreen from "../screens/ReportPreviewScreen";
import ProfileScreen from "../screens/ProfileScreen";

export type AppStackParamList = {
  ShipInfo: undefined;
  CreateReport: { ship: any };
  ReportPreview: { ship: any; report: { imageUris: string[] } };
};

const HomeStack = createNativeStackNavigator<AppStackParamList>();
const Tab = createBottomTabNavigator();

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator>
      <HomeStack.Screen
        name="ShipInfo"
        component={ShipInfoScreen}
        options={{ title: "Ship Information" }}
      />
      <HomeStack.Screen
        name="CreateReport"
        component={CreateReportScreen}
        options={{ title: "Create Report" }}
      />
      <HomeStack.Screen
        name="ReportPreview"
        component={ReportPreviewScreen}
        options={{ title: "Preview & Export" }}
      />
    </HomeStack.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <Tab.Navigator
  screenOptions={({ route }) => ({
    headerShown: false,

    tabBarShowLabel: true,
    tabBarActiveTintColor: COLORS.primary,
    tabBarInactiveTintColor: COLORS.textSecondary,

    tabBarStyle: {
      height: 64,
      paddingBottom: 10,
      paddingTop: 8,
      backgroundColor: COLORS.surface,
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
    },

    tabBarLabelStyle: {
      fontSize: 12,
      fontWeight: "600",
    },

    tabBarIcon: ({ color, size }) => {
      if (route.name === "Home") {
        return <Ionicons name="home-outline" size={size} color={color} />;
      }
      if (route.name === "Profile") {
        return <Ionicons name="person-outline" size={size} color={color} />;
      }
      return null;
    },
  })}
>
      <Tab.Screen name="Home" component={HomeStackNavigator} />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ headerShown: true, title: "Profile" }}
      />
    </Tab.Navigator>
  );
}
