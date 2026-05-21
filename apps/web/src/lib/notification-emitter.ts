import { Server } from "socket.io";
import { Notification } from "@omnichannel/core/domain/entities/notification";

export class NotificationEmitter {
  static emitToUser(
    io: Server,
    userId: string,
    workspaceId: string,
    notification: Notification
  ): void {
    const roomName = `user:${userId}`;

    io.to(roomName).emit("notification:received", {
      id: notification.id,
      workspaceId: notification.workspaceId,
      type: notification.type,
      title: notification.title,
      content: notification.content,
      metadata: notification.metadata,
      recipientType: notification.recipientType,
      recipientId: notification.recipientId,
      isRead: notification.isRead,
      readAt: notification.readAt,
      priority: notification.priority,
      createdAt: notification.createdAt,
      expiresAt: notification.expiresAt,
    });

    console.log(
      `[NotificationEmitter] Emitted notification to user ${userId} in workspace ${workspaceId}`
    );
  }

  static emitToSector(
    io: Server,
    sectorId: string,
    workspaceId: string,
    notification: Notification,
    userIds: string[]
  ): void {
    userIds.forEach((userId) => {
      this.emitToUser(io, userId, workspaceId, notification);
    });

    console.log(
      `[NotificationEmitter] Emitted notification to ${userIds.length} users in sector ${sectorId}`
    );
  }

  static emitToWorkspace(
    io: Server,
    workspaceId: string,
    notification: Notification
  ): void {
    const roomName = `workspace:${workspaceId}`;

    io.to(roomName).emit("notification:received", {
      id: notification.id,
      workspaceId: notification.workspaceId,
      type: notification.type,
      title: notification.title,
      content: notification.content,
      metadata: notification.metadata,
      recipientType: notification.recipientType,
      recipientId: notification.recipientId,
      isRead: notification.isRead,
      readAt: notification.readAt,
      priority: notification.priority,
      createdAt: notification.createdAt,
      expiresAt: notification.expiresAt,
    });

    console.log(
      `[NotificationEmitter] Emitted notification to workspace ${workspaceId}`
    );
  }

  static emitNotificationRead(
    io: Server,
    userId: string,
    workspaceId: string,
    notificationId: string
  ): void {
    const roomName = `workspace:${workspaceId}`;

    io.to(roomName).emit("notification:read", {
      notificationId,
      userId,
      workspaceId,
      readAt: new Date(),
    });

    console.log(
      `[NotificationEmitter] Emitted notification read event for notification ${notificationId}`
    );
  }

  static getInstance(): typeof NotificationEmitter {
    return NotificationEmitter;
  }
}
