import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import * as SecureStore from "expo-secure-store";

interface AuthState {
  token: string | null;
  authenticated: boolean;
  initialized: boolean;
  loading: boolean;
  error: string | null;
}

interface AuthActions {
  init: () => Promise<void>;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetError: () => void;
}

const secureStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(name);
    } catch {
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await SecureStore.setItemAsync(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await SecureStore.deleteItemAsync(name);
  },
};

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set, get) => ({
      token: null,
      authenticated: false,
      initialized: false,
      loading: false,
      error: null,

      init: async () => {
        try {
          set({ loading: true, error: null });

          const state = get();
          if (state.token) {
            set({ authenticated: true });
          }

          set({ initialized: true, loading: false });
        } catch (error) {
          set({
            initialized: true,
            loading: false,
            error: error instanceof Error ? error.message : "초기화 오류",
          });
        }
      },

      signIn: async (token) => {
        try {
          set({ loading: true, error: null });
          set({ token, authenticated: true, loading: false });
        } catch (error) {
          set({
            loading: false,
            error: error instanceof Error ? error.message : "로그인 오류",
          });
          throw error;
        }
      },

      signOut: async () => {
        try {
          set({ loading: true, error: null });
          set({ token: null, authenticated: false, loading: false });
        } catch (error) {
          set({
            loading: false,
            error: error instanceof Error ? error.message : "로그아웃 오류",
          });
          throw error;
        }
      },

      resetError: () => set({ error: null }),
    }),
    {
      name: "kiosk-auth",
      storage: createJSONStorage(() => secureStorage),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.init();
        }
      },
      partialize: (state) => ({ token: state.token }),
    }
  )
);
