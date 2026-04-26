import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../theme/colors";


import HomeScreen from "../screens/HomeScreen";
import ImageProcessingScreen from "../screens/ImageProcessingScreen";
import LayoutSelectionScreen from "../screens/LayoutSelectionScreen";
import ProfileScreen from "../screens/ProfileScreen";
import ReportPreviewScreen from "../screens/ReportPreviewScreen";
import ShipInfoScreen from "../screens/ShipInfoScreen";
import type { InspectionShip, ReportImage } from "../utils/inspectionStorage";

export type AppStackParamList = {
  HomeMain: undefined;
  ShipInfo: { ship?: Partial<InspectionShip> } | undefined;
  InspectionDetails: { ship?: Partial<InspectionShip> } | undefined;
  CreateReport: { ship: InspectionShip };
  ImageProcessing: { ship: InspectionShip };
  LayoutSelection: {
    ship: InspectionShip;
    images: (ReportImage & { title?: string })[];
  };
  ReportPreview: {
    ship: InspectionShip;
    inspectionId?: string;
    inspectionCreatedAt?: number;
    images?: (ReportImage & { title?: string })[];
    report?: {
      imagesPerPage: number;
      images: (ReportImage & { title?: string })[];
    };
  };
};

const HomeStack = createNativeStackNavigator<AppStackParamList>();
const Tab = createBottomTabNavigator();

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator>
      <HomeStack.Screen
        name="HomeMain"
        component={HomeScreen}
        options={{
          headerShown: false,
          headerTitle: "",
          title: "Home",
        }}
      />
      <HomeStack.Screen
        name="InspectionDetails"
        component={ShipInfoScreen}
        options={{
          title: "Inspection Details",
          headerBackTitle: "Home",
          headerBackTitleVisible: true,
        }}
      />
      <HomeStack.Screen
        name="ShipInfo"
        component={ShipInfoScreen}
        options={{
          title: "Inspection Details",
          headerBackTitle: "Home",
          headerBackTitleVisible: true,
        }}
      />
      <HomeStack.Screen
        name="ImageProcessing"
        component={ImageProcessingScreen}
        options={{ title: "Image Processing" }}
      />
      <HomeStack.Screen
        name="CreateReport"
        component={ImageProcessingScreen}
        options={{ title: "Image Processing" }}
      />
      <HomeStack.Screen
        name="LayoutSelection"
        component={LayoutSelectionScreen}
        options={{ title: "Layout Selection" }}
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
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
  screenOptions={({ route }) => ({
    headerShown: false,
    tabBarHideOnKeyboard: true,

    tabBarShowLabel: true,
    tabBarActiveTintColor: COLORS.primary,
    tabBarInactiveTintColor: COLORS.textSecondary,

    tabBarStyle: {
      height: 64 + insets.bottom,
      paddingBottom: insets.bottom,
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
