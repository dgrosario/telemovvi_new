"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { useServerActionQuery } from "@/hooks/server-action-hooks";
import { listConversationsByContact } from "@/app/actions/conversations";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { ArrowLeft } from "lucide-react";
import { typeChannelsAvailable } from "@omnichannel/core/domain/entities/channel";
import type { Channel } from "@omnichannel/core/domain/entities/channel";
import type { Conversation } from "@omnichannel/core/domain/entities/conversation";
import { HistoryMessageList } from "./history-message-list";
import { GroupedHistoryView } from "./grouped-history-view";
import { conversationStatusConfig } from "./message-utils";

type Props = {
  contactId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type Mode = "list" | "conversation" | "grouped";

const statusConfig = conversationStatusConfig;

function formatDate(date: Date | string | null): string {
  if (!date) return "-";
  return format(new Date(date), "dd/MM/yyyy HH:mm");
}

function formatRelativeDate(date: Date | string | null): string {
  if (!date) return "";
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR });
}

const modeTitle: Record<Mode, string> = {
  list: "Histórico de conversas",
  conversation: "Mensagens da conversa",
  grouped: "Histórico unificado",
};

export function ContactHistoryModal({ contactId, open, onOpenChange }: Props) {
  const [mode, setMode] = useState<Mode>("list");
  const [selectedConversation, setSelectedConversation] = useState<Conversation.Raw | null>(null);

  const { data, isLoading, isError } = useServerActionQuery(listConversationsByContact, {
    input: { contactId },
    queryKey: ["conversations-by-contact", contactId],
    enabled: open && !!contactId,
  });

  const conversations = data ?? [];

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSelectedConversation(null);
      setMode("list");
    }
    onOpenChange(nextOpen);
  };

  const handleBack = () => {
    setSelectedConversation(null);
    setMode("list");
  };

  const handleSelectConversation = (conv: Conversation.Raw) => {
    setSelectedConversation(conv);
    setMode("conversation");
  };

  const showBackButton = mode !== "list";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={cn("max-w-2xl", mode !== "list" && "sm:max-w-3xl")}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {showBackButton && (
              <button
                type="button"
                onClick={handleBack}
                className="p-1 -ml-1 rounded-md hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <ArrowLeft className="size-4" />
              </button>
            )}
            {modeTitle[mode]}
          </DialogTitle>
        </DialogHeader>

        {mode === "conversation" && selectedConversation ? (
          <HistoryMessageList
            conversation={selectedConversation}
          />
        ) : mode === "grouped" ? (
          <GroupedHistoryView
            contactId={contactId}
          />
        ) : isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="md" />
          </div>
        ) : isError ? (
          <p className="text-center text-sm text-destructive py-12">
            Erro ao carregar o histórico de conversas. Tente novamente.
          </p>
        ) : conversations.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-12">
            Nenhuma conversa encontrada para este contato
          </p>
        ) : (
          <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-1">
            <button
              type="button"
              onClick={() => setMode("grouped")}
              className="border rounded-lg p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors cursor-pointer text-left w-full"
            >
              <i className="tabler-history text-lg text-primary" />
              <div>
                <span className="text-sm font-medium">Histórico unificado</span>
                <p className="text-xs text-muted-foreground">Ver todas as mensagens em uma timeline</p>
              </div>
            </button>
            {conversations.map((conv) => {
              const channelType = conv.channel?.type as Channel.Type | undefined;
              const typeConfig = channelType
                ? typeChannelsAvailable.get(channelType)
                : null;
              const status = statusConfig[conv.status ?? ""] ?? null;

              return (
                <button
                  type="button"
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv)}
                  className="border rounded-lg p-3 flex flex-col gap-2 hover:bg-gray-50 transition-colors cursor-pointer text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {typeConfig && (
                        <i className={cn(typeConfig.icon, "text-lg shrink-0")} />
                      )}
                      <span className="text-sm font-medium truncate">
                        {conv.channel?.name ?? typeConfig?.name ?? "Canal desconhecido"}
                      </span>
                    </div>
                    {status && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0 text-[11px]",
                          status.color,
                          status.bg,
                          "border-transparent"
                        )}
                      >
                        {status.label}
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {conv.openedAt && (
                      <span>
                        Aberta em: {formatDate(conv.openedAt)}
                      </span>
                    )}
                    {conv.closedAt && (
                      <span>
                        Fechada em: {formatDate(conv.closedAt)}
                      </span>
                    )}
                    {conv.lastMessageCreatedAt && (
                      <span title={formatDate(conv.lastMessageCreatedAt)}>
                        Última msg: {formatRelativeDate(conv.lastMessageCreatedAt)}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    {conv.attendant && (
                      <span className="text-muted-foreground">
                        <i className="tabler-user inline-block mr-0.5 align-text-bottom" />
                        {conv.attendant.name}
                      </span>
                    )}
                    {conv.sector && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <span
                          className="inline-block size-2 rounded-full shrink-0"
                          style={{ backgroundColor: conv.sector.color ?? "#3B82F6" }}
                        />
                        {conv.sector.name}
                      </span>
                    )}
                  </div>

                  {conv.teaser && (
                    <p className="text-xs text-muted-foreground italic truncate">
                      {conv.teaser}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
