"use client";

import React from "react";
import { Users, UsersRound, MessageSquare, Plus } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type ConversationType = "contacts" | "groups" | "internal";

interface ConversationTypeTabsProps {
  activeType: ConversationType;
  onTypeChange: (type: ConversationType) => void;
  onNewInternalConversation?: () => void;
  showGroupsTab?: boolean;
}

const tabs = [
  {
    value: "contacts" as const,
    label: "Contatos",
    icon: Users,
  },
  {
    value: "groups" as const,
    label: "Grupos",
    icon: UsersRound,
  },
  {
    value: "internal" as const,
    label: "Internas",
    icon: MessageSquare,
  },
];

export const ConversationTypeTabs: React.FC<ConversationTypeTabsProps> = ({
  activeType,
  onTypeChange,
  onNewInternalConversation,
  showGroupsTab = true,
}) => {
  const visibleTabs = showGroupsTab
    ? tabs
    : tabs.filter((tab) => tab.value !== "groups");

  return (
    <div className="flex items-center justify-around border-t bg-white py-2 px-2 md:px-4">
      {visibleTabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeType === tab.value;

        return (
          <Tooltip key={tab.value}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onTypeChange(tab.value)}
                className={`
                  flex flex-col items-center gap-1 px-4 py-2 rounded-lg
                  transition-all cursor-pointer min-w-[70px]
                  ${isActive
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-primary hover:bg-primary/5"
                  }
                `}
              >
                <Icon className="size-5" />
                <span className="text-xs font-medium">{tab.label}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4}>
              {tab.label}
            </TooltipContent>
          </Tooltip>
        );
      })}

      {onNewInternalConversation && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onNewInternalConversation}
              className="flex flex-col items-center gap-1 px-4 py-2 rounded-lg
                transition-all cursor-pointer min-w-[70px]
                text-muted-foreground hover:text-primary hover:bg-primary/5"
            >
              <Plus className="size-5" />
              <span className="text-xs font-medium">Adicionar</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={4}>
            Nova conversa interna
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
};
