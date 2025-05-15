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
        <View style={styles.completionCard}>
          <View style={styles.checkIconContainer}>
            <Image
              source={require("@/assets/images/check-success.png")}
              style={styles.checkIcon}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.completionTitle}>결제 완료</Text>
          <Text style={styles.completionMessage}>
            주문이 성공적으로 완료되었습니다
          </Text>

          <View style={styles.orderSummary}>
            <View style={styles.orderInfoRow}>
              <Text style={styles.infoLabel}>결제 금액</Text>
              <Text style={styles.infoValue}>
                {getTotalAmount().toLocaleString()}원
              </Text>
            </View>
            <View style={styles.orderInfoRow}>
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingVertical: 16,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
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
    padding: 20,
  },
  completionCard: {
    width: "60%",
    maxWidth: 500,
    padding: 40,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  checkIconContainer: {
    marginBottom: 20,
  },
  checkIcon: {
    width: 100,
    height: 100,
  },
  completionTitle: {
    fontSize: 28,
    fontFamily: "Pretendard-Bold",
    color: COLORS.gray900,
    marginBottom: 12,
  },
  completionMessage: {
    fontSize: 16,
    fontFamily: "Pretendard-Medium",
    color: COLORS.gray600,
    textAlign: "center",
    marginBottom: 32,
  },
  orderSummary: {
    width: "100%",
    backgroundColor: COLORS.gray50,
    borderRadius: 10,
    padding: 20,
    marginBottom: 24,
  },
  orderInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  infoLabel: {
    fontSize: 15,
    fontFamily: "Pretendard-Medium",
    color: COLORS.gray600,
  },
  infoValue: {
    fontSize: 16,
    fontFamily: "Pretendard-SemiBold",
    color: COLORS.gray900,
  },
  redirectMessage: {
    fontSize: 14,
    fontFamily: "Pretendard-Regular",
    color: COLORS.gray500,
    marginBottom: 24,
  },
  returnButton: {
    backgroundColor: COLORS.primary500,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    width: "100%",
    alignItems: "center",
  },
  returnButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Pretendard-SemiBold",
  },
});
