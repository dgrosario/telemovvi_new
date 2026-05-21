import { beforeEach, describe, expect, it, vi } from "vitest";
import { Channel } from "../../domain/entities/channel";
import { Contact } from "../../domain/entities/contact";
import { Conversation } from "../../domain/entities/conversation";
import { Sector } from "../../domain/entities/sector";
import { User } from "../../domain/entities/user";
import { FlowStatusChecker } from "../services/flow-status-checker";
import { TransferConversation } from "./transfer-conversation";

describe("TransferConversation", () => {
  let conversationsRepository: {
    retrieve: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
  let sectorsRepository: {
    retrieve: ReturnType<typeof vi.fn>;
  };
  let usersRepository: {
    retrieve: ReturnType<typeof vi.fn>;
  };
  let humanTakeoverFlowTerminator: {
    terminateForConversation: ReturnType<typeof vi.fn>;
  };
  let command: TransferConversation;

  let conversation: Conversation;
  let sector: Sector;
  let user: User;

  beforeEach(() => {
    conversationsRepository = {
      retrieve: vi.fn(),
      upsert: vi.fn().mockResolvedValue(undefined),
    };
    sectorsRepository = {
      retrieve: vi.fn(),
    };
    usersRepository = {
      retrieve: vi.fn(),
    };
    humanTakeoverFlowTerminator = {
      terminateForConversation: vi.fn().mockResolvedValue(undefined),
    };

    command = new TransferConversation(
      conversationsRepository as any,
      sectorsRepository as any,
      usersRepository as any,
      humanTakeoverFlowTerminator as any
    );

    const channel = Channel.instance({
      id: "channel-1",
      name: "Channel",
      status: "connected",
      createdAt: new Date(),
      type: "evolution",
      payload: {},
      responseChannel: null,
      deletedAt: null,
    });
    const contact = Contact.instance({
      id: "contact-1",
      name: "Client",
      thumbnail: "",
      value: "5511999999999",
      username: "",
      type: "evolution",
    });

    conversation = Conversation.create(contact, channel);
    conversation.status = "open";

    sector = Sector.instance({
      id: "sector-1",
      name: "Support",
    });
    user = User.create({
      name: "Agent",
      email: "agent@example.com",
    });
  });

  it("terminates automation when transfer assigns an attendant", async () => {
    conversationsRepository.retrieve.mockResolvedValue(conversation);
    sectorsRepository.retrieve.mockResolvedValue(sector);
    usersRepository.retrieve.mockResolvedValue(user);

    await command.execute({
      conversationId: conversation.id,
      workspaceId: "workspace-1",
      sectorId: sector.id,
      attendantId: user.id,
      bypassSectorCheck: true,
    });

    expect(
      humanTakeoverFlowTerminator.terminateForConversation
    ).toHaveBeenCalledWith(conversation.id);
  });

  it("does not terminate automation when transfer has no attendant", async () => {
    conversationsRepository.retrieve.mockResolvedValue(conversation);
    sectorsRepository.retrieve.mockResolvedValue(sector);

    await command.execute({
      conversationId: conversation.id,
      workspaceId: "workspace-1",
      sectorId: sector.id,
      bypassSectorCheck: true,
    });

    expect(
      humanTakeoverFlowTerminator.terminateForConversation
    ).not.toHaveBeenCalled();
  });

  it("does not end the active flow when transfer has no attendant", async () => {
    conversation.activeFlowExecutionId = "flow-1";
    conversationsRepository.retrieve.mockResolvedValue(conversation);
    sectorsRepository.retrieve.mockResolvedValue(sector);

    const checkAndTerminateIfNeeded = vi.fn(async () => {
      conversation.activeFlowExecutionId = null;
      return true;
    });

    vi.spyOn(FlowStatusChecker, "instance").mockReturnValue({
      checkAndTerminateIfNeeded,
    } as unknown as FlowStatusChecker);

    await command.execute({
      conversationId: conversation.id,
      workspaceId: "workspace-1",
      sectorId: sector.id,
      bypassSectorCheck: true,
    });

    expect(checkAndTerminateIfNeeded).not.toHaveBeenCalled();
    expect(conversation.activeFlowExecutionId).toBe("flow-1");
  });
});
