import { Channel } from "../../../domain/entities/channel";
import { Conversation } from "../../../domain/entities/conversation";
import { FlowExecution } from "../../../domain/entities/flow-execution";
import { FlowNode } from "../../../domain/entities/flow-node";
import { Partner } from "../../../domain/entities/partner";

export type CachedLabel = {
  id: string;
  name: string;
  color: string;
};

export type ExecutionCache = {
  partners: Map<string, Partner | null>;
  partnerLabels: Map<string, CachedLabel[]>;
};

export type PartnerMetadata = {
  email?: string;
};

export type ExecutionContext = {
  flowExecution: FlowExecution;
  currentNode: FlowNode;
  conversation: Conversation;
  channel: Channel;
  workspaceId: string;
  userMessage?: string;
  resolvedSystemVariables: Record<string, string>;
  cache: ExecutionCache;
  partnerMetadata?: PartnerMetadata;
};

export type ExecutionResult = {
  success: boolean;
  shouldPause: boolean;
  nextNodeId: string | null;
  error?: string;
  pauseUntil?: Date;
};

export interface NodeHandler {
  canHandle(nodeType: FlowNode.Type): boolean;
  execute(context: ExecutionContext): Promise<ExecutionResult>;
}
