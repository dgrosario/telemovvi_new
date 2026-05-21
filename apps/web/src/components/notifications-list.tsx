"use client";

import { useState } from "react";
import { Bell, Check, Filter } from "lucide-react";
import { useNotifications } from "@/hooks/use-notifications";
import { Notification } from "@omnichannel/core/domain/entities/notification";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useServerActionMutation } from "@/hooks/server-action-hooks";
import { approveTransfer, rejectTransfer } from "@/app/actions/conversations";
import { toast } from "react-toastify";

export function NotificationsList() {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [typeFilter, setTypeFilter] = useState<Notification.Type | undefined>(
    undefined
  );

  const {
    notifications,
    unreadCount,
    hasNextPage,
    fetchNextPage,
    isFetching,
    markAsRead,
    markAllAsRead,
    refetch,
  } = useNotifications({
    filters: {
      isRead: filter === "unread" ? false : undefined,
      type: typeFilter,
    },
  });

  const approveTransferAction = useServerActionMutation(approveTransfer, {
    onSuccess: () => {
      toast.success("Transferência aprovada com sucesso!");
      refetch();
    },
    onError: (err) => {
      toast.error((err as Error).message || "Erro ao aprovar transferência");
    },
  });

  const rejectTransferAction = useServerActionMutation(rejectTransfer, {
    onSuccess: () => {
      toast.success("Transferência recusada");
      refetch();
    },
    onError: (err) => {
      toast.error((err as Error).message || "Erro ao recusar transferência");
    },
  });

  const handleNotificationClick = (
    notificationId: string,
    metadata: Notification.Metadata,
    isRead: boolean
  ) => {
    if (!isRead) {
      markAsRead(notificationId);
    }

    if (metadata?.conversationId) {
      router.push(`/?conversationId=${metadata.conversationId}`);
    }
  };

  const handleApproveTransfer = (
    e: React.MouseEvent,
    notification: Notification.Raw
  ) => {
    e.stopPropagation();
    const metadata = notification.metadata;

    if (
      !metadata.conversationId ||
      !metadata.requesterId ||
      !metadata.requestedSectorId
    ) {
      toast.error("Dados da solicitação incompletos");
      return;
    }

    approveTransferAction.mutate({
      notificationId: notification.id,
      conversationId: metadata.conversationId,
      requesterId: metadata.requesterId as string,
      sectorId: metadata.requestedSectorId as string,
    });
  };

  const handleRejectTransfer = (
    e: React.MouseEvent,
    notification: Notification.Raw
  ) => {
    e.stopPropagation();
    const metadata = notification.metadata;

    if (!metadata.conversationId || !metadata.requesterId) {
      toast.error("Dados da solicitação incompletos");
      return;
    }

    rejectTransferAction.mutate({
      notificationId: notification.id,
      conversationId: metadata.conversationId,
      requesterId: metadata.requesterId as string,
    });
  };

  const isTransferRequest = (notification: Notification.Raw): boolean => {
    // Inclui versao sem acento para compatibilidade com notificacoes antigas no banco
    const transferRequestTitles = new Set([
      "Solicitação de Transferência",
      "Solicitacao de Transferencia",
    ]);

    return (
      notification.type === "transfer:requested" &&
      !notification.isRead &&
      transferRequestTitles.has(notification.title) &&
      !!notification.metadata.requesterId
    );
  };

  const typeLabels: Record<Notification.Type, string> = {
    "conversation:assigned": "Conversa atribuída",
    "internal:message": "Mensagem interna",
    "transfer:requested": "Transferência solicitada",
    "channel:new-message": "Nova mensagem no canal",
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notificações</h1>
            {unreadCount > 0 && (
              <p className="text-sm text-gray-600">
                {unreadCount} não {unreadCount === 1 ? "lida" : "lidas"}
              </p>
            )}
          </div>

          {unreadCount > 0 && (
            <button
              onClick={() => markAllAsRead()}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Check className="h-4 w-4" />
              Marcar todas como lidas
            </button>
          )}
        </div>

        <div className="mb-6 flex flex-wrap gap-3">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter("all")}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                filter === "all"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setFilter("unread")}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                filter === "unread"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Não lidas
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setTypeFilter(undefined)}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                typeFilter === undefined
                  ? "bg-gray-800 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <Filter className="inline h-4 w-4 mr-1" />
              Todos os tipos
            </button>
            {Object.entries(typeLabels).map(([type, label]) => (
              <button
                key={type}
                onClick={() =>
                  setTypeFilter(type as Notification.Type)
                }
                className={`rounded-lg px-4 py-2 text-sm font-medium ${
                  typeFilter === type
                    ? "bg-gray-800 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {notifications.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white py-12 text-center">
              <Bell className="mx-auto mb-3 h-12 w-12 text-gray-300" />
              <p className="text-gray-500">Nenhuma notificação encontrada</p>
            </div>
          ) : (
            notifications.map((notification: Notification.Raw) => (
              <div
                key={notification.id}
                onClick={() =>
                  handleNotificationClick(
                    notification.id,
                    notification.metadata,
                    notification.isRead
                  )
                }
                className={`cursor-pointer rounded-lg border p-4 transition-all ${
                  notification.isRead
                    ? "border-gray-200 bg-white hover:bg-gray-50"
                    : "border-blue-200 bg-blue-50 hover:bg-blue-100"
                }`}
              >
                <div className="mb-2 flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <h3
                        className={`font-semibold ${
                          notification.isRead
                            ? "text-gray-700"
                            : "text-gray-900"
                        }`}
                      >
                        {notification.title}
                      </h3>
                      {notification.priority === "high" && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          Urgente
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      {notification.content}
                    </p>
                  </div>
                  {!notification.isRead && (
                    <div className="ml-3 h-2 w-2 shrink-0 rounded-full bg-blue-600" />
                  )}
                </div>

                {isTransferRequest(notification) && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={(e) => handleApproveTransfer(e, notification)}
                      disabled={approveTransferAction.isPending}
                      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      {approveTransferAction.isPending
                        ? "Aprovando..."
                        : "Aprovar"}
                    </button>
                    <button
                      onClick={(e) => handleRejectTransfer(e, notification)}
                      disabled={rejectTransferAction.isPending}
                      className="rounded-lg border border-red-600 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {rejectTransferAction.isPending
                        ? "Recusando..."
                        : "Recusar"}
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs mt-2">
                  <span className="text-gray-500">
                    {format(
                      new Date(notification.createdAt),
                      "dd/MM/yyyy 'as' HH:mm",
                      { locale: ptBR }
                    )}
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-700">
                    {typeLabels[notification.type]}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {hasNextPage && (
          <div className="mt-6 text-center">
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetching}
              className="rounded-lg bg-gray-100 px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
            >
              {isFetching ? "Carregando..." : "Carregar mais"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
