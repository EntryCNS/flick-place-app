import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import * as SecureStore from "expo-secure-store";

interface AuthState {
  accessToken: string | null;
  isAuthenticated: boolean;
}

interface AuthActions {
  login: (accessToken: string) => void;
  logout: () => void;
}

const secureStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return await SecureStore.getItemAsync(name);
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
    (set) => ({
      accessToken: null,
      isAuthenticated: false,
      login: (accessToken) => {
        set({
          accessToken,
          isAuthenticated: true,
        });
      },
      logout: () => {
        set({
          accessToken: null,
          isAuthenticated: false,
        });
      },
    }),
    {
      name: "kiosk-auth-storage",
      storage: createJSONStorage(() => secureStorage),
    }
  )
);