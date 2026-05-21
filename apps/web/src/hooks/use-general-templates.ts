import { create } from "zustand";

type Store = {
  open: boolean;
  setOpen(open: boolean): void;
  setId(id: string): void;
  id: string;
  toggleOpen(): void;
};

export const useGeneralTemplates = create<Store>((set, get) => ({
  open: false,
  setOpen(open: boolean) {
    set({ open });
  },

  id: "",
  setId(id: string) {
    set({ id });
  },

  toggleOpen() {
    set({ open: !get().open });
  },
}));
