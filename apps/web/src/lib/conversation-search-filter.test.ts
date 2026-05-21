import type { Conversation } from "@omnichannel/core/domain/entities/conversation";
import { describe, expect, it } from "vitest";
import { matchesConversationSearch } from "./conversation-search-filter";

function createConversation(
  overrides: Partial<Conversation.Raw> = {},
): Conversation.Raw {
  return {
    id: "conversation-1",
    contact: {
      id: "contact-1",
      name: "Ariany Beatryz",
      thumbnail: "",
      value: "5561999999999",
      username: "",
      type: "whatsapp",
      acronym: "AB",
    },
    attendant: {
      id: "attendant-1",
      name: "Joao Victor",
    },
    status: "open",
    openedAt: null,
    firstOpenedAt: null,
    closedAt: null,
    sector: null,
    channel: null,
    teaser: "",
    messageToView: 0,
    lastMessageCreatedAt: null,
    waitingAt: null,
    lastClientMessageCreatedAt: null,
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

describe("matchesConversationSearch", () => {
  it("returns true when query is empty", () => {
    const conversation = createConversation();

    expect(
      matchesConversationSearch(conversation, {
        query: "   ",
        searchType: "client-name",
      }),
    ).toBe(true);
  });

  it("matches phone by exact value", () => {
    const conversation = createConversation({
      contact: {
        id: "contact-1",
        name: "Ariany Beatryz",
        thumbnail: "",
        value: "5561999999999",
        username: "",
        type: "whatsapp",
        acronym: "AB",
      },
    });

    expect(
      matchesConversationSearch(conversation, {
        query: "5561999999999",
        searchType: "phone",
      }),
    ).toBe(true);
    expect(
      matchesConversationSearch(conversation, {
        query: "556199999999",
        searchType: "phone",
      }),
    ).toBe(false);
  });

  it("matches instagram by @prefix or exact value (case-insensitive)", () => {
    const conversation = createConversation({
      contact: {
        id: "contact-1",
        name: "Ariany Beatryz",
        thumbnail: "",
        value: "@Ariany.Br",
        username: "ariany.br",
        type: "instagram",
        acronym: "AB",
      },
    });

    expect(
      matchesConversationSearch(conversation, {
        query: "ariany",
        searchType: "instagram",
      }),
    ).toBe(true);
    expect(
      matchesConversationSearch(conversation, {
        query: "@ariany.br",
        searchType: "instagram",
      }),
    ).toBe(true);
    expect(
      matchesConversationSearch(conversation, {
        query: "softtor",
        searchType: "instagram",
      }),
    ).toBe(false);
  });

  it("matches instagram by pending value when username is empty", () => {
    const conversation = createConversation({
      contact: {
        id: "contact-1",
        name: "Pending Instagram",
        thumbnail: "",
        value: "pending.user",
        username: "",
        type: "instagram",
        acronym: "PI",
      },
    });

    expect(
      matchesConversationSearch(conversation, {
        query: "@pending",
        searchType: "instagram",
      }),
    ).toBe(true);
  });

  it("does not match non-instagram contacts when instagram search type is selected", () => {
    const conversation = createConversation({
      contact: {
        id: "contact-1",
        name: "WhatsApp Contact",
        thumbnail: "",
        value: "5561999999999",
        username: "",
        type: "whatsapp",
        acronym: "WC",
      },
    });

    expect(
      matchesConversationSearch(conversation, {
        query: "55",
        searchType: "instagram",
      }),
    ).toBe(false);
  });

  it("matches client-name and attendant-name by contains (case-insensitive)", () => {
    const conversation = createConversation({
      contact: {
        id: "contact-1",
        name: "Ariany Beatryz",
        thumbnail: "",
        value: "5561999999999",
        username: "",
        type: "whatsapp",
        acronym: "AB",
      },
      attendant: {
        id: "attendant-1",
        name: "Joao Victor",
      },
    });

    expect(
      matchesConversationSearch(conversation, {
        query: "ariany",
        searchType: "client-name",
      }),
    ).toBe(true);
    expect(
      matchesConversationSearch(conversation, {
        query: "victor",
        searchType: "attendant-name",
      }),
    ).toBe(true);
    expect(
      matchesConversationSearch(conversation, {
        query: "softtor",
        searchType: "client-name",
      }),
    ).toBe(false);
  });

  it("matches all by contact value/name only and not by attendant name", () => {
    const conversation = createConversation({
      contact: {
        id: "contact-1",
        name: "Ariany Beatryz",
        thumbnail: "",
        value: "5561999999999",
        username: "",
        type: "whatsapp",
        acronym: "AB",
      },
      attendant: {
        id: "attendant-1",
        name: "Softtor",
      },
    });

    expect(
      matchesConversationSearch(conversation, {
        query: "5561",
        searchType: "all",
      }),
    ).toBe(true);
    expect(
      matchesConversationSearch(conversation, {
        query: "ariany",
        searchType: "all",
      }),
    ).toBe(true);
    expect(
      matchesConversationSearch(conversation, {
        query: "softtor",
        searchType: "all",
      }),
    ).toBe(false);
  });
});
