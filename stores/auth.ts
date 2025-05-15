import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import * as SecureStore from "expo-secure-store";

interface AuthState {
  accessToken: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AuthActions {
  initialize: () => Promise<void>;
  login: (accessToken: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const secureStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(name);
    } catch (error) {
      console.error("Error getting item from secure storage:", error);
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(name, value);
    } catch (error) {
      console.error("Error setting item in secure storage:", error);
      throw error;
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(name);
    } catch (error) {
      console.error("Error removing item from secure storage:", error);
      throw error;
    }
  },
};

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set, get) => ({
      accessToken: null,
      isAuthenticated: false,
      isInitialized: false,
      isLoading: false,
      error: null,

      initialize: async () => {
        try {
          // 초기화 작업 중 상태
          set({ isLoading: true, error: null });

          // hydration이 완료되었는지 확인 (persist가 스토리지에서 데이터를 불러온 후)
          const state = get();

          // 토큰이 있으면 인증된 것으로 설정
          if (state.accessToken) {
            set({ isAuthenticated: true });
          }

          // 초기화 완료
          set({ isInitialized: true, isLoading: false });
        } catch (error) {
          console.error("Auth initialization error:", error);
          set({
            isInitialized: true,
            isLoading: false,
            error:
              error instanceof Error
                ? error.message
                : "인증 초기화 중 오류가 발생했습니다",
          });
        }
      },

      login: async (accessToken) => {
        try {
          set({ isLoading: true, error: null });
          set({
            accessToken,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          console.error("Login error:", error);
          set({
            isLoading: false,
            error:
              error instanceof Error
                ? error.message
                : "로그인 중 오류가 발생했습니다",
          });
          throw error;
        }
      },

      logout: async () => {
        try {
          set({ isLoading: true, error: null });
          set({
            accessToken: null,
            isAuthenticated: false,
            isLoading: false,
          });
        } catch (error) {
          console.error("Logout error:", error);
          set({
            isLoading: false,
            error:
              error instanceof Error
                ? error.message
                : "로그아웃 중 오류가 발생했습니다",
          });
          throw error;
        }
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: "kiosk-auth-storage",
      storage: createJSONStorage(() => secureStorage),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.initialize();
        }
      },
      partialize: (state) => ({
        accessToken: state.accessToken,
      }),
    }
  )
);
