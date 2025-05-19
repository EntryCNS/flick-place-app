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
  Dimensions,
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
import { Ionicons } from "@expo/vector-icons";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useCartStore } from "@/stores/cart";
import { usePaymentStore } from "@/stores/payment";

interface ErrorResponse {
  code: string;
  status: number;
  message: string;
}

const ERROR_CODES: Record<string, string> = {
  BOOTH_NOT_FOUND: "등록된 부스가 아닙니다",
  BOOTH_NOT_APPROVED: "승인된 부스가 아닙니다",
  BOOTH_REJECTED: "거절된 부스입니다",
  BOOTH_INACTIVE: "금지된 부스입니다",
  BOOTH_PASSWORD_NOT_MATCH: "비밀번호가 맞지 않습니다",
};

const loginSchema = z.object({
  username: z.string().min(1, "아이디를 입력해주세요"),
  password: z.string().min(1, "비밀번호를 입력해주세요"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const { signIn } = useAuthStore();
  const { clearCart } = useCartStore();
  const { resetPayment } = usePaymentStore();
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState(Dimensions.get("window"));

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(12)).current;
  const errorFadeAnim = useRef(new Animated.Value(0)).current;
  const buttonScaleAnim = useRef(new Animated.Value(1)).current;

  const {
    control,
    handleSubmit,
    formState: { errors },
    setError,
    clearErrors,
    watch,
    setFocus,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const formValues = watch();

  const usernameRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", ({ window }) => {
      setDimensions(window);
    });
    return () => subscription.remove();
  }, []);

  const isLandscape = dimensions.width > dimensions.height;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  useEffect(() => {
    if (errors.root?.message) {
      Animated.timing(errorFadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    } else {
      errorFadeAnim.setValue(0);
    }
  }, [errors.root?.message, errorFadeAnim]);

  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormData) => {
      const response = await axios.post(`${API_URL}/kiosks/login`, {
        username: data.username.trim(),
        password: data.password,
      });
      return response.data;
    },
    onSuccess: async (data) => {
      if (data?.accessToken) {
        await signIn(data.accessToken);
        clearCart();
        resetPayment();
        router.replace("/products");
      } else {
        setError("root", { message: "로그인에 실패했습니다" });
      }
    },
    onError: (error) => {
      if (isAxiosError(error) && error.response?.data) {
        const errorData = error.response.data as ErrorResponse;

        if (errorData.code === "BOOTH_PASSWORD_NOT_MATCH") {
          setError("password", { message: ERROR_CODES[errorData.code] });
          setFocus("password");
        } else if (errorData.code && errorData.code in ERROR_CODES) {
          setError("root", { message: ERROR_CODES[errorData.code] });
        } else {
          setError("root", { message: "로그인에 실패했습니다" });
        }
      } else {
        setError("root", { message: "연결에 실패했습니다" });
      }
    },
  });

  useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () =>
      router.canGoBack() ? false : true
    );

    return () => {
      backHandler.remove();
    };
  }, []);

  const onSubmit = useCallback(
    (data: LoginFormData) => {
      Keyboard.dismiss();
      loginMutation.mutate(data);
    },
    [loginMutation]
  );

  const goToQrScanner = useCallback(() => {
    if (loginMutation.isPending) return;
    Keyboard.dismiss();
    clearErrors();
    router.push("/(auth)/qr");
  }, [loginMutation.isPending, clearErrors]);

  const handleFieldFocus = useCallback((fieldName: string) => {
    setFocusedField(fieldName);
  }, []);

  const handleFieldBlur = useCallback(() => {
    setFocusedField(null);
  }, []);

  const handlePressIn = useCallback(() => {
    Animated.spring(buttonScaleAnim, {
      toValue: 0.98,
      friction: 5,
      useNativeDriver: true,
    }).start();
  }, [buttonScaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(buttonScaleAnim, {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    }).start();
  }, [buttonScaleAnim]);

  const handleAutoFocus = useCallback(() => {
    setTimeout(() => {
      usernameRef.current?.focus();
    }, 800);
  }, []);

  useEffect(() => {
    handleAutoFocus();
  }, [handleAutoFocus]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <Image
              source={require("@/assets/images/logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.headerTitle}>
              <Text style={styles.brandText}>Flick</Text> Place
            </Text>
          </View>

          <View style={styles.mainContainer}>
            <Animated.View
              style={[
                styles.content,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                  width: isLandscape ? "50%" : "100%",
                },
              ]}
            >
              <Text style={styles.title}>키오스크 로그인</Text>

              {errors.root?.message && (
                <Animated.View
                  style={[styles.errorBanner, { opacity: errorFadeAnim }]}
                >
                  <Ionicons
                    name="alert-circle"
                    size={18}
                    color={COLORS.danger500}
                    style={styles.errorIcon}
                  />
                  <Text style={styles.errorBannerText}>
                    {errors.root.message}
                  </Text>
                </Animated.View>
              )}

              <View style={styles.inputsContainer}>
                <Controller
                  control={control}
                  name="username"
                  render={({
                    field: { onChange, onBlur, value, ref },
                    fieldState: { error },
                  }) => (
                    <View style={styles.inputGroup}>
                      <View style={styles.inputLabelRow}>
                        <Text style={styles.inputLabel}>아이디</Text>
                        {error?.message && (
                          <Animated.Text
                            style={[
                              styles.errorText,
                              { opacity: errorFadeAnim },
                            ]}
                          >
                            {error.message}
                          </Animated.Text>
                        )}
                      </View>
                      <TextInput
                        ref={(instance) => {
                          ref(instance);
                          usernameRef.current = instance;
                        }}
                        style={[
                          styles.input,
                          focusedField === "username" && styles.inputFocused,
                          error && styles.inputError,
                        ]}
                        placeholder="아이디를 입력하세요"
                        placeholderTextColor={COLORS.gray400}
                        value={value}
                        onChangeText={onChange}
                        onBlur={() => {
                          onBlur();
                          handleFieldBlur();
                        }}
                        onFocus={() => handleFieldFocus("username")}
                        onSubmitEditing={() => setFocus("password")}
                        returnKeyType="next"
                        autoCapitalize="none"
                        blurOnSubmit={false}
                      />
                    </View>
                  )}
                />

                <Controller
                  control={control}
                  name="password"
                  render={({
                    field: { onChange, onBlur, value, ref },
                    fieldState: { error },
                  }) => (
                    <View style={styles.inputGroup}>
                      <View style={styles.inputLabelRow}>
                        <Text style={styles.inputLabel}>비밀번호</Text>
                        {error?.message && (
                          <Animated.Text
                            style={[
                              styles.errorText,
                              { opacity: errorFadeAnim },
                            ]}
                          >
                            {error.message}
                          </Animated.Text>
                        )}
                      </View>
                      <TextInput
                        ref={(instance) => {
                          ref(instance);
                          passwordRef.current = instance;
                        }}
                        style={[
                          styles.input,
                          focusedField === "password" && styles.inputFocused,
                          error && styles.inputError,
                        ]}
                        placeholder="비밀번호를 입력하세요"
                        placeholderTextColor={COLORS.gray400}
                        value={value}
                        onChangeText={onChange}
                        onBlur={() => {
                          onBlur();
                          handleFieldBlur();
                        }}
                        onFocus={() => handleFieldFocus("password")}
                        onSubmitEditing={handleSubmit(onSubmit)}
                        returnKeyType="done"
                        secureTextEntry
                        autoCapitalize="none"
                      />
                    </View>
                  )}
                />
              </View>

              <Animated.View
                style={{
                  transform: [{ scale: buttonScaleAnim }],
                  width: "100%",
                }}
              >
                <TouchableOpacity
                  style={[
                    styles.loginButton,
                    (!formValues.username ||
                      !formValues.password ||
                      loginMutation.isPending) &&
                      styles.buttonDisabled,
                  ]}
                  onPress={handleSubmit(onSubmit)}
                  onPressIn={handlePressIn}
                  onPressOut={handlePressOut}
                  disabled={
                    !formValues.username ||
                    !formValues.password ||
                    loginMutation.isPending
                  }
                  activeOpacity={0.9}
                >
                  {loginMutation.isPending ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.buttonText}>로그인</Text>
                  )}
                </TouchableOpacity>
              </Animated.View>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>또는</Text>
                <View style={styles.dividerLine} />
              </View>

              <Animated.View
                style={{
                  transform: [{ scale: buttonScaleAnim }],
                  width: "100%",
                }}
              >
                <TouchableOpacity
                  style={styles.qrButton}
                  onPress={goToQrScanner}
                  onPressIn={handlePressIn}
                  onPressOut={handlePressOut}
                  disabled={loginMutation.isPending}
                  activeOpacity={0.9}
                >
                  <Ionicons
                    name="qr-code-outline"
                    size={22}
                    color={COLORS.primary500}
                    style={styles.qrIcon}
                  />
                  <Text style={styles.qrButtonText}>QR 코드로 등록하기</Text>
                </TouchableOpacity>
              </Animated.View>
            </Animated.View>
          </View>
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
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
    height: 64,
  },
  logo: {
    width: 36,
    height: 36,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: "Pretendard-Bold",
    color: COLORS.gray900,
  },
  brandText: {
    color: COLORS.primary500,
  },
  mainContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: 24,
    paddingVertical: 32,
    maxWidth: 480,
    alignSelf: "center",
  },
  title: {
    fontSize: 28,
    fontFamily: "Pretendard-Bold",
    color: COLORS.gray900,
    marginBottom: 28,
    textAlign: "center",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.danger50,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.danger100,
  },
  errorIcon: {
    marginRight: 8,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Pretendard-Medium",
    color: COLORS.danger600,
  },
  inputsContainer: {
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 15,
    fontFamily: "Pretendard-Medium",
    color: COLORS.gray700,
  },
  input: {
    height: 56,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: "Pretendard-Regular",
    color: COLORS.gray900,
    backgroundColor: COLORS.gray50,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  inputFocused: {
    borderColor: COLORS.primary500,
    backgroundColor: COLORS.white,
    borderWidth: 2,
  },
  inputError: {
    borderColor: COLORS.danger500,
  },
  errorText: {
    fontSize: 14,
    fontFamily: "Pretendard-Medium",
    color: COLORS.danger500,
  },
  loginButton: {
    height: 56,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.primary500,
  },
  buttonDisabled: {
    backgroundColor: COLORS.gray300,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontFamily: "Pretendard-SemiBold",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.gray200,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 15,
    fontFamily: "Pretendard-Regular",
    color: COLORS.gray500,
  },
  qrButton: {
    height: 56,
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.primary500,
  },
  qrIcon: {
    marginRight: 10,
  },
  qrButtonText: {
    color: COLORS.primary500,
    fontSize: 16,
    fontFamily: "Pretendard-SemiBold",
  },
});
