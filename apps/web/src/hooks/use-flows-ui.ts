import { create } from "zustand";

type Store = {
  selectedFlowId: string;
  detailsOpen: boolean;
  editDialogOpen: boolean;
  setSelectedFlowId(flowId: string): void;
  toggleDetailsOpen(): void;
  toggleEditDialogOpen(): void;
  openDetails(flowId: string): void;
};

export const useFlowsUI = create<Store>((set, get) => ({
  selectedFlowId: "",
  detailsOpen: false,
  editDialogOpen: false,
  setSelectedFlowId(flowId) {
    set({ selectedFlowId: flowId });
  },
  toggleDetailsOpen() {
    set({ detailsOpen: !get().detailsOpen });
  },
  toggleEditDialogOpen() {
    set({ editDialogOpen: !get().editDialogOpen });
  },
  openDetails(flowId) {
    set({ selectedFlowId: flowId, detailsOpen: true });
  },
}));
