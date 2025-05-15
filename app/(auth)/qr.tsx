import { COLORS } from "@/constants/colors";
import { API_URL } from "@/constants/api";
import { useAuthStore } from "@/stores/auth";
import axios, { isAxiosError } from "axios";
import {
  BarcodeScanningResult,
  CameraView,
  useCameraPermissions,
} from "expo-camera";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

interface JwtPayload {
  accessToken: string;
}

interface ErrorResponse {
  code: string;
  status: number;
  message: string;
}

const ERROR_MESSAGES: Record<string, string> = {
  BOOTH_NOT_FOUND: "부스를 찾을 수 없습니다",
  BOOTH_NOT_APPROVED: "승인된 부스가 아닙니다",
  BOOTH_REJECTED: "거절된 부스입니다",
  BOOTH_INACTIVE: "금지된 부스입니다",
};

export default function QrScannerScreen() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const { login } = useAuthStore();
  const isMounted = useRef(true);
  const hasScanned = useRef(false);

  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const alertOpacity = useRef(new Animated.Value(0)).current;
  const alertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () =>
      isProcessing ? true : false
    );

    return () => {
      isMounted.current = false;
      backHandler.remove();
    };
  }, [isProcessing]);

  useEffect(() => {
    return () => {
      const timerToClean = alertTimerRef.current;
      if (timerToClean !== null) {
        clearTimeout(timerToClean);
      }
    };
  }, []);

  const showAlert = useCallback(
    (message: string) => {
      if (!isMounted.current) return;

      if (alertTimerRef.current !== null) {
        clearTimeout(alertTimerRef.current);
        alertTimerRef.current = null;
      }

      setAlertMessage(message);
      setAlertVisible(true);

      alertOpacity.setValue(0);

      Animated.sequence([
        Animated.timing(alertOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.delay(3000),
        Animated.timing(alertOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        if (isMounted.current) {
          setAlertVisible(false);
        }
      });
    },
    [alertOpacity]
  );

  const goBack = useCallback(() => {
    if (isProcessing) return;
    router.back();
  }, [isProcessing]);

  const handleBarCodeScanned = useCallback(
    async ({ data }: BarcodeScanningResult) => {
      if (isProcessing || !isMounted.current || hasScanned.current) return;

      hasScanned.current = true;

      try {
        setIsProcessing(true);

        if (!data || data.trim() === "") {
          throw new Error("유효하지 않은 QR 코드입니다");
        }

        const response = await axios.post<JwtPayload>(
          `${API_URL}/kiosks/register`,
          {
            registrationToken: data.trim(),
          }
        );

        if (!isMounted.current) return;

        if (response.data?.accessToken) {
          await login(response.data.accessToken);
          router.replace("/products");
        } else {
          throw new Error("등록에 실패했습니다");
        }
      } catch (error) {
        if (!isMounted.current) return;

        let errorMessage = "키오스크 등록에 실패했습니다";

        if (isAxiosError(error) && error.response?.data) {
          const errorData = error.response.data as ErrorResponse;
          if (errorData.code && ERROR_MESSAGES[errorData.code]) {
            errorMessage = ERROR_MESSAGES[errorData.code];
          }
        } else if (error instanceof Error) {
          errorMessage = error.message;
        }

        showAlert(errorMessage);
        alertTimerRef.current = setTimeout(() => {
          if (isMounted.current) {
            hasScanned.current = false;
          }
        }, 3000);
      } finally {
        if (isMounted.current) {
          setIsProcessing(false);
        }
      }
    },
    [isProcessing, login, showAlert]
  );

  if (!permission) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerContainer}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={goBack}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>QR 코드 스캔</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary600} />
          <Text style={styles.loadingText}>
            카메라 권한을 확인하는 중입니다...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    const isBlocked = permission && !permission.canAskAgain;

    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerContainer}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={goBack}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>QR 코드 스캔</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionTitle}>카메라 권한이 필요합니다</Text>
          <Text style={styles.permissionSubtitle}>
            QR 코드를 스캔하려면 카메라 접근 권한이 필요합니다
          </Text>
          {isBlocked ? (
            <TouchableOpacity
              style={styles.permissionButton}
              onPress={goBack}
              activeOpacity={0.7}
            >
              <Text style={styles.permissionButtonText}>돌아가기</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.permissionButton}
              onPress={requestPermission}
              activeOpacity={0.7}
            >
              <Text style={styles.permissionButtonText}>권한 요청하기</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
        onBarcodeScanned={
          isProcessing || hasScanned.current ? undefined : handleBarCodeScanned
        }
      >
        <SafeAreaView style={styles.scanAreaContainer}>
          <View style={styles.headerContainer}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={goBack}
              disabled={isProcessing}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={24} color={COLORS.white} />
            </TouchableOpacity>
            <Text style={styles.scanHeaderTitle}>QR 코드 스캔</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.scanOverlay}>
            <View style={styles.scannerBox}>
              <View style={[styles.scannerCorner, styles.topLeft]} />
              <View style={[styles.scannerCorner, styles.topRight]} />
              <View style={[styles.scannerCorner, styles.bottomLeft]} />
              <View style={[styles.scannerCorner, styles.bottomRight]} />
            </View>
            <Text style={styles.scanText}>
              QR 코드를 프레임 안에 위치시켜주세요
            </Text>

            {isProcessing && (
              <View style={styles.processingContainer}>
                <ActivityIndicator size="large" color={COLORS.white} />
                <Text style={styles.processingText}>처리 중...</Text>
              </View>
            )}
          </View>
        </SafeAreaView>
      </CameraView>

      {alertVisible && (
        <Animated.View style={[styles.alert, { opacity: alertOpacity }]}>
          <View style={styles.alertContent}>
            <Ionicons name="alert-circle" size={24} color={COLORS.danger500} />
            <Text style={styles.alertText}>{alertMessage}</Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Pretendard-SemiBold",
    color: COLORS.text,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
    color: COLORS.text,
    textAlign: "center",
    fontFamily: "Pretendard-Medium",
  },
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  permissionTitle: {
    fontSize: 22,
    fontFamily: "Pretendard-Bold",
    color: COLORS.text,
    marginBottom: 12,
    textAlign: "center",
  },
  permissionSubtitle: {
    fontSize: 15,
    fontFamily: "Pretendard-Medium",
    color: COLORS.textSecondary,
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 22,
  },
  permissionButton: {
    backgroundColor: COLORS.primary600,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 200,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  permissionButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontFamily: "Pretendard-SemiBold",
  },
  camera: {
    flex: 1,
  },
  scanAreaContainer: {
    flex: 1,
  },
  scanHeaderTitle: {
    fontSize: 18,
    fontFamily: "Pretendard-SemiBold",
    color: COLORS.white,
  },
  scanOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scannerBox: {
    width: 280,
    height: 280,
    borderRadius: 24,
    backgroundColor: "transparent",
    position: "relative",
  },
  scannerCorner: {
    position: "absolute",
    width: 30,
    height: 30,
    borderColor: COLORS.white,
    borderWidth: 4,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderBottomWidth: 0,
    borderRightWidth: 0,
    borderTopLeftRadius: 24,
  },
  topRight: {
    top: 0,
    right: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderTopRightRadius: 24,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomLeftRadius: 24,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderBottomRightRadius: 24,
  },
  scanText: {
    color: COLORS.white,
    fontSize: 18,
    fontFamily: "Pretendard-Medium",
    marginTop: 24,
    textAlign: "center",
  },
  processingContainer: {
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    padding: 24,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
    minWidth: 160,
    elevation: 5,
  },
  processingText: {
    color: COLORS.white,
    marginTop: 12,
    fontSize: 16,
    fontFamily: "Pretendard-Medium",
  },
  alert: {
    position: "absolute",
    top: 60,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 16,
    zIndex: 1000,
  },
  alertContent: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    maxWidth: 500,
  },
  alertText: {
    marginLeft: 12,
    fontSize: 16,
    fontFamily: "Pretendard-Medium",
    color: COLORS.text,
    flex: 1,
  },
});
