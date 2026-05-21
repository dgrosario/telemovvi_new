import { beforeEach, describe, expect, it } from "vitest";
import { useConversationStore } from "./use-conversation-store";
import type { Conversation } from "@omnichannel/core/domain/entities/conversation";

function resetConversationStore() {
  useConversationStore.setState({
    byId: {},
    idsByStatus: {
      open: [],
      waiting: [],
      closed: [],
      expired: [],
      internal: [],
    },
    pagination: {
      open: { cursor: null, hasMore: true, isLoading: false },
      waiting: { cursor: null, hasMore: true, isLoading: false },
      closed: { cursor: null, hasMore: true, isLoading: false },
      expired: { cursor: null, hasMore: true, isLoading: false },
      internal: { cursor: null, hasMore: true, isLoading: false },
    },
    counters: {
      open: 0,
      waiting: 0,
      closed: 0,
      expired: 0,
      internal: 0,
    },
    unreadByStatus: {
      open: 0,
      waiting: 0,
      closed: 0,
      expired: 0,
      internal: 0,
    },
    activeConversationId: null,
  });
}

function makeConversation(
  overrides: Partial<Conversation.Raw> = {}
): Conversation.Raw {
  return {
    id: "conv-1",
    contact: null,
    attendant: null,
    status: "open",
    openedAt: null,
    firstOpenedAt: null,
    closedAt: null,
    sector: null,
    channel: null,
    teaser: "",
    messageToView: 0,
    lastMessageCreatedAt: null,
    lastClientMessageCreatedAt: null,
    waitingAt: null,
    activeFlowExecutionId: null,
    flowCompletedAt: null,
    receivedChannel: null,
    conversationType: "external",
    name: null,
    participants: [],
    groupJid: null,
    isFromReceivingNumber: false,
    ...overrides,
  };
}

describe("useConversationStore", () => {
  beforeEach(() => {
    resetConversationStore();
  });

  it("indexes WhatsApp groups in the open bucket even when status is null", () => {
    const conversation = makeConversation({
      id: "conv-group",
      status: null,
      conversationType: "whatsapp-group",
      groupJid: "1203630@g.us",
      name: "Softtor - Gestão",
    });

    useConversationStore.getState().insertConversation(conversation);

    const state = useConversationStore.getState();

    expect(state.idsByStatus.open).toEqual(["conv-group"]);
    expect(state.counters.open).toBe(1);
  });

  it("moves WhatsApp groups to the top without reading a missing status bucket", () => {
    useConversationStore.setState({
      byId: {
        "conv-open": makeConversation({ id: "conv-open", teaser: "older" }),
        "conv-group": makeConversation({
          id: "conv-group",
          status: null,
          conversationType: "whatsapp-group",
          groupJid: "1203630@g.us",
          teaser: "newer",
        }),
      },
      idsByStatus: {
        open: ["conv-open", "conv-group"],
        waiting: [],
        closed: [],
        expired: [],
        internal: [],
      },
    });

    expect(() => useConversationStore.getState().moveToTop("conv-group")).not.toThrow();
    expect(useConversationStore.getState().idsByStatus.open).toEqual([
      "conv-group",
      "conv-open",
    ]);
  });

  it("marks WhatsApp groups as read without crashing on null status", () => {
    useConversationStore.setState({
      byId: {
        "conv-group": makeConversation({
          id: "conv-group",
          status: null,
          conversationType: "whatsapp-group",
          groupJid: "1203630@g.us",
          messageToView: 2,
        }),
      },
      idsByStatus: {
        open: ["conv-group"],
        waiting: [],
        closed: [],
        expired: [],
        internal: [],
      },
      unreadByStatus: {
        open: 1,
        waiting: 0,
        closed: 0,
        expired: 0,
        internal: 0,
      },
    });

    expect(() => useConversationStore.getState().markConversationAsRead("conv-group")).not.toThrow();
    expect(useConversationStore.getState().byId["conv-group"]?.messageToView).toBe(0);
    expect(useConversationStore.getState().unreadByStatus.open).toBe(0);
  });
});
