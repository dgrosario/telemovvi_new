import { create } from "zustand";

type Store = {
  id: string;
  setId(id: string): void;
  open: boolean;
  openLinkUser: boolean;
  toggleOpenLinkUser(): void;
  openLinkChannel: boolean;
  toggleOpenLinkChannel(): void;
  toggleOpen(): void;
};

export const useSectors = create<Store>((set, get) => ({
  open: false,

  id: "",

  setId(id) {
    set({ id });
  },

  toggleOpen() {
    set({ open: !get().open });
  },

  openLinkUser: false,

  toggleOpenLinkUser() {
    set({ openLinkUser: !get().openLinkUser });
  },

  openLinkChannel: false,

  toggleOpenLinkChannel() {
    set({ openLinkChannel: !get().openLinkChannel });
  },
}));
