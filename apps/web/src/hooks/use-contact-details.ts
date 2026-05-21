import { create } from "zustand";

type Store = {
  open: boolean;
  contactId: string | null;
  conversationId: string | null;
  channelId: string | null;
  sectorId: string | null;
  openContactDetails(params: {
    contactId: string;
    conversationId: string;
    channelId: string;
    sectorId?: string | null;
  }): void;
  closeContactDetails(): void;
};

export const useContactDetails = create<Store>((set) => ({
  open: false,
  contactId: null,
  conversationId: null,
  channelId: null,
  sectorId: null,
  openContactDetails({ contactId, conversationId, channelId, sectorId }) {
    set({ open: true, contactId, conversationId, channelId, sectorId: sectorId ?? null });
  },
  closeContactDetails() {
    set({ open: false, contactId: null, conversationId: null, channelId: null, sectorId: null });
  },
}));
