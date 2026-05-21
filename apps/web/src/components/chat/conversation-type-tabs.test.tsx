import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConversationTypeTabs } from "./conversation-type-tabs";

describe("ConversationTypeTabs", () => {
  it("hides the groups tab when group viewing is not allowed", () => {
    render(
      <ConversationTypeTabs
        activeType="contacts"
        onTypeChange={vi.fn()}
        showGroupsTab={false}
      />
    );

    expect(screen.queryByText("Grupos")).not.toBeInTheDocument();
    expect(screen.getByText("Contatos")).toBeInTheDocument();
    expect(screen.getByText("Internas")).toBeInTheDocument();
  });

  it("renders the groups tab when group viewing is allowed", () => {
    render(
      <ConversationTypeTabs
        activeType="groups"
        onTypeChange={vi.fn()}
        showGroupsTab={true}
      />
    );

    expect(screen.getByText("Grupos")).toBeInTheDocument();
  });
});
