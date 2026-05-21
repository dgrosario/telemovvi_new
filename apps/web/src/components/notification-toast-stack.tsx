"use client";

import { useState, useEffect } from "react";
import { X, Bell } from "lucide-react";
import { Notification } from "@omnichannel/core/domain/entities/notification";
import { useRouter } from "next/navigation";

type NotificationToastStackProps = {
  notifications: Notification.Raw[];
  show: boolean;
  onClose: () => void;
};

export function NotificationToastStack({
  notifications,
  show,
  onClose,
}: NotificationToastStackProps) {
  const router = useRouter();
  const [visibleNotifications, setVisibleNotifications] = useState<
    Notification.Raw[]
  >([]);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    if (show) {
      setVisibleNotifications(notifications.slice(0, 5));

      const timers = notifications.slice(0, 5).map((_, index) => {
        return setTimeout(() => {
          setVisibleNotifications((prev) =>
            prev.filter((_, i) => i !== index)
          );
        }, 5000 + index * 500);
      });

      return () => {
        timers.forEach((timer) => clearTimeout(timer));
      };
    } else {
      setVisibleNotifications([]);
    }
  }, [show, notifications]);

  const handleNotificationClick = (notification: Notification.Raw) => {
    if (notification.type === "conversation:assigned") {
      const conversationId = notification.metadata?.conversationId as
        | string
        | undefined;
      if (conversationId) {
        router.push(`/?conversationId=${conversationId}`);
        onClose();
      }
    }
  };

  const handleDismiss = (index: number) => {
    setVisibleNotifications((prev) => prev.filter((_, i) => i !== index));
  };

  if (!show || visibleNotifications.length === 0) return null;

  const hasMore = notifications.length > 5;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {hasMore && (
        <div
          onClick={() => router.push("/notifications")}
          className="group relative cursor-pointer overflow-hidden rounded-lg bg-blue-600 p-4 text-white shadow-lg transition-all hover:bg-blue-700"
        >
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5" />
            <div>
              <p className="font-semibold">Ver todas as notificações</p>
              <p className="text-sm opacity-90">
                Você tem {notifications.length} notificações
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="relative">
        {visibleNotifications.map((notification, index) => {
          const isHovered = hoveredIndex === index;
          const baseTranslateY = -index * 4;
          const baseScale = 1 - index * 0.02;

          const translateY = isHovered ? index * 80 : baseTranslateY;
          const scale = isHovered ? 1 : baseScale;

          return (
            <div
              key={notification.id}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={() => handleNotificationClick(notification)}
              className={`absolute right-0 w-80 cursor-pointer overflow-hidden rounded-lg bg-white shadow-lg transition-all duration-200 ${
                notification.type === "conversation:assigned"
                  ? "hover:bg-gray-50"
                  : ""
              }`}
              style={{
                transform: `translateY(${translateY}px) scale(${scale})`,
                zIndex: 50 - index,
                bottom: 0,
              }}
            >
              <div className="p-4">
                <div className="mb-2 flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">
                      {notification.title}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      {notification.content}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDismiss(index);
                    }}
                    className="ml-2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>
                    {new Date(notification.createdAt).toLocaleTimeString(
                      "pt-BR",
                      {
                        hour: "2-digit",
                        minute: "2-digit",
                      }
                    )}
                  </span>
                  {notification.priority === "high" && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700">
                      Urgente
                    </span>
                  )}
                </div>
              </div>

              <div
                className={`h-1 ${
                  notification.priority === "high"
                    ? "bg-red-500"
                    : "bg-blue-500"
                }`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
