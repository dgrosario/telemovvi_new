import { beforeEach, describe, expect, it, vi } from "vitest";
import { Channel } from "../../../../domain/entities/channel";
import { Contact } from "../../../../domain/entities/contact";
import { Conversation } from "../../../../domain/entities/conversation";
import { FlowNode } from "../../../../domain/entities/flow-node";
import { Sector } from "../../../../domain/entities/sector";
import { User } from "../../../../domain/entities/user";
import { ActionNodeHandler } from "./action-node-handler";
import type { ExecutionContext } from "../types";

function createContext(
  conversation: Conversation,
  data: FlowNode.ActionData
): ExecutionContext {
  return {
    flowExecution: {
      variables: {},
      getVariable: vi.fn(),
      setVariable: vi.fn(),
      deleteVariable: vi.fn(),
    },
    currentNode: {
      id: "action-node-1",
      type: "action",
      data,
    },
    conversation,
    channel: Channel.instance({
      id: "channel-1",
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
    }),
    workspaceId: "workspace-1",
    resolvedSystemVariables: {},
    cache: {
      partners: new Map(),
      partnerLabels: new Map(),
    },
    partnerMetadata: undefined,
  } as unknown as ExecutionContext;
}

describe("ActionNodeHandler", () => {
  let usersRepository: {
    retrieve: ReturnType<typeof vi.fn>;
  };
  let sectorsRepository: {
    retrieve: ReturnType<typeof vi.fn>;
  };
  let handler: ActionNodeHandler;
  let user: User;
  let sector: Sector;

  beforeEach(() => {
    usersRepository = {
      retrieve: vi.fn(),
    };
    sectorsRepository = {
      retrieve: vi.fn(),
    };

    handler = new ActionNodeHandler(
      {
        retrieveByPartnerContactIdWithWorkspace: vi.fn(),
        upsert: vi.fn(),
        updatePartnerFieldByContactId: vi.fn(),
      },
      usersRepository,
      sectorsRepository,
      {
        sendMessageToQueue: vi.fn(),
      },
      {
        addLabelsToPartner: vi.fn(),
        removeAllLabelsFromPartner: vi.fn(),
        setPartnerLabels: vi.fn(),
        listLabelsByPartner: vi.fn(),
      }
    );

    user = User.create({
      name: "Denilson Gomes",
      email: "denilson@example.com",
    });

    sector = Sector.instance({
      id: "sector-1",
      name: "Sao Manuel",
    });
  });

  function createConversation(): Conversation {
    return Conversation.create(
      Contact.instance({
        id: "contact-1",
        name: "Cliente Instagram",
        thumbnail: "",
        value: "1234567890",
        username: "cliente",
        type: "instagram",
      }),
      Channel.instance({
        id: "channel-1",
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
      })
    );
  }

  it("opens the conversation when assign_conversation links an attendant", async () => {
    const conversation = createConversation();
    usersRepository.retrieve.mockResolvedValue(user);

    const result = await handler.execute(
      createContext(conversation, {
        actionType: "assign_conversation",
        attendantId: user.id,
      })
    );

    expect(result.success).toBe(true);
    expect(conversation.status).toBe("open");
    expect(conversation.attendant?.id).toBe(user.id);
    expect(conversation.openedAt).not.toBeNull();
  });

  it("preserves the current sector when assign_conversation opens the conversation", async () => {
    const conversation = createConversation();
    conversation.sector = sector;
    usersRepository.retrieve.mockResolvedValue(user);

    await handler.execute(
      createContext(conversation, {
        actionType: "assign_conversation",
        attendantId: user.id,
      })
    );

    expect(conversation.status).toBe("open");
    expect(conversation.sector?.id).toBe(sector.id);
  });

  it("keeps the conversation pending when transfer assigns only a sector", async () => {
    const conversation = createConversation();
    sectorsRepository.retrieve.mockResolvedValue(sector);

    const result = await handler.execute(
      createContext(conversation, {
        actionType: "transfer",
        sectorId: sector.id,
      })
    );

    expect(result.success).toBe(true);
    expect(conversation.status).toBe("waiting");
    expect(conversation.attendant).toBeNull();
    expect(conversation.sector?.id).toBe(sector.id);
  });

  it("opens the conversation when transfer includes an attendant", async () => {
    const conversation = createConversation();
    sectorsRepository.retrieve.mockResolvedValue(sector);
    usersRepository.retrieve.mockResolvedValue(user);

    const result = await handler.execute(
      createContext(conversation, {
        actionType: "transfer",
        sectorId: sector.id,
        attendantId: user.id,
      })
    );

    expect(result.success).toBe(true);
    expect(conversation.status).toBe("open");
    expect(conversation.attendant?.id).toBe(user.id);
    expect(conversation.sector?.id).toBe(sector.id);
  });
});
