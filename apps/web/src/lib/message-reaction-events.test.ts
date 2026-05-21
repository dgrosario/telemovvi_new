import { Message } from "@omnichannel/core/domain/entities/message";
import { describe, expect, it } from "vitest";
import { applyReactionEvent } from "./message-reaction-events";

function createReaction(
  overrides: Partial<Message.Reaction> = {},
): Message.Reaction {
  return {
    id: "reaction-1",
    emoji: "❤️",
    reactorType: "contact",
    reactorId: "contact-1",
    reactorName: "Contact 1",
    createdAt: new Date("2026-02-17T12:00:00.000Z"),
    ...overrides,
  };
}

describe("applyReactionEvent", () => {
  it("adds reaction when not duplicated", () => {
    const reactions = [createReaction({ id: "reaction-1", emoji: "👍" })];
    const incoming = createReaction({ id: "reaction-2", emoji: "❤️" });

    const result = applyReactionEvent(reactions, {
      action: "added",
      reaction: incoming,
      removedBy: null,
    });

    expect(result).toHaveLength(2);
    expect(result[1]).toEqual(incoming);
  });

  it("does not duplicate same emoji from same reactor", () => {
    const existing = createReaction({ id: "reaction-1", emoji: "❤️" });
    const duplicate = createReaction({ id: "reaction-2", emoji: "❤️" });

    const result = applyReactionEvent([existing], {
      action: "added",
      reaction: duplicate,
      removedBy: null,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(existing);
  });

  it("removes by reaction identity when payload has reaction", () => {
    const keep = createReaction({
      id: "reaction-keep",
      emoji: "🔥",
      reactorId: "contact-2",
    });
    const remove = createReaction({
      id: "reaction-remove",
      emoji: "❤️",
      reactorId: "contact-1",
    });

    const result = applyReactionEvent([keep, remove], {
      action: "removed",
      reaction: createReaction({ emoji: "❤️", reactorId: "contact-1" }),
      removedBy: null,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(keep);
  });

  it("falls back to removedBy when reaction payload is null", () => {
    const remove1 = createReaction({
      id: "reaction-remove-1",
      emoji: "❤️",
      reactorId: "contact-1",
    });
    const remove2 = createReaction({
      id: "reaction-remove-2",
      emoji: "🔥",
      reactorId: "contact-1",
    });
    const keep = createReaction({
      id: "reaction-keep",
      emoji: "👍",
      reactorId: "contact-2",
    });

    const result = applyReactionEvent([remove1, remove2, keep], {
      action: "removed",
      reaction: null,
      removedBy: "contact-1",
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(keep);
  });
});
