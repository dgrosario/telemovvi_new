import { Message } from "@omnichannel/core/domain/entities/message";

type MessageSentConfirmedEvent = {
  conversationId: string;
  correlationId?: string;
  message: Message.Raw;
};

type ReconcileSentConfirmationInput = {
  event: MessageSentConfirmedEvent;
  messages: Map<string, Message>;
  openConversationId: string | null;
  pendingStatusByMessageId: Map<string, Message.Status>;
};

type ReconcileSentConfirmationResult = {
  applied: boolean;
  matchedBy: "correlationId" | "messageId" | "openConversation" | null;
  nextMessages: Map<string, Message>;
  consumedPendingStatus: boolean;
};

export function reconcileSentConfirmation({
  event,
  messages,
  openConversationId,
  pendingStatusByMessageId,
}: ReconcileSentConfirmationInput): ReconcileSentConfirmationResult {
  const confirmedMessage = Message.fromRaw(event.message);
  const hasCorrelationMatch = Boolean(
    event.correlationId && messages.has(event.correlationId)
  );
  const hasPersistedMatch = messages.has(confirmedMessage.id);
  const isOpenConversation = openConversationId === event.conversationId;

  if (!hasCorrelationMatch && !hasPersistedMatch && !isOpenConversation) {
    return {
      applied: false,
      matchedBy: null,
      nextMessages: messages,
      consumedPendingStatus: false,
    };
  }

  const nextMessages = new Map(messages);
  const matchedBy = hasCorrelationMatch
    ? "correlationId"
    : hasPersistedMatch
      ? "messageId"
      : "openConversation";

  if (
    event.correlationId &&
    event.correlationId !== confirmedMessage.id &&
    nextMessages.has(event.correlationId)
  ) {
    nextMessages.delete(event.correlationId);
  }

  let incomingMessageRaw = confirmedMessage.raw();
  const pendingStatus = pendingStatusByMessageId.get(confirmedMessage.id);
  const consumedPendingStatus = Boolean(pendingStatus);

  if (pendingStatus) {
    incomingMessageRaw = {
      ...incomingMessageRaw,
      status:
        getMessageStatusPriority(pendingStatus) >
        getMessageStatusPriority(incomingMessageRaw.status)
          ? pendingStatus
          : incomingMessageRaw.status,
    };
  }

  const existingPersistedMessage = nextMessages.get(confirmedMessage.id);
  if (existingPersistedMessage) {
    const existingPersistedRaw = existingPersistedMessage.raw();
    incomingMessageRaw = {
      ...existingPersistedRaw,
      ...incomingMessageRaw,
      status:
        getMessageStatusPriority(existingPersistedRaw.status) >
        getMessageStatusPriority(incomingMessageRaw.status)
          ? existingPersistedRaw.status
          : incomingMessageRaw.status,
    };
  }

  nextMessages.set(confirmedMessage.id, Message.fromRaw(incomingMessageRaw));

  return {
    applied: true,
    matchedBy,
    nextMessages,
    consumedPendingStatus,
  };
}

function getMessageStatusPriority(status: Message.Status): number {
  switch (status) {
    case "senting":
      return 0;
    case "sent":
      return 1;
    case "delivered":
      return 2;
    case "failed":
    case "viewed":
      return 3;
    default:
      return 0;
  }
}
