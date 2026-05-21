"use client";

import { useMemo } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Message } from "@omnichannel/core/domain/entities/message";

interface GroupedReaction {
  emoji: string;
  count: number;
  reactors: Array<{
    id: string;
    name: string | null;
    type: "attendant" | "contact";
  }>;
  hasCurrentUserReaction: boolean;
}

interface MessageReactionsProps {
  reactions: Message.Reaction[];
  currentUserId?: string;
  onToggleReaction: (emoji: string) => void;
  isOwnMessage?: boolean;
  disabled?: boolean;
}

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export function MessageReactions({
  reactions,
  currentUserId,
  onToggleReaction,
  isOwnMessage,
  disabled,
}: MessageReactionsProps) {
  const groupedReactions = useMemo(() => {
    const groups = new Map<string, GroupedReaction>();

    for (const reaction of reactions) {
      const existing = groups.get(reaction.emoji);
      if (existing) {
        existing.count += 1;
        existing.reactors.push({
          id: reaction.reactorId,
          name: reaction.reactorName,
          type: reaction.reactorType,
        });
        if (reaction.reactorType === "attendant" && reaction.reactorId === currentUserId) {
          existing.hasCurrentUserReaction = true;
        }
      } else {
        groups.set(reaction.emoji, {
          emoji: reaction.emoji,
          count: 1,
          reactors: [{
            id: reaction.reactorId,
            name: reaction.reactorName,
            type: reaction.reactorType,
          }],
          hasCurrentUserReaction:
            reaction.reactorType === "attendant" && reaction.reactorId === currentUserId,
        });
      }
    }

    return Array.from(groups.values());
  }, [reactions, currentUserId]);

  const formatReactorNames = (reactors: GroupedReaction["reactors"]): string => {
    const names = reactors
      .map((r) => r.name || (r.type === "contact" ? "Contato" : "Atendente"))
      .slice(0, 5);

    if (reactors.length > 5) {
      return `${names.join(", ")} e mais ${reactors.length - 5}`;
    }

    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} e ${names[1]}`;

    const lastIndex = names.length - 1;
    return `${names.slice(0, lastIndex).join(", ")} e ${names[lastIndex]}`;
  };

  if (reactions.length === 0) {
    return null;
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          "flex flex-wrap gap-1 items-center mt-1 -mb-1 px-2",
          isOwnMessage ? "justify-end" : "justify-start"
        )}
      >
        {groupedReactions.map((group) => (
          <Tooltip key={group.emoji}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onToggleReaction(group.emoji)}
                disabled={disabled}
                className={cn(
                  "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs transition-all",
                  "border hover:scale-105 active:scale-95",
                  group.hasCurrentUserReaction
                    ? "bg-blue-100 border-blue-300 text-blue-700"
                    : "bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200",
                  disabled && "opacity-50 cursor-not-allowed hover:scale-100 active:scale-100"
                )}
              >
                <span className="text-sm leading-none">{group.emoji}</span>
                {group.count > 1 && (
                  <span className="text-[10px] font-medium">{group.count}</span>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs max-w-[200px]">
              {formatReactorNames(group.reactors)}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
