import { Channel } from "@omnichannel/core/domain/entities/channel";
import { Conversation } from "@omnichannel/core/domain/entities/conversation";
import { Message } from "@omnichannel/core/domain/entities/message";
import { Sector } from "@omnichannel/core/domain/entities/sector";
import { User } from "@omnichannel/core/domain/entities/user";
import { CounterConversations, UnreadByStatus } from "@omnichannel/core/infra/repositories/conversations-repository";
import type { ChatAttendant } from "@/types/chat-attendant";
import { create } from "zustand";

type State = {
  isConnected: boolean;
  conversations: Map<string, Conversation>;
  conversation: Conversation | null;
  channels: Channel.Raw[];
  sectors: Sector.Props[];
  user: User.Raw | null;
  users: ChatAttendant[];
  messages: Map<string, Message>;
  typing: boolean;
  counters: CounterConversations;
  unreadByStatus: UnreadByStatus;
  conversationOpenedId: string | null;
  openModalTransfer: boolean;
  replyingTo: Message.Raw | null;
  previewConversationId: string | null;
  previewConversation: Conversation.Raw | null;
  lastSentMessageId: string | null;
  scrollToMessageId: string | null;
};

type StateInitial = Partial<{
  messages: Message.Raw[];
  channels: Channel.Raw[];
  sectors: Sector.Props[];
  conversations: Conversation.Raw[];
  user: User.Raw | null;
  users: ChatAttendant[];
  conversationOpenedId: string | null;
  counters: CounterConversations;
  unreadByStatus: UnreadByStatus;
}>;

type Action = {
  setMessages(messages: Message.Raw[]): void;
  prependMessages(messages: Message.Raw[]): void;
  onTyping(runTyping: boolean): void;
  setConversationOpenedId(conversationOpenedId: string | null): void;
  setConversations(conversations: Conversation.Raw[]): void;
  updateConversation(conversation: Conversation.Raw): void;
  markAllMessagesViewed(): void;
  addMessage(messageMessage: Message): void;
  markMessageAsError(messageId: string): void;
  markMessageAsDeleted(messageId: string): void;
  removeMessage(messageId: string): void;
  replaceMessage(oldMessageId: string, newMessage: Message.Raw): void;
  reset(initial: StateInitial): void;
  closeConversationOpened(): void;
  toggleOpenModalTransfer(): void;
  setReplyingTo(message: Message.Raw | null): void;
  clearReply(): void;
  setPreviewConversationId(id: string | null, conversation?: Conversation.Raw | null): void;
  setLastSentMessageId(id: string | null): void;
  setScrollToMessageId(id: string | null): void;
};

type Store = State & Action;

export const useChat = create<Store>((set, get) => ({
  channels: [],
  conversationOpenedId: null,
  conversations: new Map(),
  conversation: null,
  isConnected: false,
  sectors: [],
  users: [],
  user: null,
  messages: new Map(),
  typing: false,
  openModalTransfer: false,
  replyingTo: null,
  previewConversationId: null,
  previewConversation: null,
  lastSentMessageId: null,
  scrollToMessageId: null,
  setLastSentMessageId(id: string | null) {
    set({ lastSentMessageId: id });
  },
  setScrollToMessageId(id: string | null) {
    set({ scrollToMessageId: id });
  },
  setPreviewConversationId(id: string | null, conversation?: Conversation.Raw | null) {
    set({ previewConversationId: id, previewConversation: conversation ?? null });
  },
  toggleOpenModalTransfer() {
    set({ openModalTransfer: !get().openModalTransfer });
  },
  setReplyingTo(message: Message.Raw | null) {
    set({ replyingTo: message });
  },
  clearReply() {
    set({ replyingTo: null });
  },
  counters: { closed: 0, open: 0, waiting: 0, expired: 0, internal: 0 },
  unreadByStatus: { closed: 0, open: 0, waiting: 0, expired: 0, internal: 0 },
  closeConversationOpened() {
    set({ conversationOpenedId: null, conversation: null, messages: new Map(), replyingTo: null });
  },
  setConversations(conversations: Conversation.Raw[]) {
    const oldConversations = get().conversations;
    for (const c of conversations) {
      oldConversations.set(c.id, Conversation.fromRaw(c));
    }
    set({
      conversations: new Map(oldConversations),
    });
  },
  updateConversation(conversationRaw: Conversation.Raw) {
    const conversations = get().conversations;
    conversations.set(conversationRaw.id, Conversation.fromRaw(conversationRaw));
    set({ conversations: new Map(conversations) });
  },
  setConversationOpenedId(conversationOpenedId: string | null) {
    const currentId = get().conversationOpenedId;
    // Limpa mensagens ao trocar de conversa para não mostrar histórico anterior
    if (currentId !== conversationOpenedId) {
      set({
        conversationOpenedId,
        messages: new Map(),
        replyingTo: null,
        scrollToMessageId: null,
      });
    } else {
      set({ conversationOpenedId, scrollToMessageId: null });
    }
  },
  setMessages(messages) {
    set({
      messages: new Map(messages.map(Message.fromRaw).map((m) => [m.id, m])),
    });
  },
  prependMessages(olderMessages) {
    const currentMessages = get().messages;
    const olderParsed = olderMessages.map(Message.fromRaw);
    const newMap = new Map<string, Message>();

    for (const msg of olderParsed) {
      if (!currentMessages.has(msg.id)) {
        newMap.set(msg.id, msg);
      }
    }

    for (const [id, msg] of currentMessages) {
      newMap.set(id, msg);
    }

    set({ messages: newMap });
  },
  onTyping(runTyping: boolean) {
    set({ typing: !!runTyping });
  },
  markAllMessagesViewed() {
    set({
      messages: new Map(
        Array.from(get().messages.values())
          .map((m) =>
            m.status !== "viewed" && m.sender.type === "contact"
              ? m.markAsViewed()
              : m
          )
          .map((m) => [m.id, m])
      ),
    });
  },
  addMessage(message) {
    const messages = get().messages;
    messages.set(message.id, message);
    set({ messages: new Map(messages) });
  },
  markMessageAsError(messageId) {
    const messages = get().messages;
    const message = messages.get(messageId);
    if (message) {
      (message as Message & { error?: boolean }).error = true;
      messages.set(messageId, message);
      set({ messages: new Map(messages) });
    }
  },
  markMessageAsDeleted(messageId) {
    const messages = get().messages;
    const message = messages.get(messageId);
    if (message) {
      const raw = message.raw();
      raw.deletedAt = new Date();
      messages.set(messageId, Message.fromRaw(raw));
      set({ messages: new Map(messages) });
    }
  },
  removeMessage(messageId) {
    const messages = get().messages;
    messages.delete(messageId);
    set({ messages: new Map(messages) });
  },
  replaceMessage(oldMessageId, newMessageRaw) {
    const messages = get().messages;
    messages.delete(oldMessageId);
    const newMessage = Message.fromRaw(newMessageRaw);
    messages.set(newMessage.id, newMessage);
    set({ messages: new Map(messages) });
  },
  reset(initial) {
    const { messages, conversations, ...rest } = initial;
    const updates: Partial<State> = { ...rest };

    if (messages !== undefined) {
      updates.messages = new Map(
        messages.map((m) => [m.id, Message.fromRaw(m)])
      );
    }

    if (conversations !== undefined) {
      updates.conversations = new Map(
        conversations.map((c) => [c.id, Conversation.fromRaw(c)])
      );
    }

    set(updates);
  },
}));
