"use client";

import { useState, useMemo } from "react";
import { X, Search } from "lucide-react";
import { useServerActionQuery } from "@/hooks/server-action-hooks";
import { listQuickMessages } from "@/app/actions/quick-messages";
import { usePermissionCheck } from "@/hooks/use-permission-check";
import { CircularProgress } from "@mui/material";

interface MobileQuickMessagesModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (message: string, quickMessageId?: string) => void;
  conversationId?: string;
}

export function MobileQuickMessagesModal({
  open,
  onClose,
  onSelect,
  conversationId,
}: MobileQuickMessagesModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const { hasPermission: canCreateQuickMessages } = usePermissionCheck(["create:quick-messages"]);
  
  const { data: quickMessages = [], isLoading } = useServerActionQuery(
    listQuickMessages,
    {
      input: undefined,
      queryKey: ["list-quick-messages"],
      enabled: canCreateQuickMessages && open,
    }
  );

  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return quickMessages;

    const query = searchQuery.toLowerCase();
    return quickMessages.filter(
      (qm) =>
        qm.shortcode.toLowerCase().includes(query) ||
        qm.message.toLowerCase().includes(query)
    );
  }, [quickMessages, searchQuery]);

  const handleSelect = (qm: { id: string; shortcode: string; message: string }) => {
    onSelect(qm.message, qm.id);
    setSearchQuery("");
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white w-full md:w-[480px] md:rounded-2xl rounded-t-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="text-lg font-semibold">Mensagens Rápidas</h3>
            <p className="text-sm text-gray-500">Clique para inserir no texto</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por atalho ou conteúdo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <CircularProgress size={24} />
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center px-4">
              <p className="text-gray-500">
                {searchQuery
                  ? "Nenhuma mensagem encontrada"
                  : "Nenhuma mensagem rápida disponível"}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredMessages.map((qm) => (
                <button
                  key={qm.id}
                  onClick={() => handleSelect(qm)}
                  className="w-full text-left p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-primary">
                          /{qm.shortcode}
                        </span>
                        {qm.mediaUrl && (
                          <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full">
                            📎 Mídia
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {qm.message}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
