"use server";

import { ListNotifications } from "@omnichannel/core/application/command/list-notifications";
import { MarkNotificationAsRead } from "@omnichannel/core/application/command/mark-notification-as-read";
import { MarkAllNotificationsAsRead } from "@omnichannel/core/application/command/mark-all-notifications-as-read";
import { GetNotificationSettings } from "@omnichannel/core/application/command/get-notification-settings";
import { UpdateNotificationSettings } from "@omnichannel/core/application/command/update-notification-settings";
import { NotificationsDatabaseRepository } from "@omnichannel/core/infra/repositories/notifications-repository";
import { UserNotificationSettingsDatabaseRepository } from "@omnichannel/core/infra/repositories/user-notification-settings-repository";
import { NotificationsCacheDriver } from "@omnichannel/core/infra/drivers/notifications-cache-driver";
import { NotificationEmitter } from "@/lib/notification-emitter";
import { securityProcedure } from "../procedure";
import {
  listNotificationsSchema,
  markNotificationAsReadSchema,
  markAllNotificationsAsReadSchema,
  getNotificationSettingsSchema,
  updateNotificationSettingsSchema,
  getUnreadNotificationCountSchema,
} from "./schema";

const notificationsRepository = NotificationsDatabaseRepository.instance();
const userNotificationSettingsRepository =
  UserNotificationSettingsDatabaseRepository.instance();
const notificationsCacheDriver = NotificationsCacheDriver.instance();

export const listNotifications = securityProcedure(["list:notifications"])
  .input(listNotificationsSchema)
  .handler(async ({ input, ctx }) => {
    const { user, membership } = ctx;

    const command = ListNotifications.instance(notificationsRepository);

    const result = await command.execute({
      userId: user.id,
      workspaceId: membership.workspaceId,
      filters: input.filters,
      cursor: input.cursor ?? undefined,
      limit: input.limit,
    });

    return {
      notifications: result.notifications.map((n) => n.raw()),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
      unreadCount: result.unreadCount,
    };
  });

export const markNotificationAsRead = securityProcedure(["mark:notifications"])
  .input(markNotificationAsReadSchema)
  .handler(async ({ input, ctx }) => {
    const { user, membership } = ctx;

    const command = MarkNotificationAsRead.instance(
      notificationsRepository,
      notificationsCacheDriver
    );

    await command.execute({
      notificationId: input.notificationId,
      userId: user.id,
    });

    const io = (global as any).io;
    if (io) {
      NotificationEmitter.emitNotificationRead(
        io,
        user.id,
        membership.workspaceId,
        input.notificationId
      );
    }

    return { success: true };
  });

export const markAllNotificationsAsRead = securityProcedure([
  "mark:notifications",
])
  .input(markAllNotificationsAsReadSchema)
  .handler(async ({ ctx }) => {
    const { user, membership } = ctx;

    const command = MarkAllNotificationsAsRead.instance(
      notificationsRepository,
      notificationsCacheDriver
    );

    const result = await command.execute({
      userId: user.id,
      workspaceId: membership.workspaceId,
    });

    return { markedCount: result.markedCount };
  });

export const getNotificationSettings = securityProcedure()
  .input(getNotificationSettingsSchema)
  .handler(async ({ ctx }) => {
    const { user, membership } = ctx;

    const command = GetNotificationSettings.instance(
      userNotificationSettingsRepository
    );

    const settings = await command.execute({
      userId: user.id,
      workspaceId: membership.workspaceId,
    });

    return settings.raw();
  });

export const updateNotificationSettings = securityProcedure()
  .input(updateNotificationSettingsSchema)
  .handler(async ({ input, ctx }) => {
    const { user, membership } = ctx;

    const command = UpdateNotificationSettings.instance(
      userNotificationSettingsRepository
    );

    const settings = await command.execute({
      userId: user.id,
      workspaceId: membership.workspaceId,
      realtimeEnabled: input.realtimeEnabled,
      showFloatingButton: input.showFloatingButton,
      showAllConversations: input.showAllConversations,
      enabledTypes: input.enabledTypes,
    });

    return settings.raw();
  });

export const getUnreadNotificationCount = securityProcedure(["list:notifications"])
  .input(getUnreadNotificationCountSchema)
  .handler(async ({ ctx }) => {
    const { user, membership } = ctx;

    const count = await notificationsRepository.countUnreadForUser(
      user.id,
      membership.workspaceId
    );

    return { unreadCount: count };
  });
