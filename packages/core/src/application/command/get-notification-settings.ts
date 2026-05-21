import { UserNotificationSettings } from "../../domain/entities/user-notification-settings";

interface UserNotificationSettingsRepository {
  findByUserAndWorkspace(
    userId: string,
    workspaceId: string
  ): Promise<UserNotificationSettings | null>;
  create(settings: UserNotificationSettings): Promise<void>;
}

type InputDTO = {
  userId: string;
  workspaceId: string;
};

type OutputDTO = UserNotificationSettings;

export class GetNotificationSettings {
  constructor(
    private readonly userNotificationSettingsRepository: UserNotificationSettingsRepository
  ) {}

  async execute(input: InputDTO): Promise<OutputDTO> {
    let settings =
      await this.userNotificationSettingsRepository.findByUserAndWorkspace(
        input.userId,
        input.workspaceId
      );

    if (!settings) {
      settings = UserNotificationSettings.create({
        userId: input.userId,
        workspaceId: input.workspaceId,
      });

      await this.userNotificationSettingsRepository.create(settings);
    }

    return settings;
  }

  static instance(
    userNotificationSettingsRepository: UserNotificationSettingsRepository
  ) {
    return new GetNotificationSettings(userNotificationSettingsRepository);
  }
}
