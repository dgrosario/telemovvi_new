"use client";

import { useState, useMemo } from "react";
import { X, Search, Workflow } from "lucide-react";
import {
  useServerActionMutation,
  useServerActionQuery,
} from "@/hooks/server-action-hooks";
import { listFlows, executeFlow } from "@/app/actions/flows";
import { toast } from "react-toastify";
import { usePermissionCheck } from "@/hooks/use-permission-check";
import { CircularProgress } from "@mui/material";

interface MobileFlowsModalProps {
  open: boolean;
  onClose: () => void;
  conversationId?: string;
  disabled?: boolean;
}

export function MobileFlowsModal({
  open,
  onClose,
  conversationId,
  disabled,
}: MobileFlowsModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const { hasPermission: canListFlows } = usePermissionCheck(["list:flows"]);

  const { data: flows = [], isLoading } = useServerActionQuery(listFlows, {
    input: undefined,
    queryKey: ["list-flows"],
    enabled: canListFlows && open,
  });

  const executeFlowMutation = useServerActionMutation(executeFlow, {
    onSuccess: () => {
      toast.success("Fluxo iniciado com sucesso!");
      onClose();
      setSearchQuery("");
    },
    onError: (error) => {
      toast.error("Erro ao iniciar fluxo: " + error.message);
    },
  });

  const activeFlows = useMemo(() => {
    return flows.filter((flow) => flow.status === "active");
  }, [flows]);

  const filteredFlows = useMemo(() => {
    if (!searchQuery.trim()) return activeFlows;

    const query = searchQuery.toLowerCase();
    return activeFlows.filter((flow) => flow.name.toLowerCase().includes(query));
  }, [activeFlows, searchQuery]);

  const handleSelect = (flowId: string) => {
    if (!conversationId) {
      toast.warn("Selecione uma conversa para iniciar um fluxo");
      return;
    }

    executeFlowMutation.mutate({
      flowId,
      conversationId,
    });
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
            <h3 className="text-lg font-semibold">Iniciar Fluxo</h3>
            <p className="text-sm text-gray-500">Selecione um fluxo para enviar ao cliente</p>
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
              placeholder="Buscar fluxo por nome..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading || executeFlowMutation.isPending ? (
            <div className="flex items-center justify-center py-8">
              <CircularProgress size={24} />
            </div>
          ) : filteredFlows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center px-4">
              <Workflow className="size-12 text-gray-300 mb-2" />
              <p className="text-gray-500">
                {searchQuery
                  ? "Nenhum fluxo encontrado"
                  : activeFlows.length === 0
                    ? "Nenhum fluxo ativo disponível"
                    : "Nenhum fluxo encontrado"}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredFlows.map((flow) => (
                <button
                  key={flow.id}
                  onClick={() => handleSelect(flow.id)}
                  disabled={disabled || executeFlowMutation.isPending}
                  className="w-full text-left p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Workflow className="size-5 text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-gray-900 mb-1">
                        {flow.name}
                      </h4>
                      <p className="text-xs text-gray-500">
                        {flow.nodesCount || 0} passos
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
