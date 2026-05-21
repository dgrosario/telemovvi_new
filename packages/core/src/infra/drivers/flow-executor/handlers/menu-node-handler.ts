import { FlowNode } from "../../../../domain/entities/flow-node";
import { Channel, getPayloadProperty } from "../../../../domain/entities/channel";
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

type DisplayMode = "text" | "buttons" | "list";

interface InteractiveButton {
  type?: "reply";
  reply?: { id: string; title: string };
  buttonId?: string;
  buttonText?: { displayText: string };
}

interface InteractiveSection {
  title?: string;
  rows: Array<{
    id?: string;
    rowId?: string;
    title: string;
    description?: string;
  }>;
}

interface InteractivePayload {
  type: "button" | "list";
  header?: { type: "text"; text: string };
  body: { text: string };
  footer?: { text: string };
  action: {
    buttons?: InteractiveButton[];
    button?: string;
    sections?: InteractiveSection[];
  };
}

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_ERROR_MESSAGE = "Opcao invalida. Por favor, escolha uma das opcoes disponiveis.";

export class MenuNodeHandler implements NodeHandler {
  constructor(private readonly messagingDriver: MessagingDriver) {}

  canHandle(nodeType: FlowNode.Type): boolean {
    return nodeType === "menu";
  }



  private findSelectedOption(
    options: FlowNode.MenuOption[],
    userMessage: string
  ): FlowNode.MenuOption | null {
    const input = userMessage.trim();
    const inputLower = input.toLowerCase();

    // 1. Match por ID (resposta de botao interativo)
    const idMatch = options.find((opt) => opt.id === input);
    if (idMatch) return idMatch;

    // 2. Match exato por value
    const valueMatch = options.find((opt) => opt.value === input);
    if (valueMatch) return valueMatch;

    // 3. Match por numero (1, 2, 3...)
    const num = parseInt(input, 10);
    if (!isNaN(num) && num >= 1 && num <= options.length) {
      return options[num - 1] ?? null;
    }

    // 4. Match exato por label (case-insensitive)
    const labelMatch = options.find(
      (opt) => opt.label.toLowerCase() === inputLower
    );
    if (labelMatch) return labelMatch;

    // 5. Match parcial por label (comeca com, min 3 chars)
    if (input.length >= 3) {
      const partialMatch = options.find((opt) =>
        opt.label.toLowerCase().startsWith(inputLower)
      );
      if (partialMatch) return partialMatch;
    }

    return null;
  }

  private determineDisplayMode(
    options: FlowNode.MenuOption[],
    requestedMode: FlowNode.MenuDisplayMode | undefined,
    channelType: Channel.Type
  ): DisplayMode {
    // Instagram nao suporta menus interativos
    if (channelType === "instagram") return "text";

    const mode = requestedMode || "auto";
    if (mode !== "auto") return mode;

    const count = options.length;
    if (count <= 3) return "buttons";
    if (count <= 10) return "list";
    return "text";
  }

  private buildTextMenuBody(
    content: string,
    options: FlowNode.MenuOption[]
  ): { type: "text"; content: string } {
    const optionsText = options
      .map((opt, i) => {
        const line = `${i + 1}. ${opt.label}`;
        return opt.description ? `${line}\n   ${opt.description}` : line;
      })
      .join("\n");
    return { type: "text", content: `${content}\n\n${optionsText}` };
  }

  private buildButtonsPayload(
    content: string,
    nodeData: FlowNode.MenuData,
    channelType: Channel.Type
  ): InteractivePayload {
    const isEvolution = channelType === "evolution";

    if (isEvolution) {
      return {
        type: "button",
        body: { text: content },
        action: {
          buttons: nodeData.options.slice(0, 3).map((opt) => ({
            buttonId: opt.id,
            buttonText: { displayText: opt.label.substring(0, 20) },
          })),
        },
      };
    }

    // Meta Cloud API
    return {
      type: "button",
      header: nodeData.header
        ? { type: "text", text: nodeData.header }
        : undefined,
      body: { text: content },
      action: {
        buttons: nodeData.options.slice(0, 3).map((opt) => ({
          type: "reply",
          reply: { id: opt.id, title: opt.label.substring(0, 20) },
        })),
      },
    };
  }

  private buildListPayload(
    content: string,
    nodeData: FlowNode.MenuData,
    channelType: Channel.Type
  ): InteractivePayload {
    const isEvolution = channelType === "evolution";
    const buttonText = nodeData.buttonText || "Ver opcoes";

    if (isEvolution) {
      return {
        type: "list",
        body: { text: content },
        action: {
          button: buttonText,
          sections: [
            {
              title: "Opcoes",
              rows: nodeData.options.slice(0, 10).map((opt) => ({
                rowId: opt.id,
                title: opt.label.substring(0, 24),
                description: opt.description?.substring(0, 72),
              })),
            },
          ],
        },
      };
    }

    // Meta Cloud API
    return {
      type: "list",
      header: nodeData.header
        ? { type: "text", text: nodeData.header }
        : undefined,
      body: { text: content },
      footer: nodeData.footer ? { text: nodeData.footer } : undefined,
      action: {
        button: buttonText,
        sections: [
          {
            title: "Opcoes",
            rows: nodeData.options.slice(0, 10).map((opt) => ({
              id: opt.id,
              title: opt.label.substring(0, 24),
              description: opt.description?.substring(0, 72),
            })),
          },
        ],
      },
    };
  }

  private buildMessageBody(
    nodeData: FlowNode.MenuData,
    displayMode: DisplayMode,
    channelType: Channel.Type,
    context: ExecutionContext
  ): { type: "text" | "interactive"; content?: string; interactive?: InteractivePayload } {
    const menuText = replaceVariables(nodeData.content || "", context);

    if (displayMode === "text") {
      const textBody = this.buildTextMenuBody(menuText, nodeData.options);
      return { type: "text", content: textBody.content };
    }

    const interactive =
      displayMode === "buttons"
        ? this.buildButtonsPayload(menuText, nodeData, channelType)
        : this.buildListPayload(menuText, nodeData, channelType);

    return { type: "interactive", interactive };
  }

  private async sendMenuMessage(
    context: ExecutionContext,
    nodeData: FlowNode.MenuData,
    errorPrefix?: string
  ): Promise<boolean> {
    if (!context.conversation.contact) return false;

    const displayMode = this.determineDisplayMode(
      nodeData.options,
      nodeData.displayMode,
      context.channel.type
    );

    const messageBody = this.buildMessageBody(
      nodeData,
      displayMode,
      context.channel.type,
      context
    );

    // Se houver mensagem de erro, adicionar antes do conteudo
    if (errorPrefix && messageBody.content) {
      messageBody.content = `${errorPrefix}\n\n${messageBody.content}`;
    }
    if (errorPrefix && messageBody.interactive?.body?.text) {
      messageBody.interactive.body.text = `${errorPrefix}\n\n${messageBody.interactive.body.text}`;
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
      type: messageBody.type,
      content: messageBody.content,
      interactive: messageBody.interactive,
      to: context.conversation.contact.value,
      channel: {
        id: context.channel.id,
        type: context.channel.type,
        payload: {
          phoneNumberId: getPayloadProperty(
            context.channel.payload,
            "phoneId"
          ),
          pageId: getPayloadProperty(context.channel.payload, "pageId"),
          accessToken: getPayloadProperty(
            context.channel.payload,
            "accessToken"
          ),
          instanceName: getPayloadProperty(
            context.channel.payload,
            "instanceName"
          ),
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
    const nodeData = context.currentNode.data as FlowNode.MenuData;

    if (!context.conversation.contact) {
      return {
        success: false,
        shouldPause: false,
        nextNodeId: null,
        error: "Cannot execute flow on internal conversation",
      };
    }

    if (!nodeData.options || nodeData.options.length === 0) {
      return {
        success: false,
        shouldPause: false,
        nextNodeId: null,
        error: "Menu must have at least one option",
      };
    }

    const attemptsKey = `_menu_attempts_${context.currentNode.id}`;
    const menuSentKey = `_menu_sent_${context.currentNode.id}`;

    // Verificar se ja enviamos o menu para este node
    const menuAlreadySent = context.flowExecution.getVariable(menuSentKey);

    // Processar resposta do usuario (se o menu ja foi enviado)
    if (context.userMessage && menuAlreadySent) {
      const selectedOption = this.findSelectedOption(
        nodeData.options,
        context.userMessage
      );

      if (selectedOption) {
        // Limpar variaveis de controle
        context.flowExecution.deleteVariable(attemptsKey);
        context.flowExecution.deleteVariable(menuSentKey);

        return {
          success: true,
          shouldPause: false,
          nextNodeId: selectedOption.id,
        };
      }

      // Opcao invalida - verificar tentativas
      const attempts = (context.flowExecution.getVariable(attemptsKey) as number) || 0;
      const errorBranch = (nodeData as FlowNode.MenuData & { errorBranch?: { enabled: boolean; maxAttempts: number } }).errorBranch;
      const maxAttempts = errorBranch?.maxAttempts || DEFAULT_MAX_ATTEMPTS;

      if (attempts + 1 >= maxAttempts) {
        // Limpar variaveis de controle
        context.flowExecution.deleteVariable(attemptsKey);
        context.flowExecution.deleteVariable(menuSentKey);

        // Se error branch habilitado, seguir para saida de erro
        if (errorBranch?.enabled) {
          return {
            success: true,
            shouldPause: false,
            nextNodeId: "error",
          };
        }

        // Se nao habilitado, falhar o fluxo (comportamento legado)
        return {
          success: false,
          shouldPause: false,
          nextNodeId: null,
          error: "Max menu attempts reached",
        };
      }

      // Incrementar tentativas e reenviar menu com mensagem de erro
      context.flowExecution.setVariable(attemptsKey, attempts + 1);

      const errorMessage = (nodeData as FlowNode.MenuData & { errorMessage?: string }).errorMessage || DEFAULT_ERROR_MESSAGE;

      try {
        const sent = await this.sendMenuMessage(context, nodeData, errorMessage);

        if (!sent) {
          return {
            success: false,
            shouldPause: false,
            nextNodeId: null,
            error: "Failed to resend menu",
          };
        }

        return {
          success: true,
          shouldPause: true,
          nextNodeId: null,
        };
      } catch (error) {
        return {
          success: false,
          shouldPause: false,
          nextNodeId: null,
          error: error instanceof Error ? error.message : "Failed to resend menu",
        };
      }
    }

    // Primeira vez entrando neste node - enviar o menu
    try {
      const sent = await this.sendMenuMessage(context, nodeData);

      if (!sent) {
        return {
          success: false,
          shouldPause: false,
          nextNodeId: null,
          error: "Failed to send menu to queue",
        };
      }

      // Marcar que enviamos o menu para este node
      context.flowExecution.setVariable(menuSentKey, true);

      return {
        success: true,
        shouldPause: true,
        nextNodeId: null,
      };
    } catch (error) {
      return {
        success: false,
        shouldPause: false,
        nextNodeId: null,
        error: error instanceof Error ? error.message : "Failed to send menu",
      };
    }
  }

  static instance(): MenuNodeHandler {
    return new MenuNodeHandler(RabbitMQMessagingDriver.instance());
  }
}
