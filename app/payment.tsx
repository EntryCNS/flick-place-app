import { Ionicons } from "@expo/vector-icons";
import { isAxiosError } from "axios";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import Toast from "react-native-toast-message";
import { API_URL } from "../constants/api";
import { COLORS } from "../constants/colors";
import api from "../libs/api";
import { useCartStore } from "../stores/cart";
import { usePaymentStore } from "../stores/payment";

interface CartItemType {
  id: number;
  name: string;
  price: number;
  quantity: number;
}

type PaymentMethod = "QR_CODE" | "STUDENT_ID";

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
  const [studentId, setStudentId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const webSocketRef = useRef<WebSocket | null>(null);
  const inputRef = useRef<TextInput>(null);

  const handleCancel = useCallback(async (): Promise<void> => {
    try {
      setIsSubmitting(true);
      if (orderId) {
        await api.post(`/orders/${orderId}/cancel`);
      }
    } catch (error) {
      let message = "주문 취소 중 오류가 발생했습니다";

      if (isAxiosError(error) && error.response) {
        const errorData = error.response.data;
        if (errorData?.code === "ORDER_NOT_FOUND") {
          message = "주문을 찾을 수 없습니다";
        } else if (errorData?.code === "ORDER_NOT_PENDING") {
          message = "이미 처리된 주문입니다";
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
    let interval: NodeJS.Timeout;

    if (isActive && timer > 0) {
      interval = setInterval(decrementTimer, 1000) as unknown as NodeJS.Timeout;
    } else if (timer <= 0) {
      handleCancel();
    }

    if (status === "COMPLETED") {
      router.replace("/payment-complete");
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, timer, status, decrementTimer, handleCancel, clearCart]);

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
        if (webSocketRef.current?.readyState !== WebSocket.CLOSED) {
          webSocketRef.current?.close();
        }
      };
    }
  }, [requestId, setStatus, handleCancel]);

  useEffect(() => {
    const createQrPaymentRequest = async (): Promise<void> => {
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

        if (isAxiosError(error) && error.response) {
          const errorData = error.response.data;
          code = errorData?.code;

          if (code === "ORDER_NOT_FOUND") {
            errorMsg = "주문을 찾을 수 없습니다";
          } else if (code === "ORDER_NOT_PENDING") {
            errorMsg = "이미 처리된 주문입니다";
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
    (method: PaymentMethod): void => {
      if (selectedMethod !== method) {
        setSelectedMethod(method);
        setErrorMessage(null);
        setErrorCode(null);

        if (method === "STUDENT_ID") {
          setStudentId("");
          setTimeout(() => {
            inputRef.current?.focus();
          }, 100);
        }
      }
    },
    [selectedMethod]
  );

  const validateStudentId = (id: string): boolean => {
    if (id.length !== 4) return false;

    const grade = parseInt(id[0]);
    const room = parseInt(id[1]);
    const number = parseInt(id.substring(2));

    return (
      grade >= 1 &&
      grade <= 9 &&
      room >= 1 &&
      room <= 9 &&
      number >= 1 &&
      number <= 99
    );
  };

  const handleStudentIdSubmit = useCallback(async (): Promise<void> => {
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

      if (isAxiosError(error) && error.response) {
        const errorData = error.response.data;
        code = errorData?.code;

        if (code === "USER_NOT_FOUND") {
          errorMsg = "등록되지 않은 학번입니다";
        } else if (code === "ORDER_NOT_FOUND") {
          errorMsg = "주문을 찾을 수 없습니다";
        } else if (code === "ORDER_NOT_PENDING") {
          errorMsg = "이미 처리된 주문입니다";
        } else if (code === "BOOTH_NOT_FOUND") {
          errorMsg = "부스 정보를 찾을 수 없습니다";
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
  }, [studentId, orderId, setPaymentRequest]);

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
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
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
          >
            <Text style={styles.buttonText}>상품 목록으로 돌아가기</Text>
          </TouchableOpacity>
        );
      default:
        return (
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.buttonText}>다시 시도</Text>
          </TouchableOpacity>
        );
    }
  }, [errorCode, handleRetry]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleCancel}
          disabled={isSubmitting}
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
          <Text style={styles.backButtonText}>돌아가기</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
          <Text style={styles.flickText}>Flick</Text> Place
        </Text>

        <View style={{ width: 80 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingContainer}
      >
        <View style={styles.content}>
          <View style={styles.leftPanel}>
            <View style={styles.topContainer}>
              <View style={styles.timerRow}>
                <View style={styles.timerContainer}>
                  <Ionicons
                    name="time-outline"
                    size={18}
                    color={
                      timer <= 60 ? COLORS.danger500 : COLORS.textSecondary
                    }
                  />
                  <Text
                    style={[
                      styles.timerText,
                      timer <= 60 && styles.timerWarning,
                    ]}
                  >
                    {formatTime(timer)}
                  </Text>
                </View>
              </View>

              <View style={styles.tabContainer}>
                <TouchableOpacity
                  style={[
                    styles.tab,
                    selectedMethod === "QR_CODE" && styles.activeTab,
                  ]}
                  onPress={() => handleMethodChange("QR_CODE")}
                  disabled={isSubmitting}
                >
                  <Ionicons
                    name="qr-code-outline"
                    size={24}
                    color={
                      selectedMethod === "QR_CODE"
                        ? COLORS.primary500
                        : COLORS.textSecondary
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
                >
                  <Ionicons
                    name="school-outline"
                    size={24}
                    color={
                      selectedMethod === "STUDENT_ID"
                        ? COLORS.primary500
                        : COLORS.textSecondary
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
            </View>

            <View style={styles.paymentContent}>
              <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
              >
                {selectedMethod === "QR_CODE" ? (
                  <View style={styles.contentCenter}>
                    {isSubmitting || (!requestCode && !errorMessage) ? (
                      <View style={styles.loadingContainer}>
                        <ActivityIndicator
                          size="large"
                          color={COLORS.primary500}
                        />
                        <Text style={styles.loadingText}>
                          QR 코드 생성 중...
                        </Text>
                      </View>
                    ) : errorMessage ? (
                      <View style={styles.errorContainer}>
                        <Ionicons
                          name="alert-circle-outline"
                          size={48}
                          color={COLORS.danger500}
                        />
                        <Text style={styles.errorText}>{errorMessage}</Text>
                        {renderErrorAction()}
                      </View>
                    ) : (
                      <View style={styles.qrContainer}>
                        <View style={styles.qrCodeWrapper}>
                          <QRCode
                            value={requestCode || ""}
                            size={200}
                            color={COLORS.text}
                            backgroundColor={COLORS.white}
                          />
                        </View>
                        <Text style={styles.instructionText}>
                          QR 코드를 스캔하여 결제를 완료해주세요
                        </Text>
                        <Text style={styles.statusText}>
                          결제가 완료될 때까지 기다려주세요
                        </Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={styles.contentCenter}>
                    {requestMethod === "STUDENT_ID" && requestCode ? (
                      <View style={styles.studentIdStatusContainer}>
                        <Ionicons
                          name="checkmark-circle"
                          size={48}
                          color={COLORS.success500}
                        />
                        <Text style={styles.successText}>
                          학번 결제가 요청되었습니다
                        </Text>
                        <Text style={styles.statusText}>
                          결제가 완료될 때까지 기다려주세요
                        </Text>
                        <View style={styles.studentIdBadge}>
                          <Text style={styles.studentIdText}>
                            학번: {studentId}
                          </Text>
                        </View>
                      </View>
                    ) : errorMessage ? (
                      <View style={styles.errorContainer}>
                        <Ionicons
                          name="alert-circle-outline"
                          size={48}
                          color={COLORS.danger500}
                        />
                        <Text style={styles.errorText}>{errorMessage}</Text>
                        {renderErrorAction()}
                      </View>
                    ) : (
                      <View style={styles.studentIdInputContainer}>
                        <Text style={styles.instructionText}>
                          4자리 학번을 입력해주세요
                        </Text>
                        <Text style={styles.studentIdHelperText}>
                          예: 1학년 2반 3번 → 1203
                        </Text>
                        <TextInput
                          ref={inputRef}
                          style={styles.studentIdInput}
                          placeholder="0000"
                          value={studentId}
                          onChangeText={(text) => {
                            if (/^\d{0,4}$/.test(text)) {
                              setStudentId(text);
                            }
                          }}
                          keyboardType="number-pad"
                          maxLength={4}
                          editable={!isSubmitting}
                          autoFocus
                        />
                        <TouchableOpacity
                          style={[
                            styles.submitButton,
                            (!validateStudentId(studentId) || isSubmitting) &&
                              styles.disabledButton,
                          ]}
                          onPress={handleStudentIdSubmit}
                          disabled={
                            !validateStudentId(studentId) || isSubmitting
                          }
                        >
                          {isSubmitting ? (
                            <ActivityIndicator
                              size="small"
                              color={COLORS.white}
                            />
                          ) : (
                            <Text style={styles.buttonText}>결제 요청하기</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
              </ScrollView>
            </View>

            <View style={styles.footer}>
              <Text style={styles.amountText}>
                {getTotalAmount().toLocaleString()}원
              </Text>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancel}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={COLORS.danger500} />
                ) : (
                  <Text style={styles.cancelButtonText}>결제 취소</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.rightPanel}>
            <Text style={styles.sectionTitle}>주문 내역</Text>

            <FlatList
              data={cart as CartItemType[]}
              renderItem={({ item }) => (
                <View style={styles.orderItem}>
                  <Text style={styles.orderItemName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <View style={styles.orderItemDetails}>
                    <Text style={styles.orderItemQuantity}>
                      {item.quantity}개
                    </Text>
                    <Text style={styles.orderItemPrice}>
                      {(item.price * item.quantity).toLocaleString()}원
                    </Text>
                  </View>
                </View>
              )}
              keyExtractor={(item) => item.id.toString()}
            />

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>총 결제 금액</Text>
              <Text style={styles.totalPrice}>
                {getTotalAmount().toLocaleString()}원
              </Text>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  keyboardAvoidingContainer: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: "500",
    color: COLORS.text,
    marginLeft: 6,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.text,
  },
  flickText: {
    color: COLORS.primary500,
  },
  content: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: COLORS.background,
    padding: 16,
  },
  leftPanel: {
    flex: 6,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginRight: 12,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  topContainer: {
    flexDirection: "column",
  },
  timerRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    padding: 16,
    paddingBottom: 8,
  },
  timerContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.gray100,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  timerText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginLeft: 6,
  },
  timerWarning: {
    color: COLORS.danger500,
  },
  tabContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  activeTab: {
    borderBottomColor: COLORS.primary500,
    backgroundColor: COLORS.primary50,
  },
  tabText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginLeft: 8,
  },
  activeTabText: {
    color: COLORS.primary500,
  },
  paymentContent: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  contentCenter: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    minHeight: 300,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 16,
  },
  qrContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    padding: 16,
  },
  qrCodeWrapper: {
    padding: 20,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: 24,
  },
  instructionText: {
    fontSize: 18,
    color: COLORS.text,
    marginBottom: 12,
    textAlign: "center",
    fontWeight: "600",
  },
  studentIdHelperText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 24,
    textAlign: "center",
  },
  statusText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: "center",
  },
  errorContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  successText: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  errorText: {
    fontSize: 16,
    color: COLORS.danger500,
    textAlign: "center",
    marginVertical: 12,
    maxWidth: 300,
    lineHeight: 22,
  },
  studentIdInputContainer: {
    alignItems: "center",
    width: "100%",
    padding: 20,
  },
  studentIdStatusContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  studentIdInput: {
    width: 200,
    height: 60,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    fontSize: 24,
    fontWeight: "600",
    textAlign: "center",
    color: COLORS.text,
    marginBottom: 32,
    letterSpacing: 8,
  },
  submitButton: {
    width: 220,
    height: 52,
    backgroundColor: COLORS.primary500,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  disabledButton: {
    backgroundColor: COLORS.primary200,
    opacity: 0.7,
  },
  retryButton: {
    backgroundColor: COLORS.primary500,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 16,
  },
  actionButton: {
    backgroundColor: COLORS.primary500,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 16,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
  },
  studentIdBadge: {
    backgroundColor: COLORS.primary100,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 24,
  },
  studentIdText: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.primary700,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    padding: 20,
    alignItems: "center",
  },
  amountText: {
    fontSize: 26,
    fontWeight: "700",
    color: COLORS.primary500,
    marginBottom: 16,
  },
  cancelButton: {
    width: "100%",
    maxWidth: 400,
    height: 52,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  cancelButtonText: {
    color: COLORS.danger500,
    fontSize: 16,
    fontWeight: "600",
  },
  rightPanel: {
    flex: 4,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 16,
  },
  orderItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  orderItemName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    color: COLORS.text,
    marginRight: 12,
  },
  orderItemDetails: {
    flexDirection: "row",
    alignItems: "center",
  },
  orderItemQuantity: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginRight: 16,
    minWidth: 32,
    textAlign: "right",
  },
  orderItemPrice: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    minWidth: 90,
    textAlign: "right",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
  },
  totalPrice: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.primary500,
  },
});
