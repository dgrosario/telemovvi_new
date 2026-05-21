import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActionNodeForm } from "./action-node-form";

const updateNodeData = vi.fn();
const mockUsers = [{ id: "user-1", name: "Daniela" }];
const mockSectors = [{ id: "sector-1", name: "Sao Manuel" }];
const emptyQueryResult = { data: [] as unknown[] };

vi.mock("@/hooks/server-action-hooks", () => ({
  useServerActionQuery: vi.fn((_: unknown, config?: { queryKey?: string[] }) => {
    if (config?.queryKey?.[0] === "users-list") {
      return { data: mockUsers };
    }

    if (config?.queryKey?.[0] === "sectors") {
      return { data: mockSectors };
    }

    return emptyQueryResult;
  }),
}));

vi.mock("@/app/actions/users", () => ({
  listUsers: vi.fn(),
}));

vi.mock("@/app/actions/channels", () => ({
  listChannels: vi.fn(),
}));

vi.mock("@/app/actions/templates", () => ({
  loadTemplatesApprovedFromChannel: vi.fn(),
}));

vi.mock("@/app/actions/sectors", () => ({
  listSectors: vi.fn(),
}));

vi.mock("@/components/labels-selector", () => ({
  LabelsSelector: () => null,
}));

vi.mock("./flow-variable-inserter", () => ({
  FlowVariableInserter: () => null,
}));

vi.mock("@/stores/flow-editor-store", () => ({
  useFlowEditorStore: (selector: (state: unknown) => unknown) =>
    selector({
      updateNodeData,
      nodes: [],
    }),
}));

describe("ActionNodeForm", () => {
  beforeEach(() => {
    updateNodeData.mockReset();
  });

  it("removes legacy attendant fields from transfer actions when saving", () => {
    render(
      <ActionNodeForm
        nodeId="node-1"
        initialData={{
          actionType: "transfer",
          sectorId: "sector-1",
          sectorName: "Sao Manuel",
          attendantId: "user-1",
          attendantName: "Daniela",
        }}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Salvar Alterações" }));

    expect(updateNodeData).toHaveBeenCalledTimes(1);
    const [, savedNodeData] = updateNodeData.mock.calls[0];

    expect(savedNodeData.actionType).toBe("transfer");
    expect(savedNodeData.attendantId).toBeUndefined();
    expect(savedNodeData.attendantName).toBeUndefined();
    expect(savedNodeData.actions[0]).not.toHaveProperty("attendantId");
    expect(savedNodeData.actions[0]).not.toHaveProperty("attendantName");
  });

  it("clears attendant assignment when the action type changes to transfer", () => {
    render(
      <ActionNodeForm
        nodeId="node-1"
        initialData={{
          actionType: "assign_conversation",
          attendantId: "user-1",
          attendantName: "Daniela",
        }}
        onClose={vi.fn()}
      />
    );

    fireEvent.mouseDown(screen.getAllByRole("combobox")[0]);
    fireEvent.click(screen.getByRole("option", { name: "Transferir Conversa" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar Alterações" }));

    expect(updateNodeData).toHaveBeenCalledTimes(1);
    const [, savedNodeData] = updateNodeData.mock.calls[0];

    expect(savedNodeData.actionType).toBe("transfer");
    expect(savedNodeData.attendantId).toBeUndefined();
    expect(savedNodeData.attendantName).toBeUndefined();
    expect(savedNodeData.actions[0]).not.toHaveProperty("attendantId");
    expect(savedNodeData.actions[0]).not.toHaveProperty("attendantName");
  });

  it("removes legacy sector fields from assign_conversation actions when saving", () => {
    render(
      <ActionNodeForm
        nodeId="node-1"
        initialData={{
          actionType: "assign_conversation",
          attendantId: "user-1",
          attendantName: "Daniela",
          sectorId: "sector-1",
          sectorName: "Sao Manuel",
        }}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Salvar Alterações" }));

    expect(updateNodeData).toHaveBeenCalledTimes(1);
    const [, savedNodeData] = updateNodeData.mock.calls[0];

    expect(savedNodeData.actionType).toBe("assign_conversation");
    expect(savedNodeData.sectorId).toBeUndefined();
    expect(savedNodeData.sectorName).toBeUndefined();
    expect(savedNodeData.actions[0]).not.toHaveProperty("sectorId");
    expect(savedNodeData.actions[0]).not.toHaveProperty("sectorName");
  });
});
