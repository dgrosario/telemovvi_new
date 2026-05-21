import { Attendant } from "../../domain/entities/attendant";
import { Contact } from "../../domain/entities/contact";
import { Conversation } from "../../domain/entities/conversation";
import { Message } from "../../domain/entities/message";
import { Partner } from "../../domain/entities/partner";
import { PartnerContact } from "../../domain/entities/partner-contact";
import { Channel } from "../../domain/entities/channel";
import { PhoneNormalizer } from "../../domain/services/phone-normalizer";
import { ChannelsDatabaseRepository } from "../../infra/repositories/channels-repository";
import { ConversationsDatabaseRepository } from "../../infra/repositories/conversations-repository";
import { MessagesDatabaseRepository } from "../../infra/repositories/messages-repository";
import { PartnersDatabaseRepository } from "../../infra/repositories/partners-repository";
import { ProcessedMessagesDatabaseRepository } from "../../infra/repositories/processed-messages-repository";
import { OnMessageReceivedProps } from "../../infra/controllers/evolution-event-handler";

interface ChannelsRepository {
  retrieveByTypeAndPayload(
    type: Channel.Type,
    payload: Record<string, unknown>
  ): Promise<{ channel: Channel; workspaceId: string } | null>;
  retrieveByPayloadField(
    fieldName: string,
    fieldValue: string
  ): Promise<{ channel: Channel; workspaceId: string } | null>;
}

interface PartnersRepository {
  retrieveByContactValue(
    value: string,
    workspaceId: string
  ): Promise<Partner | null>;
  retrieveByContactTypeAndValue(
    type: string,
    value: string,
    workspaceId: string
  ): Promise<Partner | null>;
  findPartnerByExactContactValue(
    value: string,
    workspaceId: string
  ): Promise<Partner | null>;
  upsert(partner: Partner, workspaceId: string): Promise<void>;
  deleteOrphan(partnerId: string): Promise<void>;
}

interface ConversationsRepository {
  retrieveOpenByChannelIdAndContactId(
    channelId: string,
    contactId: string,
    receivedChannelId?: string | null
  ): Promise<Conversation | null>;
  retrieveOpenByGroupJid(
    channelId: string,
    groupJid: string
  ): Promise<Conversation | null>;
  upsert(conversation: Conversation, workspaceId: string): Promise<void>;
}

interface MessagesRepository {
  upsert(message: Message, conversationId: string): Promise<void>;
  retrieveWithChannelId(
    messageId: string
  ): Promise<{ message: Message; channelId: string | null } | null>;
}

interface ProcessedMessagesRepository {
  exists(messageId: string, instanceName: string): Promise<boolean>;
  markProcessed(
    messageId: string,
    instanceName: string,
    eventType: string
  ): Promise<void>;
}

export type ProcessDeviceMessageOutput = {
  conversation: Conversation;
  message: Message;
  workspaceId: string;
  isNewConversation: boolean;
};

export class DeviceChannelNotFoundError extends Error {
  readonly code = "DEVICE_CHANNEL_NOT_FOUND";
  readonly instanceName: string;
  readonly expectedChannelType?: Channel.Type;

  constructor(instanceName: string, expectedChannelType?: Channel.Type) {
    super(
      `[ProcessDeviceMessage] Channel not found for instance=${instanceName}` +
        (expectedChannelType ? ` expectedType=${expectedChannelType}` : "")
    );
    this.name = "DeviceChannelNotFoundError";
    this.instanceName = instanceName;
    this.expectedChannelType = expectedChannelType;
  }
}

export class ProcessDeviceMessage {
  constructor(
    private readonly channelsRepository: ChannelsRepository,
    private readonly partnersRepository: PartnersRepository,
    private readonly conversationsRepository: ConversationsRepository,
    private readonly messagesRepository: MessagesRepository,
    private readonly processedMessagesRepository: ProcessedMessagesRepository
  ) {}

  private isGroupJid(jid: string): boolean {
    if (jid.endsWith("@g.us")) {
      return true;
    }

    if (jid.endsWith("@lid") || jid.endsWith("@s.whatsapp.net")) {
      return false;
    }

    const cleanJid = jid
      .replace("@s.whatsapp.net", "")
      .replace("@g.us", "")
      .replace("@lid", "");
    const digits = cleanJid.replace(/\D/g, "");

    return digits.length >= 14;
  }

  private extractPhoneNumber(remoteJid: string): string {
    if (this.isGroupJid(remoteJid)) {
      throw new Error(`Cannot extract phone number from group JID: ${remoteJid}`);
    }

    const raw = remoteJid
      .replace("@s.whatsapp.net", "")
      .replace("@g.us", "")
      .replace("@lid", "");
    return PhoneNormalizer.normalize(raw);
  }

  private isGroupMessage(input: OnMessageReceivedProps): boolean {
    return input.isGroup || this.isGroupJid(input.remoteJid);
  }

  private resolveContactType(
    expectedType: Channel.Type | undefined,
    channelType: Channel.Type
  ): Channel.Type {
    // Evolution and meta_api are transport layers for WhatsApp, not contact types
    if (
      expectedType === "evolution" ||
      expectedType === "meta_api" ||
      channelType === "evolution" ||
      channelType === "meta_api"
    ) {
      return "whatsapp";
    }
    return expectedType || channelType;
  }

  private async lookupChannelByType(
    type: Channel.Type,
    instanceName: string
  ): Promise<{ channel: Channel; workspaceId: string } | null> {
    switch (type) {
      case "evolution":
        return this.channelsRepository.retrieveByTypeAndPayload("evolution", {
          instanceName,
        });
      case "whatsapp":
        return this.channelsRepository.retrieveByPayloadField(
          "phoneId",
          instanceName
        );
      case "instagram":
        return this.channelsRepository.retrieveByTypeAndPayload("instagram", {
          pageId: instanceName,
        });
      default:
        return null;
    }
  }

  private async lookupChannelFallback(
    instanceName: string
  ): Promise<{ channel: Channel; workspaceId: string } | null> {
    let result = await this.channelsRepository.retrieveByTypeAndPayload(
      "evolution",
      { instanceName }
    );

    if (!result) {
      result = await this.channelsRepository.retrieveByPayloadField(
        "phoneId",
        instanceName
      );
    }

    if (!result) {
      result = await this.channelsRepository.retrieveByTypeAndPayload(
        "instagram",
        { pageId: instanceName }
      );
    }

    return result;
  }

  private resolveSender(): Attendant {
    return Attendant.create({
      id: "device-sender",
      name: "Dispositivo",
    });
  }

  async execute(
    input: OnMessageReceivedProps
  ): Promise<ProcessDeviceMessageOutput | null> {
    const alreadyProcessed = await this.processedMessagesRepository.exists(
      input.messageId,
      input.instanceName
    );

    if (alreadyProcessed) {
      console.log(
        "[ProcessDeviceMessage] Skipping duplicate message:",
        input.messageId,
        "for instance:",
        input.instanceName
      );
      return null;
    }

    console.log(
      "[ProcessDeviceMessage] Processing device message:",
      input.messageId,
      "from instance:",
      input.instanceName
    );

    const existingMessageData =
      await this.messagesRepository.retrieveWithChannelId(input.messageId);

    if (existingMessageData?.message.sender.type === "attendant") {
      console.log(
        "[ProcessDeviceMessage] Message already exists as outbound (sent via system):",
        input.messageId
      );
      await this.processedMessagesRepository.markProcessed(
        input.messageId,
        input.instanceName,
        "messages.upsert"
      );
      return null;
    }

    let channelResult: { channel: Channel; workspaceId: string } | null = null;

    if (input.expectedChannelType) {
      channelResult = await this.lookupChannelByType(
        input.expectedChannelType,
        input.instanceName
      );
    }

    if (!channelResult) {
      channelResult = await this.lookupChannelFallback(input.instanceName);
    }

    if (!channelResult) {
      throw new DeviceChannelNotFoundError(
        input.instanceName,
        input.expectedChannelType
      );
    }

    const { channel, workspaceId } = channelResult;
    const targetChannel =
      channel.responseChannel?.status === "connected"
        ? channel.responseChannel
        : channel;

    console.log(
      "[ProcessDeviceMessage] Found channel:",
      channel.id,
      "target channel:",
      targetChannel.id,
      "workspace:",
      workspaceId
    );

    if (this.isGroupMessage(input)) {
      return this.processGroupMessage(
        input,
        channel,
        targetChannel,
        workspaceId
      );
    }

    const phoneNumber = this.extractPhoneNumber(input.remoteJid);

    let partner = await this.partnersRepository.retrieveByContactValue(
      phoneNumber,
      workspaceId
    );

    const contactType = this.resolveContactType(
      input.expectedChannelType,
      channel.type
    );

    if (!partner) {
      partner = await this.partnersRepository.retrieveByContactTypeAndValue(
        contactType,
        phoneNumber,
        workspaceId
      );
    }

    if (!partner) {
      partner = await this.partnersRepository.findPartnerByExactContactValue(
        phoneNumber,
        workspaceId
      );
    }

    let partnerContact: PartnerContact;

    if (!partner) {
      console.log(
        "[ProcessDeviceMessage] Creating new partner for phone:",
        phoneNumber
      );

      partnerContact = PartnerContact.create(contactType, phoneNumber, "", undefined, undefined, channel.id, "");

      partner = Partner.create({
        name: input.contactName || phoneNumber,
        contacts: [
          {
            id: partnerContact.id,
            type: contactType,
            value: phoneNumber,
            thumbnail: "",
            channelId: channel.id,
          },
        ],
      });

      await this.partnersRepository.upsert(partner, workspaceId);

      // Race condition check: with onConflictDoNothing, if another thread created
      // the contact first, our insert did nothing. We need to find the actual partner
      // that owns this contact and delete our orphan partner.
      const verifiedPartner =
        await this.partnersRepository.findPartnerByExactContactValue(
          phoneNumber,
          workspaceId
        );

      if (verifiedPartner && verifiedPartner.id !== partner.id) {
        console.log(
          "[ProcessDeviceMessage] Race condition detected, using existing partner:",
          verifiedPartner.id,
          "deleting orphan:",
          partner.id
        );
        await this.partnersRepository.deleteOrphan(partner.id);
        partner = verifiedPartner;
        const existingContact = partner.retrieveContactByValue(phoneNumber);
        if (existingContact) {
          partnerContact = existingContact;
        }
      }
    } else {
      const existingContact = partner.retrieveContactByValue(phoneNumber);

      if (existingContact) {
        partnerContact = existingContact;
      } else {
        partnerContact = PartnerContact.create(contactType, phoneNumber, "", undefined, undefined, channel.id, "");
        partner.addContact(partnerContact);
        await this.partnersRepository.upsert(partner, workspaceId);
      }

      if (input.contactName) {
        const currentNameIsOnlyDigits = /^\d+$/.test(partner.name);
        if (currentNameIsOnlyDigits && !partner.isNameCustom) {
          console.log(
            "[ProcessDeviceMessage] Updating partner name from digits-only:",
            partner.name,
            "to:",
            input.contactName
          );
          partner.setName(input.contactName);
          await this.partnersRepository.upsert(partner, workspaceId);
        }
      }
    }

    const contact = Contact.instance({
      id: partnerContact.id,
      name: partner.name,
      thumbnail: partnerContact.thumbnail,
      value: partnerContact.value,
      username: partnerContact.username,
      type: partnerContact.type,
    });

    const receivedChannelId =
      channel.id !== targetChannel.id ? channel.id : null;

    let conversation =
      await this.conversationsRepository.retrieveOpenByChannelIdAndContactId(
        targetChannel.id,
        contact.id
      );

    let isNewConversation = false;

    const sender = this.resolveSender();

    if (!conversation) {
      console.log(
        "[ProcessDeviceMessage] Creating new conversation for contact:",
        contact.id,
        "on target channel:",
        targetChannel.id
      );
      conversation = Conversation.create(
        contact,
        targetChannel,
        receivedChannelId ? channel : undefined
      );
      isNewConversation = true;
    }

    const message = Message.create({
      id: input.messageId,
      type: input.type,
      content: input.content,
      caption: input.caption,
      filename: input.filename,
      mimetype: input.mimetype,
      mediaKey: input.mediaKey,
      sender,
      createdAt: new Date(input.timestamp * 1000),
    });

    message.status = "sent";

    await this.conversationsRepository.upsert(conversation, workspaceId);
    await this.messagesRepository.upsert(message, conversation.id);

    await this.processedMessagesRepository.markProcessed(
      input.messageId,
      input.instanceName,
      "messages.upsert"
    );

    console.log(
      "[ProcessDeviceMessage] Device message saved:",
      message.id,
      "conversation:",
      conversation.id,
      "sender:",
      sender.name
    );

    return {
      conversation,
      message,
      workspaceId,
      isNewConversation,
    };
  }

  private async processGroupMessage(
    input: OnMessageReceivedProps,
    channel: Channel,
    targetChannel: Channel,
    workspaceId: string
  ): Promise<ProcessDeviceMessageOutput | null> {
    const groupJid = input.groupJid ?? input.remoteJid;
    const groupName =
      input.groupName && !input.groupName.endsWith("@g.us")
        ? input.groupName
        : null;

    console.log(
      "[ProcessDeviceMessage] Processing GROUP device message:",
      "groupJid:",
      groupJid,
      "messageId:",
      input.messageId
    );

    const receivedChannelId =
      channel.id !== targetChannel.id ? channel.id : null;

    let conversation =
      await this.conversationsRepository.retrieveOpenByGroupJid(
        targetChannel.id,
        groupJid
      );

    let isNewConversation = false;

    const sender = this.resolveSender();

    if (!conversation) {
      console.log(
        "[ProcessDeviceMessage] Creating new GROUP conversation:",
        groupName,
        "groupJid:",
        groupJid
      );
      conversation = Conversation.createFromWhatsAppGroup(
        groupJid,
        groupName,
        targetChannel,
        receivedChannelId ? channel : undefined
      );
      isNewConversation = true;
    }

    const message = Message.create({
      id: input.messageId,
      type: input.type,
      content: input.content,
      caption: input.caption,
      filename: input.filename,
      mimetype: input.mimetype,
      mediaKey: input.mediaKey,
      sender,
      createdAt: new Date(input.timestamp * 1000),
    });

    message.status = "sent";

    await this.conversationsRepository.upsert(conversation, workspaceId);
    await this.messagesRepository.upsert(message, conversation.id);

    await this.processedMessagesRepository.markProcessed(
      input.messageId,
      input.instanceName,
      "messages.upsert"
    );

    console.log(
      "[ProcessDeviceMessage] GROUP device message saved:",
      message.id,
      "conversation:",
      conversation.id,
      "group:",
      groupName
    );

    return {
      conversation,
      message,
      workspaceId,
      isNewConversation,
    };
  }

  static instance(): ProcessDeviceMessage {
    return new ProcessDeviceMessage(
      ChannelsDatabaseRepository.instance(),
      PartnersDatabaseRepository.instance(),
      ConversationsDatabaseRepository.instance(),
      MessagesDatabaseRepository.instance(),
      ProcessedMessagesDatabaseRepository.instance()
    );
  }
}
