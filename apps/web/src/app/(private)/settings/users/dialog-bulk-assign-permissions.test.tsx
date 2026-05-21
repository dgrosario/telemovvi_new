import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DialogBulkAssignPermissions } from "./dialog-bulk-assign-permissions";

const mockUseServerActionQuery = vi.fn();
const mockUseServerActionMutation = vi.fn();
const toastError = vi.fn();

vi.mock("@/hooks/server-action-hooks", () => ({
  useServerActionQuery: (...args: unknown[]) => mockUseServerActionQuery(...args),
  useServerActionMutation: (...args: unknown[]) => mockUseServerActionMutation(...args),
}));

vi.mock("@/app/actions/roles", () => ({
  listRoles: vi.fn(),
}));

vi.mock("@/app/actions/users", () => ({
  bulkUpsertPermissions: vi.fn(),
}));

vi.mock("react-toastify", () => ({
  Flip: undefined,
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: vi.fn(),
  },
}));

describe("DialogBulkAssignPermissions", () => {
  beforeEach(() => {
    mockUseServerActionQuery.mockReset();
    mockUseServerActionMutation.mockReset();
    toastError.mockReset();

    mockUseServerActionMutation.mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
    });
  });

  function renderDialog() {
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <DialogBulkAssignPermissions
          open
          onClose={vi.fn()}
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
  }

  it("renders the returned roles in the profile selector", async () => {
    mockUseServerActionQuery.mockReturnValue({
      data: [
        {
          id: "role-1",
          name: "Administrador",
          description: null,
          permissions: ["manage:users", "list:users"],
          isSystem: false,
          blockedSectorIds: [],
        },
      ],
      isLoading: false,
      error: null,
    });

    renderDialog();

    fireEvent.mouseDown(screen.getByRole("combobox"));

    expect(
      await screen.findByRole("option", { name: /Administrador/i })
    ).toBeInTheDocument();
  });

  it("shows a toast when roles fail to load", async () => {
    mockUseServerActionQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: new Error("boom"),
    });

    renderDialog();

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        expect.stringContaining("Erro ao carregar perfis: boom"),
        expect.any(Object)
      );
    });
  });

  it("does not loop when the roles array identity changes after selecting a profile", async () => {
    mockUseServerActionQuery.mockImplementation(() => ({
      data: [
        {
          id: "role-1",
          name: "Administrador",
          description: null,
          permissions: ["manage:users", "list:users"],
          isSystem: false,
          blockedSectorIds: [],
        },
      ],
      isLoading: false,
      error: null,
    }));

    renderDialog();

    fireEvent.mouseDown(screen.getByRole("combobox"));
    fireEvent.click(
      await screen.findByRole("option", { name: /Administrador/i })
    );

    expect(
      await screen.findByText(/Este perfil inclui 2 de/i)
    ).toBeInTheDocument();
  });
});
