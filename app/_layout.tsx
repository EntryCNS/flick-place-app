import { useAuthStore } from "@/stores/auth";
import { Redirect, Stack } from "expo-router";
import { useFonts } from "expo-font";
import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import Toast from "react-native-toast-message";
import { COLORS } from "@/constants/colors";

export default function RootLayout() {
  const { isAuthenticated } = useAuthStore();

  const [fontsLoaded] = useFonts({
    "Pretendard-Thin": require("../assets/fonts/Pretendard-Thin.otf"),
    "Pretendard-ExtraLight": require("../assets/fonts/Pretendard-ExtraLight.otf"),
    "Pretendard-Light": require("../assets/fonts/Pretendard-Light.otf"),
    "Pretendard-Regular": require("../assets/fonts/Pretendard-Regular.otf"),
    "Pretendard-Medium": require("../assets/fonts/Pretendard-Medium.otf"),
    "Pretendard-SemiBold": require("../assets/fonts/Pretendard-SemiBold.otf"),
    "Pretendard-Bold": require("../assets/fonts/Pretendard-Bold.otf"),
    "Pretendard-ExtraBold": require("../assets/fonts/Pretendard-ExtraBold.otf"),
    "Pretendard-Black": require("../assets/fonts/Pretendard-Black.otf"),
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary600} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isAuthenticated ? (
        <Redirect href="/products" />
      ) : (
        <Redirect href="/(auth)" />
      )}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" options={{ animation: "fade" }} />
        <Stack.Screen name="products" options={{ animation: "fade" }} />
        <Stack.Screen name="payment" />
        <Stack.Screen name="payment-complete" />
        <Stack.Screen name="+not-found" options={{ title: "Not Found" }} />
      </Stack>
      <Toast />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.white,
  },
});
