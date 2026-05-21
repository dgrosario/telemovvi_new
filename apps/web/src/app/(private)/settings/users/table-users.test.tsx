import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import TableUsers from "./table-users";

const mockModalConfirmDelete = vi.fn();
const mockUseServerActionQuery = vi.fn();
const mockUseServerActionMutation = vi.fn();

vi.mock("@/app/actions/users", () => ({
  listUsers: vi.fn(),
  removeUser: vi.fn(),
}));

vi.mock("@/hooks/server-action-hooks", () => ({
  useServerActionQuery: (...args: unknown[]) => mockUseServerActionQuery(...args),
  useServerActionMutation: (...args: unknown[]) => mockUseServerActionMutation(...args),
}));

vi.mock("@/hooks/use-users", () => ({
  useUsers: () => ({
    setUserId: vi.fn(),
    toggleOpenDetails: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-permission-check", () => ({
  usePermissionCheck: () => ({
    hasPermission: true,
    tooltipMessage: "",
  }),
}));

vi.mock("@/components/permissions-manager", () => ({
  PermissionsManager: () => null,
}));

vi.mock("./dialog-bulk-assign-sector", () => ({
  DialogBulkAssignSector: () => null,
}));

vi.mock("./dialog-bulk-assign-permissions", () => ({
  DialogBulkAssignPermissions: () => null,
}));

vi.mock("@/components/modal-confirm-delete", () => ({
  default: (props: Record<string, unknown>) => {
    mockModalConfirmDelete(props);
    return <div>{props.children as ReactNode}</div>;
  },
}));

vi.mock("@/components/table-default", () => ({
  TableDefault: ({ columns, rows }: { columns: Array<{ key: string; cell?: (value: unknown, row: any) => React.ReactNode }>; rows: any[] }) => (
    <div>
      {rows.map((row) => (
        <div key={row.id}>
          {columns.map((column) => (
            <div key={`${row.id}-${column.key}`}>
              {column.cell ? column.cell(row[column.key], row) : null}
            </div>
          ))}
        </div>
      ))}
    </div>
  ),
}));

describe("TableUsers delete action", () => {
  beforeEach(() => {
    mockModalConfirmDelete.mockReset();
    mockUseServerActionQuery.mockReset();
    mockUseServerActionMutation.mockReset();

    mockUseServerActionQuery.mockReturnValue({
      data: undefined,
    });
    mockUseServerActionMutation.mockReturnValue({
      mutate: vi.fn(),
    });
  });

  it("passes dialog-specific props without using title on the tooltip child", () => {
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <TableUsers
          users={[
            {
              id: "user-1",
              name: "Maria",
              email: "maria@example.com",
              sectors: [],
              permissions: [],
              isDeletable: true,
              isActive: true,
              displayName: null,
              phone: null,
              birthDate: null,
              address: null,
            },
          ]}
        />
      </QueryClientProvider>
    );

    const deleteModalCall = mockModalConfirmDelete.mock.calls.find(
      ([props]) => props.resourceName === "Maria"
    );

    expect(deleteModalCall).toBeDefined();
    expect(deleteModalCall?.[0]).toMatchObject({
      dialogTitle: "Tem certeza que deseja remover este usuário?",
      dialogContent:
        "Esta ação não pode ser desfeita. Para confirmar, digite o nome do usuário abaixo.",
    });
    expect(deleteModalCall?.[0]).not.toHaveProperty("title");
    expect(deleteModalCall?.[0]).not.toHaveProperty("content");
  });
});
