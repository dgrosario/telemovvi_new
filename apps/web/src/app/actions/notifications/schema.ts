import { z } from "zod";

export const listNotificationsSchema = z.object({
  filters: z
    .object({
      isRead: z.boolean().optional(),
      type: z
        .enum([
          "conversation:assigned",
          "internal:message",
          "transfer:requested",
          "channel:new-message",
        ])
        .optional(),
      startDate: z.coerce.date().optional(),
      endDate: z.coerce.date().optional(),
    })
    .optional(),
  cursor: z.string().nullish(),
  limit: z.number().int().positive().max(100).default(20),
});

export const markNotificationAsReadSchema = z.object({
  notificationId: z.string().uuid(),
});

export const markAllNotificationsAsReadSchema = z.object({});

export const getNotificationSettingsSchema = z.object({});

export const getUnreadNotificationCountSchema = z.object({});

export const updateNotificationSettingsSchema = z.object({
  realtimeEnabled: z.boolean().optional(),
  showFloatingButton: z.boolean().optional(),
  showAllConversations: z.boolean().optional(),
  enabledTypes: z
    .array(
      z.enum([
        "conversation:assigned",
        "internal:message",
        "transfer:requested",
        "channel:new-message",
      ])
    )
    .optional(),
});
