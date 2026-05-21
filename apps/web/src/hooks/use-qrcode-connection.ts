import { create } from "zustand";

type Store = {
  channelId: string | null;
  pendingInstanceName: string | null;
  initialQrCode: string | null;
  wasSuccessful: boolean;
  onClear(): void;
  onSuccess(): void;
};

export const useQRCodeConnection = create<Store>((set) => ({
  channelId: null,
  pendingInstanceName: null,
  initialQrCode: null,
  wasSuccessful: false,
  onClear() {
    set({
      channelId: null,
      pendingInstanceName: null,
      initialQrCode: null,
      wasSuccessful: false,
    });
  },
  onSuccess() {
    set({
      channelId: null,
      pendingInstanceName: null,
      initialQrCode: null,
      wasSuccessful: true,
    });
  },
}));
