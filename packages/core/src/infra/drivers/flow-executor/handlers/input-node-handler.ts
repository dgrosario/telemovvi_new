import { FlowNode } from "../../../../domain/entities/flow-node";
import { Channel, getPayloadProperty } from "../../../../domain/entities/channel";
import { RabbitMQMessagingDriver } from "../../messaging-driver";
import { PartnersDatabaseRepository } from "../../../repositories/partners-repository";
import { ExecutionContext, ExecutionResult, NodeHandler } from "../types";
import { replaceVariables } from "../variable-replacer";
import { validateCPF, validateCNPJ } from "../validators";

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

interface PartnersRepository {
  updatePartnerFieldByContactId(
    contactId: string,
    field: string,
    value: string
  ): Promise<void>;
}

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





export class InputNodeHandler implements NodeHandler {
  constructor(
    private readonly messagingDriver: MessagingDriver,
    private readonly partnersRepository: PartnersRepository
  ) {}

  canHandle(nodeType: FlowNode.Type): boolean {
    return nodeType === "input";
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

  private async sendMessage(
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

  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const nodeData = context.currentNode.data as FlowNode.InputData;

    if (!context.conversation.contact) {
      return {
        success: false,
        shouldPause: false,
        nextNodeId: null,
        error: "Cannot execute flow on internal conversation",
      };
    }

    if (!nodeData.question || !nodeData.variableName) {
      return {
        success: false,
        shouldPause: false,
        nextNodeId: null,
        error: "Input node must have question and variable name configured",
      };
    }

    const attemptsKey = `_input_attempts_${context.currentNode.id}`;
    const questionSentKey = `_input_question_sent_${context.currentNode.id}`;

    // Check if we already sent the question for this node
    // If not, we need to send it first before processing any user message
    const questionAlreadySent = context.flowExecution.getVariable(questionSentKey);

    if (context.userMessage && questionAlreadySent) {
      // We're resuming after the question was sent - process the user's response
      const validation = this.validateInput(
        context.userMessage,
        nodeData.validationType,
        nodeData.inputOptions
      );

      if (validation.valid) {
        context.flowExecution.setVariable(nodeData.variableName, validation.value);

        if (nodeData.saveToContact && nodeData.contactField) {
          try {
            await this.updateContactField(context, nodeData.contactField, validation.value);

            // Update context so subsequent nodes use the new value immediately
            if (nodeData.contactField === "name" && context.conversation.contact) {
              context.conversation.contact.name = validation.value;
            }
            if (nodeData.contactField === "email") {
              if (!context.partnerMetadata) {
                context.partnerMetadata = {};
              }
              context.partnerMetadata.email = validation.value;
            }
          } catch (error) {
            console.error("Failed to update contact field:", error);
          }
        }

        // Clean up tracking variables
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
      const questionText = replaceVariables(nodeData.question, context);
      const fullMessage = `${errorMessage}\n\n${questionText}`;

      const sent = await this.sendMessage(context, fullMessage);

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

    // First time entering this node - send the question
    const questionText = replaceVariables(nodeData.question, context);

    let fullMessage = questionText;
    if (nodeData.validationType === "options" && nodeData.inputOptions?.length) {
      const optionsList = nodeData.inputOptions
        .map((opt, i) => `${i + 1}. ${opt}`)
        .join("\n");
      fullMessage = `${questionText}\n\n${optionsList}`;
    }

    const sent = await this.sendMessage(context, fullMessage);

    if (!sent) {
      return {
        success: false,
        shouldPause: false,
        nextNodeId: null,
        error: "Failed to send question message",
      };
    }

    // Mark that we've sent the question for this node
    context.flowExecution.setVariable(questionSentKey, true);

    return {
      success: true,
      shouldPause: true,
      nextNodeId: null,
    };
  }

  static instance(): InputNodeHandler {
    return new InputNodeHandler(
      RabbitMQMessagingDriver.instance(),
      PartnersDatabaseRepository.instance()
    );
  }
}
