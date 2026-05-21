import { InvalidCreation } from "../errors/invalid-creation";
import { PhoneNormalizer } from "../services/phone-normalizer";
import { Channel } from "./channel";

export namespace PartnerContact {
  export interface Props {
    id: string;
    thumbnail: string;
    value: string;
    username: string;
    type: Channel.Type;
    channelId?: string | null;
    createdAt: Date;
  }

  export interface Raw {
    id: string;
    thumbnail: string;
    value: string;
    username: string;
    type: Channel.Type;
    channelId?: string | null;
    createdAt: string;
  }
}
export class PartnerContact {
  public id: string;
  public thumbnail: string;
  public value: string;
  public username: string;
  public type: Channel.Type;
  public channelId?: string | null;
  public createdAt: Date;

  constructor(props: PartnerContact.Props) {
    this.id = props.id;
    this.thumbnail = props.thumbnail;
    this.value = props.value;
    this.username = props.username;
    this.type = props.type;
    this.channelId = props.channelId;
    this.createdAt = props.createdAt;
  }

  raw(): PartnerContact.Raw {
    return {
      id: this.id,
      thumbnail: this.thumbnail,
      value: this.value,
      username: this.username,
      type: this.type,
      channelId: this.channelId,
      createdAt: this.createdAt.toISOString(),
    };
  }

  static instance(props: PartnerContact.Props) {
    const shouldNormalize =
      props.type === "whatsapp" || props.type === "evolution";
    return new PartnerContact({
      ...props,
      value: shouldNormalize
        ? PhoneNormalizer.normalize(props.value)
        : props.value,
    });
  }

  static create(
    type: Channel.Type,
    value: string,
    thumbnail?: string,
    id?: string,
    createdAt?: Date,
    channelId?: string | null,
    username?: string
  ) {
    if (!type) throw InvalidCreation.instance();
    const shouldNormalize = type === "whatsapp" || type === "evolution";
    const normalizedValue = shouldNormalize
      ? PhoneNormalizer.normalize(value)
      : value;
    return new PartnerContact({
      id: id || crypto.randomUUID().toString(),
      thumbnail: thumbnail || "",
      type,
      value: normalizedValue,
      username: username || "",
      channelId: channelId ?? null,
      createdAt: createdAt || new Date(),
    });
  }
}
