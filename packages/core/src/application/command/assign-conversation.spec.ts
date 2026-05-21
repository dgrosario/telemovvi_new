import { beforeEach, describe, expect, it, vi } from "vitest";
import { Channel } from "../../domain/entities/channel";
import { Contact } from "../../domain/entities/contact";
import { Conversation } from "../../domain/entities/conversation";
import { User } from "../../domain/entities/user";
import { AssignConversation } from "./assign-conversation";

describe("AssignConversation", () => {
  let conversationsRepository: {
    retrieve: ReturnType<typeof vi.fn>;
    assignAtomically: ReturnType<typeof vi.fn>;
  };
  let humanTakeoverFlowTerminator: {
    terminateForConversation: ReturnType<typeof vi.fn>;
  };
  let command: AssignConversation;

  const workspaceId = "workspace-1";
  let conversation: Conversation;
  let user: User;

  beforeEach(() => {
    conversationsRepository = {
      retrieve: vi.fn(),
      assignAtomically: vi.fn(),
    };
    humanTakeoverFlowTerminator = {
      terminateForConversation: vi.fn().mockResolvedValue(undefined),
    };
    command = new AssignConversation(
      conversationsRepository as any,
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
    user = User.create({
      name: "Agent",
      email: "agent@example.com",
    });
  });

  it("terminates automation after successful assignment", async () => {
    const assignedConversation = Conversation.instance({
      ...conversation.raw(),
      attendant: { id: user.id, name: user.name },
      status: "open",
      openedAt: new Date(),
      firstOpenedAt: new Date(),
      closedAt: null,
    });

    conversationsRepository.retrieve
      .mockResolvedValueOnce(conversation)
      .mockResolvedValueOnce(assignedConversation);
    conversationsRepository.assignAtomically.mockResolvedValue({
      success: true,
      currentAttendantName: null,
    });

    await command.execute({
      conversationId: conversation.id,
      attendantId: user.id,
      workspaceId,
    });

    expect(
      humanTakeoverFlowTerminator.terminateForConversation
    ).toHaveBeenCalledWith(conversation.id);
  });

  it("does not terminate automation when atomic assignment fails", async () => {
    conversationsRepository.retrieve.mockResolvedValue(conversation);
    conversationsRepository.assignAtomically.mockResolvedValue({
      success: false,
      currentAttendantName: "Other Agent",
    });

    await expect(
      command.execute({
        conversationId: conversation.id,
        attendantId: user.id,
        workspaceId,
      })
    ).rejects.toThrow();

    expect(
      humanTakeoverFlowTerminator.terminateForConversation
    ).not.toHaveBeenCalled();
  });
});
