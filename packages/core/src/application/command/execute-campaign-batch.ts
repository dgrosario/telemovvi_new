import { Campaign } from "../../domain/entities/campaign";
import { CampaignMessage } from "../../domain/entities/campaign-message";
import { Channel, getPayloadProperty } from "../../domain/entities/channel";
import { NotFound } from "../../domain/errors/not-found";
import { createResolverVariable } from "../../domain/value-objects/variable";
import { RabbitMQMessagingDriver } from "../../infra/drivers/messaging-driver";
import {
  CampaignRecipientsDatabaseRepository,
  RecipientUpdateData,
  RecipientWithContact,
} from "../../infra/repositories/campaign-recipients-repository";
import { CampaignsDatabaseRepository } from "../../infra/repositories/campaigns-repository";
import { CampaignMessagesDatabaseRepository } from "../../infra/repositories/campaign-messages-repository";
import { ChannelsDatabaseRepository } from "../../infra/repositories/channels-repository";
import { PartnersDatabaseRepository } from "../../infra/repositories/partners-repository";

const OUTBOUND_QUEUE = process.env.OUTBOUND_QUEUE || "outbound-messages";
const BATCH_SIZE = 50;

interface CampaignsRepository {
  retrieve(id: string): Promise<Campaign | null>;
  update(campaign: Campaign): Promise<void>;
  incrementCounters(id: string, sentDelta: number, failedDelta: number): Promise<void>;
}

interface CampaignRecipientsRepository {
  findPendingByCampaign(
    campaignId: string,
    limit: number
  ): Promise<RecipientWithContact[]>;
  updateBatch(recipients: RecipientUpdateData[]): Promise<void>;
  hasPendingByCampaign(campaignId: string): Promise<boolean>;
}

interface CampaignMessagesRepository {
  incrementSentCount(id: string): Promise<void>;
}

interface ChannelsRepository {
  retrieve(id: string, workspaceId: string): Promise<Channel | null>;
}

interface PartnersRepository {
  retrieveMany(
    ids: string[]
  ): Promise<Map<string, { name: string }>>;
}

type SendMessageToQueueProps = {
  queueUrl: string;
  body: object;
  groupId: string;
  messageId: string;
};

interface MessagingDriver {
  sendMessageToQueue(data: SendMessageToQueueProps): Promise<boolean>;
}

interface InputDTO {
  campaignId: string;
}

interface OutputDTO {
  processed: number;
  sent: number;
  failed: number;
  hasMore: boolean;
  completed: boolean;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class ExecuteCampaignBatch {
  constructor(
    private readonly campaignsRepository: CampaignsRepository,
    private readonly recipientsRepository: CampaignRecipientsRepository,
    private readonly messagesRepository: CampaignMessagesRepository,
    private readonly channelsRepository: ChannelsRepository,
    private readonly partnersRepository: PartnersRepository,
    private readonly messagingDriver: MessagingDriver
  ) {}

  async execute(input: InputDTO): Promise<OutputDTO> {
    const campaign = await this.campaignsRepository.retrieve(input.campaignId);

    if (!campaign) {
      throw NotFound.throw("Campaign");
    }

    if (campaign.status !== "running") {
      return {
        processed: 0,
        sent: 0,
        failed: 0,
        hasMore: false,
        completed: campaign.status === "completed",
      };
    }

    const channel = await this.channelsRepository.retrieve(
      campaign.channelId,
      campaign.workspaceId
    );

    if (!channel) {
      campaign.fail();
      await this.campaignsRepository.update(campaign);
      throw NotFound.throw("Channel");
    }

    const pendingRecipients = await this.recipientsRepository.findPendingByCampaign(
      campaign.id,
      BATCH_SIZE
    );

    if (pendingRecipients.length === 0) {
      campaign.complete();
      await this.campaignsRepository.update(campaign);
      return {
        processed: 0,
        sent: 0,
        failed: 0,
        hasMore: false,
        completed: true,
      };
    }

    let sentCount = 0;
    let failedCount = 0;
    const updatedRecipients: RecipientUpdateData[] = [];

    for (const recipientData of pendingRecipients) {
      const { recipient, partnerName, contactValue } = recipientData;

      try {
        const selectedMessage = campaign.getRandomMessage();

        const resolvedContent = this.resolveMessageContent(
          selectedMessage,
          partnerName
        );

        const messagePayload = this.buildMessagePayload(
          campaign,
          channel,
          selectedMessage,
          resolvedContent,
          contactValue,
          recipient.id,
          partnerName
        );

        const sent = await this.messagingDriver.sendMessageToQueue({
          queueUrl: OUTBOUND_QUEUE,
          body: messagePayload,
          groupId: campaign.id,
          messageId: crypto.randomUUID(),
        });

        if (!sent) {
          throw new Error("Failed to enqueue message - queue buffer full");
        }

        updatedRecipients.push({
          id: recipient.id,
          messageId: selectedMessage.id,
          status: "sent",
          externalMessageId: null,
          errorMessage: null,
          sentAt: new Date(),
        });

        await this.messagesRepository.incrementSentCount(selectedMessage.id);
        sentCount++;

        await delay(campaign.getRandomIntervalMs());
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        updatedRecipients.push({
          id: recipient.id,
          messageId: null,
          status: "failed",
          externalMessageId: null,
          errorMessage,
          sentAt: new Date(),
        });

        failedCount++;
      }
    }

    await this.recipientsRepository.updateBatch(updatedRecipients);

    await this.campaignsRepository.incrementCounters(
      campaign.id,
      sentCount,
      failedCount
    );

    const hasMore = await this.recipientsRepository.hasPendingByCampaign(campaign.id);

    if (!hasMore) {
      const updatedCampaign = await this.campaignsRepository.retrieve(campaign.id);
      if (updatedCampaign) {
        updatedCampaign.complete();
        await this.campaignsRepository.update(updatedCampaign);
      }
    }

    return {
      processed: pendingRecipients.length,
      sent: sentCount,
      failed: failedCount,
      hasMore,
      completed: !hasMore,
    };
  }

  private resolveMessageContent(
    message: CampaignMessage,
    partnerName: string
  ): string {
    if (!message.content) return "";

    const resolver = createResolverVariable({
      contact: {
        name: partnerName,
      },
    });

    return resolver(message.content);
  }

  private buildMessagePayload(
    campaign: Campaign,
    channel: Channel,
    message: CampaignMessage,
    resolvedContent: string,
    destination: string,
    recipientId: string,
    partnerName: string
  ): object {
    return {
      content: resolvedContent,
      conversationId: `campaign:${campaign.id}`,
      channelId: campaign.channelId,
      workspaceId: campaign.workspaceId,
      createdAt: new Date().toISOString(),
      sender: {
        id: "campaign-system",
        name: campaign.name,
      },
      type: message.type,
      variables: message.variables,
      templateName: message.templateName,
      correlationId: `campaign:${campaign.id}:${recipientId}`,
      quotedMessageId: null,
      to: destination,
      isGroup: false,
      isCampaignMessage: true,
      campaignId: campaign.id,
      campaignRecipientId: recipientId,
      recipientName: partnerName,
      channel: {
        id: channel.id,
        type: channel.type,
        payload: {
          phoneNumberId: getPayloadProperty(channel.payload, "phoneId"),
          pageId: getPayloadProperty(channel.payload, "pageId"),
          accessToken: getPayloadProperty(channel.payload, "accessToken"),
          instanceName: getPayloadProperty(channel.payload, "instanceName"),
        },
      },
    };
  }

  static instance(): ExecuteCampaignBatch {
    return new ExecuteCampaignBatch(
      CampaignsDatabaseRepository.instance(),
      CampaignRecipientsDatabaseRepository.instance(),
      CampaignMessagesDatabaseRepository.instance(),
      ChannelsDatabaseRepository.instance(),
      PartnersDatabaseRepository.instance(),
      RabbitMQMessagingDriver.instance()
    );
  }
}
