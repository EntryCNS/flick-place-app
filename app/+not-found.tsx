import { COLORS } from "@/constants/colors";
import { Ionicons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import React, { useCallback, useRef, useEffect } from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function NotFound(): React.ReactElement {
  const pathname = usePathname();
  const isMounted = useRef<boolean>(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleNavigateToHome = useCallback(() => {
    if (!isMounted.current) return;
    router.replace("/products");
  }, []);

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
          onPress={handleNavigateToHome}
          activeOpacity={0.7}
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
    fontFamily: "Pretendard-Bold",
    marginTop: 20,
    color: COLORS.secondary800,
  },
  message: {
    fontSize: 16,
    fontFamily: "Pretendard-Medium",
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
    fontFamily: "Pretendard-Bold",
  },
});
