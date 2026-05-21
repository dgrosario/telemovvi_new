import { create } from "zustand";

type Store = {
  open: boolean;
  toggleOpen(): void;
  setRoleId(roleId: string): void;
  roleId: string;
};

export const useRoles = create<Store>((set, get) => ({
  open: false,
  roleId: "",
  setRoleId(roleId) {
    set({ roleId });
  },
  toggleOpen() {
    set({ open: !get().open });
  },
}));
