import { Message } from "../../domain/entities/message";
import { MessagesDatabaseRepository } from "../../infra/repositories/messages-repository";
import { ConversationsDatabaseRepository } from "../../infra/repositories/conversations-repository";
import { OnMessageStatusUpdateProps } from "../../infra/controllers/evolution-event-handler";
import { Conversation } from "../../domain/entities/conversation";

const STATUS_PRIORITY: Record<string, number> = {
  senting: 0,
  sent: 1,
  delivered: 2,
  failed: 3,
  viewed: 3,
};

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 100;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

interface MessagesRepository {
  retrieve(messageId: string): Promise<Message | null>;
  upsert(message: Message, conversationId?: string): Promise<void>;
}

interface ConversationsRepository {
  retrieveByMessageId(
    messageId: string
  ): Promise<{ conversation: Conversation; workspaceId: string } | null>;
  upsert(conversation: Conversation, workspaceId: string): Promise<void>;
}

export type UpdateMessageStatusOutput = {
  message: Message;
  conversationId: string;
  workspaceId: string;
} | null;

export class UpdateMessageStatus {
  constructor(
    private readonly messagesRepository: MessagesRepository,
    private readonly conversationsRepository: ConversationsRepository
  ) {}

  async execute(
    input: OnMessageStatusUpdateProps,
    retryCount = 0
  ): Promise<UpdateMessageStatusOutput> {
    console.log(
      "[UpdateMessageStatus] Updating status for message:",
      input.messageId,
      "->",
      input.status,
      retryCount > 0 ? `(retry ${retryCount}/${MAX_RETRIES})` : ""
    );

    const message = await this.messagesRepository.retrieve(input.messageId);

    if (!message) {
      if (retryCount < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, retryCount);
        console.log(
          `[UpdateMessageStatus] Message not found, retrying in ${delay}ms: ${input.messageId} (status: ${input.status}, remoteJid: ${input.remoteJid})`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.execute(input, retryCount + 1);
      }

      console.log(
        `[UpdateMessageStatus] Message not found after max retries: ${input.messageId} (status: ${input.status}, remoteJid: ${input.remoteJid}, instance: ${input.instanceName})`
      );
      return null;
    }

    const currentPriority = STATUS_PRIORITY[message.status] ?? 0;
    const newPriority = STATUS_PRIORITY[input.status] ?? 0;

    if (newPriority <= currentPriority) {
      console.log(
        "[UpdateMessageStatus] Ignoring regressive status update:",
        input.messageId,
        message.status,
        "->",
        input.status
      );
      return null;
    }

    const conversationResult =
      await this.conversationsRepository.retrieveByMessageId(input.messageId);

    if (!conversationResult) {
      console.log(
        "[UpdateMessageStatus] Conversation not found for message:",
        input.messageId
      );
      return null;
    }

    switch (input.status) {
      case "sent":
        message.markAsSent();
        break;
      case "delivered":
        message.markAsDelivered();
        break;
      case "failed":
        message.markAsFailed();
        break;
      case "viewed":
        message.markAsViewed();
        break;
    }

    await this.messagesRepository.upsert(message);

    if (
      this.shouldExpireConversationAfterTemplateFailure(
        input,
        message,
        conversationResult.conversation
      )
    ) {
      conversationResult.conversation.expire();
      await this.conversationsRepository.upsert(
        conversationResult.conversation,
        conversationResult.workspaceId
      );
    }

    console.log(
      "[UpdateMessageStatus] Status updated:",
      input.messageId,
      "->",
      message.status
    );

    return {
      message,
      conversationId: conversationResult.conversation.id,
      workspaceId: conversationResult.workspaceId,
    };
  }

  private shouldExpireConversationAfterTemplateFailure(
    input: OnMessageStatusUpdateProps,
    message: Message,
    conversation: Conversation
  ): boolean {
    if (input.status !== "failed") return false;
    if (message.type !== "template") return false;
    if (conversation.status !== "open" && conversation.status !== "waiting")
      return false;

    const isOfficialMetaChannel =
      conversation.channel?.type === "whatsapp" ||
      conversation.channel?.type === "meta_api";

    if (!isOfficialMetaChannel) return false;

    const lastClientMessageAt = conversation.lastClientMessageCreatedAt;
    if (!lastClientMessageAt) return true;

    return Date.now() - lastClientMessageAt.getTime() > TWENTY_FOUR_HOURS_MS;
  }

  static instance(): UpdateMessageStatus {
    return new UpdateMessageStatus(
      MessagesDatabaseRepository.instance(),
      ConversationsDatabaseRepository.instance()
    );
  }
}
