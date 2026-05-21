import { create } from "zustand";

type Store = {
  open: boolean;
  clientId: string | null;
  setClientId(clientId: string): void;
  toggleOpen(): void;
  clearClientId(): void;
};

export const useClients = create<Store>((set, get) => ({
  open: false,
  clientId: null,
  clearClientId() {
    set({ clientId: null });
  },
  setClientId(clientId: string) {
    set({ clientId });
  },
  toggleOpen() {
    set({ open: !get().open });
  },
}));
