import { COLORS } from "@/constants/colors";
import { Stack } from "expo-router";
import React from "react";
import { StyleSheet, View } from "react-native";

export default function AuthLayout() {
  return (
    <View style={styles.container}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.white },
          animation: "slide_from_right",
          gestureEnabled: true,
          gestureDirection: "horizontal",
          animationDuration: 250,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
});
