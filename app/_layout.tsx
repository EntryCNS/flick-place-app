import { useAuthStore } from "@/stores/auth";
import { Redirect, Stack } from "expo-router";
import React from "react";
import Toast from "react-native-toast-message";

export default function RootLayout() {
  const { isAuthenticated } = useAuthStore();

  return (
    <>
      {isAuthenticated ? (
        <Redirect href="/products" />
      ) : (
        <Redirect href="/registration" />
      )}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="registration" />
        <Stack.Screen name="products" />
        <Stack.Screen name="payment" />
        <Stack.Screen name="payment-complete" />
        <Stack.Screen name="+not-found" options={{ title: "Not Found" }} />
      </Stack>
      <Toast />
    </>
  );
}
