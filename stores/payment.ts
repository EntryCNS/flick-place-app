import { create } from "zustand";

type PaymentRequestStatus = "PENDING" | "COMPLETED" | "FAILED" | "EXPIRED";
type PaymentRequestMethod = "QR_CODE" | "STUDENT_ID";

interface PaymentState {
  orderId: number | null;
  requestId: number | null;
  requestCode: string | null;
  requestMethod: PaymentRequestMethod | null;
  expiresAt: string | null;
  timer: number;
  isActive: boolean;
  status: PaymentRequestStatus | null;

  createPayment: (orderId: number) => void;
  setPaymentRequest: (
    requestId: number,
    requestCode: string,
    status: PaymentRequestStatus,
    requestMethod: PaymentRequestMethod,
    expiresAt: string
  ) => void;
  setStatus: (status: PaymentRequestStatus) => void;
  decrementTimer: () => void;
  resetPayment: () => void;
  cancelPayment: () => void;
}

export const usePaymentStore = create<PaymentState>((set, get) => ({
  orderId: null,
  requestId: null,
  requestCode: null,
  requestMethod: null,
  expiresAt: null,
  timer: 180,
  isActive: false,
  status: null,

  createPayment: (orderId) => {
    set({
      orderId,
      timer: 180,
      isActive: true,
      status: "PENDING",
      requestId: null,
      requestCode: null,
      requestMethod: null,
      expiresAt: null,
    });
  },

  setPaymentRequest: (
    requestId,
    requestCode,
    status,
    requestMethod,
    expiresAt
  ) => {
    set({
      requestId,
      requestCode,
      status,
      requestMethod,
      expiresAt,
      isActive: status === "PENDING",
    });

    // 만료 시간으로부터 타이머 계산
    const expiryTime = new Date(expiresAt).getTime();
    const currentTime = new Date().getTime();
    const timeLeftInSeconds = Math.max(
      0,
      Math.floor((expiryTime - currentTime) / 1000)
    );

    set({ timer: timeLeftInSeconds });
  },

  setStatus: (status) => {
    set({ status });

    if (status === "COMPLETED" || status === "FAILED" || status === "EXPIRED") {
      set({ isActive: false });
    }
  },

  decrementTimer: () => {
    const currentTimer = get().timer;
    if (currentTimer <= 0) {
      set({ isActive: false, status: "EXPIRED" });
    } else {
      set({ timer: currentTimer - 1 });
    }
  },

  resetPayment: () => {
    set({
      orderId: null,
      requestId: null,
      requestCode: null,
      requestMethod: null,
      expiresAt: null,
      timer: 180,
      isActive: false,
      status: null,
    });
  },

  cancelPayment: () => {
    set({
      isActive: false,
      status: "EXPIRED",
    });
  },
}));
