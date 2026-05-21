import { create } from "zustand";
import { Message } from "@omnichannel/core/domain/entities/message";

type ForwardMessageState = {
  messageToForward: Message.Raw | null;
  setMessageToForward: (message: Message.Raw | null) => void;
  clearMessageToForward: () => void;
};

export const useForwardMessage = create<ForwardMessageState>((set) => ({
  messageToForward: null,
  setMessageToForward: (message) => set({ messageToForward: message }),
  clearMessageToForward: () => set({ messageToForward: null }),
}));
