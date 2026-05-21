import { FlowNode } from "../../../domain/entities/flow-node";
import { ActionNodeHandler } from "./handlers/action-node-handler";
import { ConditionalNodeHandler } from "./handlers/conditional-node-handler";
import { EndNodeHandler } from "./handlers/end-node-handler";
import { InputNodeHandler } from "./handlers/input-node-handler";
import { IntervalNodeHandler } from "./handlers/interval-node-handler";
import { MenuNodeHandler } from "./handlers/menu-node-handler";
import { MessageNodeHandler } from "./handlers/message-node-handler";
import { RandomNodeHandler } from "./handlers/random-node-handler";
import { StartNodeHandler } from "./handlers/start-node-handler";
import { SubflowNodeHandler } from "./handlers/subflow-node-handler";
import { TemplateNodeHandler } from "./handlers/template-node-handler";
import { TransferNodeHandler } from "./handlers/transfer-node-handler";
import { NodeHandler } from "./types";

export class NodeHandlerRegistry {
  private static _instance: NodeHandlerRegistry | null = null;
  private handlers: NodeHandler[] = [];

  private constructor() {
    this.registerHandlers();
  }

  private registerHandlers(): void {
    this.handlers.push(StartNodeHandler.instance());
    this.handlers.push(MessageNodeHandler.instance());
    this.handlers.push(MenuNodeHandler.instance());
    this.handlers.push(IntervalNodeHandler.instance());
    this.handlers.push(TransferNodeHandler.instance());
    this.handlers.push(TemplateNodeHandler.instance());
    this.handlers.push(ConditionalNodeHandler.instance());
    this.handlers.push(ActionNodeHandler.instance());
    this.handlers.push(RandomNodeHandler.instance());
    this.handlers.push(InputNodeHandler.instance());
    this.handlers.push(EndNodeHandler.instance());
    // SubflowNodeHandler uses lazy getter to avoid circular dependency
    this.handlers.push(SubflowNodeHandler.instance(() => NodeHandlerRegistry.instance()));
  }

  getHandler(nodeType: FlowNode.Type): NodeHandler | null {
    return this.handlers.find((h) => h.canHandle(nodeType)) ?? null;
  }

  static instance(): NodeHandlerRegistry {
    if (!NodeHandlerRegistry._instance) {
      NodeHandlerRegistry._instance = new NodeHandlerRegistry();
    }
    return NodeHandlerRegistry._instance;
  }
}
