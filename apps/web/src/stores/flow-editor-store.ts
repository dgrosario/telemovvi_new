import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Node, Edge, OnNodesChange, OnEdgesChange } from "reactflow";
import { applyNodeChanges, applyEdgeChanges } from "reactflow";
import {
  validateConnection,
  validateFlowStructure,
  cleanupOrphanEdges,
  findOrphanEdges,
} from "@/components/flows/utils/connection-validator";

export type FlowNodeType = "start" | "message" | "menu" | "interval" | "transfer" | "template" | "conditional" | "action" | "subflow" | "random" | "input" | "end";

export const flowNodeTypes: readonly FlowNodeType[] = ["start", "message", "menu", "interval", "transfer", "template", "conditional", "action", "subflow", "random", "input", "end"];

export function isFlowNodeType(value: string): value is FlowNodeType {
  return flowNodeTypes.includes(value as FlowNodeType);
}

type NodeData = {
  label?: string;
  content?: string;
  options?: Array<{ id: string; label: string; value: string }>;
  delay?: number;
  sectorId?: string | null;
  templateId?: string;
  channelId?: string;
  variableMapping?: Record<
    string,
    {
      source: "auto" | "manual";
      value: string;
    }
  >;
  conditions?: Array<{
    id: string;
    label: string;
    rules?: Array<{
      id: string;
      variable: string;
      variableType?: string;
      operator: string;
      value: string;
      value2?: string;
    }>;
    variable?: string;
    variableType?: string;
    operator?: string;
    value?: string;
    value2?: string;
  }>;
  defaultBranch?: {
    id: string;
    label: string;
  };
  actionType?: string;
  tagOperation?: string;
  labelIds?: string[];
  attendantId?: string | null;
  variableName?: string;
  variableValue?: string;
  targetFlowId?: string | null;
  targetFlowName?: string | null;
  waitForCompletion?: boolean;
  outputs?: Array<{
    id: string;
    label: string;
    percentage: number;
  }>;
  channels?: Array<{
    id: string;
    name: string;
    type: string;
    status?: string | null;
  }>;
  question?: string;
  validationType?: string;
  inputOptions?: string[];
  placeholder?: string;
  errorMessage?: string;
  maxAttempts?: number;
  saveToContact?: boolean;
  contactField?: string;
  closeConversation?: boolean;
  triggerOnStatuses?: string[];
  allowConversationsWithoutSector?: boolean;
};

type ConnectionMenuState = {
  position: { x: number; y: number };
  sourceNodeId: string | null;
  sourceHandleId: string | null;
} | null;

type FlowEditorState = {
  flowId: string | null;
  nodes: Node<NodeData>[];
  edges: Edge[];
  selectedNodeId: string | null;
  isDirty: boolean;
  testHighlightedNodeId: string | null;
  connectionMenuState: ConnectionMenuState;

  setFlowId: (flowId: string) => void;
  setNodes: (nodes: Node<NodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;

  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;

  addNode: (type: FlowNodeType, position: { x: number; y: number }) => void;
  duplicateNode: (nodeId: string) => void;
  updateNodeData: (nodeId: string, data: Partial<NodeData>) => void;
  updateNodeDataAndCleanup: (nodeId: string, data: Partial<NodeData>) => void;
  deleteNode: (nodeId: string) => void;
  removeEdge: (edgeId: string) => void;
  cleanupOrphanEdges: () => void;

  setSelectedNode: (nodeId: string | null) => void;
  setTestHighlightedNode: (nodeId: string | null) => void;

  setConnectionMenuState: (state: ConnectionMenuState) => void;
  clearConnectionMenuState: () => void;

  markAsDirty: () => void;
  markAsClean: () => void;

  reset: () => void;
};

export const useFlowEditorStore = create<FlowEditorState>()(
  immer((set, get) => ({
    flowId: null,
    nodes: [],
    edges: [],
    selectedNodeId: null,
    isDirty: false,
    testHighlightedNodeId: null,
    connectionMenuState: null,

    setFlowId: (flowId) => set({ flowId }),
    setNodes: (nodes) => set({ nodes }),
    setEdges: (edges) => set({ edges }),

    onNodesChange: (changes) => {
      set((state) => {
        state.nodes = applyNodeChanges(changes, state.nodes) as Node<NodeData>[];
        state.isDirty = true;
      });
    },

    onEdgesChange: (changes) => {
      set((state) => {
        state.edges = applyEdgeChanges(changes, state.edges);
        state.isDirty = true;
      });
    },

    addNode: (type, position) => {
      const newNode: Node<NodeData> = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: {
          label: getDefaultLabel(type),
          ...getDefaultNodeData(type),
        },
      };

      set((state) => {
        state.nodes.push(newNode);
        state.isDirty = true;
      });
    },

    duplicateNode: (nodeId) => {
      const state = get();
      const node = state.nodes.find((n) => n.id === nodeId);
      if (!node || node.type === "start") return;

      const newNode: Node<NodeData> = {
        id: `${node.type}-${Date.now()}`,
        type: node.type,
        position: {
          x: node.position.x + 50,
          y: node.position.y + 50,
        },
        data: JSON.parse(JSON.stringify(node.data)),
      };

      set((state) => {
        state.nodes.push(newNode);
        state.selectedNodeId = newNode.id;
        state.isDirty = true;
      });
    },

    updateNodeData: (nodeId, data) => {
      set((state) => {
        const node = state.nodes.find((n) => n.id === nodeId);
        if (node) {
          node.data = { ...node.data, ...data };
          state.isDirty = true;
        }
      });
    },

    updateNodeDataAndCleanup: (nodeId, data) => {
      set((state) => {
        const node = state.nodes.find((n) => n.id === nodeId);
        if (node) {
          node.data = { ...node.data, ...data };
          state.edges = cleanupOrphanEdges(state.nodes, state.edges);
          state.isDirty = true;
        }
      });
    },

    deleteNode: (nodeId) => {
      set((state) => {
        state.nodes = state.nodes.filter((n) => n.id !== nodeId);
        state.edges = state.edges.filter(
          (e) => e.source !== nodeId && e.target !== nodeId
        );
        if (state.selectedNodeId === nodeId) {
          state.selectedNodeId = null;
        }
        state.isDirty = true;
      });
    },

    removeEdge: (edgeId) => {
      set((state) => {
        state.edges = state.edges.filter((e) => e.id !== edgeId);
        state.isDirty = true;
      });
    },

    setSelectedNode: (nodeId) => set({ selectedNodeId: nodeId }),
    setTestHighlightedNode: (nodeId) => set({ testHighlightedNodeId: nodeId }),

    setConnectionMenuState: (state) => set({ connectionMenuState: state }),
    clearConnectionMenuState: () => set({ connectionMenuState: null }),

    cleanupOrphanEdges: () => {
      set((state) => {
        state.edges = cleanupOrphanEdges(state.nodes, state.edges);
        state.isDirty = true;
      });
    },

    markAsDirty: () => set({ isDirty: true }),
    markAsClean: () => set({ isDirty: false }),

    reset: () =>
      set({
        flowId: null,
        nodes: [],
        edges: [],
        selectedNodeId: null,
        isDirty: false,
        testHighlightedNodeId: null,
        connectionMenuState: null,
      }),
  }))
);

function getDefaultLabel(type: FlowNodeType): string {
  switch (type) {
    case "start":
      return "Início";
    case "message":
      return "Mensagem";
    case "menu":
      return "Menu";
    case "interval":
      return "Intervalo";
    case "transfer":
      return "Transferir";
    case "template":
      return "Template";
    case "conditional":
      return "Condicional";
    case "action":
      return "Ação";
    case "subflow":
      return "Subfluxo";
    case "random":
      return "Randomização";
    case "input":
      return "Entrada";
    case "end":
      return "Finalizar";
    default:
      return "";
  }
}

function getDefaultNodeData(type: FlowNodeType): Partial<NodeData> {
  switch (type) {
    case "random":
      return {
        outputs: [
          { id: crypto.randomUUID(), label: "Saída 1", percentage: 50 },
          { id: crypto.randomUUID(), label: "Saída 2", percentage: 50 },
        ],
      };
    case "menu":
      return {
        options: [
          { id: crypto.randomUUID(), label: "Opção 1", value: "1" },
          { id: crypto.randomUUID(), label: "Opção 2", value: "2" },
        ],
      };
    case "conditional":
      return {
        conditions: [
          { id: crypto.randomUUID(), variable: "", operator: "equals", value: "", label: "Condição 1" },
        ],
        defaultBranch: { id: crypto.randomUUID(), label: "Senão" },
      };
    case "interval":
      return {
        delay: 60,
      };
    case "input":
      return {
        question: "",
        variableName: "",
        validationType: "text",
        maxAttempts: 3,
        saveToContact: false,
      };
    case "end":
      return {
        closeConversation: false,
      };
    default:
      return {};
  }
}
