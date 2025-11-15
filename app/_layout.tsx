import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";
import "../global.css";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { requestNotificationPermissions } from "@/utils/permissions";

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    // Request notification permissions when app starts
    requestNotificationPermissions();
  }, []);

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Slot />
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
