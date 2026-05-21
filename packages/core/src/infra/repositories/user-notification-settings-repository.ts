import { and, eq, InferSelectModel } from "drizzle-orm";
import { UserNotificationSettings } from "../../domain/entities/user-notification-settings";
import { Notification } from "../../domain/entities/notification";
import { createDatabaseConnection } from "../database";
import { userNotificationSettings } from "../database/schemas";

type UserNotificationSettingsRow = InferSelectModel<
  typeof userNotificationSettings
>;

export class UserNotificationSettingsDatabaseRepository {
  private mapRowToSettings(
    row: UserNotificationSettingsRow
  ): UserNotificationSettings {
    return UserNotificationSettings.fromRaw({
      id: row.id,
      userId: row.userId,
      workspaceId: row.workspaceId,
      realtimeEnabled: row.realtimeEnabled,
      showFloatingButton: row.showFloatingButton,
      showAllConversations: row.showAllConversations,
      enabledTypes: row.enabledTypes as Notification.Type[],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  async findByUserAndWorkspace(
    userId: string,
    workspaceId: string
  ): Promise<UserNotificationSettings | null> {
    const db = createDatabaseConnection();

    const [row] = await db
      .select()
      .from(userNotificationSettings)
      .where(
        and(
          eq(userNotificationSettings.userId, userId),
          eq(userNotificationSettings.workspaceId, workspaceId)
        )
      )
      .limit(1);

    if (!row) return null;

    return this.mapRowToSettings(row);
  }

  async create(settings: UserNotificationSettings): Promise<void> {
    const db = createDatabaseConnection();

    await db.insert(userNotificationSettings).values({
      userId: settings.userId,
      workspaceId: settings.workspaceId,
      realtimeEnabled: settings.realtimeEnabled,
      showFloatingButton: settings.showFloatingButton,
      showAllConversations: settings.showAllConversations,
      enabledTypes: settings.enabledTypes,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    });
  }

  async update(settings: UserNotificationSettings): Promise<void> {
    const db = createDatabaseConnection();

    await db
      .update(userNotificationSettings)
      .set({
        realtimeEnabled: settings.realtimeEnabled,
        showFloatingButton: settings.showFloatingButton,
        showAllConversations: settings.showAllConversations,
        enabledTypes: settings.enabledTypes,
        updatedAt: settings.updatedAt,
      })
      .where(eq(userNotificationSettings.id, settings.id));
  }

  static instance() {
    return new UserNotificationSettingsDatabaseRepository();
  }
}
