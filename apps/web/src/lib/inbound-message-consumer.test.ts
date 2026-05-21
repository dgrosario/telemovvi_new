import { beforeEach, describe, expect, it, vi } from "vitest";

const messagesRepository = {
  resolveMessageReference: vi.fn(),
  softDelete: vi.fn(),
};

const conversationsRepository = {
  retrieve: vi.fn(),
};

vi.mock("@omnichannel/core/infra/repositories/messages-repository", () => ({
  MessagesDatabaseRepository: {
    instance: () => messagesRepository,
  },
}));

vi.mock("@omnichannel/core/infra/repositories/conversations-repository", () => ({
  ConversationsDatabaseRepository: {
    instance: () => conversationsRepository,
  },
}));

vi.mock("@omnichannel/core/infra/database", async () => {
  const actual = await vi.importActual<typeof import("@omnichannel/core/infra/database")>(
    "@omnichannel/core/infra/database"
  );

  return {
    ...actual,
    createDatabaseConnection: vi.fn(),
    eq: vi.fn(() => Symbol("eq")),
  };
});

describe("InboundMessageConsumer delete reconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    conversationsRepository.retrieve.mockResolvedValue({
      raw: () => ({
        id: "conv-1",
        teaser: "Mensagem excluída",
      }),
    });
  });

  it("uses the revoke target id when Evolution delete arrives with a protocol wrapper id", async () => {
    const { InboundMessageConsumer } = await import("./inbound-message-consumer");
    const emit = vi.fn();
    const io = {
      to: vi.fn(() => ({ emit })),
    } as any;

    messagesRepository.resolveMessageReference.mockResolvedValue({
      id: "msg-1",
      conversationId: "conv-1",
      workspaceId: "workspace-1",
    });

    const consumer = new InboundMessageConsumer(io);

    await (consumer as any).handleEvolutionMessageDelete({
      instance: "instance-a",
      data: {
        id: "cmn-delete-event-1",
        remoteJid: "5511999999999@s.whatsapp.net",
        fromMe: false,
        message: {
          protocolMessage: {
            key: {
              id: "msg-1",
              remoteJid: "5511999999999@s.whatsapp.net",
              fromMe: false,
            },
            type: "REVOKE",
          },
        },
      },
    });

    expect(messagesRepository.resolveMessageReference).toHaveBeenCalledWith(
      "msg-1",
      "instance-a"
    );
    expect(messagesRepository.softDelete).toHaveBeenCalledWith(
      "msg-1",
      expect.any(Date)
    );
    expect(io.to).toHaveBeenCalledWith("workspace:workspace-1");
    expect(emit).toHaveBeenCalledWith(
      "message:deleted",
      expect.objectContaining({
        messageId: "msg-1",
        conversationId: "conv-1",
      })
    );
  });

  it("deduplicates duplicate delete events from global and instance queues", async () => {
    const { InboundMessageConsumer } = await import("./inbound-message-consumer");
    const emit = vi.fn();
    const io = {
      to: vi.fn(() => ({ emit })),
    } as any;

    messagesRepository.resolveMessageReference.mockResolvedValue({
      id: "msg-1",
      conversationId: "conv-1",
      workspaceId: "workspace-1",
    });

    const consumer = new InboundMessageConsumer(io);
    const event = {
      instance: "instance-a",
      data: {
        id: "cmn-delete-event-1",
        message: {
          protocolMessage: {
            key: {
              id: "msg-1",
              remoteJid: "5511999999999@s.whatsapp.net",
              fromMe: true,
            },
            type: "REVOKE",
          },
        },
      },
    };

    await (consumer as any).handleEvolutionMessageDelete(event);
    await (consumer as any).handleEvolutionMessageDelete(event);

    expect(messagesRepository.resolveMessageReference).toHaveBeenCalledTimes(1);
    expect(messagesRepository.softDelete).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledTimes(1);
  });
});
