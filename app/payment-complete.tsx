import { router } from "expo-router";
import React, { useCallback, useEffect } from "react";
import {
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { COLORS } from "@/constants/colors";
import { useCartStore } from "@/stores/cart";
import { usePaymentStore } from "@/stores/payment";

export default function PaymentComplete() {
  const { getTotalAmount, clearCart } = useCartStore();
  const { orderId, resetPayment } = usePaymentStore();

  const handleGoToMenu = useCallback(() => {
    resetPayment();
    clearCart();
    router.replace("/products");
  }, [clearCart, resetPayment]);

  useEffect(() => {
    if (!orderId) {
      router.replace("/products");
      return;
    }

    const autoRedirectTimer = setTimeout(() => {
      handleGoToMenu();
    }, 10000);

    return () => clearTimeout(autoRedirectTimer);
  }, [handleGoToMenu, orderId]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          <Text style={styles.brandText}>Flick</Text> Place
        </Text>
      </View>

      <View style={styles.content}>
        <Image
          source={require("@/assets/images/check.png")}
          style={styles.checkIcon}
          resizeMode="contain"
        />

        <Text style={styles.completionTitle}>결제 완료</Text>
        <Text style={styles.completionMessage}>
          주문이 성공적으로 완료되었습니다
        </Text>

        <View style={styles.infoContainer}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>결제 금액</Text>
            <Text style={styles.infoValue}>
              {getTotalAmount().toLocaleString()}원
            </Text>
          </View>

          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>결제 시간</Text>
            <Text style={styles.infoValue}>
              {`${new Date().toLocaleTimeString("ko-KR", {
                hour: "2-digit",
                minute: "2-digit",
              })}`}
            </Text>
          </View>
        </View>

        <Text style={styles.redirectMessage}>
          10초 후 자동으로 화면이 전환됩니다
        </Text>

        <TouchableOpacity
          style={styles.returnButton}
          onPress={handleGoToMenu}
          activeOpacity={0.7}
        >
          <Text style={styles.returnButtonText}>메뉴로 돌아가기</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    paddingVertical: 16,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
    backgroundColor: "#FFFFFF",
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: "Pretendard-Bold",
    color: COLORS.gray900,
  },
  brandText: {
    color: COLORS.primary500,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#FFFFFF",
  },
  checkIcon: {
    width: 110,
    height: 110,
    marginBottom: 32,
  },
  completionTitle: {
    fontSize: 36,
    fontFamily: "Pretendard-Bold",
    color: COLORS.gray900,
    marginBottom: 16,
  },
  completionMessage: {
    fontSize: 18,
    fontFamily: "Pretendard-Medium",
    color: COLORS.gray600,
    textAlign: "center",
    marginBottom: 48,
  },
  infoContainer: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-evenly",
    marginBottom: 40,
  },
  infoItem: {
    alignItems: "center",
    paddingHorizontal: 24,
  },
  infoLabel: {
    fontSize: 16,
    fontFamily: "Pretendard-Medium",
    color: COLORS.gray600,
    marginBottom: 8,
  },
  infoValue: {
    fontSize: 24,
    fontFamily: "Pretendard-Bold",
    color: COLORS.gray900,
  },
  redirectMessage: {
    fontSize: 14,
    fontFamily: "Pretendard-Regular",
    color: COLORS.gray500,
    marginBottom: 32,
  },
  returnButton: {
    backgroundColor: COLORS.primary500,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: "60%",
    alignItems: "center",
  },
  returnButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontFamily: "Pretendard-SemiBold",
  },
});
