import { InvalidCreation } from "../errors/invalid-creation";

export namespace CampaignMessage {
  export type VariationLabel = string;
  export type MessageType = "text" | "template";

  export interface Variable {
    name: string;
    value: string;
  }

  export interface Props {
    id: string;
    campaignId: string;
    variationLabel: VariationLabel;
    type: MessageType;
    content: string | null;
    templateName: string | null;
    variables: Variable[];
    sentCount: number;
    createdAt: Date;
  }

  export interface Raw {
    id: string;
    campaignId: string;
    variationLabel: VariationLabel;
    type: MessageType;
    content: string | null;
    templateName: string | null;
    variables: Variable[];
    sentCount: number;
    createdAt: Date;
  }

  export interface CreateProps {
    campaignId: string;
    variationLabel: VariationLabel;
    type: MessageType;
    content?: string;
    templateName?: string;
    variables?: Variable[];
  }
}

export class CampaignMessage {
  public id: string;
  public campaignId: string;
  public variationLabel: CampaignMessage.VariationLabel;
  public type: CampaignMessage.MessageType;
  public content: string | null;
  public templateName: string | null;
  public variables: CampaignMessage.Variable[];
  public sentCount: number;
  public createdAt: Date;

  constructor(props: CampaignMessage.Props) {
    this.id = props.id;
    this.campaignId = props.campaignId;
    this.variationLabel = props.variationLabel;
    this.type = props.type;
    this.content = props.content;
    this.templateName = props.templateName;
    this.variables = props.variables;
    this.sentCount = props.sentCount;
    this.createdAt = props.createdAt;
  }

  incrementSentCount(): this {
    this.sentCount += 1;
    return this;
  }

  raw(): CampaignMessage.Raw {
    return {
      id: this.id,
      campaignId: this.campaignId,
      variationLabel: this.variationLabel,
      type: this.type,
      content: this.content,
      templateName: this.templateName,
      variables: this.variables,
      sentCount: this.sentCount,
      createdAt: this.createdAt,
    };
  }

  static instance(props: CampaignMessage.Props): CampaignMessage {
    return new CampaignMessage(props);
  }

  static fromRaw(props: CampaignMessage.Raw): CampaignMessage {
    return new CampaignMessage({
      id: props.id,
      campaignId: props.campaignId,
      variationLabel: props.variationLabel,
      type: props.type,
      content: props.content,
      templateName: props.templateName,
      variables: props.variables,
      sentCount: props.sentCount,
      createdAt: props.createdAt,
    });
  }

  static create(props: CampaignMessage.CreateProps): CampaignMessage {
    if (!props.campaignId || !props.variationLabel) {
      throw InvalidCreation.instance();
    }

    if (props.type === "text" && !props.content) {
      throw InvalidCreation.instance();
    }

    if (props.type === "template" && !props.templateName) {
      throw InvalidCreation.instance();
    }

    return new CampaignMessage({
      id: crypto.randomUUID(),
      campaignId: props.campaignId,
      variationLabel: props.variationLabel,
      type: props.type,
      content: props.content ?? null,
      templateName: props.templateName ?? null,
      variables: props.variables ?? [],
      sentCount: 0,
      createdAt: new Date(),
    });
  }
}
