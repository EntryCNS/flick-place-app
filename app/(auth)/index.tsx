import { COLORS } from "@/constants/colors";
import { API_URL } from "@/constants/api";
import { useAuthStore } from "@/stores/auth";
import axios, { isAxiosError } from "axios";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, FontAwesome5 } from "@expo/vector-icons";

interface JwtPayload {
  accessToken: string;
}

interface ErrorResponse {
  code: string;
  status: number;
  message: string;
}

const ERROR_MESSAGES: Record<string, string> = {
  BOOTH_NOT_FOUND: "등록된 부스가 아닙니다",
  BOOTH_NOT_APPROVED: "승인된 부스가 아닙니다",
  BOOTH_REJECTED: "거절된 부스입니다",
  BOOTH_INACTIVE: "금지된 부스입니다",
  BOOTH_PASSWORD_NOT_MATCH: "비밀번호가 맞지 않습니다",
};

export default function LoginScreen() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [focusedInput, setFocusedInput] = useState("");
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");

  const { login } = useAuthStore();
  const isMounted = useRef(true);
  const usernameRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const alertOpacity = useRef(new Animated.Value(0)).current;
  const alertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () =>
      router.canGoBack() ? false : true
    );

    return () => {
      isMounted.current = false;
      backHandler.remove();
    };
  }, []);

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

  const handleCredentialLogin = useCallback(async () => {
    if (!username || !password || isProcessing) return;

    Keyboard.dismiss();

    try {
      setIsProcessing(true);

      const response = await axios.post<JwtPayload>(`${API_URL}/kiosks/login`, {
        username: username.trim(),
        password,
      });

      if (!isMounted.current) return;

      if (response.data?.accessToken) {
        await login(response.data.accessToken);
        router.replace("/products");
      } else {
        showAlert("로그인에 실패했습니다");
      }
    } catch (error) {
      if (!isMounted.current) return;

      let errorMessage = "로그인에 실패했습니다";

      if (isAxiosError(error) && error.response?.data) {
        const errorData = error.response.data as ErrorResponse;
        if (errorData.code && ERROR_MESSAGES[errorData.code]) {
          errorMessage = ERROR_MESSAGES[errorData.code];
        }
      }

      showAlert(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  }, [username, password, isProcessing, login, showAlert]);

  const handleFocus = useCallback((input: string) => {
    setFocusedInput(input);
  }, []);

  const handleBlur = useCallback(() => {
    setFocusedInput("");
  }, []);

  const handleUsernameSubmit = useCallback(() => {
    passwordRef.current?.focus();
  }, []);

  const goToQrScanner = useCallback(() => {
    if (isProcessing) return;
    Keyboard.dismiss();
    router.push("/(auth)/qr");
  }, [isProcessing]);

  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
      <TouchableWithoutFeedback onPress={dismissKeyboard}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.logoContainer}>
            <Image
              source={require("@/assets/images/logo.png")}
              style={styles.logo}
              resizeMode="contain"
              accessibilityLabel="Flick Place Logo"
            />
            <Text style={styles.appName}>
              <Text style={styles.highlight}>F</Text>lick Place
            </Text>
          </View>

          <View style={styles.mainContainer}>
            <View style={styles.formContainer}>
              <Text style={styles.title}>키오스크 로그인</Text>

              <TextInput
                ref={usernameRef}
                style={[
                  styles.input,
                  focusedInput === "username" && styles.inputFocused,
                ]}
                placeholder="아이디"
                placeholderTextColor={COLORS.gray400}
                value={username}
                onChangeText={setUsername}
                onFocus={() => handleFocus("username")}
                onBlur={handleBlur}
                onSubmitEditing={handleUsernameSubmit}
                returnKeyType="next"
                autoCapitalize="none"
                keyboardType="email-address"
                blurOnSubmit={false}
                autoCorrect={false}
                importantForAutofill="yes"
                accessibilityLabel="아이디 입력"
              />

              <TextInput
                ref={passwordRef}
                style={[
                  styles.input,
                  focusedInput === "password" && styles.inputFocused,
                ]}
                placeholder="비밀번호"
                placeholderTextColor={COLORS.gray400}
                value={password}
                onChangeText={setPassword}
                onFocus={() => handleFocus("password")}
                onBlur={handleBlur}
                onSubmitEditing={handleCredentialLogin}
                returnKeyType="done"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                importantForAutofill="yes"
                accessibilityLabel="비밀번호 입력"
              />

              <TouchableOpacity
                activeOpacity={0.7}
                style={[
                  styles.loginButton,
                  (!username || !password) && styles.loginButtonDisabled,
                ]}
                onPress={handleCredentialLogin}
                disabled={!username || !password || isProcessing}
                accessibilityLabel="로그인 버튼"
                accessibilityRole="button"
              >
                {isProcessing ? (
                  <ActivityIndicator color={COLORS.white} size="small" />
                ) : (
                  <Text style={styles.loginButtonText}>로그인</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.qrButton}
                onPress={goToQrScanner}
                disabled={isProcessing}
                accessibilityLabel="QR 코드로 등록하기 버튼"
                accessibilityRole="button"
              >
                <FontAwesome5
                  name="qrcode"
                  size={18}
                  color={COLORS.primary600}
                  style={styles.qrIcon}
                />
                <Text style={styles.qrButtonText}>QR 코드로 등록하기</Text>
              </TouchableOpacity>
            </View>
          </View>

          {alertVisible && (
            <Animated.View style={[styles.alert, { opacity: alertOpacity }]}>
              <View style={styles.alertContent}>
                <Ionicons
                  name="alert-circle"
                  size={24}
                  color={COLORS.danger500}
                />
                <Text style={styles.alertText}>{alertMessage}</Text>
              </View>
            </Animated.View>
          )}
        </SafeAreaView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
  },
  logo: {
    width: 40,
    height: 40,
    marginRight: 8,
  },
  appName: {
    fontSize: 22,
    fontFamily: "Pretendard-SemiBold",
    color: COLORS.text,
  },
  highlight: {
    color: COLORS.primary600,
  },
  mainContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  formContainer: {
    width: "100%",
    maxWidth: 500,
  },
  title: {
    fontSize: 28,
    fontFamily: "Pretendard-Bold",
    color: COLORS.text,
    marginBottom: 24,
    textAlign: "center",
  },
  input: {
    backgroundColor: COLORS.gray100,
    height: 56,
    borderRadius: 12,
    paddingHorizontal: 20,
    fontSize: 16,
    fontFamily: "Pretendard-Medium",
    color: COLORS.text,
    marginBottom: 16,
  },
  inputFocused: {
    borderWidth: 1,
    borderColor: COLORS.primary600,
  },
  loginButton: {
    backgroundColor: COLORS.primary600,
    height: 56,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  loginButtonDisabled: {
    backgroundColor: COLORS.gray300,
    elevation: 0,
    shadowOpacity: 0,
  },
  loginButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontFamily: "Pretendard-SemiBold",
  },
  qrButton: {
    flexDirection: "row",
    backgroundColor: COLORS.white,
    height: 56,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.primary600,
  },
  qrIcon: {
    marginRight: 8,
  },
  qrButtonText: {
    color: COLORS.primary600,
    fontSize: 16,
    fontFamily: "Pretendard-SemiBold",
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
