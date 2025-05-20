import { useAuthStore } from "@/stores/auth";
import { Redirect, Stack } from "expo-router";
import { useFonts } from "expo-font";
import React, { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import Toast from "react-native-toast-message";
import { COLORS } from "@/constants/colors";
import * as SplashScreen from "expo-splash-screen";
import * as KeepAwake from "expo-keep-awake";
import Providers from "@/components/providers";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout(): React.ReactElement | null {
  const { authenticated, initialized } = useAuthStore();
  const isMounted = useRef<boolean>(true);

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

  useEffect(() => {
    isMounted.current = true;
    KeepAwake.activateKeepAwakeAsync();

    return () => {
      isMounted.current = false;
      KeepAwake.deactivateKeepAwake();
    };
  }, []);

  useEffect(() => {
    if (fontsLoaded && initialized && isMounted.current) {
      SplashScreen.hideAsync().catch((error) => {
        console.error("Failed to hide splash screen:", error);
      });
    }
  }, [fontsLoaded, initialized]);

  if (!fontsLoaded || !initialized) {
    return null;
  }

  return (
    <Providers>
      <View style={styles.container}>
        {authenticated ? (
          <Redirect href="/products" />
        ) : (
          <Redirect href="/(auth)" />
        )}
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" options={{ animation: "fade" }} />
          <Stack.Screen name="products" options={{ animation: "fade" }} />
          <Stack.Screen name="payment" options={{ gestureEnabled: false }} />
          <Stack.Screen
            name="payment-complete"
            options={{ gestureEnabled: false }}
          />
          <Stack.Screen name="+not-found" options={{ title: "Not Found" }} />
        </Stack>
        <Toast />
      </View>
    </Providers>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
});
