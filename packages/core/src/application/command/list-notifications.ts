import { Notification } from "../../domain/entities/notification";

type FilterOptions = {
  isRead?: boolean;
  type?: Notification.Type;
  startDate?: Date;
  endDate?: Date;
};

interface NotificationsRepository {
  listForUser(input: {
    userId: string;
    workspaceId: string;
    filters?: FilterOptions;
    cursor?: string | null;
    limit?: number;
  }): Promise<{
    notifications: Notification[];
    nextCursor: string | null;
    hasMore: boolean;
  }>;
  countUnreadForUser(userId: string, workspaceId: string): Promise<number>;
}

type InputDTO = {
  userId: string;
  workspaceId: string;
  filters?: FilterOptions;
  cursor?: string | null;
  limit?: number;
};

type OutputDTO = {
  notifications: Notification[];
  nextCursor: string | null;
  hasMore: boolean;
  unreadCount: number;
};

export class ListNotifications {
  constructor(
    private readonly notificationsRepository: NotificationsRepository
  ) {}

  async execute(input: InputDTO): Promise<OutputDTO> {
    const { notifications, nextCursor, hasMore } =
      await this.notificationsRepository.listForUser({
        userId: input.userId,
        workspaceId: input.workspaceId,
        filters: input.filters,
        cursor: input.cursor,
        limit: input.limit || 20,
      });

    const unreadCount = await this.notificationsRepository.countUnreadForUser(
      input.userId,
      input.workspaceId
    );

    return {
      notifications,
      nextCursor,
      hasMore,
      unreadCount,
    };
  }

  static instance(notificationsRepository: NotificationsRepository) {
    return new ListNotifications(notificationsRepository);
  }
}
