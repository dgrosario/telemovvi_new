"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import * as Popover from "@radix-ui/react-popover";
import { useNotificationStore } from "@/hooks/use-notification-store";
import { useNotifications } from "@/hooks/use-notifications";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STORAGE_KEY = "floating-notification-position";

function getStoredPosition(): { x: number; y: number } | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

function savePosition(pos: { x: number; y: number }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
  } catch {
    // Ignore storage errors
  }
}

export function FloatingNotificationButton() {
  const router = useRouter();
  const visible = useNotificationStore((state) => state.floatingButtonVisible);
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const hideFloatingButton = useNotificationStore((state) => state.hideFloatingButton);
  const [isOpen, setIsOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);

  const [position, setPosition] = useState({ x: 0, y: 70 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [hasDragged, setHasDragged] = useState(false);

  const buttonRef = useRef<HTMLButtonElement>(null);

  const { notifications, markAsRead, markAllAsRead } = useNotifications({
    filters: {},
    limit: 5,
  });

  const lastFiveNotifications = notifications.slice(0, 5);

  useEffect(() => {
    setIsClient(true);
    const buttonSize = window.innerWidth < 768 ? 48 : 56;
    const maxX = window.innerWidth - buttonSize - 8;
    const maxY = window.innerHeight - buttonSize - 8;
    
    const storedPos = getStoredPosition();
    if (storedPos) {
      // Garante que a posição armazenada está dentro dos limites
      const validPos = {
        x: Math.max(8, Math.min(storedPos.x, maxX)),
        y: Math.max(8, Math.min(storedPos.y, maxY)),
      };
      setPosition(validPos);
    } else {
      // Posição padrão: canto superior direito
      setPosition({ x: maxX, y: 70 });
    }
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    let lastPosition = position;

    const handleMouseMove = (e: MouseEvent) => {
      setHasDragged(true);
      const buttonSize = window.innerWidth < 768 ? 48 : 56; // h-12 mobile, h-14 desktop
      const maxX = window.innerWidth - buttonSize - 8; // 8px de margem
      const maxY = window.innerHeight - buttonSize - 8;
      
      const newPos = {
        x: Math.max(8, Math.min(e.clientX - dragOffset.x, maxX)),
        y: Math.max(8, Math.min(e.clientY - dragOffset.y, maxY)),
      };
      lastPosition = newPos;
      setPosition(newPos);
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      setHasDragged(true);
      const touch = e.touches[0];
      const buttonSize = window.innerWidth < 768 ? 48 : 56;
      const maxX = window.innerWidth - buttonSize - 8;
      const maxY = window.innerHeight - buttonSize - 8;
      
      const newPos = {
        x: Math.max(8, Math.min(touch.clientX - dragOffset.x, maxX)),
        y: Math.max(8, Math.min(touch.clientY - dragOffset.y, maxY)),
      };
      lastPosition = newPos;
      setPosition(newPos);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      savePosition(lastPosition);
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
      savePosition(lastPosition);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isDragging, dragOffset, position]);

  const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setIsDragging(true);
    setHasDragged(false);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLButtonElement>) => {
    if (!buttonRef.current) return;

    const touch = e.touches[0];
    const rect = buttonRef.current.getBoundingClientRect();
    setDragOffset({
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    });
    setIsDragging(true);
    setHasDragged(false);
  };

  const handleClick = () => {
    if (!hasDragged) {
      setIsOpen(true);
    }
  };

  const handleNotificationClick = (notificationId: string, metadata: Record<string, unknown> | null) => {
    markAsRead(notificationId);
    setIsOpen(false);

    if (metadata?.conversationId) {
      router.push(`/?conversationId=${metadata.conversationId}`);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
  };

  // Calcula o melhor lado para o popover baseado na posição do botão
  const getPopoverSide = (): "top" | "bottom" | "left" | "right" => {
    const screenHeight = window.innerHeight;
    const screenWidth = window.innerWidth;
    const buttonSize = window.innerWidth < 768 ? 48 : 56;
    
    // Se está na metade superior, abre para baixo
    if (position.y < screenHeight / 2) {
      return "bottom";
    }
    // Se está na metade inferior, abre para cima
    return "top";
  };

  const getPopoverAlign = (): "start" | "center" | "end" => {
    const screenWidth = window.innerWidth;
    
    // Se está no lado esquerdo, alinha à esquerda
    if (position.x < screenWidth / 3) {
      return "start";
    }
    // Se está no lado direito, alinha à direita
    if (position.x > (screenWidth * 2) / 3) {
      return "end";
    }
    // Se está no centro, centraliza
    return "center";
  };

  if (!visible || !isClient) return null;

  return (
    <Popover.Root open={isOpen} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <button
          ref={buttonRef}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onClick={handleClick}
          className={`fixed z-[1300] flex items-center justify-center rounded-full bg-blue-600 text-white shadow-xl hover:bg-blue-700 hover:scale-105 ${
            isDragging ? "cursor-grabbing scale-110" : "cursor-grab transition-all"
          } h-12 w-12 md:h-14 md:w-14`}
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
          }}
        >
          <Bell className="h-5 w-5 md:h-6 md:w-6" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="z-[9999] w-96 max-w-[calc(100vw-16px)] rounded-lg border border-gray-200 bg-white shadow-lg"
          side={isClient ? getPopoverSide() : "bottom"}
          sideOffset={8}
          align={isClient ? getPopoverAlign() : "end"}
          collisionPadding={8}
        >
          <div className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Notificações
              </h3>
              {unreadCount > 0 && (
                <button
                  onClick={() => {
                    markAllAsRead();
                    hideFloatingButton();
                    setIsOpen(false);
                  }}
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
                onClick={() => {
                  router.push("/notifications");
                  setIsOpen(false);
                }}
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
