import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  InboundChannelNotFoundError,
  ProcessInboundMessage,
} from "./process-inbound-message";
import { Channel } from "../../domain/entities/channel";
import { Partner } from "../../domain/entities/partner";
import { Conversation } from "../../domain/entities/conversation";
import { Contact } from "../../domain/entities/contact";
import { ConversationChannel } from "../../domain/entities/conversation-channel";
import { FlowExecution } from "../../domain/entities/flow-execution";
import { FlowExecutorDriver } from "../../infra/drivers/flow-executor/flow-executor-driver";
import { OnMessageReceivedProps } from "../../infra/controllers/evolution-event-handler";

describe("ProcessInboundMessage", () => {
  let channelsRepository: {
    retrieveByTypeAndPayload: ReturnType<typeof vi.fn>;
    retrieveByPayloadField: ReturnType<typeof vi.fn>;
    isInternalChannelPhone: ReturnType<typeof vi.fn>;
  };
  let partnersRepository: {
    retrieveByContactValue: ReturnType<typeof vi.fn>;
    retrieveByContactTypeAndUsername: ReturnType<typeof vi.fn>;
    listByContactTypeAndUsername: ReturnType<typeof vi.fn>;
    retrieveByContactTypeAndValue: ReturnType<typeof vi.fn>;
    findPartnerByExactContactValue: ReturnType<typeof vi.fn>;
    canonicalizePartners: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    deleteOrphan: ReturnType<typeof vi.fn>;
    createPartnerWithContactAtomic: ReturnType<typeof vi.fn>;
    addContactIfNotExists: ReturnType<typeof vi.fn>;
  };
  let conversationsRepository: {
    retrieveOpenByChannelIdAndContactId: ReturnType<typeof vi.fn>;
    retrieveOpenByGroupJid: ReturnType<typeof vi.fn>;
    retrieveLatestByChannelIdAndContactId: ReturnType<typeof vi.fn>;
    retrieveOpenByChannelAndPartnerName: ReturnType<typeof vi.fn>;
    retrieveByChannelAndPartnerName: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    retrieve: ReturnType<typeof vi.fn>;
    reopenAtomically: ReturnType<typeof vi.fn>;
    ensureWaitingStatus: ReturnType<typeof vi.fn>;
  };
  let messagesRepository: {
    upsert: ReturnType<typeof vi.fn>;
    retrieve: ReturnType<typeof vi.fn>;
    retrieveWithChannelId: ReturnType<typeof vi.fn>;
    existsInDifferentConversation: ReturnType<typeof vi.fn>;
  };
  let processedMessagesRepository: {
    exists: ReturnType<typeof vi.fn>;
    markProcessed: ReturnType<typeof vi.fn>;
  };
  let flowsInChannelsRepository: {
    findActiveFlowForChannel: ReturnType<typeof vi.fn>;
  };
  let flowExecutionsRepository: {
    retrievePausedByConversation: ReturnType<typeof vi.fn>;
  };
  let flowsInSectorsRepository: {
    listSectorIdsForFlow: ReturnType<typeof vi.fn>;
  };
  let command: ProcessInboundMessage;

  const mockChannel = Channel.instance({
    id: "channel-123",
    name: "Test Channel",
    status: "connected",
    createdAt: new Date(),
    type: "evolution",
    payload: { instanceName: "test-instance" },
    responseChannel: null,
    deletedAt: null,
  });

  let mockPartner: Partner;

  beforeEach(() => {
    mockPartner = Partner.create({
      name: "John Doe",
      contacts: [
        {
          id: "contact-123",
          type: "evolution",
          value: "5511999999999",
          thumbnail: "",
        },
      ],
    });
    channelsRepository = {
      retrieveByTypeAndPayload: vi.fn(),
      retrieveByPayloadField: vi.fn(),
      isInternalChannelPhone: vi.fn().mockResolvedValue(false),
    };
    partnersRepository = {
      retrieveByContactValue: vi.fn(),
      retrieveByContactTypeAndUsername: vi.fn().mockResolvedValue(null),
      listByContactTypeAndUsername: vi.fn().mockResolvedValue([]),
      retrieveByContactTypeAndValue: vi.fn(),
      findPartnerByExactContactValue: vi.fn().mockResolvedValue(null),
      canonicalizePartners: vi.fn().mockResolvedValue({
        canonicalPartner: null,
        canonicalPartnerId: null,
        mergedPartnerIds: [],
      }),
      upsert: vi.fn(),
      deleteOrphan: vi.fn(),
      createPartnerWithContactAtomic: vi.fn().mockResolvedValue({
        partner: mockPartner,
        isNew: true,
      }),
      addContactIfNotExists: vi.fn().mockResolvedValue(undefined),
    };
    conversationsRepository = {
      retrieveOpenByChannelIdAndContactId: vi.fn(),
      retrieveOpenByGroupJid: vi.fn(),
      retrieveLatestByChannelIdAndContactId: vi.fn().mockResolvedValue(null),
      retrieveOpenByChannelAndPartnerName: vi.fn().mockResolvedValue(null),
      retrieveByChannelAndPartnerName: vi.fn().mockResolvedValue(null),
      upsert: vi.fn(),
      retrieve: vi.fn().mockResolvedValue(null),
      reopenAtomically: vi
        .fn()
        .mockResolvedValue({ success: false, conversationId: null }),
      ensureWaitingStatus: vi.fn().mockResolvedValue(undefined),
    };
    messagesRepository = {
      upsert: vi.fn(),
      retrieve: vi.fn().mockResolvedValue(null),
      retrieveWithChannelId: vi.fn().mockResolvedValue(null),
      existsInDifferentConversation: vi
        .fn()
        .mockResolvedValue({ exists: false, existingConversationId: null }),
    };
    processedMessagesRepository = {
      exists: vi.fn().mockResolvedValue(false),
      markProcessed: vi.fn().mockResolvedValue(undefined),
    };
    flowsInChannelsRepository = {
      findActiveFlowForChannel: vi.fn().mockResolvedValue(null),
    };
    flowExecutionsRepository = {
      retrievePausedByConversation: vi.fn().mockResolvedValue(null),
    };
    flowsInSectorsRepository = {
      listSectorIdsForFlow: vi.fn().mockResolvedValue([]),
    };

    command = new ProcessInboundMessage(
      channelsRepository,
      partnersRepository,
      conversationsRepository,
      messagesRepository,
      processedMessagesRepository,
      flowsInChannelsRepository,
      flowExecutionsRepository,
      flowsInSectorsRepository,
    );
  });

  const createInput = (
    overrides: Partial<OnMessageReceivedProps> = {},
  ): OnMessageReceivedProps => ({
    instanceName: "test-instance",
    messageId: "msg-123",
    remoteJid: "5511999999999@s.whatsapp.net",
    fromMe: false,
    content: "Hello, world!",
    type: "text",
    timestamp: 1700000000,
    contactName: "John Doe",
    isGroup: false,
    ...overrides,
  });

  describe("successful message processing", () => {
    it("should process message with existing partner and conversation", async () => {
      channelsRepository.retrieveByTypeAndPayload.mockResolvedValue({
        channel: mockChannel,
        workspaceId: "workspace-123",
      });
      partnersRepository.retrieveByContactValue.mockResolvedValue(mockPartner);
      partnersRepository.retrieveByContactTypeAndValue.mockResolvedValue(null);

      const mockContact = Contact.instance({
        id: "contact-123",
        name: mockPartner.name,
        thumbnail: "",
        value: "5511999999999",
        username: "",
        type: "evolution",
      });
      const mockConversationChannel = ConversationChannel.instance({
        id: mockChannel.id,
        name: mockChannel.name,
        type: mockChannel.type,
      });
      const mockConversation = Conversation.instance({
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
      });
      conversationsRepository.retrieveOpenByChannelIdAndContactId.mockResolvedValue(
        mockConversation,
      );

      const input = createInput();
      const result = await command.execute(input);

      expect(result).not.toBeNull();
      expect(result?.workspaceId).toBe("workspace-123");
      expect(result?.isNewConversation).toBe(false);
      expect(result?.message.id).toBe("msg-123");
      expect(result?.message.content).toBe("Hello, world!");
      expect(result?.message.type).toBe("text");

      expect(messagesRepository.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ id: "msg-123" }),
        "conv-123",
      );
    });

    it("should create new partner when not found", async () => {
      channelsRepository.retrieveByTypeAndPayload.mockResolvedValue({
        channel: mockChannel,
        workspaceId: "workspace-123",
      });
      conversationsRepository.retrieveOpenByChannelIdAndContactId.mockResolvedValue(
        null,
      );

      const input = createInput({ contactName: "New Contact" });
      const result = await command.execute(input);

      expect(result).not.toBeNull();
      expect(result?.isNewConversation).toBe(true);
      expect(
        partnersRepository.createPartnerWithContactAtomic,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ name: "New Contact" }),
        expect.objectContaining({ value: "5511999999999" }),
        "workspace-123",
      );
    });

    it("should create new conversation when no open conversation exists", async () => {
      channelsRepository.retrieveByTypeAndPayload.mockResolvedValue({
        channel: mockChannel,
        workspaceId: "workspace-123",
      });
      partnersRepository.retrieveByContactValue.mockResolvedValue(mockPartner);
      partnersRepository.retrieveByContactTypeAndValue.mockResolvedValue(null);
      conversationsRepository.retrieveOpenByChannelIdAndContactId.mockResolvedValue(
        null,
      );

      const input = createInput();
      const result = await command.execute(input);

      expect(result).not.toBeNull();
      expect(result?.isNewConversation).toBe(true);
      expect(conversationsRepository.upsert).toHaveBeenCalled();
    });

    it("should extract phone number from remoteJid correctly", async () => {
      channelsRepository.retrieveByTypeAndPayload.mockResolvedValue({
        channel: mockChannel,
        workspaceId: "workspace-123",
      });
      conversationsRepository.retrieveOpenByChannelIdAndContactId.mockResolvedValue(
        null,
      );

      const input = createInput({
        remoteJid: "5511888888888@s.whatsapp.net",
      });

      await command.execute(input);

      expect(
        partnersRepository.createPartnerWithContactAtomic,
      ).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ value: "5511888888888" }),
        "workspace-123",
      );
    });

    it("should use phone number as name when contactName is empty", async () => {
      channelsRepository.retrieveByTypeAndPayload.mockResolvedValue({
        channel: mockChannel,
        workspaceId: "workspace-123",
      });
      conversationsRepository.retrieveOpenByChannelIdAndContactId.mockResolvedValue(
        null,
      );

      const input = createInput({
        contactName: "",
        remoteJid: "5511777777777@s.whatsapp.net",
      });

      await command.execute(input);

      expect(
        partnersRepository.createPartnerWithContactAtomic,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ name: "5511777777777" }),
        expect.objectContaining({ value: "5511777777777" }),
        "workspace-123",
      );
    });

    it("should process image message correctly", async () => {
      channelsRepository.retrieveByTypeAndPayload.mockResolvedValue({
        channel: mockChannel,
        workspaceId: "workspace-123",
      });
      partnersRepository.retrieveByContactValue.mockResolvedValue(mockPartner);
      partnersRepository.retrieveByContactTypeAndValue.mockResolvedValue(null);
      conversationsRepository.retrieveOpenByChannelIdAndContactId.mockResolvedValue(
        null,
      );

      const input = createInput({
        type: "image",
        content: "https://example.com/image.jpg",
        mediaUrl: "https://example.com/image.jpg",
        mimetype: "image/jpeg",
        caption: "Check this out!",
      });

      const result = await command.execute(input);

      expect(result?.message.type).toBe("image");
      expect(result?.message.content).toBe("https://example.com/image.jpg");
      expect(result?.message.caption).toBe("Check this out!");
      expect(result?.message.mimetype).toBe("image/jpeg");
    });

    it("should process audio message correctly", async () => {
      channelsRepository.retrieveByTypeAndPayload.mockResolvedValue({
        channel: mockChannel,
        workspaceId: "workspace-123",
      });
      partnersRepository.retrieveByContactValue.mockResolvedValue(mockPartner);
      partnersRepository.retrieveByContactTypeAndValue.mockResolvedValue(null);
      conversationsRepository.retrieveOpenByChannelIdAndContactId.mockResolvedValue(
        null,
      );

      const input = createInput({
        type: "audio",
        content: "https://example.com/audio.ogg",
        mediaUrl: "https://example.com/audio.ogg",
        mimetype: "audio/ogg",
      });

      const result = await command.execute(input);

      expect(result?.message.type).toBe("audio");
      expect(result?.message.mimetype).toBe("audio/ogg");
    });

    it("should process document message correctly", async () => {
      channelsRepository.retrieveByTypeAndPayload.mockResolvedValue({
        channel: mockChannel,
        workspaceId: "workspace-123",
      });
      partnersRepository.retrieveByContactValue.mockResolvedValue(mockPartner);
      partnersRepository.retrieveByContactTypeAndValue.mockResolvedValue(null);
      conversationsRepository.retrieveOpenByChannelIdAndContactId.mockResolvedValue(
        null,
      );

      const input = createInput({
        type: "document",
        content: "https://example.com/doc.pdf",
        mediaUrl: "https://example.com/doc.pdf",
        mimetype: "application/pdf",
        filename: "report.pdf",
      });

      const result = await command.execute(input);

      expect(result?.message.type).toBe("document");
      expect(result?.message.filename).toBe("report.pdf");
    });

    it("should synchronize instagram pending username with inbound scoped id", async () => {
      const mockInstagramChannel = Channel.instance({
        id: "instagram-channel-123",
        name: "Instagram Channel",
        status: "connected",
        createdAt: new Date(),
        type: "instagram",
        payload: {
          pageId: "ig-page-123",
          igUserId: "ig-user-123",
          accessToken: "token",
        },
        responseChannel: null,
        deletedAt: null,
      });

      const pendingInstagramPartner = Partner.create({
        name: "Alan Pedro",
        contacts: [
          {
            id: "ig-contact-1",
            type: "instagram",
            value: "alanpedro",
            username: "alanpedro",
            thumbnail: "",
            channelId: "instagram-channel-123",
          },
        ],
      });

      channelsRepository.retrieveByTypeAndPayload.mockResolvedValue({
        channel: mockInstagramChannel,
        workspaceId: "workspace-123",
      });
      partnersRepository.listByContactTypeAndUsername.mockResolvedValue(
        [pendingInstagramPartner],
      );
      partnersRepository.retrieveByContactTypeAndValue.mockResolvedValue(null);
      conversationsRepository.retrieveOpenByChannelIdAndContactId.mockResolvedValue(
        null,
      );

      const input = createInput({
        expectedChannelType: "instagram",
        instanceName: "ig-page-123",
        remoteJid: "1574724680481548",
        username: "alanpedro",
      });

      const result = await command.execute(input);

      expect(result).not.toBeNull();
      expect(partnersRepository.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          contacts: expect.arrayContaining([
            expect.objectContaining({
              id: "ig-contact-1",
              value: "1574724680481548",
              username: "alanpedro",
              type: "instagram",
            }),
          ]),
        }),
        "workspace-123",
      );
      expect(
        partnersRepository.createPartnerWithContactAtomic,
      ).not.toHaveBeenCalled();
    });

    it("should use existing scoped-id partner when username pending contact collides on value", async () => {
      const mockInstagramChannel = Channel.instance({
        id: "instagram-channel-123",
        name: "Instagram Channel",
        status: "connected",
        createdAt: new Date(),
        type: "instagram",
        payload: {
          pageId: "ig-page-123",
          igUserId: "ig-user-123",
          accessToken: "token",
        },
        responseChannel: null,
        deletedAt: null,
      });

      const pendingInstagramPartner = Partner.create({
        name: "Alan Pedro",
        contacts: [
          {
            id: "whatsapp-contact-1",
            type: "whatsapp",
            value: "5511999999999",
            username: "",
            thumbnail: "",
            channelId: null,
          },
          {
            id: "ig-contact-1",
            type: "instagram",
            value: "alanpedro",
            username: "alanpedro",
            thumbnail: "",
            channelId: "instagram-channel-123",
          },
        ],
      });
      const scopedIdPartner = Partner.create({
        name: "Alan Pedro",
        contacts: [
          {
            id: "ig-contact-scoped",
            type: "instagram",
            value: "1574724680481548",
            username: "",
            thumbnail: "",
            channelId: "instagram-channel-123",
          },
        ],
      });
      const canonicalPartner = Partner.create({
        name: "Alan Pedro",
        contacts: [
          {
            id: "whatsapp-contact-1",
            type: "whatsapp",
            value: "5511999999999",
            username: "",
            thumbnail: "",
            channelId: null,
          },
          {
            id: "ig-contact-scoped",
            type: "instagram",
            value: "1574724680481548",
            username: "",
            thumbnail: "",
            channelId: "instagram-channel-123",
          },
        ],
      });

      channelsRepository.retrieveByTypeAndPayload.mockResolvedValue({
        channel: mockInstagramChannel,
        workspaceId: "workspace-123",
      });
      partnersRepository.listByContactTypeAndUsername.mockResolvedValue(
        [pendingInstagramPartner],
      );
      partnersRepository.retrieveByContactTypeAndValue.mockResolvedValue(
        scopedIdPartner,
      );
      partnersRepository.canonicalizePartners.mockResolvedValue({
        canonicalPartner,
        canonicalPartnerId: canonicalPartner.id,
        mergedPartnerIds: [scopedIdPartner.id],
      });
      conversationsRepository.retrieveOpenByChannelIdAndContactId.mockResolvedValue(
        null,
      );

      const input = createInput({
        expectedChannelType: "instagram",
        instanceName: "ig-page-123",
        remoteJid: "1574724680481548",
        username: "alanpedro",
      });

      const result = await command.execute(input);

      expect(result).not.toBeNull();
      expect(partnersRepository.canonicalizePartners).toHaveBeenCalledWith(
        [pendingInstagramPartner.id, scopedIdPartner.id],
        "workspace-123",
      );
      expect(
        conversationsRepository.retrieveOpenByChannelIdAndContactId,
      ).toHaveBeenCalledWith(
        "instagram-channel-123",
        "ig-contact-scoped",
        null,
      );
      expect(partnersRepository.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ id: canonicalPartner.id }),
        "workspace-123",
      );
      expect(partnersRepository.upsert).not.toHaveBeenCalledWith(
        expect.objectContaining({ id: pendingInstagramPartner.id }),
        "workspace-123",
      );
      expect(
        partnersRepository.createPartnerWithContactAtomic,
      ).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should throw when channel is not found", async () => {
      channelsRepository.retrieveByTypeAndPayload.mockResolvedValue(null);

      const input = createInput();
      await expect(command.execute(input)).rejects.toBeInstanceOf(
        InboundChannelNotFoundError,
      );
      expect(partnersRepository.retrieveByContactValue).not.toHaveBeenCalled();
    });

    it("should lookup channel with evolution type and instanceName", async () => {
      channelsRepository.retrieveByTypeAndPayload.mockResolvedValue(null);

      const input = createInput({ instanceName: "my-custom-instance" });
      await expect(command.execute(input)).rejects.toBeInstanceOf(
        InboundChannelNotFoundError,
      );

      expect(channelsRepository.retrieveByTypeAndPayload).toHaveBeenCalledWith(
        "evolution",
        { instanceName: "my-custom-instance" },
      );
    });
  });

  describe("message status", () => {
    it("should set message status to delivered", async () => {
      channelsRepository.retrieveByTypeAndPayload.mockResolvedValue({
        channel: mockChannel,
        workspaceId: "workspace-123",
      });
      partnersRepository.retrieveByContactValue.mockResolvedValue(mockPartner);
      partnersRepository.retrieveByContactTypeAndValue.mockResolvedValue(null);
      conversationsRepository.retrieveOpenByChannelIdAndContactId.mockResolvedValue(
        null,
      );

      const input = createInput();
      const result = await command.execute(input);

      expect(result?.message.status).toBe("delivered");
    });
  });

  describe("timestamp handling", () => {
    it("should convert Unix timestamp to Date", async () => {
      channelsRepository.retrieveByTypeAndPayload.mockResolvedValue({
        channel: mockChannel,
        workspaceId: "workspace-123",
      });
      partnersRepository.retrieveByContactValue.mockResolvedValue(mockPartner);
      partnersRepository.retrieveByContactTypeAndValue.mockResolvedValue(null);
      conversationsRepository.retrieveOpenByChannelIdAndContactId.mockResolvedValue(
        null,
      );

      const unixTimestamp = 1700000000;
      const input = createInput({ timestamp: unixTimestamp });
      const result = await command.execute(input);

      const expectedDate = new Date(unixTimestamp * 1000);
      expect(result?.message.createdAt.getTime()).toBe(expectedDate.getTime());
    });
  });

  describe("response channel handling", () => {
    it("should use responseChannel when configured and connected", async () => {
      const mockResponseChannel = Channel.instance({
        id: "response-channel-456",
        name: "Response Channel",
        status: "connected",
        createdAt: new Date(),
        type: "whatsapp",
        payload: {
          phoneId: "response-phone",
          accessToken: "test-token",
          wabaId: "test-waba-id",
        },
        responseChannel: null,
        deletedAt: null,
      });

      const channelWithResponse = Channel.instance({
        id: "channel-123",
        name: "Receiving Channel",
        status: "connected",
        createdAt: new Date(),
        type: "evolution",
        payload: { instanceName: "test-instance" },
        responseChannel: mockResponseChannel,
        deletedAt: null,
      });

      channelsRepository.retrieveByTypeAndPayload.mockResolvedValue({
        channel: channelWithResponse,
        workspaceId: "workspace-123",
      });
      partnersRepository.retrieveByContactValue.mockResolvedValue(mockPartner);
      partnersRepository.retrieveByContactTypeAndValue.mockResolvedValue(null);
      conversationsRepository.retrieveOpenByChannelIdAndContactId.mockResolvedValue(
        null,
      );

      const input = createInput();
      const result = await command.execute(input);

      expect(result).not.toBeNull();
      expect(result?.isNewConversation).toBe(true);

      expect(
        conversationsRepository.retrieveOpenByChannelIdAndContactId,
      ).toHaveBeenCalledWith(
        "response-channel-456",
        "contact-123",
        "channel-123",
      );

      expect(conversationsRepository.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: expect.objectContaining({
            id: "response-channel-456",
            type: "whatsapp",
          }),
          receivedChannel: expect.objectContaining({
            id: "channel-123",
            type: "evolution",
          }),
        }),
        "workspace-123",
      );
    });

    it("should use original channel when responseChannel is disconnected", async () => {
      const mockDisconnectedResponseChannel = Channel.instance({
        id: "response-channel-456",
        name: "Disconnected Response Channel",
        status: "disconnected",
        createdAt: new Date(),
        type: "whatsapp",
        payload: {
          phoneId: "response-phone",
          accessToken: "test-token",
          wabaId: "test-waba-id",
        },
        responseChannel: null,
        deletedAt: null,
      });

      const channelWithDisconnectedResponse = Channel.instance({
        id: "channel-123",
        name: "Original Channel",
        status: "connected",
        createdAt: new Date(),
        type: "evolution",
        payload: { instanceName: "test-instance" },
        responseChannel: mockDisconnectedResponseChannel,
        deletedAt: null,
      });

      channelsRepository.retrieveByTypeAndPayload.mockResolvedValue({
        channel: channelWithDisconnectedResponse,
        workspaceId: "workspace-123",
      });
      partnersRepository.retrieveByContactValue.mockResolvedValue(mockPartner);
      partnersRepository.retrieveByContactTypeAndValue.mockResolvedValue(null);
      conversationsRepository.retrieveOpenByChannelIdAndContactId.mockResolvedValue(
        null,
      );

      const input = createInput();
      const result = await command.execute(input);

      expect(result).not.toBeNull();
      expect(result?.isNewConversation).toBe(true);

      expect(
        conversationsRepository.retrieveOpenByChannelIdAndContactId,
      ).toHaveBeenCalledWith("channel-123", "contact-123", null);

      expect(conversationsRepository.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: expect.objectContaining({
            id: "channel-123",
            type: "evolution",
          }),
          receivedChannel: null,
        }),
        "workspace-123",
      );
    });

    it("should use original channel when no responseChannel configured", async () => {
      channelsRepository.retrieveByTypeAndPayload.mockResolvedValue({
        channel: mockChannel,
        workspaceId: "workspace-123",
      });
      partnersRepository.retrieveByContactValue.mockResolvedValue(mockPartner);
      partnersRepository.retrieveByContactTypeAndValue.mockResolvedValue(null);
      conversationsRepository.retrieveOpenByChannelIdAndContactId.mockResolvedValue(
        null,
      );

      const input = createInput();
      const result = await command.execute(input);

      expect(result).not.toBeNull();
      expect(
        conversationsRepository.retrieveOpenByChannelIdAndContactId,
      ).toHaveBeenCalledWith("channel-123", "contact-123", null);

      expect(conversationsRepository.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: expect.objectContaining({
            id: "channel-123",
          }),
          receivedChannel: null,
        }),
        "workspace-123",
      );
    });

    it("should create separate conversations for different received channels", async () => {
      const mockResponseChannel = Channel.instance({
        id: "response-channel-456",
        name: "Response Channel",
        status: "connected",
        createdAt: new Date(),
        type: "whatsapp",
        payload: {
          phoneId: "response-phone",
          accessToken: "test-token",
          wabaId: "test-waba-id",
        },
        responseChannel: null,
        deletedAt: null,
      });

      const receivingChannelA = Channel.instance({
        id: "receiving-channel-A",
        name: "Receiving Channel A",
        status: "connected",
        createdAt: new Date(),
        type: "evolution",
        payload: { instanceName: "test-instance-A" },
        responseChannel: mockResponseChannel,
        deletedAt: null,
      });

      const receivingChannelB = Channel.instance({
        id: "receiving-channel-B",
        name: "Receiving Channel B",
        status: "connected",
        createdAt: new Date(),
        type: "evolution",
        payload: { instanceName: "test-instance-B" },
        responseChannel: mockResponseChannel,
        deletedAt: null,
      });

      channelsRepository.retrieveByTypeAndPayload
        .mockResolvedValueOnce({
          channel: receivingChannelA,
          workspaceId: "workspace-123",
        })
        .mockResolvedValueOnce({
          channel: receivingChannelB,
          workspaceId: "workspace-123",
        });

      partnersRepository.retrieveByContactValue.mockResolvedValue(mockPartner);
      partnersRepository.retrieveByContactTypeAndValue.mockResolvedValue(null);

      conversationsRepository.retrieveOpenByChannelIdAndContactId.mockResolvedValue(
        null,
      );

      const inputA = createInput();
      const resultA = await command.execute(inputA);

      expect(resultA).not.toBeNull();
      expect(
        conversationsRepository.retrieveOpenByChannelIdAndContactId,
      ).toHaveBeenCalledWith(
        "response-channel-456",
        "contact-123",
        "receiving-channel-A",
      );

      const inputB = createInput({ messageId: "msg-456" });
      const resultB = await command.execute(inputB);

      expect(resultB).not.toBeNull();
      expect(
        conversationsRepository.retrieveOpenByChannelIdAndContactId,
      ).toHaveBeenCalledWith(
        "response-channel-456",
        "contact-123",
        "receiving-channel-B",
      );

      expect(conversationsRepository.upsert).toHaveBeenCalledTimes(2);
    });

    it("should use whatsapp as contact type when receiving via evolution channel", async () => {
      const mockResponseChannel = Channel.instance({
        id: "response-channel-456",
        name: "Response Channel",
        status: "connected",
        createdAt: new Date(),
        type: "whatsapp",
        payload: {
          phoneId: "response-phone",
          accessToken: "test-token",
          wabaId: "test-waba-id",
        },
        responseChannel: null,
        deletedAt: null,
      });

      const evolutionChannel = Channel.instance({
        id: "channel-123",
        name: "Evolution Channel",
        status: "connected",
        createdAt: new Date(),
        type: "evolution",
        payload: { instanceName: "test-instance" },
        responseChannel: mockResponseChannel,
        deletedAt: null,
      });

      channelsRepository.retrieveByTypeAndPayload.mockResolvedValue({
        channel: evolutionChannel,
        workspaceId: "workspace-123",
      });
      partnersRepository.retrieveByContactValue.mockResolvedValue(null);
      partnersRepository.retrieveByContactTypeAndValue.mockResolvedValue(null);
      conversationsRepository.retrieveOpenByChannelIdAndContactId.mockResolvedValue(
        null,
      );

      const input = createInput({
        contactName: "Test Contact",
        remoteJid: "5511888888888@s.whatsapp.net",
      });

      await command.execute(input);

      // Evolution is a transport layer for WhatsApp, so contacts should be typed as "whatsapp"
      expect(partnersRepository.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          contacts: expect.arrayContaining([
            expect.objectContaining({
              type: "whatsapp",
            }),
          ]),
        }),
        "workspace-123",
      );
    });
  });

  describe("flow automation guard for attended conversations", () => {
    it("should not resume or start flow when conversation has attendant", async () => {
      const pausedExecution = FlowExecution.create({
        flowId: "flow-1",
        conversationId: "conv-123",
        initialNodeId: "node-1",
      });
      pausedExecution.pause();

      flowExecutionsRepository.retrievePausedByConversation.mockResolvedValue(
        pausedExecution,
      );

      const flowExecutorInstance = {
        resumeFlow: vi.fn(),
        executeFlow: vi.fn(),
      };
      const flowExecutorSpy = vi
        .spyOn(FlowExecutorDriver, "instance")
        .mockReturnValue(flowExecutorInstance as any);

      const conversation = Conversation.instance({
        id: "conv-123",
        contact: Contact.instance({
          id: "contact-123",
          name: "John Doe",
          thumbnail: "",
          value: "5511999999999",
          username: "",
          type: "evolution",
        }),
        channel: ConversationChannel.instance({
          id: mockChannel.id,
          name: mockChannel.name,
          type: mockChannel.type,
        }),
        attendant: { id: "user-1", name: "Agent" },
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
        activeFlowExecutionId: "execution-1",
        flowCompletedAt: null,
        receivedChannel: null,
        conversationType: "external",
        name: null,
        participants: [],
        groupJid: null,
      });

      await (command as any).processFlowTrigger(
        mockChannel,
        conversation,
        { content: "hello" },
        false,
        "workspace-123",
      );

      expect(flowExecutorInstance.resumeFlow).not.toHaveBeenCalled();
      expect(flowExecutorInstance.executeFlow).not.toHaveBeenCalled();
      expect(conversationsRepository.upsert).not.toHaveBeenCalled();

      flowExecutorSpy.mockRestore();
    });
  });
});
