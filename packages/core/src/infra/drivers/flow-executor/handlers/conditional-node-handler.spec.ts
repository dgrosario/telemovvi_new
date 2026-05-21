import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FlowNode } from "../../../../domain/entities/flow-node";
import { ConditionalNodeHandler } from "./conditional-node-handler";
import type { ExecutionContext } from "../types";

function createContext(
  overrides: Partial<ExecutionContext> = {}
): ExecutionContext {
  return {
    flowExecution: {
      variables: {},
    },
    currentNode: {
      id: "node-1",
      type: "conditional",
      data: {},
    },
    conversation: {
      contact: null,
      sector: null,
    },
    channel: {
      type: "whatsapp",
    },
    workspaceId: "workspace-1",
    userMessage: undefined,
    resolvedSystemVariables: {},
    cache: {
      partners: new Map(),
      partnerLabels: new Map(),
    },
    partnerMetadata: undefined,
    ...overrides,
  } as unknown as ExecutionContext;
}

function createDateRule(
  overrides: Partial<FlowNode.ConditionalRule> = {}
): FlowNode.ConditionalRule {
  return {
    id: "rule-1",
    variable: "system.current_date",
    variableType: "date",
    operator: "equals",
    value: "17/02/2026",
    ...overrides,
  };
}

describe("ConditionalNodeHandler date rules", () => {
  let handler: ConditionalNodeHandler;

  beforeEach(() => {
    handler = new ConditionalNodeHandler(
      {
        retrieveByPartnerContactIdWithWorkspace: vi.fn(),
      },
      {
        listLabelsByPartner: vi.fn(),
      }
    );

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-17T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function evaluate(
    rule: FlowNode.ConditionalRule,
    context: ExecutionContext
  ): Promise<boolean> {
    const internalHandler = handler as unknown as {
      evaluateRule: (
        targetRule: FlowNode.ConditionalRule,
        targetContext: ExecutionContext
      ) => Promise<boolean>;
    };
    return internalHandler.evaluateRule(rule, context);
  }

  it("evaluates equals with current date", async () => {
    const result = await evaluate(createDateRule(), createContext());

    expect(result).toBe(true);
  });

  it("evaluates greater_than and less_or_equal for date variables", async () => {
    const context = createContext({
      flowExecution: {
        variables: {
          appointment_date: "18/02/2026",
        },
      } as unknown as ExecutionContext["flowExecution"],
    });

    const greaterThan = await evaluate(
      createDateRule({
        variable: "flow.appointment_date",
        operator: "greater_than",
        value: "17/02/2026",
      }),
      context
    );
    const lessOrEqual = await evaluate(
      createDateRule({
        variable: "flow.appointment_date",
        operator: "less_or_equal",
        value: "18/02/2026",
      }),
      context
    );

    expect(greaterThan).toBe(true);
    expect(lessOrEqual).toBe(true);
  });

  it("evaluates between as inclusive", async () => {
    const context = createContext({
      flowExecution: {
        variables: {
          invoice_date: "17/02/2026",
        },
      } as unknown as ExecutionContext["flowExecution"],
    });

    const result = await evaluate(
      createDateRule({
        variable: "flow.invoice_date",
        operator: "between",
        value: "17/02/2026",
        value2: "20/02/2026",
      }),
      context
    );

    expect(result).toBe(true);
  });

  it("reads date from resolved system variables fallback", async () => {
    const context = createContext({
      resolvedSystemVariables: {
        data: "17/02/2026",
      },
    });

    const result = await evaluate(
      createDateRule({
        variable: "data",
        operator: "equals",
        value: "17/02/2026",
      }),
      context
    );

    expect(result).toBe(true);
  });

  it("accepts legacy ISO values in comparison", async () => {
    const context = createContext({
      flowExecution: {
        variables: {
          due_date: "2026-02-17",
        },
      } as unknown as ExecutionContext["flowExecution"],
    });

    const result = await evaluate(
      createDateRule({
        variable: "flow.due_date",
        operator: "equals",
        value: "17/02/2026",
      }),
      context
    );

    expect(result).toBe(true);
  });
});
