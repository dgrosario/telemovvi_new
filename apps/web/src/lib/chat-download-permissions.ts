import type { Conversation } from "@omnichannel/core/domain/entities/conversation";

type CanDownloadDocumentInChatInput = {
  hasBypassAttendance: boolean;
  conversationType?: Conversation.Type | null;
  conversationAttendantId?: string | null;
  currentUserId?: string | null;
};

export function canDownloadDocumentInChat(
  input: CanDownloadDocumentInChatInput
): boolean {
  if (input.hasBypassAttendance) {
    return true;
  }

  if (
    input.conversationType === "direct" ||
    input.conversationType === "group" ||
    input.conversationType === "whatsapp-group"
  ) {
    return true;
  }

  return (
    !!input.conversationAttendantId &&
    !!input.currentUserId &&
    input.conversationAttendantId === input.currentUserId
  );
}
