import { InvalidCreation } from "../errors/invalid-creation";
import { CampaignMessage } from "./campaign-message";

export namespace Campaign {
  export type Status =
    | "draft"
    | "scheduled"
    | "running"
    | "completed"
    | "cancelled"
    | "failed";

  export type Type = "manual" | "birthday";

  export interface Props {
    id: string;
    workspaceId: string;
    channelId: string;
    name: string;
    type: Type;
    status: Status;
    filterLabelIds: string[];
    minIntervalMs: number;
    maxIntervalMs: number;
    scheduledAt: Date | null;
    startedAt: Date | null;
    completedAt: Date | null;
    createdBy: string | null;
    totalRecipients: number;
    sentCount: number;
    failedCount: number;
    messages: CampaignMessage[];
    createdAt: Date;
    updatedAt: Date;
  }

  export interface Raw {
    id: string;
    workspaceId: string;
    channelId: string;
    name: string;
    type: Type;
    status: Status;
    filterLabelIds: string[];
    minIntervalMs: number;
    maxIntervalMs: number;
    scheduledAt: Date | null;
    startedAt: Date | null;
    completedAt: Date | null;
    createdBy: string | null;
    totalRecipients: number;
    sentCount: number;
    failedCount: number;
    messages: CampaignMessage.Raw[];
    createdAt: Date;
    updatedAt: Date;
  }

  export interface CreateProps {
    workspaceId: string;
    channelId: string;
    name: string;
    type?: Type;
    filterLabelIds?: string[];
    minIntervalMs?: number;
    maxIntervalMs?: number;
    scheduledAt?: Date;
    createdBy: string;
    messages: Array<{
      variationLabel: CampaignMessage.VariationLabel;
      type: CampaignMessage.MessageType;
      content?: string;
      templateName?: string;
      variables?: CampaignMessage.Variable[];
    }>;
  }
}

export class Campaign {
  public id: string;
  public workspaceId: string;
  public channelId: string;
  public name: string;
  public type: Campaign.Type;
  public status: Campaign.Status;
  public filterLabelIds: string[];
  public minIntervalMs: number;
  public maxIntervalMs: number;
  public scheduledAt: Date | null;
  public startedAt: Date | null;
  public completedAt: Date | null;
  public createdBy: string | null;
  public totalRecipients: number;
  public sentCount: number;
  public failedCount: number;
  public messages: CampaignMessage[];
  public createdAt: Date;
  public updatedAt: Date;

  constructor(props: Campaign.Props) {
    this.id = props.id;
    this.workspaceId = props.workspaceId;
    this.channelId = props.channelId;
    this.name = props.name;
    this.type = props.type;
    this.status = props.status;
    this.filterLabelIds = props.filterLabelIds;
    this.minIntervalMs = props.minIntervalMs;
    this.maxIntervalMs = props.maxIntervalMs;
    this.scheduledAt = props.scheduledAt;
    this.startedAt = props.startedAt;
    this.completedAt = props.completedAt;
    this.createdBy = props.createdBy;
    this.totalRecipients = props.totalRecipients;
    this.sentCount = props.sentCount;
    this.failedCount = props.failedCount;
    this.messages = props.messages;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  getRandomIntervalMs(): number {
    return (
      Math.floor(Math.random() * (this.maxIntervalMs - this.minIntervalMs + 1)) +
      this.minIntervalMs
    );
  }

  isBirthdayCampaign(): boolean {
    return this.type === "birthday";
  }

  canEdit(): boolean {
    return this.status === "draft";
  }

  canStart(): boolean {
    return this.status === "draft" || this.status === "scheduled";
  }

  canCancel(): boolean {
    return this.status === "scheduled" || this.status === "running";
  }

  schedule(scheduledAt: Date): this {
    if (!this.canEdit() && this.status !== "scheduled") {
      throw new Error("Campaign cannot be scheduled in current status");
    }
    this.status = "scheduled";
    this.scheduledAt = scheduledAt;
    this.updatedAt = new Date();
    return this;
  }

  start(): this {
    if (!this.canStart()) {
      throw new Error("Campaign cannot be started in current status");
    }
    this.status = "running";
    this.startedAt = new Date();
    this.updatedAt = new Date();
    return this;
  }

  complete(): this {
    if (this.status !== "running") {
      throw new Error("Campaign cannot be completed in current status");
    }
    this.status = "completed";
    this.completedAt = new Date();
    this.updatedAt = new Date();
    return this;
  }

  cancel(): this {
    if (!this.canCancel()) {
      throw new Error("Campaign cannot be cancelled in current status");
    }
    this.status = "cancelled";
    this.completedAt = new Date();
    this.updatedAt = new Date();
    return this;
  }

  fail(): this {
    this.status = "failed";
    this.completedAt = new Date();
    this.updatedAt = new Date();
    return this;
  }

  setTotalRecipients(count: number): this {
    this.totalRecipients = count;
    this.updatedAt = new Date();
    return this;
  }

  incrementSentCount(): this {
    this.sentCount += 1;
    this.updatedAt = new Date();
    return this;
  }

  incrementFailedCount(): this {
    this.failedCount += 1;
    this.updatedAt = new Date();
    return this;
  }

  updateName(name: string): this {
    if (!this.canEdit()) {
      throw new Error("Campaign cannot be edited in current status");
    }
    this.name = name.trim();
    this.updatedAt = new Date();
    return this;
  }

  updateFilterLabelIds(labelIds: string[]): this {
    if (!this.canEdit()) {
      throw new Error("Campaign cannot be edited in current status");
    }
    this.filterLabelIds = labelIds;
    this.updatedAt = new Date();
    return this;
  }

  getRandomMessage(): CampaignMessage {
    if (this.messages.length === 0) {
      throw new Error("Campaign has no messages");
    }
    const randomIndex = Math.floor(Math.random() * this.messages.length);
    const message = this.messages[randomIndex];
    if (!message) {
      throw new Error("Campaign has no messages");
    }
    return message;
  }

  getProgress(): { sent: number; failed: number; pending: number; total: number; percentage: number } {
    const pending = this.totalRecipients - this.sentCount - this.failedCount;
    const percentage = this.totalRecipients > 0
      ? Math.round((this.sentCount / this.totalRecipients) * 100)
      : 0;
    return {
      sent: this.sentCount,
      failed: this.failedCount,
      pending: Math.max(0, pending),
      total: this.totalRecipients,
      percentage,
    };
  }

  raw(): Campaign.Raw {
    return {
      id: this.id,
      workspaceId: this.workspaceId,
      channelId: this.channelId,
      name: this.name,
      type: this.type,
      status: this.status,
      filterLabelIds: this.filterLabelIds,
      minIntervalMs: this.minIntervalMs,
      maxIntervalMs: this.maxIntervalMs,
      scheduledAt: this.scheduledAt,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      createdBy: this.createdBy,
      totalRecipients: this.totalRecipients,
      sentCount: this.sentCount,
      failedCount: this.failedCount,
      messages: this.messages.map((m) => m.raw()),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static instance(props: Campaign.Props): Campaign {
    return new Campaign(props);
  }

  static fromRaw(props: Campaign.Raw): Campaign {
    return new Campaign({
      id: props.id,
      workspaceId: props.workspaceId,
      channelId: props.channelId,
      name: props.name,
      type: props.type,
      status: props.status,
      filterLabelIds: props.filterLabelIds,
      minIntervalMs: props.minIntervalMs,
      maxIntervalMs: props.maxIntervalMs,
      scheduledAt: props.scheduledAt,
      startedAt: props.startedAt,
      completedAt: props.completedAt,
      createdBy: props.createdBy,
      totalRecipients: props.totalRecipients,
      sentCount: props.sentCount,
      failedCount: props.failedCount,
      messages: props.messages.map((m) => CampaignMessage.fromRaw(m)),
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    });
  }

  static create(props: Campaign.CreateProps): Campaign {
    if (!props.workspaceId || !props.channelId || !props.name) {
      throw InvalidCreation.instance();
    }

    if (!props.messages || props.messages.length === 0) {
      throw InvalidCreation.instance();
    }

    const campaignType = props.type ?? "manual";
    const filterLabelIds = props.filterLabelIds ?? [];

    if (campaignType === "manual" && filterLabelIds.length === 0) {
      throw InvalidCreation.instance();
    }

    const now = new Date();
    const campaignId = crypto.randomUUID();

    const messages = props.messages.map((m) =>
      CampaignMessage.create({
        campaignId,
        variationLabel: m.variationLabel,
        type: m.type,
        content: m.content,
        templateName: m.templateName,
        variables: m.variables,
      })
    );

    return new Campaign({
      id: campaignId,
      workspaceId: props.workspaceId,
      channelId: props.channelId,
      name: props.name.trim(),
      type: campaignType,
      status: props.scheduledAt ? "scheduled" : "draft",
      filterLabelIds,
      minIntervalMs: props.minIntervalMs ?? 5000,
      maxIntervalMs: props.maxIntervalMs ?? 30000,
      scheduledAt: props.scheduledAt ?? null,
      startedAt: null,
      completedAt: null,
      createdBy: props.createdBy,
      totalRecipients: 0,
      sentCount: 0,
      failedCount: 0,
      messages,
      createdAt: now,
      updatedAt: now,
    });
  }
}
