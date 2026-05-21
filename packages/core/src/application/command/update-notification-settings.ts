import { Notification } from "../../domain/entities/notification";
import { UserNotificationSettings } from "../../domain/entities/user-notification-settings";
import { NotFound } from "../../domain/errors/not-found";

interface UserNotificationSettingsRepository {
  findByUserAndWorkspace(
    userId: string,
    workspaceId: string
  ): Promise<UserNotificationSettings | null>;
  update(settings: UserNotificationSettings): Promise<void>;
}

type InputDTO = {
  userId: string;
  workspaceId: string;
  realtimeEnabled?: boolean;
  showFloatingButton?: boolean;
  showAllConversations?: boolean;
  enabledTypes?: Notification.Type[];
};

type OutputDTO = UserNotificationSettings;

export class UpdateNotificationSettings {
  constructor(
    private readonly userNotificationSettingsRepository: UserNotificationSettingsRepository
  ) {}

  async execute(input: InputDTO): Promise<OutputDTO> {
    const settings =
      await this.userNotificationSettingsRepository.findByUserAndWorkspace(
        input.userId,
        input.workspaceId
      );

    if (!settings) {
      throw NotFound.throw("Configurações de notificação");
    }

    if (input.realtimeEnabled !== undefined) {
      if (input.realtimeEnabled !== settings.realtimeEnabled) {
        settings.toggleRealtime();
      }
    }

    if (input.showFloatingButton !== undefined) {
      if (input.showFloatingButton !== settings.showFloatingButton) {
        settings.toggleFloatingButton();
      }
    }

    if (input.showAllConversations !== undefined) {
      if (input.showAllConversations !== settings.showAllConversations) {
        settings.toggleShowAllConversations();
      }
    }

    if (input.enabledTypes !== undefined) {
      settings.enabledTypes = input.enabledTypes;
      settings.updatedAt = new Date();
    }

    await this.userNotificationSettingsRepository.update(settings);

    return settings;
  }

  static instance(
    userNotificationSettingsRepository: UserNotificationSettingsRepository
  ) {
    return new UpdateNotificationSettings(userNotificationSettingsRepository);
  }
}
