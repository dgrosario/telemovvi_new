import { InvalidCreation } from "../errors/invalid-creation";
import { Notification } from "./notification";

export namespace UserNotificationSettings {
  export interface Raw {
    id: string;
    userId: string;
    workspaceId: string;
    realtimeEnabled: boolean;
    showFloatingButton: boolean;
    showAllConversations: boolean;
    enabledTypes: Notification.Type[];
    createdAt: Date;
    updatedAt: Date;
  }

  export interface CreateProps {
    id?: string;
    userId: string;
    workspaceId: string;
    realtimeEnabled?: boolean;
    showFloatingButton?: boolean;
    showAllConversations?: boolean;
    enabledTypes?: Notification.Type[];
  }

  export interface Props {
    id: string;
    userId: string;
    workspaceId: string;
    realtimeEnabled: boolean;
    showFloatingButton: boolean;
    showAllConversations: boolean;
    enabledTypes: Notification.Type[];
    createdAt: Date;
    updatedAt: Date;
  }
}

export class UserNotificationSettings {
  public readonly id: string;
  public readonly userId: string;
  public readonly workspaceId: string;
  public realtimeEnabled: boolean;
  public showFloatingButton: boolean;
  public showAllConversations: boolean;
  public enabledTypes: Notification.Type[];
  public readonly createdAt: Date;
  public updatedAt: Date;

  constructor(props: UserNotificationSettings.Props) {
    this.id = props.id;
    this.userId = props.userId;
    this.workspaceId = props.workspaceId;
    this.realtimeEnabled = props.realtimeEnabled;
    this.showFloatingButton = props.showFloatingButton;
    this.showAllConversations = props.showAllConversations;
    this.enabledTypes = props.enabledTypes;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  toggleRealtime(): this {
    this.realtimeEnabled = !this.realtimeEnabled;
    this.updatedAt = new Date();
    return this;
  }

  toggleFloatingButton(): this {
    this.showFloatingButton = !this.showFloatingButton;
    this.updatedAt = new Date();
    return this;
  }

  toggleShowAllConversations(): this {
    this.showAllConversations = !this.showAllConversations;
    this.updatedAt = new Date();
    return this;
  }

  enableType(type: Notification.Type): this {
    if (!this.enabledTypes.includes(type)) {
      this.enabledTypes.push(type);
      this.updatedAt = new Date();
    }
    return this;
  }

  disableType(type: Notification.Type): this {
    this.enabledTypes = this.enabledTypes.filter((t) => t !== type);
    this.updatedAt = new Date();
    return this;
  }

  isTypeEnabled(type: Notification.Type): boolean {
    return this.enabledTypes.includes(type);
  }

  raw(): UserNotificationSettings.Raw {
    return {
      id: this.id,
      userId: this.userId,
      workspaceId: this.workspaceId,
      realtimeEnabled: this.realtimeEnabled,
      showFloatingButton: this.showFloatingButton,
      showAllConversations: this.showAllConversations,
      enabledTypes: this.enabledTypes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static instance(props: UserNotificationSettings.Props): UserNotificationSettings {
    return new UserNotificationSettings(props);
  }

  static fromRaw(props: UserNotificationSettings.Raw): UserNotificationSettings {
    return new UserNotificationSettings({
      id: props.id,
      userId: props.userId,
      workspaceId: props.workspaceId,
      realtimeEnabled: props.realtimeEnabled,
      showFloatingButton: props.showFloatingButton,
      showAllConversations: props.showAllConversations,
      enabledTypes: props.enabledTypes,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    });
  }

  static create(props: UserNotificationSettings.CreateProps): UserNotificationSettings {
    const id = props.id || crypto.randomUUID();

    if (!props.userId) throw InvalidCreation.instance();
    if (!props.workspaceId) throw InvalidCreation.instance();

    const now = new Date();

    return new UserNotificationSettings({
      id,
      userId: props.userId,
      workspaceId: props.workspaceId,
      realtimeEnabled: props.realtimeEnabled ?? true,
      showFloatingButton: props.showFloatingButton ?? true,
      showAllConversations: props.showAllConversations ?? false,
      enabledTypes: props.enabledTypes || [
        "conversation:assigned",
        "internal:message",
        "transfer:requested",
        "channel:new-message",
      ],
      createdAt: now,
      updatedAt: now,
    });
  }
}
