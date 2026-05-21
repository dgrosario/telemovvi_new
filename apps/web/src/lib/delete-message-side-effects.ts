import type { Server as SocketIOServer } from "socket.io";
import type { QueryClient } from "@tanstack/react-query";
import type { Conversation } from "@omnichannel/core/domain/entities/conversation";

type ConversationRetriever = {
  retrieve: (
    conversationId: string
  ) => Promise<{ raw(): Conversation.Raw } | null>;
};

type MessageSoftDeleteRepository = {
  softDelete: (messageId: string, deletedAt?: Date) => Promise<void>;
};

type DeleteMessageSocketPayload = {
  messageId: string;
  conversationId: string;
  deletedAt: string;
  conversation: Conversation.Raw | null;
};

export async function finalizeDeletedMessage(props: {
  messageId: string;
  conversationId: string;
  workspaceId: string;
  conversationsRepository: ConversationRetriever;
  messagesRepository: MessageSoftDeleteRepository;
  socket?: Pick<SocketIOServer, "to"> | null;
  deletedAt?: Date;
}): Promise<DeleteMessageSocketPayload> {
  const deletedAt = props.deletedAt ?? new Date();

  await props.messagesRepository.softDelete(props.messageId, deletedAt);

  const updatedConversation = await props.conversationsRepository.retrieve(
    props.conversationId
  );

  const payload: DeleteMessageSocketPayload = {
    messageId: props.messageId,
    conversationId: props.conversationId,
    deletedAt: deletedAt.toISOString(),
    conversation: updatedConversation?.raw() ?? null,
  };

  props.socket
    ?.to(`workspace:${props.workspaceId}`)
    .emit("message:deleted", payload);

  return payload;
}

export async function invalidateDeletedMessageQueries(
  queryClient: Pick<QueryClient, "invalidateQueries">,
  conversationId?: string | null
): Promise<void> {
  const invalidations: Promise<unknown>[] = [
    queryClient.invalidateQueries({
      queryKey: ["conversations-paginated"],
    }),
  ];

  if (conversationId) {
    invalidations.push(
      queryClient.invalidateQueries({
        queryKey: ["messages-paginated", conversationId],
        refetchType: "active",
      }),
      queryClient.invalidateQueries({
        queryKey: ["retrieve-conversation", conversationId],
        refetchType: "active",
      })
    );
  }

  await Promise.all(invalidations);
}
