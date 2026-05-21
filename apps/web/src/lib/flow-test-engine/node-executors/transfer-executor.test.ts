import { describe, expect, it, vi } from "vitest";
import { transferExecutor } from "./transfer-executor";

describe("transferExecutor", () => {
  it("records only the transfer message without claiming the flow ended", async () => {
    const messages: Array<{ type: string; content: string; nodeId?: string }> = [];

    await transferExecutor.execute(
      {
        id: "transfer-1",
        type: "transfer",
        position: { x: 0, y: 0 },
        data: {
          sectorName: "Financeiro",
        },
      },
      {
        nodes: [],
        edges: [],
        variables: {},
        simulatedContact: {
          name: "Cliente",
          phone: "5511999999999",
        },
        addMessage: (message) => {
          messages.push(message);
        },
        addLogEntry: vi.fn(),
        setVariable: vi.fn(),
        findNextNode: vi.fn(),
      }
    );

    expect(messages).toEqual([
      {
        type: "system",
        content: "[Simulação] Transferência para setor: Financeiro",
        nodeId: "transfer-1",
      },
    ]);
  });
});
