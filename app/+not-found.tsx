import { COLORS } from "@/constants/colors";
import { Ionicons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import React from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function NotFound() {
  const pathname = usePathname();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Ionicons
          name="alert-circle-outline"
          size={80}
          color={COLORS.danger500}
        />
        <Text style={styles.title}>페이지를 찾을 수 없습니다</Text>
        <Text style={styles.message}>
          요청하신 경로 &quot;{pathname}&quot;를 찾을 수 없습니다.
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.replace("/products")}
        >
          <Text style={styles.buttonText}>메인으로 돌아가기</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.secondary50,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 20,
    color: COLORS.secondary800,
  },
  message: {
    fontSize: 16,
    textAlign: "center",
    marginTop: 10,
    marginBottom: 30,
    color: COLORS.secondary500,
  },
  button: {
    backgroundColor: COLORS.primary500,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: {
    color: COLORS.secondary50,
    fontSize: 16,
    fontWeight: "bold",
  },
});
