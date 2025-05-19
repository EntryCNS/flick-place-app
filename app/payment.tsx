import { Ionicons } from "@expo/vector-icons";
import { isAxiosError } from "axios";
import { router } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { API_URL } from "@/constants/api";
import { COLORS } from "@/constants/colors";
import api from "@/libs/api";
import { useCartStore } from "@/stores/cart";
import { usePaymentStore } from "@/stores/payment";
import { useMutation } from "@tanstack/react-query";

interface CartItemType {
  id: number;
  name: string;
  price: number;
  quantity: number;
}

type PaymentMethod = "QR_CODE" | "STUDENT_ID";
type WebSocketStatus = "CONNECTING" | "CONNECTED" | "DISCONNECTED" | "FAILED";

interface NotificationType {
  type: "success" | "error" | "info";
  message: string;
  submessage?: string;
}

const ERROR_MESSAGES = {
  ORDER_NOT_FOUND: "주문을 찾을 수 없습니다",
  ORDER_NOT_PENDING: "이미 처리된 주문입니다",
  USER_NOT_FOUND: "등록되지 않은 학번입니다",
  BOOTH_NOT_FOUND: "부스 정보를 찾을 수 없습니다",
};

const NOTIFICATION_DURATION = 3000;
const WS_RECONNECT_DELAY = 3000;
const MAX_RECONNECT_ATTEMPTS = 3;

export default function PaymentScreen() {
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
    resetPaymentRequest,
  } = usePaymentStore();

  const [selectedMethod, setSelectedMethod] =
    useState<PaymentMethod>("QR_CODE");
  const [studentId, setStudentId] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [notification, setNotification] = useState<NotificationType | null>(
    null
  );
  const [wsStatus, setWsStatus] = useState<WebSocketStatus>("DISCONNECTED");

  const wsReconnectAttemptsRef = useRef<number>(0);
  const timerAnimValue = useRef(new Animated.Value(1)).current;
  const webSocketRef = useRef<WebSocket | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notificationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const wsReconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const cancelOrderMutation = useMutation({
    mutationFn: async () => {
      if (orderId) {
        return await api.post(`/orders/${orderId}/cancel`);
      }
      return null;
    },
    onError: (error) => {
      let message = "주문 취소 중 오류가 발생했습니다";

      if (isAxiosError(error) && error.response?.data) {
        const errorData = error.response.data;
        if (
          errorData?.code &&
          ERROR_MESSAGES[errorData.code as keyof typeof ERROR_MESSAGES]
        ) {
          message =
            ERROR_MESSAGES[errorData.code as keyof typeof ERROR_MESSAGES];
        }
      }

      showNotification("error", message);
    },
    onSettled: () => {
      cancelPayment();
      clearCart();
      router.replace("/products");
    },
  });

  const qrPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!orderId) throw new Error("주문 정보가 없습니다");
      const response = await api.post("/payments/qr", { orderId });
      return response.data;
    },
    onSuccess: (data) => {
      setPaymentRequest(
        data.id,
        data.token || "",
        "PENDING",
        "QR_CODE",
        data.expiresAt || new Date(Date.now() + 15 * 60 * 1000).toISOString()
      );
    },
    onError: (error) => {
      let errorMsg = "결제 요청을 생성할 수 없습니다";
      let code = null;

      if (isAxiosError(error) && error.response?.data) {
        const errorData = error.response.data;
        code = errorData?.code;

        if (code && ERROR_MESSAGES[code as keyof typeof ERROR_MESSAGES]) {
          errorMsg = ERROR_MESSAGES[code as keyof typeof ERROR_MESSAGES];
        }
      }

      setErrorCode(code);
      setErrorMessage(errorMsg);
      showNotification("error", errorMsg);
    },
  });

  const studentIdPaymentMutation = useMutation({
    mutationFn: async (studentIdValue: string) => {
      if (!orderId) throw new Error("주문 정보가 없습니다");
      const response = await api.post("/payments/student-id", {
        orderId,
        studentId: studentIdValue.trim(),
      });
      return response.data;
    },
    onSuccess: (data) => {
      setPaymentRequest(
        data.id,
        data.token || studentId,
        "PENDING",
        "STUDENT_ID",
        data.expiresAt || new Date(Date.now() + 15 * 60 * 1000).toISOString()
      );

      showNotification("success", "학번 결제 요청 완료");
    },
    onError: (error) => {
      let errorMsg = "결제 요청에 실패했습니다";
      let code = null;

      if (isAxiosError(error) && error.response?.data) {
        const errorData = error.response.data;
        code = errorData?.code;

        if (code && ERROR_MESSAGES[code as keyof typeof ERROR_MESSAGES]) {
          errorMsg = ERROR_MESSAGES[code as keyof typeof ERROR_MESSAGES];
        }
      }

      setErrorCode(code);
      setErrorMessage(errorMsg);
      showNotification("error", errorMsg);
    },
  });

  const showNotification = useCallback(
    (
      type: "success" | "error" | "info",
      message: string,
      submessage?: string
    ) => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }

      setNotification({ type, message, submessage });

      notificationTimeoutRef.current = setTimeout(() => {
        setNotification(null);
      }, NOTIFICATION_DURATION);
    },
    []
  );

  useEffect(() => {
    return () => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (wsReconnectTimeoutRef.current) {
        clearTimeout(wsReconnectTimeoutRef.current);
      }
      if (webSocketRef.current) {
        webSocketRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    const shouldAnimate = timer <= 60;

    if (shouldAnimate) {
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

    return () => {
      timerAnimValue.stopAnimation();
    };
  }, [timer, timerAnimValue]);

  const handleCancel = useCallback(() => {
    cancelOrderMutation.mutate();
  }, [cancelOrderMutation]);

  useEffect(() => {
    if (isActive && timer > 0) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      timerIntervalRef.current = setInterval(decrementTimer, 1000);
    } else if (timer <= 0 && isActive) {
      handleCancel();
    }

    if (status === "COMPLETED") {
      router.replace("/payment-complete");
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [isActive, timer, status, decrementTimer, handleCancel]);

  const connectWebSocket = useCallback(() => {
    if (!requestId) return;

    if (wsStatus === "CONNECTING" || wsStatus === "CONNECTED") return;

    setWsStatus("CONNECTING");

    const wsUrl = `${API_URL.replace(
      "http",
      "ws"
    )}/ws/payment-requests/${requestId}`;

    try {
      if (
        webSocketRef.current &&
        webSocketRef.current.readyState !== WebSocket.CLOSED
      ) {
        webSocketRef.current.close();
      }

      const ws = new WebSocket(wsUrl);
      webSocketRef.current = ws;

      ws.onopen = () => {
        setWsStatus("CONNECTED");
        wsReconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.status === "COMPLETED") {
            setStatus("COMPLETED");
          } else if (data.status === "FAILED") {
            setStatus("FAILED");
            showNotification(
              "error",
              "결제 실패",
              data.message || "결제가 실패했습니다."
            );
          } else if (data.status === "EXPIRED") {
            setStatus("EXPIRED");
            showNotification("error", "결제 시간이 초과되었습니다.");
            handleCancel();
          }
        } catch {
          console.error("웹소켓 메시지 처리 실패");
        }
      };

      ws.onerror = () => {
        setWsStatus("FAILED");
      };

      ws.onclose = (event) => {
        if (!event.wasClean) {
          setWsStatus("DISCONNECTED");

          if (
            wsReconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS &&
            requestId
          ) {
            const delay = Math.min(
              WS_RECONNECT_DELAY * (wsReconnectAttemptsRef.current + 1),
              10000
            );

            if (wsReconnectTimeoutRef.current) {
              clearTimeout(wsReconnectTimeoutRef.current);
            }

            wsReconnectTimeoutRef.current = setTimeout(() => {
              wsReconnectAttemptsRef.current += 1;
              connectWebSocket();
            }, delay);
          } else {
            setWsStatus("FAILED");
          }
        }
      };
    } catch {
      setWsStatus("FAILED");
    }
  }, [requestId, showNotification, setStatus, handleCancel, wsStatus]);

  useEffect(() => {
    let shouldConnect = false;

    if (requestId && wsStatus !== "CONNECTED") {
      shouldConnect = true;
    } else if (!requestId) {
      setWsStatus("DISCONNECTED");

      if (webSocketRef.current) {
        webSocketRef.current.close();
      }

      if (wsReconnectTimeoutRef.current) {
        clearTimeout(wsReconnectTimeoutRef.current);
      }
    }

    if (shouldConnect) {
      const timeoutId = setTimeout(() => {
        connectWebSocket();
      }, 0);

      return () => clearTimeout(timeoutId);
    }
  }, [requestId, connectWebSocket, wsStatus]);

  const handleReconnectWebSocket = useCallback(() => {
    wsReconnectAttemptsRef.current = 0;
    connectWebSocket();
  }, [connectWebSocket]);

  const createQrPaymentRequest = useCallback(() => {
    qrPaymentMutation.mutate();
  }, [qrPaymentMutation]);

  useEffect(() => {
    if (
      selectedMethod === "QR_CODE" &&
      orderId &&
      !requestCode &&
      !qrPaymentMutation.isPending
    ) {
      createQrPaymentRequest();
    }
  }, [
    selectedMethod,
    orderId,
    requestCode,
    createQrPaymentRequest,
    qrPaymentMutation.isPending,
  ]);

  const handleMethodChange = useCallback(
    (method: PaymentMethod) => {
      if (
        selectedMethod !== method &&
        !qrPaymentMutation.isPending &&
        !studentIdPaymentMutation.isPending
      ) {
        setSelectedMethod(method);
        setErrorMessage(null);
        setErrorCode(null);

        resetPaymentRequest();

        if (method === "STUDENT_ID") {
          setStudentId("");
        }
      }
    },
    [
      selectedMethod,
      resetPaymentRequest,
      qrPaymentMutation.isPending,
      studentIdPaymentMutation.isPending,
    ]
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

  const handleStudentIdSubmit = useCallback(() => {
    if (!validateStudentId(studentId)) {
      showNotification("info", "올바른 학번 형식이 아닙니다");
      return;
    }

    studentIdPaymentMutation.mutate(studentId);
  }, [
    studentId,
    validateStudentId,
    showNotification,
    studentIdPaymentMutation,
  ]);

  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }, []);

  const handleRetry = useCallback(() => {
    resetPaymentRequest();
    setErrorMessage(null);
    setErrorCode(null);

    if (selectedMethod === "STUDENT_ID") {
      setStudentId("");
    }
  }, [selectedMethod, resetPaymentRequest]);

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

  const keypadButtons = useMemo(() => {
    return [
      ["1", "2", "3"],
      ["4", "5", "6"],
      ["7", "8", "9"],
      ["clear", "0", "delete"],
    ];
  }, []);

  const renderKeypadButton = useCallback(
    (key: string, index: number) => (
      <TouchableOpacity
        key={`key-${key}-${index}`}
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
          <Text style={styles.keypadActionText}>←</Text>
        ) : key === "clear" ? (
          <Text style={styles.keypadActionText}>C</Text>
        ) : (
          <Text style={styles.keypadButtonText}>{key}</Text>
        )}
      </TouchableOpacity>
    ),
    [handleKeypadPress]
  );

  const renderKeypad = useCallback(() => {
    return (
      <View style={styles.keypadContainer}>
        {keypadButtons.map((row, rowIndex) => (
          <View key={`row-${rowIndex}`} style={styles.keypadRow}>
            {row.map((key, keyIndex) => renderKeypadButton(key, keyIndex))}
          </View>
        ))}
      </View>
    );
  }, [keypadButtons, renderKeypadButton]);

  const renderNotification = useCallback(() => {
    if (!notification) return null;

    const getNotificationStyle = () => {
      switch (notification.type) {
        case "success":
          return styles.notificationSuccess;
        case "error":
          return styles.notificationError;
        case "info":
          return styles.notificationInfo;
        default:
          return {};
      }
    };

    const getNotificationIcon = () => {
      switch (notification.type) {
        case "success":
          return (
            <Ionicons
              name="checkmark-circle"
              size={24}
              color={COLORS.success500}
            />
          );
        case "error":
          return (
            <Ionicons name="alert-circle" size={24} color={COLORS.danger500} />
          );
        case "info":
          return (
            <Ionicons
              name="information-circle"
              size={24}
              color={COLORS.primary500}
            />
          );
        default:
          return null;
      }
    };

    return (
      <Animated.View
        style={[styles.notificationContainer, getNotificationStyle()]}
      >
        {getNotificationIcon()}
        <View style={styles.notificationContent}>
          <Text style={styles.notificationText}>{notification.message}</Text>
          {notification.submessage && (
            <Text style={styles.notificationSubText}>
              {notification.submessage}
            </Text>
          )}
        </View>
        <TouchableOpacity
          onPress={() => setNotification(null)}
          style={styles.notificationCloseButton}
        >
          <Text style={styles.notificationCloseText}>×</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }, [notification]);

  const getWsStatusColor = useCallback(() => {
    switch (wsStatus) {
      case "CONNECTED":
        return COLORS.success500;
      case "CONNECTING":
        return COLORS.warning500;
      case "DISCONNECTED":
      case "FAILED":
        return COLORS.danger500;
      default:
        return COLORS.gray500;
    }
  }, [wsStatus]);

  const isSubmitting =
    qrPaymentMutation.isPending ||
    studentIdPaymentMutation.isPending ||
    cancelOrderMutation.isPending;

  const renderQRPaymentContent = useCallback(() => {
    if (qrPaymentMutation.isPending || (!requestCode && !errorMessage)) {
      return (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={COLORS.primary500} />
          <Text style={styles.loadingText}>QR 코드 생성 중...</Text>
        </View>
      );
    }

    if (errorMessage) {
      return (
        <View style={styles.centerContent}>
          <Ionicons name="alert-circle" size={44} color={COLORS.danger500} />
          <Text style={styles.errorText}>{errorMessage}</Text>
          {renderErrorAction()}
        </View>
      );
    }

    return (
      <View style={styles.centerContent}>
        <View style={styles.qrContainer}>
          <QRCode
            value={requestCode || ""}
            size={200}
            color="#000000"
            backgroundColor="#FFFFFF"
          />
        </View>
        <Text style={styles.instructionText}>
          QR 코드를 스캔하여 결제해 주세요
        </Text>
        <Text style={styles.subText}>결제가 완료될 때까지 기다려주세요</Text>
      </View>
    );
  }, [
    qrPaymentMutation.isPending,
    requestCode,
    errorMessage,
    renderErrorAction,
  ]);

  const renderStudentIdPaymentContent = useCallback(() => {
    if (requestMethod === "STUDENT_ID" && requestCode) {
      return (
        <View style={styles.centerContent}>
          <Ionicons
            name="checkmark-circle"
            size={56}
            color={COLORS.success500}
          />
          <Text style={styles.successText}>학번 결제가 요청되었습니다</Text>
          <Text style={styles.subText}>결제가 완료될 때까지 기다려주세요</Text>

          <View style={styles.studentNumberContainer}>
            <View style={styles.studentNumberDigits}>
              {studentId.split("").map((digit, index) => (
                <View key={index} style={styles.studentNumberDigitBox}>
                  <Text style={styles.studentNumberDigit}>{digit}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={handleRetry}
              disabled={isSubmitting}
              activeOpacity={0.7}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>다시 요청하기</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (errorMessage) {
      return (
        <View style={styles.centerContent}>
          <Ionicons name="alert-circle" size={44} color={COLORS.danger500} />
          <Text style={styles.errorText}>{errorMessage}</Text>
          {renderErrorAction()}
        </View>
      );
    }

    return (
      <View style={styles.centerContent}>
        <Text style={styles.instructionText}>4자리 학번을 입력해주세요</Text>

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
                <Text style={styles.digitText}>{studentId[index]}</Text>
              )}
            </View>
          ))}
        </View>

        {renderKeypad()}

        <TouchableOpacity
          style={[
            styles.submitButton,
            (!validateStudentId(studentId) ||
              studentIdPaymentMutation.isPending) &&
              styles.disabledButton,
          ]}
          onPress={handleStudentIdSubmit}
          disabled={
            !validateStudentId(studentId) || studentIdPaymentMutation.isPending
          }
          activeOpacity={0.7}
        >
          {studentIdPaymentMutation.isPending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>결제 요청하기</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }, [
    requestMethod,
    requestCode,
    studentId,
    errorMessage,
    isSubmitting,
    validateStudentId,
    studentIdPaymentMutation.isPending,
    handleRetry,
    handleStudentIdSubmit,
    renderErrorAction,
    renderKeypad,
  ]);

  return (
    <SafeAreaView style={styles.container}>
      {renderNotification()}

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.push("/products")}
          disabled={isSubmitting}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.gray800} />
          <Text style={styles.backButtonText}>돌아가기</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
          <Text style={styles.brandText}>Flick</Text> Place
        </Text>

        <View style={styles.headerRightContainer}>
          <TouchableOpacity
            style={[
              styles.wsStatusIndicator,
              { backgroundColor: getWsStatusColor() },
            ]}
            onPress={
              wsStatus === "FAILED" ? handleReconnectWebSocket : undefined
            }
          />
          <Animated.View
            style={[styles.timerWrapper, { opacity: timerAnimValue }]}
          >
            <Ionicons
              name="time-outline"
              size={22}
              color={timer <= 60 ? COLORS.danger500 : COLORS.gray700}
            />
            <Text
              style={[styles.timerText, timer <= 60 && styles.timerWarning]}
            >
              {formatTime(timer)}
            </Text>
          </Animated.View>
        </View>
      </View>

      <View style={styles.mainContent}>
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
            <View style={styles.centerContentWrapper}>
              {selectedMethod === "QR_CODE"
                ? renderQRPaymentContent()
                : renderStudentIdPaymentContent()}
            </View>
          </View>
        </View>

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
              {cancelOrderMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.cancelButtonText}>결제 취소</Text>
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
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
    height: 60,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
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
  headerRightContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  wsStatusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
    fontSize: 15,
    fontFamily: "Pretendard-Bold",
    color: COLORS.gray800,
    marginLeft: 6,
  },
  timerWarning: {
    color: COLORS.danger500,
  },
  mainContent: {
    flex: 1,
    flexDirection: "row",
    padding: 20,
    gap: 20,
  },
  leftPanel: {
    flex: 3,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
    height: 52,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
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
    padding: 20,
  },
  centerContentWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  centerContent: {
    alignItems: "center",
    width: "100%",
    maxWidth: 320,
  },
  qrContainer: {
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    marginBottom: 20,
  },
  instructionText: {
    fontSize: 17,
    fontFamily: "Pretendard-SemiBold",
    color: COLORS.gray900,
    marginBottom: 12,
    textAlign: "center",
  },
  loadingText: {
    fontSize: 15,
    fontFamily: "Pretendard-Medium",
    color: COLORS.gray700,
    marginTop: 16,
  },
  subText: {
    fontSize: 14,
    fontFamily: "Pretendard-Regular",
    color: COLORS.gray600,
    textAlign: "center",
    marginBottom: 20,
  },
  errorText: {
    fontSize: 15,
    fontFamily: "Pretendard-Medium",
    color: COLORS.danger500,
    textAlign: "center",
    marginVertical: 14,
    marginHorizontal: 16,
  },
  successText: {
    fontSize: 17,
    fontFamily: "Pretendard-SemiBold",
    color: COLORS.gray900,
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  studentNumberContainer: {
    marginTop: 16,
    marginBottom: 24,
    alignItems: "center",
  },
  studentNumberDigits: {
    flexDirection: "row",
    gap: 12,
  },
  studentNumberDigitBox: {
    width: 44,
    height: 52,
    backgroundColor: COLORS.primary50,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  studentNumberDigit: {
    fontSize: 22,
    fontFamily: "Pretendard-Bold",
    color: COLORS.primary700,
  },
  digitBoxContainer: {
    flexDirection: "row",
    marginVertical: 18,
    gap: 14,
  },
  digitBox: {
    width: 44,
    height: 56,
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
    marginBottom: 20,
  },
  keypadRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 10,
    gap: 14,
  },
  keypadButton: {
    width: 56,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.gray50,
    borderRadius: 10,
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
    fontSize: 20,
    fontFamily: "Pretendard-Medium",
    color: COLORS.gray700,
  },
  buttonsContainer: {
    alignItems: "center",
    width: "100%",
  },
  submitButton: {
    width: 220,
    height: 48,
    backgroundColor: COLORS.primary500,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    display: "flex",
    flexDirection: "column",
    height: "100%",
  },
  orderHeader: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
    height: 52,
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
    paddingHorizontal: 20,
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
    marginRight: 10,
  },
  orderItemDetails: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  orderItemQuantity: {
    fontSize: 14,
    fontFamily: "Pretendard-Regular",
    color: COLORS.gray600,
    textAlign: "right",
    minWidth: 28,
  },
  orderItemPrice: {
    fontSize: 14,
    fontFamily: "Pretendard-SemiBold",
    color: COLORS.gray900,
    textAlign: "right",
    minWidth: 76,
  },
  orderFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 15,
    fontFamily: "Pretendard-SemiBold",
    color: COLORS.gray800,
  },
  totalAmount: {
    fontSize: 20,
    fontFamily: "Pretendard-Bold",
    color: COLORS.primary500,
  },
  cancelButton: {
    height: 48,
    backgroundColor: COLORS.danger500,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 15,
    fontFamily: "Pretendard-SemiBold",
    color: "#FFFFFF",
  },
  actionButton: {
    backgroundColor: COLORS.primary500,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 14,
  },
  retryButton: {
    backgroundColor: COLORS.primary500,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    minWidth: 150,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationContainer: {
    position: "absolute",
    top: 16,
    left: "50%",
    marginLeft: -160,
    width: 320,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    zIndex: 1000,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  notificationSuccess: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.success500,
  },
  notificationError: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.danger500,
  },
  notificationInfo: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary500,
  },
  notificationContent: {
    flex: 1,
    marginLeft: 10,
  },
  notificationText: {
    fontSize: 14,
    fontFamily: "Pretendard-SemiBold",
    color: COLORS.gray900,
  },
  notificationSubText: {
    fontSize: 12,
    fontFamily: "Pretendard-Regular",
    color: COLORS.gray600,
    marginTop: 2,
  },
  notificationCloseButton: {
    width: 26,
    height: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  notificationCloseText: {
    fontSize: 22,
    fontFamily: "Pretendard-Medium",
    color: COLORS.gray600,
    lineHeight: 26,
  },
});
