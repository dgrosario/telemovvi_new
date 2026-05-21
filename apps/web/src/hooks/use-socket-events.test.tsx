import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  handlers,
  ioHandlers,
  invalidateQueries,
  socketMock,
  chatState,
  useChatMock,
  conversationStoreState,
  useConversationStoreMock,
  notificationStoreState,
  useNotificationStoreMock,
} = vi.hoisted(() => {
  const handlers = new Map<string, (...args: any[]) => void>();
  const ioHandlers = new Map<string, (...args: any[]) => void>();
  const invalidateQueries = vi.fn();

  const socketMock = {
    on: vi.fn((event: string, handler: (...args: any[]) => void) => {
      handlers.set(event, handler);
    }),
    off: vi.fn((event: string) => {
      handlers.delete(event);
    }),
    io: {
      on: vi.fn((event: string, handler: (...args: any[]) => void) => {
        ioHandlers.set(event, handler);
      }),
      off: vi.fn((event: string) => {
        ioHandlers.delete(event);
      }),
    },
  };

  const chatState = {
    conversationOpenedId: "conv-open",
    messages: new Map(),
    setMessages: vi.fn(),
    addMessage: vi.fn(),
    setConversations: vi.fn(),
    updateConversation: vi.fn(),
    markMessageAsDeleted: vi.fn(),
    user: { id: "user-1", name: "Admin" },
  };

  const useChatMock = Object.assign(vi.fn(() => chatState), {
    getState: vi.fn(() => chatState),
  });

  const conversationStoreState = {
    byId: {},
    updateConversation: vi.fn(),
    moveToTop: vi.fn(),
    removeConversation: vi.fn(),
    insertConversation: vi.fn(),
    adjustUnread: vi.fn(),
    resetStatus: vi.fn(),
    markConversationAsRead: vi.fn(),
  };

  const useConversationStoreMock = Object.assign(
    vi.fn(() => conversationStoreState),
    {
      getState: vi.fn(() => conversationStoreState),
    }
  );

  const notificationStoreState = {
    addNotification: vi.fn(),
    markAsRead: vi.fn(),
  };

  const useNotificationStoreMock = Object.assign(
    vi.fn(() => notificationStoreState),
    {
      getState: vi.fn(() => notificationStoreState),
    }
  );

  return {
    handlers,
    ioHandlers,
    invalidateQueries,
    socketMock,
    chatState,
    useChatMock,
    conversationStoreState,
    useConversationStoreMock,
    notificationStoreState,
    useNotificationStoreMock,
  };
});

vi.mock("@/providers/socket-provider", () => ({
  useSocket: () => ({
    socket: socketMock,
    isConnected: true,
  }),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query"
  );

  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries,
    }),
  };
});

vi.mock("./use-chat", () => ({
  useChat: useChatMock,
}));

vi.mock("./use-conversation-store", () => ({
  useConversationStore: useConversationStoreMock,
}));

vi.mock("./use-notification-store", () => ({
  useNotificationStore: useNotificationStoreMock,
}));

vi.mock("./use-user-sectors", () => ({
  useUserSectors: () => ({
    data: [],
  }),
}));

vi.mock("./use-my-channels", () => ({
  useMyChannels: () => ({
    data: [],
    isSuccess: true,
  }),
}));

vi.mock("@/providers/user-permissions-provider", () => ({
  useUserPermissions: () => ({
    hasPermission: () => false,
  }),
}));

vi.mock("./conversation-filters-loader", () => ({
  useConversationFilters: () => ({
    showAll: false,
    statusFilters: ["open"],
    sectors: [],
    channels: [],
    users: [],
    query: "",
    searchType: "all",
    conversationType: "contacts",
    waitingStatus: "",
  }),
}));

vi.mock("@/lib/conversation-search-filter", () => ({
  matchesConversationSearch: () => true,
}));

vi.mock("@/lib/message-reaction-events", () => ({
  applyReactionEvent: vi.fn(),
}));

vi.mock("react-toastify", () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

import { useSocketEvents } from "./use-socket-events";

function TestComponent() {
  useSocketEvents();
  return null;
}

describe("useSocketEvents regressions", () => {
  beforeEach(() => {
    handlers.clear();
    ioHandlers.clear();
    invalidateQueries.mockClear();
    socketMock.on.mockClear();
    socketMock.off.mockClear();
    socketMock.io.on.mockClear();
    socketMock.io.off.mockClear();
    chatState.conversationOpenedId = "conv-open";
    chatState.messages = new Map();
    chatState.setMessages.mockClear();
    chatState.updateConversation.mockClear();
    chatState.markMessageAsDeleted.mockClear();
    conversationStoreState.byId = {};
    conversationStoreState.updateConversation.mockClear();
    conversationStoreState.moveToTop.mockClear();
    conversationStoreState.removeConversation.mockClear();
    conversationStoreState.insertConversation.mockClear();
    conversationStoreState.adjustUnread.mockClear();
    conversationStoreState.resetStatus.mockClear();
    conversationStoreState.markConversationAsRead.mockClear();
    notificationStoreState.addNotification.mockClear();
    notificationStoreState.markAsRead.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("invalidates the open conversation messages query on refresh", () => {
    render(<TestComponent />);

    const refreshHandler = handlers.get("refresh");

    expect(refreshHandler).toBeTypeOf("function");

    refreshHandler?.();

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["messages-paginated", "conv-open"],
      refetchType: "active",
    });
  });

  it("falls back to refetch when sent confirmation cannot reconcile with local state", () => {
    render(<TestComponent />);

    const confirmationHandler = handlers.get("message:sent:confirmed");

    expect(confirmationHandler).toBeTypeOf("function");

    confirmationHandler?.({
      conversationId: "conv-group",
      workspaceId: "workspace-1",
      correlationId: "corr-miss",
      whatsappMessageId: "wamid-1",
      message: {
        id: "msg-persisted",
        type: "text",
        content: "ol",
        originalContent: null,
        caption: null,
        filename: null,
        mimetype: null,
        mediaKey: null,
        sender: {
          type: "attendant",
          id: "user-1",
          name: "Admin",
        },
        internal: false,
        createdAt: new Date("2026-03-24T08:36:00.000Z"),
        viewedAt: null,
        deletedAt: null,
        editedAt: null,
        status: "sent",
        quotedMessageId: null,
        templateName: null,
        remoteJid: null,
      },
    });

    expect(chatState.setMessages).not.toHaveBeenCalled();
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["messages-paginated", "conv-group"],
      refetchType: "active",
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["retrieve-conversation", "conv-group"],
      refetchType: "active",
    });
  });

  it("reconciles sent confirmation for an open WhatsApp group conversation with null status", () => {
    chatState.conversationOpenedId = "conv-group";
    conversationStoreState.byId = {
      "conv-group": {
        id: "conv-group",
        contact: null,
        attendant: null,
        status: null,
        openedAt: null,
        firstOpenedAt: null,
        closedAt: null,
        sector: null,
        channel: null,
        teaser: "anterior",
        messageToView: 0,
        lastMessageCreatedAt: null,
        lastClientMessageCreatedAt: null,
        waitingAt: null,
        activeFlowExecutionId: null,
        flowCompletedAt: null,
        receivedChannel: null,
        conversationType: "whatsapp-group",
        name: "Softtor - Gestão",
        participants: [],
        groupJid: "1203630@g.us",
        isFromReceivingNumber: false,
      },
    };

    render(<TestComponent />);

    const confirmationHandler = handlers.get("message:sent:confirmed");

    expect(confirmationHandler).toBeTypeOf("function");

    confirmationHandler?.({
      conversationId: "conv-group",
      workspaceId: "workspace-1",
      correlationId: "corr-group",
      whatsappMessageId: "wamid-group",
      conversation: {
        ...conversationStoreState.byId["conv-group"],
        lastMessageCreatedAt: new Date("2026-03-24T08:36:00.000Z"),
      },
      message: {
        id: "msg-group",
        type: "text",
        content: "ol",
        originalContent: null,
        caption: null,
        filename: null,
        mimetype: null,
        mediaKey: null,
        sender: {
          type: "attendant",
          id: "user-1",
          name: "Admin",
        },
        internal: false,
        createdAt: new Date("2026-03-24T08:36:00.000Z"),
        viewedAt: null,
        deletedAt: null,
        editedAt: null,
        status: "sent",
        quotedMessageId: null,
        templateName: null,
        remoteJid: null,
      },
    });

    expect(conversationStoreState.updateConversation).toHaveBeenCalled();
    expect(conversationStoreState.moveToTop).toHaveBeenCalledWith("conv-group");
    expect(chatState.setMessages).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).not.toHaveBeenCalledWith({
      queryKey: ["messages-paginated", "conv-group"],
      refetchType: "active",
    });
  });

  it("updates the open conversation and teaser when a message is deleted", () => {
    render(<TestComponent />);

    const deletedHandler = handlers.get("message:deleted");

    expect(deletedHandler).toBeTypeOf("function");

    deletedHandler?.({
      messageId: "msg-1",
      conversationId: "conv-open",
      deletedAt: "2026-03-24T09:15:00.000Z",
      conversation: {
        id: "conv-open",
        contact: null,
        attendant: null,
        status: "open",
        openedAt: null,
        firstOpenedAt: null,
        closedAt: null,
        sector: null,
        channel: null,
        receivedChannel: null,
        teaser: "Mensagem excluída",
        messageToView: 0,
        lastMessageCreatedAt: new Date("2026-03-24T09:14:59.000Z"),
        waitingAt: null,
        lastClientMessageCreatedAt: null,
        activeFlowExecutionId: null,
        flowCompletedAt: null,
        conversationType: "external",
        name: null,
        participants: [],
        groupJid: null,
        isFromReceivingNumber: false,
      },
    });

    expect(chatState.markMessageAsDeleted).toHaveBeenCalledWith("msg-1");
    expect(conversationStoreState.updateConversation).toHaveBeenCalledWith(
      "conv-open",
      expect.objectContaining({
        teaser: "Mensagem excluída",
      })
    );
  });

  it("falls back to refetch when delete cannot be fully reconciled locally", () => {
    render(<TestComponent />);

    const deletedHandler = handlers.get("message:deleted");

    expect(deletedHandler).toBeTypeOf("function");

    deletedHandler?.({
      messageId: "msg-missing",
      conversationId: "conv-missing",
      deletedAt: "2026-03-24T09:15:00.000Z",
    });

    expect(chatState.markMessageAsDeleted).toHaveBeenCalledWith("msg-missing");
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["messages-paginated", "conv-missing"],
      refetchType: "active",
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["retrieve-conversation", "conv-missing"],
      refetchType: "active",
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["conversations-paginated"],
      refetchType: "active",
    });
  });
});
