import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SectorBlocker } from "../sector-blocker";

const mockSectors = [
  { id: "sector-1", name: "Vendas" },
  { id: "sector-2", name: "Suporte" },
  { id: "sector-3", name: "Financeiro" },
];

describe("SectorBlocker", () => {
  describe("rendering", () => {
    it("should collapse content when isVisible is false", () => {
      const { container } = render(
        <SectorBlocker
          isVisible={false}
          sectors={mockSectors}
          blockedSectorIds={new Set()}
          onToggle={vi.fn()}
          context="role"
        />
      );

      const collapse = container.querySelector(".MuiCollapse-root");
      expect(collapse).toHaveClass("MuiCollapse-hidden");
    });

    it("should render all sectors when isVisible is true", () => {
      render(
        <SectorBlocker
          isVisible={true}
          sectors={mockSectors}
          blockedSectorIds={new Set()}
          onToggle={vi.fn()}
          context="role"
        />
      );

      expect(screen.getByText("Vendas")).toBeInTheDocument();
      expect(screen.getByText("Suporte")).toBeInTheDocument();
      expect(screen.getByText("Financeiro")).toBeInTheDocument();
    });

    it("should show empty state when no sectors exist", () => {
      render(
        <SectorBlocker
          isVisible={true}
          sectors={[]}
          blockedSectorIds={new Set()}
          onToggle={vi.fn()}
          context="role"
        />
      );

      expect(screen.getByText("Nenhum setor cadastrado")).toBeInTheDocument();
    });
  });

  describe("context text", () => {
    it("should show correct text for role context", () => {
      render(
        <SectorBlocker
          isVisible={true}
          sectors={mockSectors}
          blockedSectorIds={new Set()}
          onToggle={vi.fn()}
          context="role"
        />
      );

      expect(
        screen.getByText(/usuários com este perfil/i)
      ).toBeInTheDocument();
    });

    it("should show correct text for user context", () => {
      render(
        <SectorBlocker
          isVisible={true}
          sectors={mockSectors}
          blockedSectorIds={new Set()}
          onToggle={vi.fn()}
          context="user"
        />
      );

      expect(screen.getByText(/este usuário/i)).toBeInTheDocument();
    });
  });

  describe("blocked sectors display", () => {
    it("should show message when no sectors are blocked", () => {
      render(
        <SectorBlocker
          isVisible={true}
          sectors={mockSectors}
          blockedSectorIds={new Set()}
          onToggle={vi.fn()}
          context="role"
        />
      );

      expect(
        screen.getByText(/Nenhum setor bloqueado = pode ver dados de contatos em todos os setores/i)
      ).toBeInTheDocument();
    });

    it("should show blocked sector names when sectors are blocked", () => {
      render(
        <SectorBlocker
          isVisible={true}
          sectors={mockSectors}
          blockedSectorIds={new Set(["sector-1", "sector-2"])}
          onToggle={vi.fn()}
          context="role"
        />
      );

      expect(
        screen.getByText(/NÃO poderá ver dados de contatos nos setores: Vendas, Suporte/i)
      ).toBeInTheDocument();
    });

    it("should handle blocked sector IDs that do not exist in sectors list", () => {
      render(
        <SectorBlocker
          isVisible={true}
          sectors={mockSectors}
          blockedSectorIds={new Set(["sector-1", "non-existent-sector"])}
          onToggle={vi.fn()}
          context="role"
        />
      );

      expect(
        screen.getByText(/NÃO poderá ver dados de contatos nos setores: Vendas/i)
      ).toBeInTheDocument();
    });
  });

  describe("interaction", () => {
    it("should call onToggle when a sector chip is clicked", () => {
      const onToggle = vi.fn();
      render(
        <SectorBlocker
          isVisible={true}
          sectors={mockSectors}
          blockedSectorIds={new Set()}
          onToggle={onToggle}
          context="role"
        />
      );

      fireEvent.click(screen.getByText("Vendas"));

      expect(onToggle).toHaveBeenCalledWith("sector-1");
    });

    it("should call onToggle with correct sector id for blocked sector", () => {
      const onToggle = vi.fn();
      render(
        <SectorBlocker
          isVisible={true}
          sectors={mockSectors}
          blockedSectorIds={new Set(["sector-2"])}
          onToggle={onToggle}
          context="role"
        />
      );

      fireEvent.click(screen.getByText("Suporte"));

      expect(onToggle).toHaveBeenCalledWith("sector-2");
    });
  });
});
