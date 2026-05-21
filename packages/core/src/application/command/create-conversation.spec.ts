import { beforeEach, describe, expect, it, vi } from "vitest";
import { Channel } from "../../domain/entities/channel";
import { Contact } from "../../domain/entities/contact";
import { Conversation } from "../../domain/entities/conversation";
import { Partner } from "../../domain/entities/partner";
import { User } from "../../domain/entities/user";
import { CreateConversation } from "./create-conversation";

describe("CreateConversation", () => {
  const workspaceId = "workspace-1";

  let usersRepository: {
    retrieve: ReturnType<typeof vi.fn>;
  };
  let partnersRepository: {
    retrieve: ReturnType<typeof vi.fn>;
  };
  let channelsRepository: {
    retrieve: ReturnType<typeof vi.fn>;
  };
  let conversationsRepository: {
    retrieve: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    retrieveOpenByChannelIdAndContactId: ReturnType<typeof vi.fn>;
    retrieveLatestByChannelIdAndContactId: ReturnType<typeof vi.fn>;
    reopenAtomically: ReturnType<typeof vi.fn>;
  };
  let messagingDriver: {
    sendMessageToQueue: ReturnType<typeof vi.fn>;
  };
  let messagesRepository: {
    upsert: ReturnType<typeof vi.fn>;
  };
  let sectorsRepository: {
    retrieve: ReturnType<typeof vi.fn>;
  };

  let command: CreateConversation;
  let user: User;
  let channel: Channel;

  beforeEach(() => {
    usersRepository = {
      retrieve: vi.fn(),
    };
    partnersRepository = {
      retrieve: vi.fn(),
    };
    channelsRepository = {
      retrieve: vi.fn(),
    };
    conversationsRepository = {
      retrieve: vi.fn(),
      upsert: vi.fn(),
      retrieveOpenByChannelIdAndContactId: vi.fn(),
      retrieveLatestByChannelIdAndContactId: vi.fn(),
      reopenAtomically: vi.fn(),
    };
    messagingDriver = {
      sendMessageToQueue: vi.fn(),
    };
    messagesRepository = {
      upsert: vi.fn(),
    };
    sectorsRepository = {
      retrieve: vi.fn(),
    };

    command = new CreateConversation(
      channelsRepository,
      partnersRepository,
      usersRepository,
      conversationsRepository,
      messagingDriver,
      messagesRepository,
      sectorsRepository
    );

    user = User.create({
      name: "Atendente Teste",
      email: "teste@example.com",
    });

    channel = Channel.instance({
      id: "channel-1",
      name: "WhatsApp",
      status: "connected",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      type: "evolution",
      payload: {
        instanceName: "instance-test",
      },
      responseChannel: null,
      deletedAt: null,
    });

    usersRepository.retrieve.mockResolvedValue(user);
    channelsRepository.retrieve.mockResolvedValue(channel);
    conversationsRepository.reopenAtomically.mockResolvedValue({
      success: false,
      conversationId: null,
    });
    sectorsRepository.retrieve.mockResolvedValue(null);
    messagingDriver.sendMessageToQueue.mockResolvedValue(true);
    conversationsRepository.upsert.mockResolvedValue(undefined);
    messagesRepository.upsert.mockResolvedValue(undefined);
  });

  it("blocks manual conversation creation for instagram contacts", async () => {
    const partner = Partner.create({
      name: "Cliente Instagram",
      contacts: [
        {
          id: "contact-instagram",
          type: "instagram",
          value: "softtor",
        },
      ],
    });
    partnersRepository.retrieve.mockResolvedValue(partner);

    await expect(
      command.execute({
        channelId: channel.id,
        userId: user.id,
        workspaceId,
        partnerId: partner.id,
        contactId: "contact-instagram",
      })
    ).rejects.toThrow(
      "Não é possível iniciar conversa com este contato. Selecione um número de telefone válido."
    );

    expect(
      conversationsRepository.retrieveOpenByChannelIdAndContactId
    ).not.toHaveBeenCalled();
  });

  it("blocks manual conversation creation for non-phone whatsapp values", async () => {
    const partner = Partner.create({
      name: "Cliente com ID",
      contacts: [
        {
          id: "contact-id-like",
          type: "whatsapp",
          value: "85380057575449",
        },
      ],
    });
    partnersRepository.retrieve.mockResolvedValue(partner);

    await expect(
      command.execute({
        channelId: channel.id,
        userId: user.id,
        workspaceId,
        partnerId: partner.id,
        contactId: "contact-id-like",
      })
    ).rejects.toThrow(
      "Não é possível iniciar conversa com este contato. Selecione um número de telefone válido."
    );

    expect(
      conversationsRepository.retrieveOpenByChannelIdAndContactId
    ).not.toHaveBeenCalled();
  });

  it("allows creation when contact is a valid phone number", async () => {
    const partner = Partner.create({
      name: "Cliente Telefone",
      contacts: [
        {
          id: "contact-phone",
          type: "whatsapp",
          value: "5511999999999",
        },
      ],
    });
    partnersRepository.retrieve.mockResolvedValue(partner);

    const existingConversation = Conversation.create(
      Contact.fromPartner(partner, "contact-phone"),
      channel
    );
    existingConversation.assign(user);

    conversationsRepository.retrieveOpenByChannelIdAndContactId.mockResolvedValue(
      existingConversation
    );

    const conversationId = await command.execute({
      channelId: channel.id,
      userId: user.id,
      workspaceId,
      partnerId: partner.id,
      contactId: "contact-phone",
    });

    expect(conversationId).toBe(existingConversation.id);
    expect(conversationsRepository.upsert).toHaveBeenCalledWith(
      existingConversation,
      workspaceId
    );
    expect(messagesRepository.upsert).toHaveBeenCalledTimes(1);
  });
});
