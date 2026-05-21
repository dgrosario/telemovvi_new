"use client";

import { Bell, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import * as Popover from "@radix-ui/react-popover";
import styled from "@emotion/styled";
import { useNotifications } from "@/hooks/use-notifications";
import { useNotificationStore } from "@/hooks/use-notification-store";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type NotificationPopoverProps = {
  showText?: boolean;
};

const StyledMenuButton = styled.button<{ showText?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: ${({ showText }) => (showText ? "flex-start" : "center")};
  min-block-size: 30px;
  text-decoration: none;
  color: inherit;
  box-sizing: border-box;
  cursor: pointer;
  padding-block: 8px;
  padding-inline: ${({ showText }) => (showText ? "12px" : "0")};
  margin-block-start: ${({ showText }) => (showText ? "12px" : "0")};
  width: 100%;
  border: none;
  background: transparent;
  border-radius: 8px;

  &:hover {
    background-color: var(--mui-palette-action-hover, #f3f3f3);
  }

  &:focus-visible {
    outline: none;
    background-color: var(--mui-palette-action-hover, #f3f3f3);
  }
`;

export function NotificationPopover({ showText = false }: NotificationPopoverProps) {
  const router = useRouter();
  const { notifications, markAsRead, markAllAsRead } = useNotifications({
    filters: {},
    limit: 5,
  });

  const unreadCount = useNotificationStore((state) => state.unreadCount);

  const lastFiveNotifications = notifications.slice(0, 5);

  const handleNotificationClick = (notificationId: string, metadata: any) => {
    markAsRead(notificationId);

    if (metadata?.conversationId) {
      router.push(`/?conversationId=${metadata.conversationId}`);
    }
  };

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <StyledMenuButton showText={showText}>
          <div
            className="relative flex items-center justify-center"
            style={{ marginInlineEnd: showText ? '16px' : '0' }}
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </div>
          {showText && (
            <span className="flex-grow overflow-hidden text-ellipsis whitespace-nowrap text-left">
              Notificações
            </span>
          )}
        </StyledMenuButton>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="z-[9999] w-96 rounded-lg border border-gray-200 bg-white shadow-lg"
          side="right"
          sideOffset={8}
          align="start"
        >
          <div className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Notificações
              </h3>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllAsRead()}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                >
                  <Check className="h-4 w-4" />
                  Marcar todas como lidas
                </button>
              )}
            </div>

            <div className="max-h-96 space-y-2 overflow-y-auto">
              {lastFiveNotifications.length === 0 ? (
                <div className="py-8 text-center text-gray-500">
                  <Bell className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                  <p>Nenhuma notificação</p>
                </div>
              ) : (
                lastFiveNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() =>
                      handleNotificationClick(
                        notification.id,
                        notification.metadata
                      )
                    }
                    className={`cursor-pointer rounded-lg border p-3 transition-colors hover:bg-gray-50 ${
                      notification.isRead
                        ? "border-gray-200 bg-white"
                        : "border-blue-200 bg-blue-50"
                    }`}
                  >
                    <div className="mb-1 flex items-start justify-between">
                      <p
                        className={`text-sm font-semibold ${
                          notification.isRead
                            ? "text-gray-700"
                            : "text-gray-900"
                        }`}
                      >
                        {notification.title}
                      </p>
                      {notification.priority === "high" && (
                        <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                          Urgente
                        </span>
                      )}
                    </div>
                    <p className="mb-2 text-sm text-gray-600">
                      {notification.content}
                    </p>
                    <p className="text-xs text-gray-500">
                      {format(
                        new Date(notification.createdAt),
                        "dd/MM/yyyy 'às' HH:mm",
                        { locale: ptBR }
                      )}
                    </p>
                  </div>
                ))
              )}
            </div>

            {lastFiveNotifications.length > 0 && (
              <button
                onClick={() => router.push("/notifications")}
                className="mt-3 w-full rounded-lg bg-gray-100 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                Ver todas as notificações
              </button>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
