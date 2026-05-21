import { describe, expect, it } from "vitest";
import { getPermissionsByCategory, permissions } from "./permissions";

describe("permissions catalog", () => {
  it("includes whatsapp groups permission in conversations category", () => {
    expect(getPermissionsByCategory("conversations")).toContain(
      "view:whatsapp-groups"
    );

    expect(permissions.get("view:whatsapp-groups")).toMatchObject({
      category: "conversations",
      linkeds: [],
    });
  });

  it("does not grant whatsapp groups through manage conversations", () => {
    expect(permissions.get("manage:conversations")?.linkeds).not.toContain(
      "view:whatsapp-groups"
    );
  });
});
