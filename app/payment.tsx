import { Ionicons } from "@expo/vector-icons";
import { isAxiosError } from "axios";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import Toast from "react-native-toast-message";
import { API_URL } from "@/constants/api";
import { COLORS } from "@/constants/colors";
import api from "@/libs/api";
import { useCartStore } from "@/stores/cart";
import { usePaymentStore } from "@/stores/payment";

interface CartItemType {
  id: number;
  name: string;
  price: number;
  quantity: number;
}

type PaymentMethod = "QR_CODE" | "STUDENT_ID";

const ERROR_MESSAGES: Record<string, string> = {
  ORDER_NOT_FOUND: "주문을 찾을 수 없습니다",
  ORDER_NOT_PENDING: "이미 처리된 주문입니다",
  USER_NOT_FOUND: "등록되지 않은 학번입니다",
  BOOTH_NOT_FOUND: "부스 정보를 찾을 수 없습니다",
};

export default function Payment() {
  const { items: cart, getTotalAmount, clearCart } = useCartStore();
  const {
    orderId,
    requestId,
    requestCode,
    timer,
    isActive,
    decrementTimer,
    cancelPayment,
    status,
    setStatus,
    requestMethod,
    setPaymentRequest,
    resetPayment,
  } = usePaymentStore();

  const [selectedMethod, setSelectedMethod] =
    useState<PaymentMethod>("QR_CODE");
  const [studentId, setStudentId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const timerAnimValue = useRef(new Animated.Value(1)).current;
  const webSocketRef = useRef<WebSocket | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 타이머 애니메이션 (60초 미만일 때)
  useEffect(() => {
    if (timer <= 60) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(timerAnimValue, {
            toValue: 0.6,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(timerAnimValue, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      timerAnimValue.setValue(1);
    }
  }, [timer <= 60]);

  const handleCancel = useCallback(async () => {
    try {
      setIsSubmitting(true);
      if (orderId) {
        await api.post(`/orders/${orderId}/cancel`);
      }
    } catch (error) {
      let message = "주문 취소 중 오류가 발생했습니다";

      if (isAxiosError(error) && error.response?.data) {
        const errorData = error.response.data;
        if (errorData?.code && ERROR_MESSAGES[errorData.code]) {
          message = ERROR_MESSAGES[errorData.code];
        }
      }

      Toast.show({
        type: "error",
        text1: message,
      });
    } finally {
      setIsSubmitting(false);
      cancelPayment();
      clearCart();
      router.replace("/products");
    }
  }, [orderId, cancelPayment, clearCart]);

  useEffect(() => {
    if (isActive && timer > 0) {
      intervalRef.current = setInterval(decrementTimer, 1000);
    } else if (timer <= 0) {
      handleCancel();
    }

    if (status === "COMPLETED") {
      router.replace("/payment-complete");
    }

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive, timer, status, decrementTimer, handleCancel]);

  useEffect(() => {
    if (requestId) {
      const wsUrl = `${API_URL.replace(
        "http",
        "ws"
      )}/ws/payment-requests/${requestId}`;
      webSocketRef.current = new WebSocket(wsUrl);

      webSocketRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.status === "COMPLETED") {
            setStatus("COMPLETED");
          } else if (data.status === "FAILED") {
            setStatus("FAILED");
            Toast.show({
              type: "error",
              text1: "결제 실패",
              text2: data.message || "결제가 실패했습니다.",
            });
          } else if (data.status === "EXPIRED") {
            setStatus("EXPIRED");
            Toast.show({
              type: "error",
              text1: "결제 시간이 초과되었습니다.",
            });
            handleCancel();
          }
        } catch (error) {
          console.error("웹소켓 메시지 처리 실패:", error);
        }
      };

      webSocketRef.current.onerror = () => {
        Toast.show({
          type: "error",
          text1: "결제 상태 업데이트 실패",
        });
      };

      return () => {
        if (
          webSocketRef.current &&
          webSocketRef.current.readyState !== WebSocket.CLOSED
        ) {
          webSocketRef.current.close();
        }
      };
    }
  }, [requestId, setStatus, handleCancel]);

  useEffect(() => {
    const createQrPaymentRequest = async () => {
      if (!orderId || requestCode) return;

      try {
        setIsSubmitting(true);
        setErrorMessage(null);
        setErrorCode(null);

        const response = await api.post("/payments/qr", { orderId });

        if (response.data) {
          setPaymentRequest(
            response.data.id,
            response.data.token || "",
            "PENDING",
            "QR_CODE",
            response.data.expiresAt ||
              new Date(Date.now() + 15 * 60 * 1000).toISOString()
          );
        }
      } catch (error) {
        let errorMsg = "결제 요청을 생성할 수 없습니다";
        let code = null;

        if (isAxiosError(error) && error.response?.data) {
          const errorData = error.response.data;
          code = errorData?.code;

          if (code && ERROR_MESSAGES[code]) {
            errorMsg = ERROR_MESSAGES[code];
          }
        }

        setErrorCode(code);
        setErrorMessage(errorMsg);
        Toast.show({
          type: "error",
          text1: errorMsg,
        });
      } finally {
        setIsSubmitting(false);
      }
    };

    if (selectedMethod === "QR_CODE" && orderId && !requestCode) {
      createQrPaymentRequest();
    }
  }, [selectedMethod, orderId, requestCode, setPaymentRequest]);

  const handleMethodChange = useCallback(
    (method: PaymentMethod) => {
      if (selectedMethod !== method) {
        setSelectedMethod(method);
        setErrorMessage(null);
        setErrorCode(null);

        if (method === "STUDENT_ID") {
          setStudentId("");
        }
      }
    },
    [selectedMethod]
  );

  const validateStudentId = useCallback((id: string): boolean => {
    if (id.length !== 4) return false;

    const grade = parseInt(id[0], 10);
    const room = parseInt(id[1], 10);
    const number = parseInt(id.substring(2), 10);

    return (
      grade >= 1 &&
      grade <= 9 &&
      room >= 1 &&
      room <= 9 &&
      number >= 1 &&
      number <= 99
    );
  }, []);

  const handleStudentIdSubmit = useCallback(async () => {
    if (!validateStudentId(studentId)) {
      Toast.show({
        type: "info",
        text1: "올바른 학번 형식이 아닙니다",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      setErrorCode(null);

      const response = await api.post("/payments/student-id", {
        orderId,
        studentId: studentId.trim(),
      });

      if (response.data) {
        setPaymentRequest(
          response.data.id,
          response.data.token || studentId,
          "PENDING",
          "STUDENT_ID",
          response.data.expiresAt ||
            new Date(Date.now() + 15 * 60 * 1000).toISOString()
        );

        Toast.show({
          type: "success",
          text1: "학번 결제 요청 완료",
        });
      }
    } catch (error) {
      let errorMsg = "결제 요청에 실패했습니다";
      let code = null;

      if (isAxiosError(error) && error.response?.data) {
        const errorData = error.response.data;
        code = errorData?.code;

        if (code && ERROR_MESSAGES[code]) {
          errorMsg = ERROR_MESSAGES[code];
        }
      }

      setErrorCode(code);
      setErrorMessage(errorMsg);
      Toast.show({
        type: "error",
        text1: errorMsg,
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [studentId, orderId, setPaymentRequest, validateStudentId]);

  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }, []);

  const handleRetry = useCallback(() => {
    if (selectedMethod === "QR_CODE") {
      resetPayment();
      setErrorMessage(null);
      setErrorCode(null);

      if (orderId) {
        setPaymentRequest(
          0,
          "",
          "PENDING",
          "QR_CODE",
          new Date(Date.now() + 15 * 60 * 1000).toISOString()
        );
      }
    } else {
      setStudentId("");
      setErrorMessage(null);
      setErrorCode(null);
    }
  }, [selectedMethod, orderId, resetPayment, setPaymentRequest]);

  const renderErrorAction = useCallback(() => {
    if (!errorCode) return null;

    switch (errorCode) {
      case "ORDER_NOT_PENDING":
      case "ORDER_NOT_FOUND":
        return (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.replace("/products")}
            activeOpacity={0.7}
          >
            <Text style={styles.buttonText}>상품 목록으로 돌아가기</Text>
          </TouchableOpacity>
        );
      default:
        return (
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleRetry}
            activeOpacity={0.7}
          >
            <Text style={styles.buttonText}>다시 시도</Text>
          </TouchableOpacity>
        );
    }
  }, [errorCode, handleRetry]);

  const renderCartItem = useCallback(
    ({ item }: { item: CartItemType }) => (
      <View style={styles.orderItem}>
        <Text style={styles.orderItemName} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={styles.orderItemDetails}>
          <Text style={styles.orderItemQuantity}>{item.quantity}개</Text>
          <Text style={styles.orderItemPrice}>
            {(item.price * item.quantity).toLocaleString()}원
          </Text>
        </View>
      </View>
    ),
    []
  );

  const handleKeypadPress = useCallback(
    (value: string) => {
      if (value === "delete") {
        setStudentId((prev) => prev.slice(0, -1));
      } else if (value === "clear") {
        setStudentId("");
      } else if (studentId.length < 4) {
        setStudentId((prev) => prev + value);
      }
    },
    [studentId]
  );

  const renderKeypad = () => {
    const keys = [
      ["1", "2", "3"],
      ["4", "5", "6"],
      ["7", "8", "9"],
      ["clear", "0", "delete"],
    ];

    return (
      <View style={styles.keypadContainer}>
        {keys.map((row, rowIndex) => (
          <View key={`row-${rowIndex}`} style={styles.keypadRow}>
            {row.map((key) => (
              <TouchableOpacity
                key={`key-${key}`}
                style={[
                  styles.keypadButton,
                  key === "delete" || key === "clear"
                    ? styles.keypadActionButton
                    : null,
                ]}
                onPress={() => handleKeypadPress(key)}
                activeOpacity={0.6}
              >
                {key === "delete" ? (
                  <Ionicons
                    name="backspace-outline"
                    size={22}
                    color={COLORS.gray600}
                  />
                ) : key === "clear" ? (
                  <Text style={styles.keypadActionText}>삭제</Text>
                ) : (
                  <Text style={styles.keypadButtonText}>{key}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleCancel}
          disabled={isSubmitting}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.gray800} />
          <Text style={styles.backButtonText}>돌아가기</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
          <Text style={styles.brandText}>Flick</Text> Place
        </Text>

        <Animated.View
          style={[styles.timerWrapper, { opacity: timerAnimValue }]}
        >
          <Ionicons
            name="time-outline"
            size={22}
            color={timer <= 60 ? COLORS.danger500 : COLORS.gray700}
          />
          <Text style={[styles.timerText, timer <= 60 && styles.timerWarning]}>
            {formatTime(timer)}
          </Text>
        </Animated.View>
      </View>

      {/* 메인 콘텐츠 */}
      <View style={styles.mainContent}>
        {/* 왼쪽 패널: 결제 방법 */}
        <View style={styles.leftPanel}>
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[
                styles.tab,
                selectedMethod === "QR_CODE" && styles.activeTab,
              ]}
              onPress={() => handleMethodChange("QR_CODE")}
              disabled={isSubmitting}
              activeOpacity={0.7}
            >
              <Ionicons
                name="qr-code-outline"
                size={22}
                color={
                  selectedMethod === "QR_CODE"
                    ? COLORS.primary500
                    : COLORS.gray600
                }
              />
              <Text
                style={[
                  styles.tabText,
                  selectedMethod === "QR_CODE" && styles.activeTabText,
                ]}
              >
                QR 결제
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tab,
                selectedMethod === "STUDENT_ID" && styles.activeTab,
              ]}
              onPress={() => handleMethodChange("STUDENT_ID")}
              disabled={isSubmitting}
              activeOpacity={0.7}
            >
              <Ionicons
                name="school-outline"
                size={22}
                color={
                  selectedMethod === "STUDENT_ID"
                    ? COLORS.primary500
                    : COLORS.gray600
                }
              />
              <Text
                style={[
                  styles.tabText,
                  selectedMethod === "STUDENT_ID" && styles.activeTabText,
                ]}
              >
                학번 결제
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.paymentContent}>
            {selectedMethod === "QR_CODE" ? (
              <View style={styles.centerContentWrapper}>
                {isSubmitting || (!requestCode && !errorMessage) ? (
                  <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color={COLORS.primary500} />
                    <Text style={styles.loadingText}>QR 코드 생성 중...</Text>
                  </View>
                ) : errorMessage ? (
                  <View style={styles.centerContent}>
                    <Ionicons
                      name="alert-circle-outline"
                      size={44}
                      color={COLORS.danger500}
                    />
                    <Text style={styles.errorText}>{errorMessage}</Text>
                    {renderErrorAction()}
                  </View>
                ) : (
                  <View style={styles.centerContent}>
                    <View style={styles.qrContainer}>
                      <QRCode
                        value={requestCode || ""}
                        size={180}
                        color="#000000"
                        backgroundColor="#FFFFFF"
                      />
                    </View>
                    <Text style={styles.instructionText}>
                      QR 코드를 스캔하여 결제해 주세요
                    </Text>
                    <Text style={styles.subText}>
                      결제가 완료될 때까지 기다려주세요
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.centerContentWrapper}>
                {requestMethod === "STUDENT_ID" && requestCode ? (
                  <View style={styles.centerContent}>
                    <Ionicons
                      name="checkmark-circle"
                      size={56}
                      color={COLORS.success500}
                    />
                    <Text style={styles.successText}>
                      학번 결제가 요청되었습니다
                    </Text>
                    <Text style={styles.subText}>
                      결제가 완료될 때까지 기다려주세요
                    </Text>
                    <View style={styles.studentIdBadge}>
                      <Text style={styles.studentIdBadgeText}>
                        학번: {studentId}
                      </Text>
                    </View>
                  </View>
                ) : errorMessage ? (
                  <View style={styles.centerContent}>
                    <Ionicons
                      name="alert-circle-outline"
                      size={44}
                      color={COLORS.danger500}
                    />
                    <Text style={styles.errorText}>{errorMessage}</Text>
                    {renderErrorAction()}
                  </View>
                ) : (
                  <View style={styles.centerContent}>
                    <Text style={styles.instructionText}>
                      4자리 학번을 입력해주세요
                    </Text>
                    <Text style={styles.subText}>예: 1학년 2반 3번 → 1203</Text>

                    <View style={styles.digitBoxContainer}>
                      {[0, 1, 2, 3].map((index) => (
                        <View
                          key={`digit-${index}`}
                          style={[
                            styles.digitBox,
                            index < studentId.length && styles.digitBoxFilled,
                          ]}
                        >
                          {index < studentId.length && (
                            <Text style={styles.digitText}>
                              {studentId[index]}
                            </Text>
                          )}
                        </View>
                      ))}
                    </View>

                    {renderKeypad()}

                    <TouchableOpacity
                      style={[
                        styles.submitButton,
                        (!validateStudentId(studentId) || isSubmitting) &&
                          styles.disabledButton,
                      ]}
                      onPress={handleStudentIdSubmit}
                      disabled={!validateStudentId(studentId) || isSubmitting}
                      activeOpacity={0.7}
                    >
                      {isSubmitting ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.buttonText}>결제 요청하기</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>

        {/* 오른쪽 패널: 주문 내역 */}
        <View style={styles.rightPanel}>
          <View style={styles.orderHeader}>
            <Text style={styles.orderHeaderText}>주문 내역</Text>
          </View>

          <FlatList
            data={cart}
            renderItem={renderCartItem}
            keyExtractor={(item) => item.id.toString()}
            style={styles.orderList}
            contentContainerStyle={styles.orderListContent}
            showsVerticalScrollIndicator={false}
          />

          <View style={styles.orderFooter}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>총 결제 금액</Text>
              <Text style={styles.totalAmount}>
                {getTotalAmount().toLocaleString()}원
              </Text>
            </View>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancel}
              disabled={isSubmitting}
              activeOpacity={0.7}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={COLORS.danger500} />
              ) : (
                <Text style={styles.cancelText}>결제 취소</Text>
              )}
            </TouchableOpacity>
          </View>
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
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  backButtonText: {
    fontSize: 16,
    fontFamily: "Pretendard-Medium",
    color: COLORS.gray800,
    marginLeft: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "Pretendard-Bold",
    color: COLORS.gray900,
  },
  brandText: {
    color: COLORS.primary500,
  },
  timerWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.gray100,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  timerText: {
    fontSize: 16,
    fontFamily: "Pretendard-Bold",
    color: COLORS.gray800,
    marginLeft: 5,
  },
  timerWarning: {
    color: COLORS.danger500,
  },
  mainContent: {
    flex: 1,
    flexDirection: "row",
    padding: 16,
    gap: 16,
  },
  leftPanel: {
    flex: 3,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 8,
  },
  activeTab: {
    backgroundColor: COLORS.primary50,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary500,
  },
  tabText: {
    fontSize: 15,
    fontFamily: "Pretendard-Medium",
    color: COLORS.gray600,
  },
  activeTabText: {
    color: COLORS.primary500,
    fontFamily: "Pretendard-SemiBold",
  },
  paymentContent: {
    flex: 1,
  },
  centerContentWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  centerContent: {
    alignItems: "center",
    paddingHorizontal: 16,
  },
  qrContainer: {
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    marginBottom: 16,
  },
  instructionText: {
    fontSize: 16,
    fontFamily: "Pretendard-SemiBold",
    color: COLORS.gray900,
    marginBottom: 6,
    textAlign: "center",
  },
  loadingText: {
    fontSize: 15,
    fontFamily: "Pretendard-Medium",
    color: COLORS.gray700,
    marginTop: 12,
  },
  subText: {
    fontSize: 14,
    fontFamily: "Pretendard-Regular",
    color: COLORS.gray600,
    textAlign: "center",
  },
  errorText: {
    fontSize: 15,
    fontFamily: "Pretendard-Medium",
    color: COLORS.danger500,
    textAlign: "center",
    marginVertical: 10,
    marginHorizontal: 12,
  },
  successText: {
    fontSize: 16,
    fontFamily: "Pretendard-SemiBold",
    color: COLORS.gray900,
    marginTop: 12,
    marginBottom: 6,
    textAlign: "center",
  },
  studentIdBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary50,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  studentIdBadgeText: {
    fontSize: 16,
    fontFamily: "Pretendard-SemiBold",
    color: COLORS.primary700,
  },
  digitBoxContainer: {
    flexDirection: "row",
    marginVertical: 16,
    gap: 10,
  },
  digitBox: {
    width: 42,
    height: 52,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.gray300,
    justifyContent: "center",
    alignItems: "center",
  },
  digitBoxFilled: {
    borderBottomColor: COLORS.primary500,
  },
  digitText: {
    fontSize: 26,
    fontFamily: "Pretendard-Bold",
    color: COLORS.gray900,
  },
  keypadContainer: {
    marginBottom: 16,
  },
  keypadRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 8,
    gap: 8,
  },
  keypadButton: {
    width: 52,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.gray50,
    borderRadius: 8,
  },
  keypadActionButton: {
    backgroundColor: COLORS.gray200,
  },
  keypadButtonText: {
    fontSize: 20,
    fontFamily: "Pretendard-Medium",
    color: COLORS.gray900,
  },
  keypadActionText: {
    fontSize: 12,
    fontFamily: "Pretendard-Medium",
    color: COLORS.gray700,
  },
  submitButton: {
    width: 180,
    height: 44,
    backgroundColor: COLORS.primary500,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  disabledButton: {
    backgroundColor: COLORS.gray300,
    opacity: 0.8,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Pretendard-SemiBold",
  },
  rightPanel: {
    flex: 2,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    display: "flex",
    flexDirection: "column",
  },
  orderHeader: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  orderHeaderText: {
    fontSize: 15,
    fontFamily: "Pretendard-SemiBold",
    color: COLORS.gray800,
  },
  orderList: {
    flex: 1,
  },
  orderListContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  orderItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  orderItemName: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Pretendard-Medium",
    color: COLORS.gray800,
    marginRight: 8,
  },
  orderItemDetails: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  orderItemQuantity: {
    fontSize: 14,
    fontFamily: "Pretendard-Regular",
    color: COLORS.gray600,
    textAlign: "right",
    minWidth: 30,
  },
  orderItemPrice: {
    fontSize: 14,
    fontFamily: "Pretendard-SemiBold",
    color: COLORS.gray900,
    textAlign: "right",
    minWidth: 70,
  },
  orderFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontFamily: "Pretendard-SemiBold",
    color: COLORS.gray800,
  },
  totalAmount: {
    fontSize: 20,
    fontFamily: "Pretendard-Bold",
    color: COLORS.primary500,
  },
  cancelButton: {
    height: 44,
    backgroundColor: COLORS.gray50,
    borderWidth: 1,
    borderColor: COLORS.danger100,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelText: {
    fontSize: 15,
    fontFamily: "Pretendard-SemiBold",
    color: COLORS.danger500,
  },
  actionButton: {
    backgroundColor: COLORS.primary500,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
  },
  retryButton: {
    backgroundColor: COLORS.primary500,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
  },
});
