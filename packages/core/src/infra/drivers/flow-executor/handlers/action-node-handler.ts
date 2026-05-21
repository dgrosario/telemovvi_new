import { FlowNode } from "../../../../domain/entities/flow-node";
import { Partner } from "../../../../domain/entities/partner";
import { Sector } from "../../../../domain/entities/sector";
import { User } from "../../../../domain/entities/user";
import { getPayloadProperty } from "../../../../domain/entities/channel";
import { PartnersDatabaseRepository } from "../../../repositories/partners-repository";
import { PartnersLabelsDatabaseRepository } from "../../../repositories/partners-labels-repository";
import { UsersDatabaseRepository } from "../../../repositories/users-repository";
import { SectorsDatabaseRepository } from "../../../repositories/sectors-respository";
import { RabbitMQMessagingDriver } from "../../messaging-driver";
import { ExecutionContext, ExecutionResult, NodeHandler } from "../types";
import { validateCPF, validateCNPJ } from "../validators";

const OUTBOUND_QUEUE = process.env.OUTBOUND_QUEUE || "outbound-messages";

interface ValidationResult {
  valid: boolean;
  value: string;
  error?: string;
}

const VALIDATION_PATTERNS: Record<string, RegExp> = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^\+?[\d\s()-]{10,}$/,
  cep: /^\d{5}-?\d{3}$/,
  date: /^\d{2}\/\d{2}\/\d{4}$/,
  time: /^\d{2}:\d{2}$/,
  number: /^-?\d+([.,]\d+)?$/,
};

function normalizeTemplateIdentifier(
  value: string | undefined | null
): string | null {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > 255) return null;
  return normalized;
}





type SendMessageToQueueProps = {
  queueUrl: string;
  body: object;
  groupId: string;
  messageId: string;
};

interface PartnersRepository {
  retrieveByPartnerContactIdWithWorkspace(
    partnerContactId: string
  ): Promise<{ partner: Partner; workspaceId: string } | null>;
  upsert(partner: Partner, workspaceId: string): Promise<void>;
  updatePartnerFieldByContactId(
    contactId: string,
    field: string,
    value: string
  ): Promise<void>;
}

interface UsersRepository {
  retrieve(id: string): Promise<User | null>;
}

interface SectorsRepository {
  retrieve(id: string): Promise<Sector | null>;
}

interface MessagingDriver {
  sendMessageToQueue(data: SendMessageToQueueProps): Promise<boolean>;
}

interface PartnersLabelsRepository {
  addLabelsToPartner(partnerId: string, labelIds: string[], workspaceId: string): Promise<void>;
  removeAllLabelsFromPartner(partnerId: string, workspaceId: string): Promise<void>;
  setPartnerLabels(partnerId: string, labelIds: string[], workspaceId: string): Promise<void>;
  listLabelsByPartner(partnerId: string, workspaceId: string): Promise<{ id: string; name: string; color: string }[]>;
}

export class ActionNodeHandler implements NodeHandler {
  constructor(
    private readonly partnersRepository: PartnersRepository,
    private readonly usersRepository: UsersRepository,
    private readonly sectorsRepository: SectorsRepository,
    private readonly messagingDriver: MessagingDriver,
    private readonly partnersLabelsRepository: PartnersLabelsRepository
  ) {}

  canHandle(nodeType: FlowNode.Type): boolean {
    return nodeType === "action";
  }

  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const nodeData = context.currentNode.data as FlowNode.ActionData;

    // Check if we have multiple actions
    if (nodeData.actions && nodeData.actions.length > 0) {
      return this.executeMultipleActions(context, nodeData.actions);
    }

    // Legacy single action format
    if (!nodeData.actionType) {
      return {
        success: false,
        shouldPause: false,
        nextNodeId: null,
        error: "Action type is required",
      };
    }

    return this.executeSingleAction(context, nodeData);
  }

  private async executeMultipleActions(
    context: ExecutionContext,
    actions: FlowNode.SingleActionData[]
  ): Promise<ExecutionResult> {
    // Get the current action index from flow variables (for resuming after pause)
    const actionIndexKey = `_multi_action_index_${context.currentNode.id}`;
    let currentIndex = (context.flowExecution.getVariable(actionIndexKey) as number) || 0;

    // Execute actions sequentially starting from currentIndex
    for (let i = currentIndex; i < actions.length; i++) {
      const action = actions[i]!;
      
      // Convert SingleActionData to ActionData format for execution
      const actionData: FlowNode.ActionData = {
        ...action,
        label: context.currentNode.data.label,
      };

      const result = await this.executeSingleAction(context, actionData);

      // If action failed, stop execution
      if (!result.success) {
        // Clean up the index variable on failure
        context.flowExecution.deleteVariable(actionIndexKey);
        return result;
      }

      // If action requires pause (e.g., capture_input, pause_flow), save progress and pause
      if (result.shouldPause) {
        // Save the current action index so we can resume from here
        context.flowExecution.setVariable(actionIndexKey, i);
        return result;
      }
    }

    // All actions completed successfully, clean up
    context.flowExecution.deleteVariable(actionIndexKey);

    return {
      success: true,
      shouldPause: false,
      nextNodeId: null,
    };
  }

  private async executeSingleAction(
    context: ExecutionContext,
    nodeData: FlowNode.ActionData
  ): Promise<ExecutionResult> {
    switch (nodeData.actionType) {
      case "tag_contact":
        return this.executeTagContact(context, nodeData);
      case "assign_conversation":
        return this.executeAssignConversation(context, nodeData);
      case "set_variable":
        return this.executeSetVariable(context, nodeData);
      case "close_conversation":
        return this.executeCloseConversation(context);
      case "send_message":
        return this.executeSendMessage(context, nodeData);
      case "send_template":
        return this.executeSendTemplate(context, nodeData);
      case "transfer":
        return this.executeTransfer(context, nodeData);
      case "pause_flow":
        return this.executePauseFlow(context, nodeData);
      case "capture_input":
        return this.executeCaptureInput(context, nodeData);
      default:
        return {
          success: false,
          shouldPause: false,
          nextNodeId: null,
          error: `Unknown action type: ${nodeData.actionType}`,
        };
    }
  }

  private async executeTagContact(
    context: ExecutionContext,
    nodeData: FlowNode.ActionData
  ): Promise<ExecutionResult> {
    const labelIds = nodeData.labelIds ?? [];

    if (labelIds.length === 0) {
      console.log(
        "[ActionNodeHandler] Skipping tag_contact: no labels configured for node",
        context.currentNode.id
      );
      return {
        success: true,
        shouldPause: false,
        nextNodeId: null,
      };
    }

    if (!context.conversation.contact) {
      return {
        success: false,
        shouldPause: false,
        nextNodeId: null,
        error: "Cannot tag contact on internal conversation",
      };
    }

    const contactId = context.conversation.contact.id;

    let partner = context.cache.partners.get(contactId);

    if (partner === undefined) {
      const result =
        await this.partnersRepository.retrieveByPartnerContactIdWithWorkspace(
          contactId
        );

      if (!result) {
        return {
          success: false,
          shouldPause: false,
          nextNodeId: null,
          error: "Partner not found for contact",
        };
      }

      partner = result.partner;
      context.cache.partners.set(contactId, partner);
    }

    if (!partner) {
      return {
        success: false,
        shouldPause: false,
        nextNodeId: null,
        error: "Partner not found for contact",
      };
    }

    const operation = nodeData.tagOperation ?? "add";
    const workspaceId = context.workspaceId;

    if (operation === "add") {
      await this.partnersLabelsRepository.addLabelsToPartner(partner.id, labelIds, workspaceId);
    } else if (operation === "set") {
      await this.partnersLabelsRepository.setPartnerLabels(partner.id, labelIds, workspaceId);
    } else {
      const currentLabels = await this.partnersLabelsRepository.listLabelsByPartner(partner.id, workspaceId);
      const remainingLabelIds = currentLabels
        .filter(label => !labelIds.includes(label.id))
        .map(label => label.id);
      await this.partnersLabelsRepository.setPartnerLabels(partner.id, remainingLabelIds, workspaceId);
    }

    context.cache.partners.set(contactId, partner);

    return {
      success: true,
      shouldPause: false,
      nextNodeId: null,
    };
  }

  private async executeAssignConversation(
    context: ExecutionContext,
    nodeData: FlowNode.ActionData
  ): Promise<ExecutionResult> {
    if (!nodeData.attendantId) {
      return {
        success: false,
        shouldPause: false,
        nextNodeId: null,
        error: "Attendant ID is required",
      };
    }

    const user = await this.usersRepository.retrieve(nodeData.attendantId);

    if (!user) {
      return {
        success: false,
        shouldPause: false,
        nextNodeId: null,
        error: "Attendant not found",
      };
    }

    context.conversation.assign(
      user,
      context.conversation.sector ?? undefined
    );

    return {
      success: true,
      shouldPause: false,
      nextNodeId: null,
    };
  }

  private executeSetVariable(
    context: ExecutionContext,
    nodeData: FlowNode.ActionData
  ): ExecutionResult {
    if (!nodeData.variableName) {
      return {
        success: false,
        shouldPause: false,
        nextNodeId: null,
        error: "Variable name is required",
      };
    }

    const value = nodeData.variableValue ?? "";
    context.flowExecution.setVariable(nodeData.variableName, value);

    return {
      success: true,
      shouldPause: false,
      nextNodeId: null,
    };
  }

  private executeCloseConversation(context: ExecutionContext): ExecutionResult {
    context.conversation.close();

    return {
      success: true,
      shouldPause: false,
      nextNodeId: null,
    };
  }

  private async getPartnerLabels(
    partnerId: string,
    context: ExecutionContext
  ): Promise<{ id: string; name: string; color: string }[]> {
    const cached = context.cache.partnerLabels.get(partnerId);
    if (cached !== undefined) {
      return cached;
    }

    const labels = await this.partnersLabelsRepository.listLabelsByPartner(partnerId, context.workspaceId);
    context.cache.partnerLabels.set(partnerId, labels);
    return labels;
  }

  private escapeRegexChars(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private async replaceVariables(content: string, context: ExecutionContext): Promise<string> {
    let result = content;

    // 1. Substituir variaveis de sistema primeiro
    for (const [key, value] of Object.entries(context.resolvedSystemVariables)) {
      const escapedKey = this.escapeRegexChars(key);
      const regex = new RegExp(`{{${escapedKey}}}`, "gi");
      result = result.replace(regex, value);
    }

    // 2. Substituir variaveis locais do fluxo (com e sem prefixo flow.)
    for (const [key, value] of Object.entries(context.flowExecution.variables)) {
      // Pular variáveis internas (começam com _)
      if (key.startsWith("_")) continue;

      const escapedKey = this.escapeRegexChars(key);
      // Substituir com prefixo flow. (ex: {{flow.cpf}})
      const regexWithPrefix = new RegExp(`{{flow\\.${escapedKey}}}`, "gi");
      result = result.replace(regexWithPrefix, String(value));
      // Substituir sem prefixo (ex: {{cpf}})
      const regexWithoutPrefix = new RegExp(`{{${escapedKey}}}`, "gi");
      result = result.replace(regexWithoutPrefix, String(value));
    }

    // 3. Substituir variaveis de contexto da conversa
    if (context.conversation.contact) {
      // user.phone e contact.phone
      if (context.conversation.contact.value) {
        result = result.replace(/{{user\.phone}}/gi, context.conversation.contact.value);
        result = result.replace(/{{contact\.phone}}/gi, context.conversation.contact.value);
      }
      // contact.name e partner.name
      if (context.conversation.contact.name) {
        result = result.replace(/{{contact\.name}}/gi, context.conversation.contact.name);
        result = result.replace(/{{partner\.name}}/gi, context.conversation.contact.name);
      }
      // partner.tags (legacy - deprecated, use partner.labels instead)
      result = result.replace(/{{partner\.tags}}/gi, "");

      // partner.labels
      if (result.includes("{{partner.labels}}") || result.includes("{{partner.Labels}}")) {
        const partner = context.cache.partners.get(context.conversation.contact.id);
        if (partner) {
          const labels = await this.getPartnerLabels(partner.id, context);
          const labelNames = labels.map(l => l.name).join(", ");
          result = result.replace(/{{partner\.labels}}/gi, labelNames);
        } else {
          result = result.replace(/{{partner\.labels}}/gi, "");
        }
      }
    }

    // 4. Substituir user.message
    if (context.userMessage) {
      result = result.replace(/{{user\.message}}/gi, context.userMessage);
    }

    // 5. Substituir conversation.channel
    if (context.channel?.type) {
      result = result.replace(/{{conversation\.channel}}/gi, context.channel.type);
    }

    // 6. Substituir partner.email (vem do partnerMetadata)
    if (context.partnerMetadata?.email) {
      result = result.replace(/{{partner\.email}}/gi, context.partnerMetadata.email);
    } else {
      result = result.replace(/{{partner\.email}}/gi, "");
    }

    return result;
  }

  private async executeSendMessage(
    context: ExecutionContext,
    nodeData: FlowNode.ActionData
  ): Promise<ExecutionResult> {
    if (!context.conversation.contact) {
      return {
        success: false,
        shouldPause: false,
        nextNodeId: null,
        error: "Cannot send message on internal conversation",
      };
    }

    const messageType = nodeData.messageType || "text";

    if (messageType === "text" && !nodeData.content) {
      return {
        success: false,
        shouldPause: false,
        nextNodeId: null,
        error: "Message content is required for text messages",
      };
    }

    if (messageType !== "text" && !nodeData.mediaUrl) {
      return {
        success: false,
        shouldPause: false,
        nextNodeId: null,
        error: "Media URL is required for media messages",
      };
    }

    const caption = nodeData.content
      ? await this.replaceVariables(nodeData.content, context)
      : undefined;

    try {
      const baseBody = {
        conversationId: context.conversation.id,
        channelId: context.channel.id,
        workspaceId: context.workspaceId,
        createdAt: new Date(),
        sender: {
          id: "flow-executor",
          name: "Bot",
        },
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

      let body: typeof baseBody & {
        type: string;
        content?: string;
        mediaId?: string;
        filename?: string;
        mimeType?: string;
        caption?: string;
      };

      if (messageType === "text") {
        body = {
          ...baseBody,
          type: "text",
          content: caption || "",
        };
      } else {
        body = {
          ...baseBody,
          type: messageType,
          mediaId: nodeData.mediaUrl || "",
          filename: nodeData.mediaName,
          mimeType: nodeData.mediaMimeType,
          caption,
        };
      }

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

  private resolveVariableValue(
    variableName: string,
    variableMapping: NonNullable<FlowNode.ActionData["variableMapping"]>,
    context: ExecutionContext
  ): string {
    const mapping = variableMapping[variableName];

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

  private async executeSendTemplate(
    context: ExecutionContext,
    nodeData: FlowNode.ActionData
  ): Promise<ExecutionResult> {
    const templateIdentifier =
      normalizeTemplateIdentifier(nodeData.templateName) ??
      normalizeTemplateIdentifier(nodeData.templateId);

    if (!context.conversation.contact) {
      return {
        success: false,
        shouldPause: false,
        nextNodeId: null,
        error: "Cannot send template on internal conversation",
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
            nodeData.variableMapping,
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

  private async executeTransfer(
    context: ExecutionContext,
    nodeData: FlowNode.ActionData
  ): Promise<ExecutionResult> {
    if (!nodeData.sectorId) {
      context.conversation.sector = null;
      context.conversation.attendant = null;
      context.conversation.status = "waiting";

      return {
        success: true,
        shouldPause: false,
        nextNodeId: null,
      };
    }

    const sector = await this.sectorsRepository.retrieve(nodeData.sectorId);

    if (!sector) {
      return {
        success: false,
        shouldPause: false,
        nextNodeId: null,
        error: "Sector not found",
      };
    }

    context.conversation.transferToSector(sector);

    if (nodeData.attendantId) {
      const user = await this.usersRepository.retrieve(nodeData.attendantId);
      if (user) {
        context.conversation.assign(user, sector);
      }
    }

    return {
      success: true,
      shouldPause: false,
      nextNodeId: null,
    };
  }

  private calculateResumeTimestamp(duration: number, unit: FlowNode.PauseUnit): Date {
    const now = new Date();
    const multipliers: Record<FlowNode.PauseUnit, number> = {
      minutes: 60 * 1000,
      hours: 60 * 60 * 1000,
      days: 24 * 60 * 60 * 1000,
    };
    const milliseconds = duration * multipliers[unit];
    return new Date(now.getTime() + milliseconds);
  }

  private executePauseFlow(
    context: ExecutionContext,
    nodeData: FlowNode.ActionData
  ): ExecutionResult {
    const existingResumeAt = context.flowExecution.getVariable("_pauseResumeAt");

    if (existingResumeAt && typeof existingResumeAt === "string") {
      const resumeAtDate = new Date(existingResumeAt);
      const now = new Date();

      if (now >= resumeAtDate) {
        delete context.flowExecution.variables["_pauseResumeAt"];
        delete context.flowExecution.variables["_pauseDuration"];
        delete context.flowExecution.variables["_pauseUnit"];

        return {
          success: true,
          shouldPause: false,
          nextNodeId: null,
        };
      }

      return {
        success: true,
        shouldPause: true,
        nextNodeId: null,
        pauseUntil: resumeAtDate,
      };
    }

    const duration = nodeData.pauseDuration || 5;
    const unit = nodeData.pauseUnit || "minutes";

    const resumeAt = this.calculateResumeTimestamp(duration, unit);

    context.flowExecution.setVariable("_pauseResumeAt", resumeAt.toISOString());
    context.flowExecution.setVariable("_pauseDuration", duration);
    context.flowExecution.setVariable("_pauseUnit", unit);

    return {
      success: true,
      shouldPause: true,
      nextNodeId: null,
      pauseUntil: resumeAt,
    };
  }

  private validateInput(
    input: string,
    type: FlowNode.InputValidationType,
    options?: string[]
  ): ValidationResult {
    const trimmed = input.trim();

    if (!trimmed) {
      return { valid: false, value: "", error: "Resposta vazia" };
    }

    switch (type) {
      case "text":
        return { valid: true, value: trimmed };

      case "number": {
        const pattern = VALIDATION_PATTERNS.number;
        if (!pattern?.test(trimmed)) {
          return { valid: false, value: trimmed, error: "Informe um numero valido" };
        }
        return { valid: true, value: trimmed.replace(",", ".") };
      }

      case "email": {
        const pattern = VALIDATION_PATTERNS.email;
        if (!pattern?.test(trimmed)) {
          return { valid: false, value: trimmed, error: "Informe um email valido" };
        }
        return { valid: true, value: trimmed.toLowerCase() };
      }

      case "phone": {
        const cleaned = trimmed.replace(/\D/g, "");
        if (cleaned.length < 10 || cleaned.length > 15) {
          return { valid: false, value: trimmed, error: "Informe um telefone valido" };
        }
        return { valid: true, value: cleaned };
      }

      case "cpf": {
        if (!validateCPF(trimmed)) {
          return { valid: false, value: trimmed, error: "Informe um CPF valido" };
        }
        return { valid: true, value: trimmed.replace(/\D/g, "") };
      }

      case "cnpj": {
        if (!validateCNPJ(trimmed)) {
          return { valid: false, value: trimmed, error: "Informe um CNPJ valido" };
        }
        return { valid: true, value: trimmed.replace(/\D/g, "") };
      }

      case "cep": {
        const pattern = VALIDATION_PATTERNS.cep;
        if (!pattern?.test(trimmed)) {
          return { valid: false, value: trimmed, error: "Informe um CEP valido (ex: 12345-678)" };
        }
        return { valid: true, value: trimmed.replace(/\D/g, "") };
      }

      case "date": {
        const pattern = VALIDATION_PATTERNS.date;
        if (!pattern?.test(trimmed)) {
          return { valid: false, value: trimmed, error: "Informe uma data valida (DD/MM/AAAA)" };
        }
        const [day, month, year] = trimmed.split("/").map(Number);
        const date = new Date(year!, month! - 1, day);
        if (
          date.getDate() !== day ||
          date.getMonth() !== month! - 1 ||
          date.getFullYear() !== year
        ) {
          return { valid: false, value: trimmed, error: "Data invalida" };
        }
        return { valid: true, value: trimmed };
      }

      case "time": {
        const pattern = VALIDATION_PATTERNS.time;
        if (!pattern?.test(trimmed)) {
          return { valid: false, value: trimmed, error: "Informe um horario valido (HH:MM)" };
        }
        const [hours, minutes] = trimmed.split(":").map(Number);
        if (hours! > 23 || minutes! > 59) {
          return { valid: false, value: trimmed, error: "Horario invalido" };
        }
        return { valid: true, value: trimmed };
      }

      case "options": {
        if (!options || options.length === 0) {
          return { valid: true, value: trimmed };
        }
        const lowerInput = trimmed.toLowerCase();
        const matchedOption = options.find(
          (opt) => opt.toLowerCase() === lowerInput
        );
        if (matchedOption) {
          return { valid: true, value: matchedOption };
        }
        const num = parseInt(trimmed, 10);
        if (!isNaN(num) && num >= 1 && num <= options.length) {
          return { valid: true, value: options[num - 1]! };
        }
        return {
          valid: false,
          value: trimmed,
          error: `Escolha uma opcao valida: ${options.join(", ")}`,
        };
      }

      default:
        return { valid: true, value: trimmed };
    }
  }

  private async updateContactField(
    context: ExecutionContext,
    field: FlowNode.InputContactField,
    value: string
  ): Promise<void> {
    if (!context.conversation.contact?.id) return;

    await this.partnersRepository.updatePartnerFieldByContactId(
      context.conversation.contact.id,
      field,
      value
    );
  }

  private async sendQuestionMessage(
    context: ExecutionContext,
    content: string
  ): Promise<boolean> {
    if (!context.conversation.contact) return false;

    const body = {
      conversationId: context.conversation.id,
      channelId: context.channel.id,
      workspaceId: context.workspaceId,
      createdAt: new Date(),
      sender: {
        id: "flow-executor",
        name: "Bot",
      },
      type: "text",
      content,
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

    return this.messagingDriver.sendMessageToQueue({
      queueUrl: OUTBOUND_QUEUE,
      body,
      groupId: context.conversation.id,
      messageId: crypto.randomUUID(),
    });
  }

  private async executeCaptureInput(
    context: ExecutionContext,
    nodeData: FlowNode.ActionData
  ): Promise<ExecutionResult> {
    if (!context.conversation.contact) {
      return {
        success: false,
        shouldPause: false,
        nextNodeId: null,
        error: "Cannot execute capture_input on internal conversation",
      };
    }

    if (!nodeData.question || !nodeData.variableName) {
      return {
        success: false,
        shouldPause: false,
        nextNodeId: null,
        error: "Capture input action must have question and variable name configured",
      };
    }

    const attemptsKey = `_input_attempts_${context.currentNode.id}`;
    const questionSentKey = `_input_question_sent_${context.currentNode.id}`;
    const validationType = nodeData.inputValidationType || "text";

    const questionAlreadySent = context.flowExecution.getVariable(questionSentKey);

    if (context.userMessage && questionAlreadySent) {
      const validation = this.validateInput(
        context.userMessage,
        validationType,
        nodeData.inputOptions
      );

      if (validation.valid) {
        context.flowExecution.setVariable(nodeData.variableName, validation.value);

        if (nodeData.saveToContact && nodeData.contactField) {
          try {
            await this.updateContactField(context, nodeData.contactField, validation.value);
          } catch (error) {
            console.error("Failed to update contact field:", error);
          }
        }

        context.flowExecution.deleteVariable(attemptsKey);
        context.flowExecution.deleteVariable(questionSentKey);

        return {
          success: true,
          shouldPause: false,
          nextNodeId: null,
        };
      }

      const attempts = (context.flowExecution.getVariable(attemptsKey) as number) || 0;
      const maxAttempts = nodeData.maxAttempts || 3;

      if (attempts + 1 >= maxAttempts) {
        context.flowExecution.setVariable(nodeData.variableName, "");
        context.flowExecution.deleteVariable(attemptsKey);
        context.flowExecution.deleteVariable(questionSentKey);

        return {
          success: true,
          shouldPause: false,
          nextNodeId: null,
        };
      }

      context.flowExecution.setVariable(attemptsKey, attempts + 1);

      const errorMessage =
        nodeData.errorMessage ||
        validation.error ||
        "Resposta invalida. Por favor, tente novamente.";
      const questionText = await this.replaceVariables(nodeData.question, context);
      const fullMessage = `${errorMessage}\n\n${questionText}`;

      const sent = await this.sendQuestionMessage(context, fullMessage);

      if (!sent) {
        return {
          success: false,
          shouldPause: false,
          nextNodeId: null,
          error: "Failed to send error message",
        };
      }

      return {
        success: true,
        shouldPause: true,
        nextNodeId: null,
      };
    }

    const questionText = await this.replaceVariables(nodeData.question, context);

    let fullMessage = questionText;
    if (validationType === "options" && nodeData.inputOptions?.length) {
      const optionsList = nodeData.inputOptions
        .map((opt, i) => `${i + 1}. ${opt}`)
        .join("\n");
      fullMessage = `${questionText}\n\n${optionsList}`;
    }

    const sent = await this.sendQuestionMessage(context, fullMessage);

    if (!sent) {
      return {
        success: false,
        shouldPause: false,
        nextNodeId: null,
        error: "Failed to send question message",
      };
    }

    context.flowExecution.setVariable(questionSentKey, true);

    return {
      success: true,
      shouldPause: true,
      nextNodeId: null,
    };
  }

  static instance() {
    return new ActionNodeHandler(
      PartnersDatabaseRepository.instance(),
      UsersDatabaseRepository.instance(),
      SectorsDatabaseRepository.instance(),
      RabbitMQMessagingDriver.instance(),
      PartnersLabelsDatabaseRepository.instance()
    );
  }
}
