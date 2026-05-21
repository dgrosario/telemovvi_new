import { create } from "zustand";

type Store = {
  open: boolean;
  setOpen(open: boolean): void;
};

export const useTemplates = create<Store>((set) => ({
  open: false,
  setOpen(open: boolean) {
    set({ open });
  },
}));
