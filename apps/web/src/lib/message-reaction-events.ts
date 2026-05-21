import { Message } from "@omnichannel/core/domain/entities/message";

export type MessageReactionEventPayload = {
  action: "added" | "removed";
  reaction: Message.Reaction | null;
  removedBy: string | null;
};

export function applyReactionEvent(
  currentReactions: Message.Reaction[],
  event: MessageReactionEventPayload,
): Message.Reaction[] {
  if (event.action === "added" && event.reaction) {
    const exists = currentReactions.some(
      (reaction) =>
        reaction.reactorId === event.reaction?.reactorId &&
        reaction.emoji === event.reaction?.emoji,
    );

    if (exists) {
      return currentReactions;
    }

    return [...currentReactions, event.reaction];
  }

  if (event.action !== "removed") {
    return currentReactions;
  }

  if (event.reaction) {
    return currentReactions.filter(
      (reaction) =>
        !(
          reaction.reactorId === event.reaction?.reactorId &&
          reaction.emoji === event.reaction?.emoji
        ),
    );
  }

  if (event.removedBy) {
    return currentReactions.filter(
      (reaction) => reaction.reactorId !== event.removedBy,
    );
  }

  return currentReactions;
}
