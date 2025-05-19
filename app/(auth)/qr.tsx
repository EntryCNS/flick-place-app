import { COLORS } from "@/constants/colors";
import { API_URL } from "@/constants/api";
import { useAuthStore } from "@/stores/auth";
import axios from "axios";
import {
  BarcodeScanningResult,
  CameraView,
  useCameraPermissions,
} from "expo-camera";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef } from "react";
import {
  ActivityIndicator,
  BackHandler,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useMutation } from "@tanstack/react-query";

interface QRRegistrationResponse {
  accessToken: string;
}

export default function QrScannerScreen() {
  const { signIn } = useAuthStore();
  const [permission, requestPermission] = useCameraPermissions();

  const isMounted = useRef(true);
  const canScan = useRef(true);

  const registerMutation = useMutation({
    mutationFn: async (token: string) => {
      const response = await axios.post<QRRegistrationResponse>(
        `${API_URL}/kiosks/register`,
        { registrationToken: token },
        { timeout: 10000 }
      );
      return response.data;
    },
    onSuccess: async (data) => {
      if (!isMounted.current) return;

      if (data?.accessToken) {
        await signIn(data.accessToken);
        router.replace("/products");
      } else {
        resetScanState();
      }
    },
    onError: () => {
      if (isMounted.current) {
        resetScanState();
      }
    },
  });

  useEffect(() => {
    StatusBar.setBarStyle("light-content");
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => registerMutation.isPending
    );

    return () => {
      StatusBar.setBarStyle("dark-content");
      isMounted.current = false;
      backHandler.remove();
    };
  }, [registerMutation.isPending]);

  const resetScanState = useCallback(() => {
    setTimeout(() => {
      if (isMounted.current) canScan.current = true;
    }, 1000);
  }, []);

  const handleQRScanned = useCallback(
    ({ data }: BarcodeScanningResult) => {
      if (registerMutation.isPending || !isMounted.current || !canScan.current)
        return;

      canScan.current = false;

      if (!data?.trim()) {
        resetScanState();
        return;
      }

      registerMutation.mutate(data.trim());
    },
    [registerMutation, resetScanState]
  );

  const goBack = useCallback(() => {
    if (registerMutation.isPending) return;
    router.back();
  }, [registerMutation.isPending]);

  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <Header onBack={goBack} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary500} />
          <Text style={styles.message}>카메라 권한을 확인하는 중입니다</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    const isBlocked = permission && !permission.canAskAgain;

    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <Header onBack={goBack} />
        <View style={styles.center}>
          <Text style={styles.title}>카메라 권한이 필요합니다</Text>
          <Text style={styles.message}>
            QR 코드를 스캔하려면 카메라 접근 권한이 필요합니다
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={isBlocked ? goBack : requestPermission}
          >
            <Text style={styles.buttonText}>
              {isBlocked ? "돌아가기" : "권한 요청하기"}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <Header onBack={goBack} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary500} />
          <Text style={styles.message}>카메라 권한을 확인하는 중입니다</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    const isBlocked = permission && !permission.canAskAgain;

    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <Header onBack={goBack} />
        <View style={styles.center}>
          <Text style={styles.title}>카메라 권한이 필요합니다</Text>
          <Text style={styles.message}>
            QR 코드를 스캔하려면 카메라 접근 권한이 필요합니다
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={isBlocked ? goBack : requestPermission}
          >
            <Text style={styles.buttonText}>
              {isBlocked ? "돌아가기" : "권한 요청하기"}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
        onBarcodeScanned={
          registerMutation.isPending || !canScan.current
            ? undefined
            : handleQRScanned
        }
      >
        <SafeAreaView style={styles.overlay}>
          <HeaderLight onBack={goBack} disabled={registerMutation.isPending} />

          <View style={styles.scanArea}>
            <View style={styles.scanFrame}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
            <Text style={styles.scanText}>
              QR 코드를 프레임 안에 위치시켜주세요
            </Text>

            {registerMutation.isPending && (
              <View style={styles.indicator}>
                <ActivityIndicator size="large" color={COLORS.white} />
                <Text style={styles.indicatorText}>처리 중...</Text>
              </View>
            )}
          </View>
        </SafeAreaView>
      </CameraView>
    </View>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Ionicons name="arrow-back" size={24} color={COLORS.gray900} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>QR 코드 스캔</Text>
      <View style={styles.spacer} />
    </View>
  );
}

function HeaderLight({
  onBack,
  disabled = false,
}: {
  onBack: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={onBack}
        disabled={disabled}
      >
        <Ionicons name="arrow-back" size={24} color={COLORS.white} />
      </TouchableOpacity>
      <Text style={styles.headerTitleLight}>QR 코드 스캔</Text>
      <View style={styles.spacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  camera: {
    flex: 1,
    backgroundColor: "#000",
  },
  overlay: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    height: 56,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Pretendard-SemiBold",
    color: COLORS.gray900,
  },
  headerTitleLight: {
    fontSize: 18,
    fontFamily: "Pretendard-SemiBold",
    color: COLORS.white,
  },
  spacer: {
    width: 40,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontFamily: "Pretendard-Bold",
    color: COLORS.gray900,
    marginBottom: 12,
    textAlign: "center",
  },
  message: {
    fontSize: 15,
    fontFamily: "Pretendard-Medium",
    color: COLORS.gray600,
    textAlign: "center",
    marginTop: 16,
    marginBottom: 32,
    lineHeight: 22,
  },
  button: {
    backgroundColor: COLORS.primary500,
    borderRadius: 6,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 200,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontFamily: "Pretendard-SemiBold",
  },
  scanArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scanFrame: {
    width: 280,
    height: 280,
    borderRadius: 16,
    backgroundColor: "transparent",
    position: "relative",
  },
  corner: {
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
    fontFamily: "Pretendard-Medium",
    marginTop: 24,
    textAlign: "center",
  },
  indicator: {
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    padding: 20,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
    minWidth: 160,
  },
  indicatorText: {
    color: COLORS.white,
    marginTop: 12,
    fontSize: 16,
    fontFamily: "Pretendard-Medium",
  },
});
