import { create } from "zustand";

type Store = {
  open: boolean;
  openLink: boolean;
  openDetails: boolean;
  toggleOpen(): void;
  toggleOpenLink(): void;
  toggleOpenDetails(): void;
  setUserId(userId: string): void;
  userId: string;
};

export const useUsers = create<Store>((set, get) => ({
  open: false,
  openLink: false,
  openDetails: false,
  userId: "",
  setUserId(userId) {
    set({ userId });
  },
  toggleOpen() {
    set({ open: !get().open });
  },
  toggleOpenLink() {
    set({ openLink: !get().openLink });
  },
  toggleOpenDetails() {
    set({ openDetails: !get().openDetails });
  },
}));
