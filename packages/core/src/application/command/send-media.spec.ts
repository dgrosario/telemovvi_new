import { beforeEach, describe, expect, it, vi } from "vitest";
import { Channel } from "../../domain/entities/channel";
import { Contact } from "../../domain/entities/contact";
import { Conversation } from "../../domain/entities/conversation";
import { User } from "../../domain/entities/user";
import { SendMedia } from "./send-media";

describe("SendMedia", () => {
  let conversationsRepository: {
    retrieve: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
  let channelsRepository: {
    retrieve: ReturnType<typeof vi.fn>;
  };
  let messagingDriver: {
    sendMessageToQueue: ReturnType<typeof vi.fn>;
  };
  let usersRepository: {
    retrieve: ReturnType<typeof vi.fn>;
  };
  let humanTakeoverFlowTerminator: {
    terminateForConversation: ReturnType<typeof vi.fn>;
  };

  let command: SendMedia;
  let instagramChannel: Channel;
  let user: User;
  const workspaceId = "workspace-1";

  beforeEach(() => {
    conversationsRepository = {
      retrieve: vi.fn(),
      upsert: vi.fn(),
    };
    channelsRepository = {
      retrieve: vi.fn(),
    };
    messagingDriver = {
      sendMessageToQueue: vi.fn().mockResolvedValue(true),
    };
    usersRepository = {
      retrieve: vi.fn(),
    };
    humanTakeoverFlowTerminator = {
      terminateForConversation: vi.fn().mockResolvedValue(undefined),
    };

    command = new SendMedia(
      conversationsRepository,
      channelsRepository,
      messagingDriver,
      usersRepository,
      humanTakeoverFlowTerminator as any,
    );

    instagramChannel = Channel.instance({
      id: "channel-ig-1",
      name: "Instagram",
      status: "connected",
      createdAt: new Date(),
      type: "instagram",
      payload: {
        pageId: "page-id",
        igUserId: "ig-user-id",
        accessToken: "token",
      },
      responseChannel: null,
      deletedAt: null,
    });

    user = User.create({
      name: "Tester",
      email: "tester@example.com",
    });

    channelsRepository.retrieve.mockResolvedValue(instagramChannel);
    usersRepository.retrieve.mockResolvedValue(user);
  });

  it("blocks instagram media send when destination is username (without scoped ID)", async () => {
    const conversation = Conversation.create(
      Contact.instance({
        id: "contact-1",
        name: "Instagram Pending",
        thumbnail: "",
        value: "pending.username",
        username: "pending.username",
        type: "instagram",
      }),
      instagramChannel,
    );

    conversationsRepository.retrieve.mockResolvedValue(conversation);

    await expect(
      command.execute({
        conversationId: conversation.id,
        channelId: instagramChannel.id,
        userId: user.id,
        userName: user.name,
        workspaceId,
        filename: "arquivo.jpg",
        mimeType: "image/jpeg",
        type: "image",
        mediaId: "media-1",
      }),
    ).rejects.toThrow(
      "Contato Instagram ainda sem ID sincronizado. Aguarde a primeira mensagem do @username para sincronizar.",
    );

    expect(messagingDriver.sendMessageToQueue).not.toHaveBeenCalled();
  });

  it("allows instagram media send when destination is numeric scoped ID", async () => {
    const conversation = Conversation.create(
      Contact.instance({
        id: "contact-1",
        name: "Instagram Synced",
        thumbnail: "",
        value: "1574724680481548",
        username: "synced.username",
        type: "instagram",
      }),
      instagramChannel,
    );

    conversationsRepository.retrieve.mockResolvedValue(conversation);

    await command.execute({
      conversationId: conversation.id,
      channelId: instagramChannel.id,
      userId: user.id,
      userName: user.name,
      workspaceId,
      filename: "arquivo.jpg",
      mimeType: "image/jpeg",
      type: "image",
      mediaId: "media-1",
    });

    expect(messagingDriver.sendMessageToQueue).toHaveBeenCalledTimes(1);
  });

  it("terminates flow when user takes over unattended conversation", async () => {
    const conversation = Conversation.create(
      Contact.instance({
        id: "contact-1",
        name: "Instagram Synced",
        thumbnail: "",
        value: "1574724680481548",
        username: "synced.username",
        type: "instagram",
      }),
      instagramChannel,
    );

    conversationsRepository.retrieve.mockResolvedValue(conversation);

    await command.execute({
      conversationId: conversation.id,
      channelId: instagramChannel.id,
      userId: user.id,
      userName: user.name,
      workspaceId,
      filename: "arquivo.jpg",
      mimeType: "image/jpeg",
      type: "image",
      mediaId: "media-1",
    });

    expect(
      humanTakeoverFlowTerminator.terminateForConversation,
    ).toHaveBeenCalledWith(conversation.id);
  });

  it("does not terminate flow when conversation already has attendant", async () => {
    const conversation = Conversation.create(
      Contact.instance({
        id: "contact-1",
        name: "Instagram Synced",
        thumbnail: "",
        value: "1574724680481548",
        username: "synced.username",
        type: "instagram",
      }),
      instagramChannel,
    );
    conversation.assign(user);

    conversationsRepository.retrieve.mockResolvedValue(conversation);

    await command.execute({
      conversationId: conversation.id,
      channelId: instagramChannel.id,
      userId: user.id,
      userName: user.name,
      workspaceId,
      filename: "arquivo.jpg",
      mimeType: "image/jpeg",
      type: "image",
      mediaId: "media-1",
    });

    expect(
      humanTakeoverFlowTerminator.terminateForConversation,
    ).not.toHaveBeenCalled();
  });

  it("opens a waiting conversation that is already assigned when sending media", async () => {
    const conversation = Conversation.create(
      Contact.instance({
        id: "contact-1",
        name: "Instagram Synced",
        thumbnail: "",
        value: "1574724680481548",
        username: "synced.username",
        type: "instagram",
      }),
      instagramChannel,
    );
    conversation.assign(user);
    conversation.status = "waiting";
    conversation.openedAt = null;
    conversation.waitingAt = new Date();

    conversationsRepository.retrieve.mockResolvedValue(conversation);

    await command.execute({
      conversationId: conversation.id,
      channelId: instagramChannel.id,
      userId: user.id,
      userName: user.name,
      workspaceId,
      filename: "arquivo.jpg",
      mimeType: "image/jpeg",
      type: "image",
      mediaId: "media-1",
    });

    expect(conversation.status).toBe("open");
    expect(conversation.attendant?.id).toBe(user.id);
    expect(conversationsRepository.upsert).toHaveBeenCalledWith(
      conversation,
      workspaceId,
    );
    expect(
      humanTakeoverFlowTerminator.terminateForConversation,
    ).not.toHaveBeenCalled();
  });
});
