import { FlowNode } from "../../../../domain/entities/flow-node";
import { getPayloadProperty } from "../../../../domain/entities/channel";
import { RabbitMQMessagingDriver } from "../../messaging-driver";
import { ExecutionContext, ExecutionResult, NodeHandler } from "../types";

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

function normalizeTemplateIdentifier(
  value: string | undefined | null
): string | null {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > 255) return null;
  return normalized;
}

export class TemplateNodeHandler implements NodeHandler {
  constructor(private readonly messagingDriver: MessagingDriver) {}

  canHandle(nodeType: FlowNode.Type): boolean {
    return nodeType === "template";
  }

  private resolveVariableValue(
    variableName: string,
    nodeData: FlowNode.TemplateData,
    context: ExecutionContext
  ): string {
    const mapping = nodeData.variableMapping[variableName];

    if (mapping) {
      if (mapping.source === "manual") {
        return mapping.value;
      }

      const varPath = mapping.value;
      return this.resolveFromContext(varPath, context) || "";
    }

    return context.conversation.contact?.name || "";
  }

  private resolveFromContext(
    path: string,
    context: ExecutionContext
  ): string | undefined {
    const variables = context.flowExecution.variables as Record<string, unknown>;

    switch (path) {
      case "partner.name":
      case "contact.name":
        return context.conversation.contact?.name;
      case "user.message":
        return context.userMessage;
      default:
        return variables[path]?.toString();
    }
  }

  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const nodeData = context.currentNode.data as FlowNode.TemplateData;
    const templateIdentifier =
      normalizeTemplateIdentifier(nodeData.templateName) ??
      normalizeTemplateIdentifier(nodeData.templateId);

    if (!context.conversation.contact) {
      return {
        success: false,
        shouldPause: false,
        nextNodeId: null,
        error: "Cannot execute flow on internal conversation",
      };
    }

    if (!templateIdentifier || !nodeData.channelId) {
      return {
        success: false,
        shouldPause: false,
        nextNodeId: null,
        error: "Template name and channel are required",
      };
    }

    try {
      const resolvedVariables: { name: string; value: string }[] = [];

      if (nodeData.variableMapping) {
        for (const [variableName] of Object.entries(nodeData.variableMapping)) {
          const resolvedValue = this.resolveVariableValue(
            variableName,
            nodeData,
            context
          );
          resolvedVariables.push({
            name: variableName,
            value: resolvedValue,
          });
        }
      }

      const body = {
        conversationId: context.conversation.id,
        channelId: context.channel.id,
        workspaceId: context.workspaceId,
        createdAt: new Date(),
        sender: {
          id: "flow-executor",
          name: "Bot",
        },
        type: "template",
        templateName: templateIdentifier,
        variables: resolvedVariables,
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
          error: "Failed to send template message to queue",
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
          error instanceof Error
            ? error.message
            : "Failed to send template message",
      };
    }
  }

  static instance(): TemplateNodeHandler {
    return new TemplateNodeHandler(RabbitMQMessagingDriver.instance());
  }
}
