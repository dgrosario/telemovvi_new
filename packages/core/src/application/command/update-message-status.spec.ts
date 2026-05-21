import { describe, it, expect, vi, beforeEach } from "vitest";
import { UpdateMessageStatus } from "./update-message-status";
import { Message } from "../../domain/entities/message";
import { Conversation } from "../../domain/entities/conversation";
import { Contact } from "../../domain/entities/contact";
import { ConversationChannel } from "../../domain/entities/conversation-channel";
import { Sender } from "../../domain/entities/sender";
import { OnMessageStatusUpdateProps } from "../../infra/controllers/evolution-event-handler";

describe("UpdateMessageStatus", () => {
  let messagesRepository: {
    retrieve: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
  let conversationsRepository: {
    retrieveByMessageId: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
  let command: UpdateMessageStatus;

  const createMockMessage = (overrides: Partial<Message.Props> = {}): Message => {
    const mockSender = Sender.create("contact", "contact-123", "John Doe");
    return Message.instance({
      id: "msg-123",
      type: "text",
      content: "Test message",
      originalContent: null,
      sender: mockSender,
      status: "senting",
      createdAt: new Date(),
      viewedAt: null,
      deletedAt: null,
      editedAt: null,
      caption: null,
      filename: null,
      mimetype: null,
      mediaKey: null,
      internal: false,
      quotedMessageId: null,
      templateName: null,
      remoteJid: null,
      ...overrides,
    });
  };

  const createMockConversation = (
    overrides: Partial<Conversation.Props> = {}
  ): Conversation => {
    const mockContact = Contact.instance({
      id: "contact-123",
      name: "John Doe",
      thumbnail: "",
      value: "5511999999999",
      username: "",
      type: "whatsapp",
    });
    const mockConversationChannel = ConversationChannel.instance({
      id: "channel-123",
      name: "Test Channel",
      type: "whatsapp",
    });
    return Conversation.instance({
      id: "conv-123",
      contact: mockContact,
      channel: mockConversationChannel,
      attendant: null,
      status: "open",
      openedAt: null,
      firstOpenedAt: null,
      closedAt: null,
      sector: null,
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
      ...overrides,
    });
  };

  beforeEach(() => {
    messagesRepository = {
      retrieve: vi.fn(),
      upsert: vi.fn(),
    };
    conversationsRepository = {
      retrieveByMessageId: vi.fn(),
      upsert: vi.fn(),
    };

    command = new UpdateMessageStatus(
      messagesRepository,
      conversationsRepository
    );
  });

  const createInput = (
    overrides: Partial<OnMessageStatusUpdateProps> = {}
  ): OnMessageStatusUpdateProps => ({
    instanceName: "test-instance",
    messageId: "msg-123",
    remoteJid: "5511999999999@s.whatsapp.net",
    status: "delivered",
    ...overrides,
  });

  describe("successful status updates", () => {
    it("should update message status to sent", async () => {
      const mockMessage = createMockMessage();
      const mockConversation = createMockConversation();

      messagesRepository.retrieve.mockResolvedValue(mockMessage);
      conversationsRepository.retrieveByMessageId.mockResolvedValue({
        conversation: mockConversation,
        workspaceId: "workspace-123",
      });

      const input = createInput({ status: "sent" });
      const result = await command.execute(input);

      expect(result).not.toBeNull();
      expect(result?.message.status).toBe("sent");
      expect(messagesRepository.upsert).toHaveBeenCalledWith(mockMessage);
    });

    it("should update message status to delivered", async () => {
      const mockMessage = createMockMessage();
      const mockConversation = createMockConversation();

      messagesRepository.retrieve.mockResolvedValue(mockMessage);
      conversationsRepository.retrieveByMessageId.mockResolvedValue({
        conversation: mockConversation,
        workspaceId: "workspace-123",
      });

      const input = createInput({ status: "delivered" });
      const result = await command.execute(input);

      expect(result).not.toBeNull();
      expect(result?.message.status).toBe("delivered");
    });

    it("should update message status to viewed and set viewedAt", async () => {
      const mockMessage = createMockMessage();
      const mockConversation = createMockConversation();

      messagesRepository.retrieve.mockResolvedValue(mockMessage);
      conversationsRepository.retrieveByMessageId.mockResolvedValue({
        conversation: mockConversation,
        workspaceId: "workspace-123",
      });

      const input = createInput({ status: "viewed" });
      const result = await command.execute(input);

      expect(result).not.toBeNull();
      expect(result?.message.status).toBe("viewed");
      expect(result?.message.viewedAt).toBeInstanceOf(Date);
    });

    it("should update message status to failed from sent", async () => {
      const mockMessage = createMockMessage({ status: "sent" });
      const mockConversation = createMockConversation();

      messagesRepository.retrieve.mockResolvedValue(mockMessage);
      conversationsRepository.retrieveByMessageId.mockResolvedValue({
        conversation: mockConversation,
        workspaceId: "workspace-123",
      });

      const input = createInput({ status: "failed" });
      const result = await command.execute(input);

      expect(result).not.toBeNull();
      expect(result?.message.status).toBe("failed");
    });

    it("should update message status to failed from delivered", async () => {
      const mockMessage = createMockMessage({ status: "delivered" });
      const mockConversation = createMockConversation();

      messagesRepository.retrieve.mockResolvedValue(mockMessage);
      conversationsRepository.retrieveByMessageId.mockResolvedValue({
        conversation: mockConversation,
        workspaceId: "workspace-123",
      });

      const input = createInput({ status: "failed" });
      const result = await command.execute(input);

      expect(result).not.toBeNull();
      expect(result?.message.status).toBe("failed");
    });

    it("should revert conversation to expired when template fails outside 24h window", async () => {
      const mockMessage = createMockMessage({
        status: "sent",
        type: "template",
        templateName: "chamarconversa",
      });
      const mockConversation = createMockConversation({
        status: "open",
        lastClientMessageCreatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
      });

      messagesRepository.retrieve.mockResolvedValue(mockMessage);
      conversationsRepository.retrieveByMessageId.mockResolvedValue({
        conversation: mockConversation,
        workspaceId: "workspace-123",
      });

      const input = createInput({ status: "failed" });
      const result = await command.execute(input);

      expect(result).not.toBeNull();
      expect(mockConversation.status).toBe("expired");
      expect(conversationsRepository.upsert).toHaveBeenCalledWith(
        mockConversation,
        "workspace-123"
      );
    });

    it("should keep conversation open when template fails inside 24h window", async () => {
      const mockMessage = createMockMessage({
        status: "sent",
        type: "template",
        templateName: "chamarconversa",
      });
      const mockConversation = createMockConversation({
        status: "open",
        lastClientMessageCreatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      });

      messagesRepository.retrieve.mockResolvedValue(mockMessage);
      conversationsRepository.retrieveByMessageId.mockResolvedValue({
        conversation: mockConversation,
        workspaceId: "workspace-123",
      });

      const input = createInput({ status: "failed" });
      const result = await command.execute(input);

      expect(result).not.toBeNull();
      expect(mockConversation.status).toBe("open");
      expect(conversationsRepository.upsert).not.toHaveBeenCalled();
    });

    it("should not expire conversation for non-official channels", async () => {
      const mockMessage = createMockMessage({
        status: "sent",
        type: "template",
        templateName: "chamarconversa",
      });
      const mockConversation = createMockConversation({
        status: "open",
        channel: ConversationChannel.instance({
          id: "channel-evo",
          name: "Evolution",
          type: "evolution",
        }),
        lastClientMessageCreatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
      });

      messagesRepository.retrieve.mockResolvedValue(mockMessage);
      conversationsRepository.retrieveByMessageId.mockResolvedValue({
        conversation: mockConversation,
        workspaceId: "workspace-123",
      });

      const input = createInput({ status: "failed" });
      const result = await command.execute(input);

      expect(result).not.toBeNull();
      expect(mockConversation.status).toBe("open");
      expect(conversationsRepository.upsert).not.toHaveBeenCalled();
    });
  });

  describe("return values", () => {
    it("should return conversation id and workspace id", async () => {
      const mockMessage = createMockMessage();
      const mockConversation = createMockConversation();

      messagesRepository.retrieve.mockResolvedValue(mockMessage);
      conversationsRepository.retrieveByMessageId.mockResolvedValue({
        conversation: mockConversation,
        workspaceId: "workspace-456",
      });

      const input = createInput();
      const result = await command.execute(input);

      expect(result?.conversationId).toBe("conv-123");
      expect(result?.workspaceId).toBe("workspace-456");
    });
  });

  describe("error handling", () => {
    it("should return null when message is not found", async () => {
      messagesRepository.retrieve.mockResolvedValue(null);

      const input = createInput();
      const result = await command.execute(input);

      expect(result).toBeNull();
      expect(conversationsRepository.retrieveByMessageId).not.toHaveBeenCalled();
      expect(messagesRepository.upsert).not.toHaveBeenCalled();
    });

    it("should return null when conversation is not found", async () => {
      const mockMessage = createMockMessage();
      messagesRepository.retrieve.mockResolvedValue(mockMessage);
      conversationsRepository.retrieveByMessageId.mockResolvedValue(null);

      const input = createInput();
      const result = await command.execute(input);

      expect(result).toBeNull();
      expect(messagesRepository.upsert).not.toHaveBeenCalled();
    });

    it("should retrieve message by messageId from input", async () => {
      messagesRepository.retrieve.mockResolvedValue(null);

      const input = createInput({ messageId: "custom-msg-id" });
      await command.execute(input);

      expect(messagesRepository.retrieve).toHaveBeenCalledWith("custom-msg-id");
    });

    it("should ignore failed update when current status is viewed", async () => {
      const mockMessage = createMockMessage({ status: "viewed" });

      messagesRepository.retrieve.mockResolvedValue(mockMessage);
      conversationsRepository.retrieveByMessageId.mockResolvedValue({
        conversation: createMockConversation(),
        workspaceId: "workspace-123",
      });

      const input = createInput({ status: "failed" });
      const result = await command.execute(input);

      expect(result).toBeNull();
      expect(messagesRepository.upsert).not.toHaveBeenCalled();
    });

    it("should ignore delivered update when current status is failed", async () => {
      const mockMessage = createMockMessage({ status: "failed" });

      messagesRepository.retrieve.mockResolvedValue(mockMessage);
      conversationsRepository.retrieveByMessageId.mockResolvedValue({
        conversation: createMockConversation(),
        workspaceId: "workspace-123",
      });

      const input = createInput({ status: "delivered" });
      const result = await command.execute(input);

      expect(result).toBeNull();
      expect(messagesRepository.upsert).not.toHaveBeenCalled();
    });
  });

  describe("repository calls", () => {
    it("should call upsert without conversationId parameter", async () => {
      const mockMessage = createMockMessage();
      const mockConversation = createMockConversation();

      messagesRepository.retrieve.mockResolvedValue(mockMessage);
      conversationsRepository.retrieveByMessageId.mockResolvedValue({
        conversation: mockConversation,
        workspaceId: "workspace-123",
      });

      const input = createInput();
      await command.execute(input);

      expect(messagesRepository.upsert).toHaveBeenCalledWith(mockMessage);
      expect(messagesRepository.upsert).toHaveBeenCalledTimes(1);
    });
  });
});
