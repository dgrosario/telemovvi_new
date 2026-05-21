import { InvalidCreation } from "../errors/invalid-creation";

export namespace CampaignRecipient {
  export type Status = "pending" | "sent" | "failed" | "skipped";

  export interface Props {
    id: string;
    campaignId: string;
    partnerId: string;
    partnerContactId: string;
    messageId: string | null;
    status: Status;
    externalMessageId: string | null;
    errorMessage: string | null;
    sentAt: Date | null;
    createdAt: Date;
  }

  export interface Raw {
    id: string;
    campaignId: string;
    partnerId: string;
    partnerContactId: string;
    messageId: string | null;
    status: Status;
    externalMessageId: string | null;
    errorMessage: string | null;
    sentAt: Date | null;
    createdAt: Date;
  }

  export interface CreateProps {
    campaignId: string;
    partnerId: string;
    partnerContactId: string;
  }
}

export class CampaignRecipient {
  public id: string;
  public campaignId: string;
  public partnerId: string;
  public partnerContactId: string;
  public messageId: string | null;
  public status: CampaignRecipient.Status;
  public externalMessageId: string | null;
  public errorMessage: string | null;
  public sentAt: Date | null;
  public createdAt: Date;

  constructor(props: CampaignRecipient.Props) {
    this.id = props.id;
    this.campaignId = props.campaignId;
    this.partnerId = props.partnerId;
    this.partnerContactId = props.partnerContactId;
    this.messageId = props.messageId;
    this.status = props.status;
    this.externalMessageId = props.externalMessageId;
    this.errorMessage = props.errorMessage;
    this.sentAt = props.sentAt;
    this.createdAt = props.createdAt;
  }

  markAsSent(messageId: string, externalMessageId?: string): this {
    this.status = "sent";
    this.messageId = messageId;
    this.externalMessageId = externalMessageId ?? null;
    this.sentAt = new Date();
    this.errorMessage = null;
    return this;
  }

  markAsFailed(errorMessage: string): this {
    this.status = "failed";
    this.errorMessage = errorMessage;
    this.sentAt = new Date();
    return this;
  }

  markAsSkipped(reason?: string): this {
    this.status = "skipped";
    this.errorMessage = reason ?? null;
    return this;
  }

  raw(): CampaignRecipient.Raw {
    return {
      id: this.id,
      campaignId: this.campaignId,
      partnerId: this.partnerId,
      partnerContactId: this.partnerContactId,
      messageId: this.messageId,
      status: this.status,
      externalMessageId: this.externalMessageId,
      errorMessage: this.errorMessage,
      sentAt: this.sentAt,
      createdAt: this.createdAt,
    };
  }

  static instance(props: CampaignRecipient.Props): CampaignRecipient {
    return new CampaignRecipient(props);
  }

  static fromRaw(props: CampaignRecipient.Raw): CampaignRecipient {
    return new CampaignRecipient({
      id: props.id,
      campaignId: props.campaignId,
      partnerId: props.partnerId,
      partnerContactId: props.partnerContactId,
      messageId: props.messageId,
      status: props.status,
      externalMessageId: props.externalMessageId,
      errorMessage: props.errorMessage,
      sentAt: props.sentAt,
      createdAt: props.createdAt,
    });
  }

  static create(props: CampaignRecipient.CreateProps): CampaignRecipient {
    if (!props.campaignId || !props.partnerId || !props.partnerContactId) {
      throw InvalidCreation.instance();
    }

    return new CampaignRecipient({
      id: crypto.randomUUID(),
      campaignId: props.campaignId,
      partnerId: props.partnerId,
      partnerContactId: props.partnerContactId,
      messageId: null,
      status: "pending",
      externalMessageId: null,
      errorMessage: null,
      sentAt: null,
      createdAt: new Date(),
    });
  }
}
