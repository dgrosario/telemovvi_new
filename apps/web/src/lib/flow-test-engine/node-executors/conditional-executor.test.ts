import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Node } from "reactflow";
import { conditionalExecutor } from "./conditional-executor";
import type { ExecutionContext } from "../types";

function createContext(
  overrides: Partial<ExecutionContext> = {}
): ExecutionContext {
  return {
    nodes: [],
    edges: [],
    variables: {},
    simulatedContact: {
      name: "Contato Teste",
      phone: "5511999999999",
    },
    addMessage: vi.fn(),
    addLogEntry: vi.fn(),
    setVariable: vi.fn(),
    findNextNode: vi.fn((_nodeId: string, handleId?: string) =>
      handleId ? `next-${handleId}` : "next-default"
    ),
    ...overrides,
  };
}

function createConditionalNode(rule: {
  id: string;
  variable: string;
  operator: string;
  value: string;
  value2?: string;
  variableType?: "string" | "number" | "boolean" | "array" | "day_of_week" | "time" | "date";
}): Node {
  return {
    id: "node-1",
    type: "conditional",
    position: { x: 0, y: 0 },
    data: {
      label: "Condição",
      defaultBranch: {
        id: "default-1",
      },
      conditions: [
        {
          id: "condition-1",
          label: "Condição 1",
          rules: [rule],
        },
      ],
    },
  };
}

describe("conditionalExecutor date comparisons", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-17T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("evaluates equals with system.current_date", async () => {
    const node = createConditionalNode({
      id: "rule-1",
      variable: "system.current_date",
      variableType: "date",
      operator: "equals",
      value: "17/02/2026",
    });

    const result = await conditionalExecutor.execute(node, createContext());

    expect(result.nextNodeId).toBe("next-condition-1");
  });

  it("evaluates greater_than and less_or_equal for date values", async () => {
    const context = createContext({
      variables: {
        "flow.delivery_date": "18/02/2026",
      },
    });

    const greaterThanNode = createConditionalNode({
      id: "rule-1",
      variable: "flow.delivery_date",
      variableType: "date",
      operator: "greater_than",
      value: "17/02/2026",
    });

    const lessOrEqualNode = createConditionalNode({
      id: "rule-2",
      variable: "flow.delivery_date",
      variableType: "date",
      operator: "less_or_equal",
      value: "18/02/2026",
    });

    const greaterThanResult = await conditionalExecutor.execute(
      greaterThanNode,
      context
    );
    const lessOrEqualResult = await conditionalExecutor.execute(
      lessOrEqualNode,
      context
    );

    expect(greaterThanResult.nextNodeId).toBe("next-condition-1");
    expect(lessOrEqualResult.nextNodeId).toBe("next-condition-1");
  });

  it("evaluates between as inclusive", async () => {
    const context = createContext({
      variables: {
        "flow.invoice_date": "17/02/2026",
      },
    });
    const node = createConditionalNode({
      id: "rule-1",
      variable: "flow.invoice_date",
      variableType: "date",
      operator: "between",
      value: "17/02/2026",
      value2: "20/02/2026",
    });

    const result = await conditionalExecutor.execute(node, context);

    expect(result.nextNodeId).toBe("next-condition-1");
  });

  it("supports legacy ISO date values", async () => {
    const context = createContext({
      variables: {
        "flow.legacy_date": "2026-02-17",
      },
    });
    const node = createConditionalNode({
      id: "rule-1",
      variable: "flow.legacy_date",
      variableType: "date",
      operator: "equals",
      value: "17/02/2026",
    });

    const result = await conditionalExecutor.execute(node, context);

    expect(result.nextNodeId).toBe("next-condition-1");
  });
});
