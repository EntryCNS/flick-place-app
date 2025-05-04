import { COLORS } from "@/constants/colors";
import api from "@/libs/api";
import { useAuthStore } from "@/stores/auth";
import { isAxiosError } from "axios";
import {
  BarcodeScanningResult,
  CameraView,
  useCameraPermissions,
} from "expo-camera";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Toast from "react-native-toast-message";

interface JwtPayload {
  accessToken: string;
}

interface ErrorResponse {
  code: string;
  status: number;
  message: string;
}

const Registration = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const { login } = useAuthStore();
  const isMounted = useRef(true);

  const startScanning = () => {
    setIsScanning(true);
  };

  const stopScanning = () => {
    setIsScanning(false);
  };

  const handleBarCodeScanned = async ({ data }: BarcodeScanningResult) => {
    if (isProcessing) return;

    try {
      setIsProcessing(true);

      if (!data || data.trim() === "") {
        throw new Error("유효하지 않은 QR 코드입니다");
      }

      const response = await api.post<JwtPayload>("/kiosks/register", {
        registrationToken: data,
      });

      if (response.data && response.data.accessToken) {
        login(response.data.accessToken);
        router.replace("/products");
      } else {
        throw new Error("등록에 실패했습니다");
      }
    } catch (error) {
      let errorMessage = "키오스크 등록에 실패했습니다";

      if (isAxiosError(error)) {
        if (error.response) {
          const errorData = error.response.data as ErrorResponse;

          if (errorData?.code) {
            switch (errorData.code) {
              case "BOOTH_NOT_FOUND":
                errorMessage = "부스를 찾을 수 없습니다";
                break;
              default:
                errorMessage =
                  errorData.message || "키오스크 등록에 실패했습니다";
                break;
            }
          }
        } else if (error.request) {
          errorMessage = "네트워크 연결을 확인해주세요";
        }
      }

      stopScanning();

      if (isMounted.current) {
        Toast.show({
          type: "error",
          text1: errorMessage,
          position: "top",
          visibilityTime: 3000,
        });
      }
    } finally {
      if (isMounted.current) {
        setIsProcessing(false);
      }
    }
  };

  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary500} />
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionTitle}>카메라 권한이 필요합니다</Text>
          <Text style={styles.permissionSubtitle}>
            QR 코드를 스캔하려면 카메라 접근 권한이 필요합니다
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestPermission}
          >
            <Text style={styles.permissionButtonText}>권한 요청하기</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {isScanning ? (
        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ["qr"],
            }}
            onBarcodeScanned={isProcessing ? undefined : handleBarCodeScanned}
          >
            <View style={styles.scanOverlay}>
              <View style={styles.scannerBox}>
                <View style={[styles.scannerCorner, styles.topLeft]} />
                <View style={[styles.scannerCorner, styles.topRight]} />
                <View style={[styles.scannerCorner, styles.bottomLeft]} />
                <View style={[styles.scannerCorner, styles.bottomRight]} />
              </View>
              <Text style={styles.scanText}>QR 코드를 스캔하세요</Text>

              {isProcessing && (
                <View style={styles.processingContainer}>
                  <ActivityIndicator size="large" color={COLORS.white} />
                  <Text style={styles.processingText}>처리 중...</Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={stopScanning}
                disabled={isProcessing}
              >
                <Text style={styles.cancelButtonText}>취소</Text>
              </TouchableOpacity>
            </View>
          </CameraView>
        </View>
      ) : (
        <View style={styles.welcomeContainer}>
          <View style={styles.logoContainer}>
            <Image
              source={require("@/assets/images/logo.png")}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={styles.logoText}>
              <Text style={styles.highlightText}>Flick</Text> Place
            </Text>
          </View>

          <View style={styles.contentContainer}>
            <Text style={styles.welcomeTitle}>키오스크 등록</Text>
            <Text style={styles.welcomeSubtitle}>
              웹 관리자 페이지에서 생성한 QR 코드를 스캔하여 이 기기를
              키오스크로 등록하세요
            </Text>

            <TouchableOpacity style={styles.scanButton} onPress={startScanning}>
              <Text style={styles.scanButtonText}>QR 코드 스캔하기</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 12,
    textAlign: "center",
  },
  permissionSubtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 22,
  },
  permissionButton: {
    backgroundColor: COLORS.primary500,
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 200,
  },
  permissionButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
  },
  welcomeContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 40,
  },
  logoImage: {
    width: 36,
    height: 36,
    marginRight: 10,
  },
  logoText: {
    fontSize: 26,
    fontWeight: "700",
    color: COLORS.text,
  },
  highlightText: {
    color: COLORS.primary500,
    fontWeight: "700",
  },
  contentContainer: {
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 10,
    textAlign: "center",
  },
  welcomeSubtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 22,
  },
  scanButton: {
    backgroundColor: COLORS.primary500,
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    height: 54,
    width: "100%",
  },
  scanButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  scanOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  scannerBox: {
    width: 250,
    height: 250,
    borderRadius: 16,
    backgroundColor: "transparent",
    position: "relative",
  },
  scannerCorner: {
    position: "absolute",
    width: 20,
    height: 20,
    borderColor: COLORS.white,
    borderWidth: 3,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderBottomWidth: 0,
    borderRightWidth: 0,
    borderTopLeftRadius: 16,
  },
  topRight: {
    top: 0,
    right: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderTopRightRadius: 16,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomLeftRadius: 16,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderBottomRightRadius: 16,
  },
  scanText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "600",
    marginTop: 24,
  },
  processingContainer: {
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
  },
  processingText: {
    color: COLORS.white,
    marginTop: 10,
    fontSize: 16,
  },
  cancelButton: {
    position: "absolute",
    bottom: 40,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  cancelButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
  },
});

export default Registration;
