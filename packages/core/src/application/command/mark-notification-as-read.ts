import { Notification } from "../../domain/entities/notification";
import { NotFound } from "../../domain/errors/not-found";

interface NotificationsRepository {
  findById(id: string): Promise<Notification | null>;
  update(notification: Notification): Promise<void>;
}

interface NotificationsCacheDriver {
  decrementUnreadCount(userId: string): Promise<void>;
}

type InputDTO = {
  notificationId: string;
  userId: string;
};

type OutputDTO = Notification;

export class MarkNotificationAsRead {
  constructor(
    private readonly notificationsRepository: NotificationsRepository,
    private readonly notificationsCacheDriver: NotificationsCacheDriver
  ) {}

  async execute(input: InputDTO): Promise<OutputDTO> {
    const notification = await this.notificationsRepository.findById(
      input.notificationId
    );

    if (!notification) {
      throw NotFound.throw("Notificação");
    }

    if (notification.isRead) {
      return notification;
    }

    notification.markAsRead();

    await this.notificationsRepository.update(notification);

    if (notification.recipientType === "user") {
      await this.notificationsCacheDriver.decrementUnreadCount(input.userId);
    }

    return notification;
  }

  static instance(
    notificationsRepository: NotificationsRepository,
    notificationsCacheDriver: NotificationsCacheDriver
  ) {
    return new MarkNotificationAsRead(
      notificationsRepository,
      notificationsCacheDriver
    );
  }
}
