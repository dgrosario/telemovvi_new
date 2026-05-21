import { Membership } from "../entities/membership";
import { Notification } from "../entities/notification";
import { User } from "../entities/user";

export class NotificationFilterService {
  shouldReceiveNotification(
    notification: Notification,
    user: User,
    membership: Membership
  ): boolean {
    if (notification.workspaceId !== membership.workspaceId) {
      return false;
    }

    switch (notification.recipientType) {
      case "user":
        return notification.recipientId === user.id;

      case "sector":
        // TODO: Implement sector-based notifications after user-sector refactor (migration 0023)
        return false;

      case "workspace":
        return notification.recipientId === membership.workspaceId;

      default:
        return false;
    }
  }

  canAccessNotification(
    notification: Notification,
    user: User,
    membership: Membership
  ): boolean {
    if (notification.workspaceId !== membership.workspaceId) {
      return false;
    }

    if (notification.recipientType === "user") {
      return notification.recipientId === user.id;
    }

    if (notification.recipientType === "sector") {
      // TODO: Implement sector-based notifications after user-sector refactor (migration 0023)
      return false;
    }

    if (notification.recipientType === "workspace") {
      return true;
    }

    return false;
  }

  filterByChannelPermissions(
    notification: Notification,
    membership: Membership
  ): boolean {
    if (notification.type !== "channel:new-message") {
      return true;
    }

    const channelId = notification.metadata.channelId;
    const sectorId = notification.metadata.sectorId;

    if (!channelId || !sectorId) {
      return false;
    }

    // TODO: Implement sector-based channel filtering after user-sector refactor (migration 0023)
    return false;
  }

  static instance(): NotificationFilterService {
    return new NotificationFilterService();
  }
}
