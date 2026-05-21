import { Contact } from "../../domain/entities/contact";
import { Conversation } from "../../domain/entities/conversation";
import { Message } from "../../domain/entities/message";
import { Partner } from "../../domain/entities/partner";
import { PartnerContact } from "../../domain/entities/partner-contact";
import { Channel } from "../../domain/entities/channel";
import { Flow } from "../../domain/entities/flow";
import { FlowExecution } from "../../domain/entities/flow-execution";
import { PhoneNormalizer } from "../../domain/services/phone-normalizer";
import { FlowExecutorDriver } from "../../infra/drivers/flow-executor/flow-executor-driver";
import { ChannelsDatabaseRepository } from "../../infra/repositories/channels-repository";
import { ConversationsDatabaseRepository } from "../../infra/repositories/conversations-repository";
import { FlowExecutionsDatabaseRepository } from "../../infra/repositories/flow-executions-repository";
import { FlowsInChannelsDatabaseRepository } from "../../infra/repositories/flows-in-channels-repository";
import { FlowsInSectorsDatabaseRepository } from "../../infra/repositories/flows-in-sectors-repository";
import { MessagesDatabaseRepository } from "../../infra/repositories/messages-repository";
import { PartnersDatabaseRepository } from "../../infra/repositories/partners-repository";
import { ProcessedMessagesDatabaseRepository } from "../../infra/repositories/processed-messages-repository";
import { OnMessageReceivedProps } from "../../infra/controllers/evolution-event-handler";
import { ProfilePicturePublisher } from "../../infra/drivers/profile-picture-publisher";

interface ChannelsRepository {
  retrieveByTypeAndPayload(
    type: Channel.Type,
    payload: Record<string, unknown>,
  ): Promise<{ channel: Channel; workspaceId: string } | null>;
  retrieveByPayloadField(
    fieldName: string,
    fieldValue: string,
  ): Promise<{ channel: Channel; workspaceId: string } | null>;
  isInternalChannelPhone(
    phoneNumber: string,
    workspaceId: string,
  ): Promise<boolean>;
}

interface PartnersRepository {
  retrieveByContactValue(
    value: string,
    workspaceId: string,
  ): Promise<Partner | null>;
  retrieveByContactTypeAndUsername(
    type: string,
    username: string,
    workspaceId: string,
  ): Promise<Partner | null>;
  listByContactTypeAndUsername(
    type: string,
    username: string,
    workspaceId: string,
  ): Promise<Partner[]>;
  retrieveByContactTypeAndValue(
    type: string,
    value: string,
    workspaceId: string,
  ): Promise<Partner | null>;
  findPartnerByExactContactValue(
    value: string,
    workspaceId: string,
  ): Promise<Partner | null>;
  canonicalizePartners(
    partnerIds: string[],
    workspaceId: string,
    options?: { dryRun?: boolean },
  ): Promise<{
    canonicalPartner: Partner | null;
    canonicalPartnerId: string | null;
    mergedPartnerIds: string[];
  }>;
  upsert(partner: Partner, workspaceId: string): Promise<void>;
  deleteOrphan(partnerId: string): Promise<void>;
  createPartnerWithContactAtomic(
    partnerData: { name: string; tags?: string[] },
    contactData: {
      type: Channel.Type;
      value: string;
      thumbnail?: string;
      channelId?: string | null;
      username?: string;
    },
    workspaceId: string,
  ): Promise<{ partner: Partner; isNew: boolean }>;
  addContactIfNotExists(
    partnerId: string,
    contactData: { type: Channel.Type; value: string; channelId?: string },
  ): Promise<void>;
}

interface ConversationsRepository {
  retrieveOpenByChannelIdAndContactId(
    channelId: string,
    contactId: string,
    receivedChannelId?: string | null,
  ): Promise<Conversation | null>;
  retrieveLatestByChannelIdAndContactId(
    channelId: string,
    contactId: string,
  ): Promise<Conversation | null>;
  retrieveOpenByGroupJid(
    channelId: string,
    groupJid: string,
  ): Promise<Conversation | null>;
  retrieveOpenByChannelAndPartnerName(
    channelId: string,
    partnerName: string,
    workspaceId: string,
  ): Promise<Conversation | null>;
  retrieveByChannelAndPartnerName(
    channelId: string,
    partnerName: string,
    workspaceId: string,
  ): Promise<Conversation | null>;
  upsert(conversation: Conversation, workspaceId: string): Promise<void>;
  retrieve(conversationId: string): Promise<Conversation | null>;
  reopenAtomically(
    channelId: string,
    contactId: string,
    workspaceId: string,
  ): Promise<{ success: boolean; conversationId: string | null }>;
  ensureWaitingStatus(conversationId: string): Promise<void>;
}

interface MessagesRepository {
  upsert(message: Message, conversationId: string): Promise<void>;
  retrieve(messageId: string): Promise<Message | null>;
  retrieveWithChannelId(
    messageId: string,
  ): Promise<{ message: Message; channelId: string | null } | null>;
  existsInDifferentConversation(
    messageId: string,
    targetConversationId: string,
  ): Promise<{ exists: boolean; existingConversationId: string | null }>;
}

interface ProcessedMessagesRepository {
  exists(messageId: string, instanceName: string): Promise<boolean>;
  markProcessed(
    messageId: string,
    instanceName: string,
    eventType: string,
  ): Promise<void>;
}

interface FlowsInChannelsRepository {
  findActiveFlowForChannel(channelId: string): Promise<Flow | null>;
}

interface FlowsInSectorsRepository {
  listSectorIdsForFlow(flowId: string): Promise<string[]>;
}

interface FlowExecutionsRepository {
  retrievePausedByConversation(
    conversationId: string,
  ): Promise<FlowExecution | null>;
}

export type ProcessInboundMessageOutput = {
  conversation: Conversation;
  message: Message;
  workspaceId: string;
  isNewConversation: boolean;
  groupNameChanged?: boolean;
};

export class InboundChannelNotFoundError extends Error {
  readonly code = "INBOUND_CHANNEL_NOT_FOUND";
  readonly instanceName: string;
  readonly expectedChannelType?: Channel.Type;

  constructor(instanceName: string, expectedChannelType?: Channel.Type) {
    super(
      `[ProcessInboundMessage] Channel not found for instance=${instanceName}` +
        (expectedChannelType ? ` expectedType=${expectedChannelType}` : ""),
    );
    this.name = "InboundChannelNotFoundError";
    this.instanceName = instanceName;
    this.expectedChannelType = expectedChannelType;
  }
}

interface FlowTriggerData {
  channel: Channel;
  conversation: Conversation;
  message: Message;
  isNewConversation: boolean;
  workspaceId: string;
}

export class ProcessInboundMessage {
  // Map global para debounce de triggers de fluxo (compartilhado entre instancias via static)
  private static flowTriggerBuffer: Map<
    string,
    {
      data: FlowTriggerData;
      timeout: NodeJS.Timeout;
      receivedAt: number;
      instance: ProcessInboundMessage;
    }
  > = new Map();

  private static readonly FLOW_DEBOUNCE_MS = 1500;

  constructor(
    private readonly channelsRepository: ChannelsRepository,
    private readonly partnersRepository: PartnersRepository,
    private readonly conversationsRepository: ConversationsRepository,
    private readonly messagesRepository: MessagesRepository,
    private readonly processedMessagesRepository: ProcessedMessagesRepository,
    private readonly flowsInChannelsRepository: FlowsInChannelsRepository,
    private readonly flowExecutionsRepository: FlowExecutionsRepository,
    private readonly flowsInSectorsRepository: FlowsInSectorsRepository,
  ) {}

  private getChannelPhoneNumber(channel: Channel): string | null {
    const payload = channel.payload;
    if ("phoneNumber" in payload && payload.phoneNumber) {
      return payload.phoneNumber;
    }
    return null;
  }

  private isGroupJid(jid: string): boolean {
    // @lid is Linked ID (WhatsApp privacy feature), not a group
    if (jid.endsWith("@lid")) {
      return false;
    }

    if (jid.endsWith("@g.us")) {
      return true;
    }

    const cleanJid = jid.replace("@s.whatsapp.net", "").replace("@g.us", "");
    const digits = cleanJid.replace(/\D/g, "");

    // Instagram IDs are numeric but not groups - they don't have @ suffix
    // WhatsApp JIDs always have @ suffix (@s.whatsapp.net or @g.us)
    // If no @ suffix, it's likely an Instagram ID, not a group
    if (!jid.includes("@")) {
      return false;
    }

    // Group JIDs typically have 14+ digits
    // Valid phone numbers have max 13 digits (55 + 2 DDD + 9 number = 13)
    if (digits.length >= 14) {
      return true;
    }

    return false;
  }

  private extractPhoneNumber(remoteJid: string): string {
    // Reject group JIDs - they cannot be used as contact phone numbers
    if (this.isGroupJid(remoteJid)) {
      throw new Error(
        `Cannot extract phone number from group JID: ${remoteJid}`,
      );
    }

    // Handle different JID suffixes including @lid (WhatsApp privacy feature)
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
    channelType: Channel.Type,
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
    instanceName: string,
  ): Promise<{ channel: Channel; workspaceId: string } | null> {
    switch (type) {
      case "evolution":
        return this.channelsRepository.retrieveByTypeAndPayload("evolution", {
          instanceName,
        });
      case "whatsapp":
        return this.channelsRepository.retrieveByPayloadField(
          "phoneId",
          instanceName,
        );
      case "instagram":
        // Instagram webhooks can send either pageId or igUserId as the instance
        // Try pageId first, then igUserId
        const instagramResult =
          await this.channelsRepository.retrieveByTypeAndPayload("instagram", {
            pageId: instanceName,
          });
        if (instagramResult) return instagramResult;

        return this.channelsRepository.retrieveByTypeAndPayload("instagram", {
          igUserId: instanceName,
        });
      default:
        return null;
    }
  }

  private async lookupChannelFallback(
    instanceName: string,
  ): Promise<{ channel: Channel; workspaceId: string } | null> {
    let result = await this.channelsRepository.retrieveByTypeAndPayload(
      "evolution",
      { instanceName },
    );

    if (!result) {
      result = await this.channelsRepository.retrieveByPayloadField(
        "phoneId",
        instanceName,
      );
    }

    if (!result) {
      result = await this.channelsRepository.retrieveByTypeAndPayload(
        "instagram",
        { pageId: instanceName },
      );
    }

    // Try igUserId for Instagram as fallback
    if (!result) {
      result = await this.channelsRepository.retrieveByTypeAndPayload(
        "instagram",
        { igUserId: instanceName },
      );
    }

    return result;
  }

  async execute(
    input: OnMessageReceivedProps,
  ): Promise<ProcessInboundMessageOutput | null> {
    const alreadyProcessed = await this.processedMessagesRepository.exists(
      input.messageId,
      input.instanceName,
    );

    if (alreadyProcessed) {
      console.log(
        "[ProcessInboundMessage] Skipping duplicate message:",
        input.messageId,
        "for instance:",
        input.instanceName,
      );
      return null;
    }

    console.log(
      "[ProcessInboundMessage] Processing message from:",
      input.instanceName,
      "messageId:",
      input.messageId,
      "expectedChannelType:",
      input.expectedChannelType,
    );

    let channelResult: { channel: Channel; workspaceId: string } | null = null;

    if (input.expectedChannelType) {
      channelResult = await this.lookupChannelByType(
        input.expectedChannelType,
        input.instanceName,
      );
    }

    if (!channelResult) {
      channelResult = await this.lookupChannelFallback(input.instanceName);
    }

    if (!channelResult) {
      throw new InboundChannelNotFoundError(
        input.instanceName,
        input.expectedChannelType,
      );
    }

    const { channel, workspaceId } = channelResult;
    const targetChannel =
      channel.responseChannel?.status === "connected"
        ? channel.responseChannel
        : channel;

    // Check for group message BEFORE extracting phone number
    // Group JIDs cannot be converted to phone numbers
    if (this.isGroupMessage(input)) {
      return this.processGroupMessage(
        input,
        channel,
        targetChannel,
        workspaceId,
      );
    }

    const phoneNumber = this.extractPhoneNumber(input.remoteJid);
    const isLinkedId = PhoneNormalizer.isLinkedId(input.remoteJid);

    console.log(
      "[ProcessInboundMessage] Found channel:",
      channel.id,
      "target channel:",
      targetChannel.id,
      "workspace:",
      workspaceId,
      isLinkedId ? `(LID detected: ${phoneNumber})` : "",
    );

    // Only block messages that would cause a loop (same channel sending to itself)
    // Allow messages between different internal channels
    const receivingChannelPhone = this.getChannelPhoneNumber(channel);
    const isSelfMessage =
      receivingChannelPhone &&
      PhoneNormalizer.normalize(receivingChannelPhone) === phoneNumber;

    if (isSelfMessage) {
      console.log(
        "[ProcessInboundMessage] Ignoring self-message from channel:",
        phoneNumber,
        "messageId:",
        input.messageId,
      );
      return null;
    }

    const existingMessageData =
      await this.messagesRepository.retrieveWithChannelId(input.messageId);

    if (
      existingMessageData &&
      existingMessageData.message.sender.type === "attendant" &&
      existingMessageData.channelId === targetChannel.id
    ) {
      console.log(
        "[ProcessInboundMessage] Ignoring inbound message - already exists as outbound on same channel:",
        input.messageId,
        "channelId:",
        targetChannel.id,
      );
      await this.processedMessagesRepository.markProcessed(
        input.messageId,
        input.instanceName,
        "messages.upsert",
      );
      return null;
    }

    if (isLinkedId) {
      const lidResolution = await this.resolveLidConversation(
        input,
        phoneNumber,
        targetChannel,
        channel,
        workspaceId,
      );

      if (lidResolution) {
        return lidResolution;
      }

      if (!input.contactName) {
        console.warn(
          "[ProcessInboundMessage] LID without pushName, all fallbacks failed. Dropping message:",
          input.messageId,
          "LID:",
          phoneNumber,
        );
        return null;
      }

      console.warn(
        "[ProcessInboundMessage] LID with pushName but no existing match. Creating new partner:",
        input.contactName,
        "LID:",
        phoneNumber,
      );
    }

    const contactType = this.resolveContactType(
      input.expectedChannelType,
      channel.type,
    );
    const normalizedUsername = input.username?.trim().replace(/^@/, "") || "";

    console.log(
      "[ProcessInboundMessage] Creating/updating partner:",
      "contactName:",
      input.contactName,
      "phoneNumber:",
      phoneNumber,
      "contactType:",
      contactType,
    );

    let partner: Partner | null = null;
    let isNewPartner = false;

    if (contactType === "instagram" && normalizedUsername) {
      const findUsernameContact = (candidatePartner: Partner) =>
        candidatePartner.contacts.find((contact) => {
          if (contact.type !== "instagram") return false;

          const normalizedContactUsername = contact.username
            ?.trim()
            .replace(/^@/, "")
            .toLowerCase();
          const normalizedContactValue = contact.value
            .trim()
            .replace(/^@/, "")
            .toLowerCase();
          const normalizedTarget = normalizedUsername.toLowerCase();

          return (
            normalizedContactUsername === normalizedTarget ||
            (!contact.username && normalizedContactValue === normalizedTarget)
          );
        });

      const createPartnerFromInboundScopedId = async () => {
        const createdResult =
          await this.partnersRepository.createPartnerWithContactAtomic(
            { name: input.contactName || phoneNumber },
            {
              type: contactType,
              value: phoneNumber,
              thumbnail: "",
              channelId: channel.id,
              username: normalizedUsername,
            },
            workspaceId,
          );
        partner = createdResult.partner;
        isNewPartner = createdResult.isNew;
      };

      const applyUsernameOnScopedContact = async (scopedPartner: Partner) => {
        const scopedContact = scopedPartner.retrieveContactByValue(phoneNumber);
        if (
          scopedContact &&
          (scopedContact.username !== normalizedUsername ||
            scopedContact.channelId !== channel.id)
        ) {
          scopedContact.username = normalizedUsername;
          scopedContact.channelId = channel.id;
          await this.partnersRepository.upsert(scopedPartner, workspaceId);
        }
      };

      const partnersByUsername =
        await this.partnersRepository.listByContactTypeAndUsername(
          "instagram",
          normalizedUsername,
          workspaceId,
        );
      const existingPartnerByScopedId =
        await this.partnersRepository.retrieveByContactTypeAndValue(
          "instagram",
          phoneNumber,
          workspaceId,
        );

      const partnerIdsToCanonicalize = Array.from(
        new Set([
          ...partnersByUsername.map((candidate) => candidate.id),
          existingPartnerByScopedId?.id,
        ].filter((partnerId): partnerId is string => !!partnerId)),
      );

      if (partnerIdsToCanonicalize.length > 1) {
        const canonicalization = await this.partnersRepository.canonicalizePartners(
          partnerIdsToCanonicalize,
          workspaceId,
        );
        partner = canonicalization.canonicalPartner;

        if (partner) {
          await applyUsernameOnScopedContact(partner);

          const canonicalScopedContact = partner.retrieveContactByValue(phoneNumber);
          if (!canonicalScopedContact) {
            const usernameContact = findUsernameContact(partner);
            if (usernameContact) {
              usernameContact.value = phoneNumber;
              usernameContact.username = normalizedUsername;
              usernameContact.channelId = channel.id;
              await this.partnersRepository.upsert(partner, workspaceId);
              console.log(
                "[ProcessInboundMessage] Canonical instagram partner synchronized to scoped ID:",
                normalizedUsername,
                "->",
                phoneNumber,
              );
            }
          }
        }
      } else if (partnersByUsername.length > 0) {
        const partnerByUsername = partnersByUsername[0]!;
        const usernameContact = findUsernameContact(partnerByUsername);

        if (usernameContact) {
          const contactHasScopedId = /^\d+$/.test(usernameContact.value);
          const sameScopedId = usernameContact.value === phoneNumber;

          if (!contactHasScopedId) {
            usernameContact.value = phoneNumber;
            usernameContact.username = normalizedUsername;
            usernameContact.channelId = channel.id;
            await this.partnersRepository.upsert(
              partnerByUsername,
              workspaceId,
            );
            console.log(
              "[ProcessInboundMessage] Instagram username synchronized to scoped ID:",
              normalizedUsername,
              "->",
              phoneNumber,
            );
            partner = partnerByUsername;
          } else if (!sameScopedId) {
            console.warn(
              "[ProcessInboundMessage] Instagram username conflict ignored:",
              normalizedUsername,
              "existing scoped ID:",
              usernameContact.value,
              "incoming scoped ID:",
              phoneNumber,
            );
            await createPartnerFromInboundScopedId();
          } else {
            await applyUsernameOnScopedContact(partnerByUsername);
            partner = partnerByUsername;
          }
        } else {
          await createPartnerFromInboundScopedId();
        }
      } else if (existingPartnerByScopedId) {
        await applyUsernameOnScopedContact(existingPartnerByScopedId);
        partner = existingPartnerByScopedId;
      } else {
        await createPartnerFromInboundScopedId();
      }
    } else {
      const createdResult =
        await this.partnersRepository.createPartnerWithContactAtomic(
          { name: input.contactName || phoneNumber },
          {
            type: contactType,
            value: phoneNumber,
            thumbnail: "",
            channelId: channel.id,
            username: normalizedUsername,
          },
          workspaceId,
        );
      partner = createdResult.partner;
      isNewPartner = createdResult.isNew;
    }

    if (!partner) {
      throw new Error(
        "Instagram inbound partner resolution failed unexpectedly",
      );
    }

    console.log(
      "[ProcessInboundMessage] Partner result:",
      "id:",
      partner.id,
      "name:",
      partner.name,
      "isNew:",
      isNewPartner,
    );

    let partnerContact = partner.retrieveContactByValue(phoneNumber);

    if (!partnerContact) {
      partnerContact = PartnerContact.create(
        contactType,
        phoneNumber,
        "",
        undefined,
        undefined,
        channel.id,
        normalizedUsername,
      );
      partner.addContact(partnerContact);
      await this.partnersRepository.upsert(partner, workspaceId);
    } else if (
      normalizedUsername &&
      partnerContact.username !== normalizedUsername
    ) {
      partnerContact.username = normalizedUsername;
      await this.partnersRepository.upsert(partner, workspaceId);
    }

    if (!isNewPartner && input.contactName) {
      const currentNameIsOnlyDigits = /^\d+$/.test(partner.name);
      if (currentNameIsOnlyDigits && !partner.isNameCustom) {
        console.log(
          "[ProcessInboundMessage] Updating partner name from digits-only:",
          partner.name,
          "to:",
          input.contactName,
        );
        partner.setName(input.contactName);
        await this.partnersRepository.upsert(partner, workspaceId);
      }
    }

    if (isNewPartner) {
      console.log(
        "[ProcessInboundMessage] Created new partner:",
        partner.id,
        "for phone:",
        phoneNumber,
      );

      if (channel.type === "evolution" && partnerContact) {
        this.publishProfilePictureFetch(
          partnerContact.id,
          phoneNumber,
          input.instanceName,
          channel.id,
          workspaceId,
        );
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
        contact.id,
        receivedChannelId,
      );

    let isNewConversation = false;
    let isReopenedConversation = false;

    if (!conversation) {
      const reopenResult = await this.conversationsRepository.reopenAtomically(
        targetChannel.id,
        contact.id,
        workspaceId,
      );

      if (reopenResult.success && reopenResult.conversationId) {
        console.log(
          "[ProcessInboundMessage] Reopening closed conversation atomically:",
          reopenResult.conversationId,
          "for contact:",
          contact.id,
        );
        const reopenedConversation =
          await this.conversationsRepository.retrieve(
            reopenResult.conversationId,
          );
        if (reopenedConversation) {
          conversation = reopenedConversation;
          isReopenedConversation = true;
        }
      }

      if (!conversation) {
        console.log(
          "[ProcessInboundMessage] Creating new conversation for contact:",
          contact.id,
          "on target channel:",
          targetChannel.id,
          receivedChannelId
            ? `received from channel: ${receivedChannelId}`
            : "",
        );
        conversation = Conversation.create(
          contact,
          targetChannel,
          receivedChannelId ? channel : undefined,
        );
        isNewConversation = true;
      }
    }

    await this.conversationsRepository.upsert(conversation, workspaceId);

    const conflictCheck =
      await this.messagesRepository.existsInDifferentConversation(
        input.messageId,
        conversation.id,
      );

    let finalMessageId = input.messageId;
    if (conflictCheck.exists) {
      finalMessageId = `${input.messageId}:${input.instanceName}`;
      console.log(
        "[ProcessInboundMessage] Message exists in different conversation:",
        conflictCheck.existingConversationId,
        "- generating unique ID:",
        finalMessageId,
      );
    }

    if (input.quotedMessageId) {
      console.log(
        "[ProcessInboundMessage] Creating message with quotedMessageId:",
        input.quotedMessageId,
        "for message:",
        finalMessageId,
      );
    }

    const message = Message.create({
      id: finalMessageId,
      type: input.type,
      content: input.content,
      caption: input.caption,
      filename: input.filename,
      mimetype: input.mimetype,
      mediaKey: input.mediaKey,
      sender: contact,
      createdAt: new Date(input.timestamp * 1000),
      quotedMessageId: input.quotedMessageId,
      remoteJid: input.remoteJid,
    });

    message.status = "delivered";

    await this.messagesRepository.upsert(message, conversation.id);

    if (isReopenedConversation) {
      await this.conversationsRepository.ensureWaitingStatus(conversation.id);
    }

    await this.processedMessagesRepository.markProcessed(
      input.messageId,
      input.instanceName,
      "messages.upsert",
    );

    console.log(
      "[ProcessInboundMessage] Message saved:",
      message.id,
      "conversation:",
      conversation.id,
    );

    await this.scheduleFlowTrigger({
      channel: targetChannel,
      conversation,
      message,
      isNewConversation: isNewConversation || isReopenedConversation,
      workspaceId,
    });

    return {
      conversation,
      message,
      workspaceId,
      isNewConversation: isNewConversation || isReopenedConversation,
    };
  }

  private async resolveLidConversation(
    input: OnMessageReceivedProps,
    lidValue: string,
    targetChannel: Channel,
    channel: Channel,
    workspaceId: string,
  ): Promise<ProcessInboundMessageOutput | null> {
    // Step 1: contactName present -> search open/waiting conversations by name
    if (input.contactName) {
      const openConversation =
        await this.conversationsRepository.retrieveOpenByChannelAndPartnerName(
          targetChannel.id,
          input.contactName,
          workspaceId,
        );

      if (openConversation?.contact) {
        console.log(
          "[ProcessInboundMessage] LID resolved via open conversation by name:",
          openConversation.id,
          "contact:",
          openConversation.contact.value,
        );

        await this.storeLidMapping(
          openConversation,
          lidValue,
          channel,
          workspaceId,
        );

        return this.processMessageForExistingConversation(
          input,
          openConversation,
          channel,
          workspaceId,
        );
      }

      // Step 2: contactName present -> search ALL conversations (including closed)
      const anyConversation =
        await this.conversationsRepository.retrieveByChannelAndPartnerName(
          targetChannel.id,
          input.contactName,
          workspaceId,
        );

      if (anyConversation?.contact) {
        console.log(
          "[ProcessInboundMessage] LID resolved via closed conversation by name:",
          anyConversation.id,
          "contact:",
          anyConversation.contact.value,
          "- will reopen",
        );

        await this.storeLidMapping(
          anyConversation,
          lidValue,
          channel,
          workspaceId,
        );

        return this.processMessageForExistingConversation(
          input,
          anyConversation,
          channel,
          workspaceId,
        );
      }
    }

    // Step 3: Search partner by LID value (previous mapping or exact match)
    const contactType = this.resolveContactType(
      input.expectedChannelType,
      channel.type,
    );

    const existingPartner =
      await this.partnersRepository.findPartnerByExactContactValue(
        lidValue,
        workspaceId,
      );

    if (existingPartner) {
      const lidContact = existingPartner.retrieveContactByValue(lidValue);

      if (lidContact) {
        console.log(
          "[ProcessInboundMessage] LID resolved via partner contact mapping:",
          existingPartner.id,
          "contact:",
          lidContact.value,
        );

        const contact = Contact.instance({
          id: lidContact.id,
          name: existingPartner.name,
          thumbnail: lidContact.thumbnail,
          value: lidContact.value,
          username: lidContact.username,
          type: lidContact.type,
        });

        const receivedChannelId =
          channel.id !== targetChannel.id ? channel.id : null;

        let conversation =
          await this.conversationsRepository.retrieveOpenByChannelIdAndContactId(
            targetChannel.id,
            contact.id,
            receivedChannelId,
          );

        if (!conversation) {
          const reopenResult =
            await this.conversationsRepository.reopenAtomically(
              targetChannel.id,
              contact.id,
              workspaceId,
            );

          if (reopenResult.success && reopenResult.conversationId) {
            conversation = await this.conversationsRepository.retrieve(
              reopenResult.conversationId,
            );
          }
        }

        if (conversation) {
          return this.processMessageForExistingConversation(
            input,
            conversation,
            channel,
            workspaceId,
          );
        }
      }
    }

    return null;
  }

  private async storeLidMapping(
    conversation: Conversation,
    lidValue: string,
    channel: Channel,
    workspaceId: string,
  ): Promise<void> {
    if (!conversation.contact) return;

    const contactType = this.resolveContactType(undefined, channel.type);

    try {
      const partner =
        await this.partnersRepository.findPartnerByExactContactValue(
          conversation.contact.value,
          workspaceId,
        );

      if (!partner) return;

      await this.partnersRepository.addContactIfNotExists(partner.id, {
        type: contactType,
        value: lidValue,
        channelId: channel.id,
      });

      console.log(
        "[ProcessInboundMessage] Stored LID mapping:",
        lidValue,
        "-> partner:",
        partner.id,
      );
    } catch (error) {
      console.warn(
        "[ProcessInboundMessage] Failed to store LID mapping (non-critical):",
        lidValue,
        error,
      );
    }
  }

  private async processMessageForExistingConversation(
    input: OnMessageReceivedProps,
    conversation: Conversation,
    channel: Channel,
    workspaceId: string,
  ): Promise<ProcessInboundMessageOutput | null> {
    const contact = conversation.contact;
    if (!contact) {
      const error = new Error(
        `[ProcessInboundMessage] Existing conversation has no contact: ${conversation.id}`,
      );
      (error as Error & { code?: string }).code =
        "INBOUND_CONVERSATION_CONTACT_MISSING";
      throw error;
    }

    const conflictCheck =
      await this.messagesRepository.existsInDifferentConversation(
        input.messageId,
        conversation.id,
      );

    let finalMessageId = input.messageId;
    if (conflictCheck.exists) {
      finalMessageId = `${input.messageId}:${input.instanceName}`;
      console.log(
        "[ProcessInboundMessage] LID message exists in different conversation:",
        conflictCheck.existingConversationId,
        "- generating unique ID:",
        finalMessageId,
      );
    }

    if (input.quotedMessageId) {
      console.log(
        "[ProcessInboundMessage] Creating LID message with quotedMessageId:",
        input.quotedMessageId,
        "for message:",
        finalMessageId,
      );
    }

    const message = Message.create({
      id: finalMessageId,
      type: input.type,
      content: input.content,
      caption: input.caption,
      filename: input.filename,
      mimetype: input.mimetype,
      mediaKey: input.mediaKey,
      sender: contact,
      createdAt: new Date(input.timestamp * 1000),
      quotedMessageId: input.quotedMessageId,
      remoteJid: input.remoteJid,
    });

    message.status = "delivered";

    await this.messagesRepository.upsert(message, conversation.id);

    await this.processedMessagesRepository.markProcessed(
      input.messageId,
      input.instanceName,
      "messages.upsert",
    );

    console.log(
      "[ProcessInboundMessage] LID message saved to existing conversation:",
      message.id,
      "conversation:",
      conversation.id,
      "contact:",
      contact.value,
    );

    if (conversation.channel) {
      await this.scheduleFlowTrigger({
        channel,
        conversation,
        message,
        isNewConversation: false,
        workspaceId,
      });
    }

    return {
      conversation,
      message,
      workspaceId,
      isNewConversation: false,
    };
  }

  private async processGroupMessage(
    input: OnMessageReceivedProps,
    channel: Channel,
    targetChannel: Channel,
    workspaceId: string,
  ): Promise<ProcessInboundMessageOutput | null> {
    const groupJid = input.groupJid ?? input.remoteJid;
    const groupName =
      input.groupName && !input.groupName.endsWith("@g.us")
        ? input.groupName
        : null;
    const participantJid = input.participantJid;
    const participantName = input.participantName ?? input.contactName;

    console.log(
      "[ProcessInboundMessage] Processing GROUP message:",
      "groupJid:",
      groupJid,
      "groupName:",
      groupName,
      "participantJid:",
      participantJid,
      "messageId:",
      input.messageId,
    );

    const receivedChannelId =
      channel.id !== targetChannel.id ? channel.id : null;

    let conversation =
      await this.conversationsRepository.retrieveOpenByGroupJid(
        targetChannel.id,
        groupJid,
      );

    let isNewConversation = false;

    if (!conversation) {
      console.log(
        "[ProcessInboundMessage] Creating new GROUP conversation:",
        groupName,
        "groupJid:",
        groupJid,
      );
      conversation = Conversation.createFromWhatsAppGroup(
        groupJid,
        groupName,
        targetChannel,
        receivedChannelId ? channel : undefined,
      );
      isNewConversation = true;
    }

    let groupNameChanged = false;

    if (conversation && !isNewConversation && groupName) {
      const nameHasChanged = conversation.name !== groupName;

      if (nameHasChanged) {
        console.log(
          "[ProcessInboundMessage] Updating GROUP name:",
          conversation.name,
          "to:",
          groupName,
        );
        conversation.name = groupName;
        groupNameChanged = true;
      }
    }

    let senderContact: Contact;

    if (participantJid) {
      const participantPhone = this.extractPhoneNumber(participantJid);

      const { partner: senderPartner, isNew: isNewParticipant } =
        await this.partnersRepository.createPartnerWithContactAtomic(
          { name: participantName ?? participantPhone },
          {
            type: "whatsapp",
            value: participantPhone,
            thumbnail: "",
            channelId: channel.id,
            username: "",
          },
          workspaceId,
        );

      const partnerContact =
        senderPartner.retrieveContactByValue(participantPhone);

      if (isNewParticipant && channel.type === "evolution" && partnerContact) {
        this.publishProfilePictureFetch(
          partnerContact.id,
          participantPhone,
          input.instanceName,
          channel.id,
          workspaceId,
        );
      }

      senderContact = Contact.instance({
        id: partnerContact?.id ?? crypto.randomUUID(),
        name: senderPartner.name,
        thumbnail: partnerContact?.thumbnail ?? "",
        value: participantPhone,
        username: partnerContact?.username ?? "",
        type: "whatsapp",
      });
    } else {
      senderContact = Contact.instance({
        id: crypto.randomUUID(),
        name: participantName ?? "Participante",
        thumbnail: "",
        value: "",
        username: "",
        type: "whatsapp",
      });
    }

    await this.conversationsRepository.upsert(conversation, workspaceId);

    const conflictCheck =
      await this.messagesRepository.existsInDifferentConversation(
        input.messageId,
        conversation.id,
      );

    let finalMessageId = input.messageId;
    if (conflictCheck.exists) {
      finalMessageId = `${input.messageId}:${input.instanceName}`;
      console.log(
        "[ProcessInboundMessage] GROUP message exists in different conversation:",
        conflictCheck.existingConversationId,
        "- generating unique ID:",
        finalMessageId,
      );
    }

    if (input.quotedMessageId) {
      console.log(
        "[ProcessInboundMessage] Creating GROUP message with quotedMessageId:",
        input.quotedMessageId,
        "for message:",
        finalMessageId,
      );
    }

    const message = Message.create({
      id: finalMessageId,
      type: input.type,
      content: input.content,
      caption: input.caption,
      filename: input.filename,
      mimetype: input.mimetype,
      mediaKey: input.mediaKey,
      sender: senderContact,
      createdAt: new Date(input.timestamp * 1000),
      quotedMessageId: input.quotedMessageId,
      remoteJid: input.remoteJid,
    });

    message.status = "delivered";

    await this.messagesRepository.upsert(message, conversation.id);

    await this.processedMessagesRepository.markProcessed(
      input.messageId,
      input.instanceName,
      "messages.upsert",
    );

    console.log(
      "[ProcessInboundMessage] GROUP message saved:",
      message.id,
      "conversation:",
      conversation.id,
      "group:",
      groupName,
      input.quotedMessageId ? `(reply to: ${input.quotedMessageId})` : "",
    );

    return {
      conversation,
      message,
      workspaceId,
      isNewConversation,
      groupNameChanged,
    };
  }

  private async scheduleFlowTrigger(data: FlowTriggerData): Promise<void> {
    const key = data.conversation.id;

    // Se nao tem fluxo ativo, processa imediatamente (nova conversa ou fluxo ainda nao iniciou)
    if (!data.conversation.activeFlowExecutionId) {
      await this.processFlowTrigger(
        data.channel,
        data.conversation,
        data.message,
        data.isNewConversation,
        data.workspaceId,
      );
      return;
    }

    // Cancela trigger pendente para esta conversa (substitui pela mensagem mais recente)
    const existing = ProcessInboundMessage.flowTriggerBuffer.get(key);
    if (existing) {
      clearTimeout(existing.timeout);
      console.log(
        `[ProcessInboundMessage] Debounce: substituindo trigger pendente para conversa ${key}, ` +
          `mensagem anterior: ${existing.data.message.type}, nova: ${data.message.type}`,
      );
    }

    console.log(
      `[ProcessInboundMessage] Debounce: enfileirando trigger para conversa ${key}, ` +
        `tipo: ${data.message.type}, aguardando ${ProcessInboundMessage.FLOW_DEBOUNCE_MS}ms`,
    );

    // Agenda novo trigger com debounce
    const timeout = setTimeout(async () => {
      const pending = ProcessInboundMessage.flowTriggerBuffer.get(key);
      if (pending) {
        ProcessInboundMessage.flowTriggerBuffer.delete(key);
        const elapsed = Date.now() - pending.receivedAt;

        // Recarrega conversa para ter estado atualizado (pode ter mudado durante o debounce)
        const currentConversation =
          await pending.instance.conversationsRepository.retrieve(
            pending.data.conversation.id,
          );

        if (!currentConversation) {
          console.log(
            `[ProcessInboundMessage] Debounce: conversa ${key} nao encontrada apos ${elapsed}ms, cancelando trigger`,
          );
          return;
        }

        // Verifica se conversa ainda e valida para trigger
        if (currentConversation.status === "closed") {
          console.log(
            `[ProcessInboundMessage] Debounce: conversa ${key} foi fechada durante debounce, cancelando trigger`,
          );
          return;
        }

        console.log(
          `[ProcessInboundMessage] Debounce: executando trigger apos ${elapsed}ms para conversa ${key}, ` +
            `tipo: ${pending.data.message.type}`,
        );

        try {
          await pending.instance.processFlowTrigger(
            pending.data.channel,
            currentConversation,
            pending.data.message,
            pending.data.isNewConversation,
            pending.data.workspaceId,
          );
        } catch (error) {
          console.error(
            `[ProcessInboundMessage] Debounce: erro ao executar trigger para conversa ${key}:`,
            error,
          );
        }
      }
    }, ProcessInboundMessage.FLOW_DEBOUNCE_MS);

    ProcessInboundMessage.flowTriggerBuffer.set(key, {
      data,
      timeout,
      receivedAt: Date.now(),
      instance: this,
    });
  }

  private async processFlowTrigger(
    channel: Channel,
    conversation: Conversation,
    message: Message,
    isNewConversation: boolean,
    workspaceId: string,
  ): Promise<void> {
    try {
      console.log("[ProcessInboundMessage] processFlowTrigger:", {
        channelId: channel.id,
        conversationId: conversation.id,
        isNewConversation,
        hasActiveFlow: !!conversation.activeFlowExecutionId,
      });

      const pausedExecution =
        await this.flowExecutionsRepository.retrievePausedByConversation(
          conversation.id,
        );

      if (conversation.attendant) {
        console.log(
          "[ProcessInboundMessage] Conversation has attendant, skipping flow automation:",
          conversation.id,
        );
        return;
      }

      if (pausedExecution) {
        // Check if flow is paused at an interval node - if so, let RabbitMQ handle the resume
        // This prevents race condition where both user message and RabbitMQ try to resume
        // We check currentNodeId instead of _intervalResumeAt_ variable because the variable
        // is deleted by IntervalNodeHandler when the interval expires, causing a race condition
        if (pausedExecution.currentNodeId?.startsWith("interval-")) {
          console.log(
            `[ProcessInboundMessage] Flow ${pausedExecution.id} is paused at interval node ${pausedExecution.currentNodeId}, letting RabbitMQ handle resume to prevent race condition`,
          );
          return;
        }

        console.log(
          "[ProcessInboundMessage] Resuming paused flow execution:",
          pausedExecution.id,
        );

        const executor = FlowExecutorDriver.instance();
        await executor.resumeFlow({
          execution: pausedExecution,
          conversation,
          channel,
          workspaceId,
          userMessage: message.content,
        });
        const latestConversation = await this.conversationsRepository.retrieve(
          conversation.id,
        );

        if (latestConversation?.attendant) {
          console.log(
            "[ProcessInboundMessage] Conversation attended while resuming flow, skipping stale flow state persistence:",
            conversation.id,
          );
          return;
        }

        await this.conversationsRepository.upsert(conversation, workspaceId);
        return;
      }

      if (conversation.activeFlowExecutionId) {
        console.log(
          "[ProcessInboundMessage] Conversation already has active flow, skipping:",
          conversation.activeFlowExecutionId,
        );
        return;
      }

      // Check if flow was already completed (End node was reached)
      if (conversation.flowCompletedAt) {
        console.log(
          "[ProcessInboundMessage] Flow was already completed at:",
          conversation.flowCompletedAt,
          "- skipping new flow execution",
        );
        return;
      }

      const activeFlow =
        await this.flowsInChannelsRepository.findActiveFlowForChannel(
          channel.id,
        );

      if (!activeFlow) {
        console.log(
          "[ProcessInboundMessage] No active flow found for channel:",
          channel.id,
        );
        return;
      }

      const startNode = activeFlow.nodes.find((n) => n.type === "start");
      if (startNode) {
        const startData = startNode.data as { triggerOnStatuses?: string[] };
        const allowedStatuses = startData.triggerOnStatuses;

        // Se triggerOnStatuses está definido e tem valores, verifica o status
        // Se não está definido ou está vazio, dispara para qualquer status
        // Grupos WhatsApp (status null) não disparam fluxos baseados em status
        if (allowedStatuses && allowedStatuses.length > 0) {
          if (
            !conversation.status ||
            !allowedStatuses.includes(conversation.status)
          ) {
            console.log(
              "[ProcessInboundMessage] Conversation status not allowed for flow:",
              {
                conversationStatus: conversation.status,
                allowedStatuses,
                flowId: activeFlow.id,
              },
            );
            return;
          }
        }
      }

      const flowSectorIds =
        await this.flowsInSectorsRepository.listSectorIdsForFlow(activeFlow.id);
      if (flowSectorIds.length > 0) {
        const conversationSectorId = conversation.sector?.id;
        const allowWithoutSector =
          (startNode?.data as { allowConversationsWithoutSector?: boolean })
            ?.allowConversationsWithoutSector ?? false;

        if (!conversationSectorId) {
          if (!allowWithoutSector) {
            console.log(
              "[ProcessInboundMessage] Conversation without sector blocked:",
              { flowId: activeFlow.id, allowConversationsWithoutSector: false },
            );
            return;
          }
          console.log(
            "[ProcessInboundMessage] Conversation without sector ALLOWED:",
            { flowId: activeFlow.id },
          );
        } else {
          if (!flowSectorIds.includes(conversationSectorId)) {
            console.log(
              "[ProcessInboundMessage] Conversation sector not allowed for flow:",
              {
                conversationSectorId,
                allowedSectorIds: flowSectorIds,
                flowId: activeFlow.id,
              },
            );
            return;
          }
        }
      }

      console.log(
        "[ProcessInboundMessage] Starting flow:",
        activeFlow.id,
        "for conversation:",
        conversation.id,
      );

      const executor = FlowExecutorDriver.instance();
      await executor.executeFlow({
        flowId: activeFlow.id,
        conversation,
        channel,
        workspaceId,
        userMessage: message.content,
      });
      const latestConversation = await this.conversationsRepository.retrieve(
        conversation.id,
      );

      if (latestConversation?.attendant) {
        console.log(
          "[ProcessInboundMessage] Conversation attended while executing flow, skipping stale flow state persistence:",
          conversation.id,
        );
        return;
      }

      // Salvar estado final da conversa (activeFlowExecutionId pode ter sido limpo se fluxo terminou)
      await this.conversationsRepository.upsert(conversation, workspaceId);
    } catch (error) {
      console.error("[ProcessInboundMessage] Flow trigger error:", error);
    }
  }

  private publishProfilePictureFetch(
    contactId: string,
    phoneNumber: string,
    instanceName: string,
    channelId: string,
    workspaceId: string,
  ): void {
    const publisher = ProfilePicturePublisher.instance();
    publisher
      .publishFetchRequest({
        contactId,
        phoneNumber,
        instanceName,
        channelId,
        workspaceId,
      })
      .catch((error) => {
        console.error(
          "[ProcessInboundMessage] Failed to publish profile picture fetch:",
          error,
        );
      });
  }

  static instance(): ProcessInboundMessage {
    return new ProcessInboundMessage(
      ChannelsDatabaseRepository.instance(),
      PartnersDatabaseRepository.instance(),
      ConversationsDatabaseRepository.instance(),
      MessagesDatabaseRepository.instance(),
      ProcessedMessagesDatabaseRepository.instance(),
      FlowsInChannelsDatabaseRepository.instance(),
      FlowExecutionsDatabaseRepository.instance(),
      FlowsInSectorsDatabaseRepository.instance(),
    );
  }
}
