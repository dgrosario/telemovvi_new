import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

export interface TestMessage {
  id: string;
  type: "bot" | "user" | "system";
  content: string;
  timestamp: Date;
  nodeId?: string;
  metadata?: {
    nodeType?: string;
    options?: Array<{ id: string; label: string; value: string }>;
  };
}

export interface ExecutionLogEntry {
  id: string;
  timestamp: Date;
  nodeId: string;
  nodeType: string;
  nodeLabel: string;
  action: "enter" | "exit" | "error" | "wait";
  details?: string;
}

interface SimulatedContact {
  name: string;
  phone: string;
}

interface PendingMenuSelection {
  nodeId: string;
  options: Array<{ id: string; label: string; value: string }>;
}

interface FlowTestState {
  isTestModeActive: boolean;
  isExecuting: boolean;
  isPaused: boolean;
  currentNodeId: string | null;
  executionHistory: string[];
  variables: Record<string, string | number | boolean>;
  messages: TestMessage[];
  pendingMenuSelection: PendingMenuSelection | null;
  executionLog: ExecutionLogEntry[];
  simulatedContact: SimulatedContact;
  awaitingUserInput: boolean;
}

interface FlowTestActions {
  openTestMode: () => void;
  closeTestMode: () => void;
  startTest: () => void;
  stopTest: () => void;
  resetTest: () => void;
  setCurrentNode: (nodeId: string | null) => void;
  addMessage: (message: Omit<TestMessage, "id" | "timestamp">) => void;
  addLogEntry: (entry: Omit<ExecutionLogEntry, "id" | "timestamp">) => void;
  setVariable: (key: string, value: string | number | boolean) => void;
  setPendingMenuSelection: (selection: PendingMenuSelection | null) => void;
  setAwaitingUserInput: (awaiting: boolean) => void;
  setSimulatedContact: (contact: SimulatedContact) => void;
  addToExecutionHistory: (nodeId: string) => void;
}

type FlowTestStore = FlowTestState & FlowTestActions;

const initialState: FlowTestState = {
  isTestModeActive: false,
  isExecuting: false,
  isPaused: false,
  currentNodeId: null,
  executionHistory: [],
  variables: {},
  messages: [],
  pendingMenuSelection: null,
  executionLog: [],
  simulatedContact: {
    name: "Usuario Teste",
    phone: "5511999999999",
  },
  awaitingUserInput: false,
};

export const useFlowTestStore = create<FlowTestStore>()(
  immer((set) => ({
    ...initialState,

    openTestMode: () =>
      set((state) => {
        state.isTestModeActive = true;
      }),

    closeTestMode: () =>
      set((state) => {
        state.isTestModeActive = false;
        state.isExecuting = false;
        state.isPaused = false;
        state.currentNodeId = null;
        state.awaitingUserInput = false;
      }),

    startTest: () =>
      set((state) => {
        state.isExecuting = true;
        state.isPaused = false;
        state.messages = [];
        state.executionLog = [];
        state.executionHistory = [];
        state.variables = {};
        state.currentNodeId = null;
        state.pendingMenuSelection = null;
        state.awaitingUserInput = false;
      }),

    stopTest: () =>
      set((state) => {
        state.isExecuting = false;
        state.isPaused = false;
        state.currentNodeId = null;
        state.pendingMenuSelection = null;
        state.awaitingUserInput = false;
      }),

    resetTest: () =>
      set((state) => {
        state.isExecuting = false;
        state.isPaused = false;
        state.currentNodeId = null;
        state.executionHistory = [];
        state.variables = {};
        state.messages = [];
        state.pendingMenuSelection = null;
        state.executionLog = [];
        state.awaitingUserInput = false;
      }),

    setCurrentNode: (nodeId) =>
      set((state) => {
        state.currentNodeId = nodeId;
      }),

    addMessage: (message) =>
      set((state) => {
        state.messages.push({
          ...message,
          id: crypto.randomUUID(),
          timestamp: new Date(),
        });
      }),

    addLogEntry: (entry) =>
      set((state) => {
        state.executionLog.push({
          ...entry,
          id: crypto.randomUUID(),
          timestamp: new Date(),
        });
      }),

    setVariable: (key, value) =>
      set((state) => {
        state.variables[key] = value;
      }),

    setPendingMenuSelection: (selection) =>
      set((state) => {
        state.pendingMenuSelection = selection;
      }),

    setAwaitingUserInput: (awaiting) =>
      set((state) => {
        state.awaitingUserInput = awaiting;
      }),

    setSimulatedContact: (contact) =>
      set((state) => {
        state.simulatedContact = contact;
      }),

    addToExecutionHistory: (nodeId) =>
      set((state) => {
        state.executionHistory.push(nodeId);
      }),
  }))
);
