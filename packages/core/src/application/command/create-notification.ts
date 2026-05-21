import { Notification } from "../../domain/entities/notification";

interface NotificationsRepository {
  create(notification: Notification): Promise<void>;
}

interface NotificationsCacheDriver {
  cacheNotification(notification: Notification): Promise<void>;
  incrementUnreadCount(userId: string): Promise<void>;
}

type InputDTO = {
  workspaceId: string;
  type: Notification.Type;
  title: string;
  content: string;
  metadata?: Notification.Metadata;
  recipientType: Notification.RecipientType;
  recipientId: string;
  priority?: Notification.Priority;
  expiresAt?: Date | null;
};

type OutputDTO = Notification;

export class CreateNotification {
  constructor(
    private readonly notificationsRepository: NotificationsRepository,
    private readonly notificationsCacheDriver: NotificationsCacheDriver
  ) {}

  async execute(input: InputDTO): Promise<OutputDTO> {
    const notification = Notification.create({
      workspaceId: input.workspaceId,
      type: input.type,
      title: input.title,
      content: input.content,
      metadata: input.metadata || {},
      recipientType: input.recipientType,
      recipientId: input.recipientId,
      priority: input.priority || "normal",
      expiresAt: input.expiresAt || null,
    });

    await this.notificationsRepository.create(notification);

    if (input.recipientType === "user") {
      await this.notificationsCacheDriver.cacheNotification(notification);
      await this.notificationsCacheDriver.incrementUnreadCount(
        input.recipientId
      );
    }

    return notification;
  }

  static instance(
    notificationsRepository: NotificationsRepository,
    notificationsCacheDriver: NotificationsCacheDriver
  ) {
    return new CreateNotification(
      notificationsRepository,
      notificationsCacheDriver
    );
  }
}
