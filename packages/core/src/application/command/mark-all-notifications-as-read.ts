interface NotificationsRepository {
  markAllAsReadForUser(userId: string, workspaceId: string): Promise<number>;
}

interface NotificationsCacheDriver {
  resetUnreadCount(userId: string): Promise<void>;
}

type InputDTO = {
  userId: string;
  workspaceId: string;
};

type OutputDTO = {
  markedCount: number;
};

export class MarkAllNotificationsAsRead {
  constructor(
    private readonly notificationsRepository: NotificationsRepository,
    private readonly notificationsCacheDriver: NotificationsCacheDriver
  ) {}

  async execute(input: InputDTO): Promise<OutputDTO> {
    const markedCount = await this.notificationsRepository.markAllAsReadForUser(
      input.userId,
      input.workspaceId
    );

    await this.notificationsCacheDriver.resetUnreadCount(input.userId);

    return { markedCount };
  }

  static instance(
    notificationsRepository: NotificationsRepository,
    notificationsCacheDriver: NotificationsCacheDriver
  ) {
    return new MarkAllNotificationsAsRead(
      notificationsRepository,
      notificationsCacheDriver
    );
  }
}
