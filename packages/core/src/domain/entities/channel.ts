export interface WhatsAppChannelPayload {
  accessToken: string;
  wabaId: string;
  phoneId: string;
  businessId?: string;
  phoneNumber?: string;
  isDirect?: boolean;
}

export interface InstagramChannelPayload {
  accessToken: string;
  pageId: string;
  pageName?: string;
  igUserId: string;
  igUsername?: string;
  profilePictureUrl?: string;
  tokenExpiresAt?: Date | string;
  tokenType?: "short-lived" | "long-lived";
}

export interface EvolutionChannelPayload {
  instanceName: string;
  instanceId?: string;
  qrcode?: string | null;
  connected?: boolean;
  phoneNumber?: string | null;
}

export interface MetaApiChannelPayload {
  appId: string;
  appSecret: string;
  accessToken: string;
  wabaId: string;
  phoneId: string;
  phoneNumber?: string;
  businessId?: string;
  verifyToken?: string;
}

export interface EmptyChannelPayload {
  [key: string]: never;
}

export type ChannelPayload =
  | WhatsAppChannelPayload
  | InstagramChannelPayload
  | EvolutionChannelPayload
  | MetaApiChannelPayload
  | EmptyChannelPayload;

export namespace Channel {
  export type Status = "connected" | "disconnected";
  export type Type = "whatsapp" | "instagram" | "evolution" | "meta_api";

  export type PayloadByType<T extends Type> = T extends "whatsapp"
    ? WhatsAppChannelPayload
    : T extends "instagram"
      ? InstagramChannelPayload
      : T extends "evolution"
        ? EvolutionChannelPayload
        : T extends "meta_api"
          ? MetaApiChannelPayload
          : ChannelPayload;

  export interface Props<T extends Type = Type> {
    id: string;
    name: string;
    status: Status;
    createdAt: Date;
    type: T;
    payload: PayloadByType<T> | EmptyChannelPayload;
    responseChannel: Channel | null;
    deletedAt: Date | null;
  }

  export interface Raw<T extends Type = Type> {
    id: string;
    name: string;
    status: Status;
    createdAt: Date;
    type: T;
    payload: PayloadByType<T> | EmptyChannelPayload;
    responseChannel: Channel.Raw | null;
    deletedAt: Date | null;
  }
}
export class Channel {
  public id: string;
  public name: string;
  public createdAt: Date;
  public status: Channel.Status;
  public type: Channel.Type;
  public payload: ChannelPayload;
  public responseChannel: Channel | null;
  public deletedAt: Date | null;

  constructor(props: Channel.Props) {
    this.id = props.id;
    this.name = props.name;
    this.createdAt = props.createdAt;
    this.status = props.status;
    this.type = props.type;
    this.payload = props.payload;
    this.responseChannel = props.responseChannel;
    this.deletedAt = props.deletedAt;
  }

  get isDeleted(): boolean {
    return this.deletedAt !== null;
  }

  raw(): Channel.Raw {
    return {
      createdAt: this.createdAt,
      id: this.id,
      name: this.name,
      payload: this.payload,
      status: this.status,
      type: this.type,
      responseChannel: this.responseChannel?.raw?.() || null,
      deletedAt: this.deletedAt,
    };
  }

  rename(name: string) {
    this.name = name;
  }

  connected(payload: ChannelPayload, isConnected: boolean) {
    this.status = isConnected ? "connected" : "disconnected";
    this.payload = payload;
  }

  disconnect() {
    this.status = "disconnected";
    this.payload = {} as EmptyChannelPayload;
  }

  reconnect(newType: Channel.Type, newPayload: ChannelPayload) {
    this.type = newType;
    this.payload = newPayload;
    this.status = "disconnected";
  }

  registerResponseChannel(channel: Channel) {
    this.responseChannel = channel;
  }

  unregisterResponseChannel() {
    this.responseChannel = null;
  }

  static instance(props: Channel.Props | Channel.Raw): Channel {
    const responseChannel = props.responseChannel
      ? props.responseChannel instanceof Channel
        ? props.responseChannel
        : Channel.instance(props.responseChannel)
      : null;
    return new Channel({
      ...props,
      deletedAt: props.deletedAt ?? null,
      responseChannel,
    });
  }

  static create(name: string, type: Channel.Type) {
    return new Channel({
      id: crypto.randomUUID().toString(),
      name: name || "",
      createdAt: new Date(),
      status: "disconnected",
      type,
      payload: {} as EmptyChannelPayload,
      responseChannel: null,
      deletedAt: null,
    });
  }
}

export function isWhatsAppPayload(
  payload: ChannelPayload
): payload is WhatsAppChannelPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "accessToken" in payload &&
    "wabaId" in payload &&
    "phoneId" in payload
  );
}

export function isInstagramPayload(
  payload: ChannelPayload
): payload is InstagramChannelPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "accessToken" in payload &&
    "pageId" in payload &&
    "igUserId" in payload
  );
}

export function isEvolutionPayload(
  payload: ChannelPayload
): payload is EvolutionChannelPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "instanceName" in payload
  );
}

export function isMetaApiPayload(
  payload: ChannelPayload
): payload is MetaApiChannelPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "appId" in payload &&
    "appSecret" in payload &&
    "accessToken" in payload &&
    "wabaId" in payload &&
    "phoneId" in payload
  );
}

export function isEmptyPayload(
  payload: ChannelPayload
): payload is EmptyChannelPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    Object.keys(payload).length === 0
  );
}

export function getPayloadProperty<K extends keyof (WhatsAppChannelPayload & InstagramChannelPayload & EvolutionChannelPayload & MetaApiChannelPayload)>(
  payload: ChannelPayload,
  key: K
): (WhatsAppChannelPayload & InstagramChannelPayload & EvolutionChannelPayload & MetaApiChannelPayload)[K] | undefined {
  if (typeof payload === "object" && payload !== null && key in payload) {
    return (payload as WhatsAppChannelPayload & InstagramChannelPayload & EvolutionChannelPayload & MetaApiChannelPayload)[key];
  }
  return undefined;
}

export function parseChannelPayload(payload: unknown): ChannelPayload {
  if (typeof payload === "string") {
    console.warn("[parseChannelPayload] Detected double-serialized payload, parsing...");
    try {
      const parsed: unknown = JSON.parse(payload);
      if (typeof parsed === "object" && parsed !== null) {
        return parsed as ChannelPayload;
      }
    } catch {
      return {} as EmptyChannelPayload;
    }
    return {} as EmptyChannelPayload;
  }

  if (typeof payload !== "object" || payload === null) {
    return {} as EmptyChannelPayload;
  }
  return payload as ChannelPayload;
}

export function sanitizeChannelPayload(payload: ChannelPayload): ChannelPayload {
  if (isMetaApiPayload(payload)) {
    const { appSecret: _, accessToken: __, verifyToken: ___, ...sanitized } = payload;
    return sanitized as unknown as ChannelPayload;
  }
  if (isWhatsAppPayload(payload)) {
    const { accessToken: _, ...sanitized } = payload;
    return sanitized as unknown as ChannelPayload;
  }
  if (isInstagramPayload(payload)) {
    const { accessToken: _, ...sanitized } = payload;
    return sanitized as unknown as ChannelPayload;
  }
  return payload;
}

export type TypeChannelAvailable = {
  name: string;
  type: Channel.Type;
  icon: string;
};

export const typeChannelsAvailable: Map<Channel.Type, TypeChannelAvailable> =
  new Map([
    [
      "evolution",
      {
        icon: "tabler-brand-whatsapp text-green-500",
        name: "WhatsApp",
        type: "evolution",
      },
    ],
    [
      "whatsapp",
      {
        icon: "tabler-brand-whatsapp-filled text-green-600",
        name: "WhatsApp Cloud",
        type: "whatsapp",
      },
    ],
    [
      "instagram",
      {
        icon: "tabler-brand-instagram text-rose-500",
        name: "Instagram",
        type: "instagram",
      },
    ],
    [
      "meta_api",
      {
        icon: "tabler-brand-meta text-blue-500",
        name: "Meta API",
        type: "meta_api",
      },
    ],
  ]);

export const WHATSAPP_FAMILY: Channel.Type[] = [
  "whatsapp",
  "evolution",
  "meta_api",
];

export const INSTAGRAM_FAMILY: Channel.Type[] = ["instagram"];

export function getChannelFamily(type: Channel.Type): Channel.Type[] {
  if (WHATSAPP_FAMILY.includes(type)) return WHATSAPP_FAMILY;
  if (INSTAGRAM_FAMILY.includes(type)) return INSTAGRAM_FAMILY;
  return [type];
}

export const META_CHANNEL_TYPES: Channel.Type[] = [
  "whatsapp",
  "instagram",
  "meta_api",
];

export function isMetaChannel(type: Channel.Type): boolean {
  return META_CHANNEL_TYPES.includes(type);
}
