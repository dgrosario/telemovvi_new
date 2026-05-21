import { FlowNode } from "../../../../domain/entities/flow-node";
import { getPayloadProperty } from "../../../../domain/entities/channel";
import { RabbitMQMessagingDriver } from "../../messaging-driver";
import { ExecutionContext, ExecutionResult, NodeHandler } from "../types";
import { replaceVariables } from "../variable-replacer";

const OUTBOUND_QUEUE = process.env.OUTBOUND_QUEUE || "outbound-messages";

type SendMessageToQueueProps = {
  queueUrl: string;
  body: object;
  groupId: string;
  messageId: string;
};

interface MessagingDriver {
  sendMessageToQueue(data: SendMessageToQueueProps): Promise<boolean>;
}

export class MessageNodeHandler implements NodeHandler {
  constructor(private readonly messagingDriver: MessagingDriver) {}

  canHandle(nodeType: FlowNode.Type): boolean {
    return nodeType === "message";
  }



  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const nodeData = context.currentNode.data as FlowNode.MessageData;

    if (!context.conversation.contact) {
      return {
        success: false,
        shouldPause: false,
        nextNodeId: null,
        error: "Cannot execute flow on internal conversation",
      };
    }

    if (!nodeData.content) {
      return {
        success: false,
        shouldPause: false,
        nextNodeId: null,
        error: "Message content is required",
      };
    }

    const content = replaceVariables(nodeData.content, context);

    try {
      const body = {
        content,
        conversationId: context.conversation.id,
        channelId: context.channel.id,
        workspaceId: context.workspaceId,
        createdAt: new Date(),
        sender: {
          id: "flow-executor",
          name: "Bot",
        },
        type: "text",
        to: context.conversation.contact.value,
        channel: {
          id: context.channel.id,
          type: context.channel.type,
          payload: {
            phoneNumberId: getPayloadProperty(context.channel.payload, "phoneId"),
            pageId: getPayloadProperty(context.channel.payload, "pageId"),
            accessToken: getPayloadProperty(context.channel.payload, "accessToken"),
            instanceName: getPayloadProperty(context.channel.payload, "instanceName"),
          },
        },
      };

      const result = await this.messagingDriver.sendMessageToQueue({
        queueUrl: OUTBOUND_QUEUE,
        body,
        groupId: context.conversation.id,
        messageId: crypto.randomUUID(),
      });

      if (!result) {
        return {
          success: false,
          shouldPause: false,
          nextNodeId: null,
          error: "Failed to send message to queue",
        };
      }

      return {
        success: true,
        shouldPause: false,
        nextNodeId: null,
      };
    } catch (error) {
      return {
        success: false,
        shouldPause: false,
        nextNodeId: null,
        error:
          error instanceof Error ? error.message : "Failed to send message",
      };
    }
  }

  static instance() {
    return new MessageNodeHandler(RabbitMQMessagingDriver.instance());
  }
}
