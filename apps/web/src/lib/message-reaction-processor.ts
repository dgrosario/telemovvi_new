import type { Server as SocketIOServer } from "socket.io";
import type {
  MessageReaction,
  ReactorType,
} from "@omnichannel/core/infra/repositories/message-reactions-repository";

interface ProcessInboundMessageReactionInput {
  io: SocketIOServer;
  targetMessageId: string;
  emoji: string;
  reactorId: string;
  reactorName?: string;
  reactorType: ReactorType;
  isRemoval: boolean;
}

interface ProcessInboundMessageReactionDependencies {
  createDatabaseConnection: () => any;
  eq: (left: unknown, right: unknown) => unknown;
  conversations: {
    id: unknown;
    workspaceId: unknown;
  };
  messages: {
    id: unknown;
    conversationId: unknown;
  };
  reactionsRepository: {
    addReaction: (input: {
      messageId: string;
      emoji: string;
      reactorType: ReactorType;
      reactorId: string;
      reactorName?: string;
    }) => Promise<MessageReaction>;
    removeReaction: (
      messageId: string,
      emoji: string,
      reactorId: string
    ) => Promise<boolean>;
    removeReactionsByMessageAndReactor: (
      messageId: string,
      reactorId: string
    ) => Promise<number>;
  };
}

export async function processInboundMessageReaction(
  input: ProcessInboundMessageReactionInput,
  deps?: ProcessInboundMessageReactionDependencies
): Promise<void> {
  const resolvedDeps =
    deps ??
    (await (async (): Promise<ProcessInboundMessageReactionDependencies> => {
      const [
        { createDatabaseConnection, eq },
        { conversations, messages },
        { MessageReactionsDatabaseRepository },
      ] = await Promise.all([
        import("@omnichannel/core/infra/database"),
        import("@omnichannel/core/infra/database/schemas"),
        import("@omnichannel/core/infra/repositories/message-reactions-repository"),
      ]);

      return {
        createDatabaseConnection,
        eq,
        conversations,
        messages,
        reactionsRepository: MessageReactionsDatabaseRepository.instance(),
      };
    })());

  const db = resolvedDeps.createDatabaseConnection();
  const reactionsRepository = resolvedDeps.reactionsRepository;

  const [messageData] = await db
    .select({
      conversationId: resolvedDeps.messages.conversationId,
    })
    .from(resolvedDeps.messages)
    .where(resolvedDeps.eq(resolvedDeps.messages.id, input.targetMessageId));

  if (!messageData?.conversationId) {
    console.log(
      `[processInboundMessageReaction] Conversation not found for message: ${input.targetMessageId}`
    );
    return;
  }

  const [conversation] = await db
    .select({
      workspaceId: resolvedDeps.conversations.workspaceId,
    })
    .from(resolvedDeps.conversations)
    .where(
      resolvedDeps.eq(
        resolvedDeps.conversations.id,
        messageData.conversationId
      )
    );

  if (!conversation?.workspaceId) {
    console.log(
      `[processInboundMessageReaction] Workspace not found for conversation: ${messageData.conversationId}`
    );
    return;
  }

  const reactorName = input.reactorName || input.reactorId;
  let reaction: MessageReaction | null = null;
  let action: "added" | "removed" = "removed";

  if (input.isRemoval) {
    const removedCount = input.emoji
      ? (await reactionsRepository.removeReaction(
          input.targetMessageId,
          input.emoji,
          input.reactorId
        ))
        ? 1
        : 0
      : await reactionsRepository.removeReactionsByMessageAndReactor(
          input.targetMessageId,
          input.reactorId
        );

    if (removedCount > 0 && input.emoji) {
      reaction = {
        id: "",
        messageId: input.targetMessageId,
        emoji: input.emoji,
        reactorType: input.reactorType,
        reactorId: input.reactorId,
        reactorName,
        createdAt: new Date(),
      };
    }
  } else {
    action = "added";
    reaction = await reactionsRepository.addReaction({
      messageId: input.targetMessageId,
      emoji: input.emoji,
      reactorType: input.reactorType,
      reactorId: input.reactorId,
      reactorName,
    });
  }

  input.io.to(`workspace:${conversation.workspaceId}`).emit("message:reaction", {
    messageId: input.targetMessageId,
    conversationId: messageData.conversationId,
    action,
    reaction: reaction
      ? {
          id: reaction.id,
          emoji: reaction.emoji,
          reactorType: reaction.reactorType,
          reactorId: reaction.reactorId,
          reactorName: reaction.reactorName,
          createdAt: reaction.createdAt,
        }
      : null,
    removedBy: action === "removed" ? input.reactorId : null,
  });

  console.log(
    `[processInboundMessageReaction] Reaction ${action} for message ${input.targetMessageId}: ${input.emoji || "<all>"}`
  );
}
