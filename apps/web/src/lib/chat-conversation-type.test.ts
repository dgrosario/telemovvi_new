import { describe, expect, it } from "vitest";
import {
  normalizeConversationType,
  normalizeConversationListFilter,
  shouldShowStatusFilters,
  toConversationTypeFilter,
} from "./chat-conversation-type";

describe("chat conversation type access", () => {
  it("falls back to contacts when groups are requested without permission", () => {
    expect(normalizeConversationType("groups", false)).toBe("contacts");
    expect(toConversationTypeFilter("groups", false)).toBe("contacts");
  });

  it("preserves groups when the user has permission", () => {
    expect(normalizeConversationType("groups", true)).toBe("groups");
    expect(toConversationTypeFilter("groups", true)).toBe("groups");
  });

  it("preserves internal conversations independently from groups permission", () => {
    expect(normalizeConversationType("internal", false)).toBe("internal");
  });

  it("falls back from all to contacts when group viewing is not allowed", () => {
    expect(normalizeConversationListFilter("all", false)).toBe("contacts");
    expect(normalizeConversationListFilter("all", true)).toBe("all");
  });

  it("shows status filters only for normalized contacts mode", () => {
    expect(shouldShowStatusFilters("contacts")).toBe(true);
    expect(shouldShowStatusFilters("groups")).toBe(false);
    expect(shouldShowStatusFilters("internal")).toBe(false);
  });
});
