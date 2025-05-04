import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect } from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { COLORS } from "../constants/colors";
import { useCartStore } from "../stores/cart";
import { usePaymentStore } from "../stores/payment";

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
        <View style={styles.headerCenterContent}>
          <Text style={styles.headerTitle}>
            <Text style={styles.flickText}>Flick</Text> Place
          </Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.successContainer}>
          <View style={styles.successIconContainer}>
            <Ionicons
              name="checkmark-circle"
              size={100}
              color={COLORS.success500}
            />
          </View>

          <Text style={styles.successTitle}>결제 완료</Text>
          <Text style={styles.successMessage}>
            주문이 성공적으로 완료되었습니다. 감사합니다!
          </Text>

          <View style={styles.orderInfoContainer}>
            <View style={styles.orderInfoRow}>
              <Text style={styles.orderInfoLabel}>결제 금액</Text>
              <Text style={styles.orderInfoValue}>
                {getTotalAmount().toLocaleString()}원
              </Text>
            </View>
            <View style={styles.orderInfoRow}>
              <Text style={styles.orderInfoLabel}>결제 시간</Text>
              <Text style={styles.orderInfoValue}>
                {`${new Date().toLocaleTimeString("ko-KR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}`}
              </Text>
            </View>
          </View>

          <View style={styles.timerText}>
            <Text style={styles.timerHint}>
              10초 후 자동으로 화면이 전환됩니다
            </Text>
          </View>

          <TouchableOpacity
            style={styles.returnButton}
            onPress={handleGoToMenu}
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
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  headerCenterContent: {
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  flickText: {
    color: COLORS.primary500,
    fontWeight: "700",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  successContainer: {
    width: "60%",
    maxWidth: 600,
    padding: 40,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  successIconContainer: {
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 16,
  },
  successMessage: {
    fontSize: 18,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginBottom: 40,
  },
  orderInfoContainer: {
    width: "100%",
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 24,
    marginBottom: 24,
  },
  orderInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  orderInfoLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: COLORS.textSecondary,
  },
  orderInfoValue: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  timerText: {
    marginBottom: 24,
  },
  timerHint: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
  },
  returnButton: {
    backgroundColor: COLORS.primary500,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
  },
  returnButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
  },
});
