import { Contact } from "../../domain/entities/contact";
import { Conversation } from "../../domain/entities/conversation";
import { Partner } from "../../domain/entities/partner";
import { User } from "../../domain/entities/user";
import { Message } from "../../domain/entities/message";
import { Attendant } from "../../domain/entities/attendant";
import { Sector } from "../../domain/entities/sector";
import { NotFound } from "../../domain/errors/not-found";
import { RabbitMQMessagingDriver } from "../../infra/drivers/messaging-driver";
import { ChannelsDatabaseRepository } from "../../infra/repositories/channels-repository";
import { ConversationsDatabaseRepository } from "../../infra/repositories/conversations-repository";
import { PartnersDatabaseRepository } from "../../infra/repositories/partners-repository";
import { UsersDatabaseRepository } from "../../infra/repositories/users-repository";
import { MessagesDatabaseRepository } from "../../infra/repositories/messages-repository";
import { SectorsDatabaseRepository } from "../../infra/repositories/sectors-respository";
import { Channel, getPayloadProperty } from "./../../domain/entities/channel";
import { PhoneNormalizer } from "../../domain/services/phone-normalizer";

interface ConversationsRepository {
  retrieve(id: string): Promise<Conversation | null>;
  upsert(conversation: Conversation, workspaceId: string): Promise<void>;
  retrieveOpenByChannelIdAndContactId(
    channelId: string,
    contactId: string
  ): Promise<Conversation | null>;
  retrieveLatestByChannelIdAndContactId(
    channelId: string,
    contactId: string
  ): Promise<Conversation | null>;
  reopenAtomically(
    channelId: string,
    contactId: string,
    workspaceId: string
  ): Promise<{ success: boolean; conversationId: string | null }>;
}

interface ChannelsRepository {
  retrieve(id: string, workspaceId: string): Promise<Channel | null>;
}

interface UsersRepository {
  retrieve(userId: string): Promise<User | null>;
}

interface PartnersRepository {
  retrieve(partnerId: string): Promise<Partner | null>;
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

interface MessagesRepository {
  upsert(message: Message, conversationId?: string): Promise<void>;
}

interface SectorsRepository {
  retrieve(sectorId?: string): Promise<Sector | null>;
}

export class CreateConversation {
  constructor(
    private readonly channelsRepository: ChannelsRepository,
    private readonly partnersRepository: PartnersRepository,
    private readonly usersRepository: UsersRepository,
    private readonly conversationsRepository: ConversationsRepository,
    private readonly messagingDriver: MessagingDriver,
    private readonly messagesRepository: MessagesRepository,
    private readonly sectorsRepository: SectorsRepository
  ) {}

  async execute(input: InputDTO): Promise<string> {
    const user = await this.usersRepository.retrieve(input.userId);
    if (!user) throw NotFound.throw("Usuário");

    const partner = await this.partnersRepository.retrieve(input.partnerId);
    if (!partner) throw NotFound.throw("Cliente");

    const channel = await this.channelsRepository.retrieve(
      input.channelId,
      input.workspaceId
    );

    if (!channel) throw NotFound.throw("Canal");

    if (channel.type === "instagram") {
      throw new Error(
        "Não é possível iniciar conversas pelo Instagram. O contato precisa enviar a primeira mensagem."
      );
    }

    const hasWabaId = !!getPayloadProperty(channel.payload, "wabaId");
    const isOfficialWhatsAppChannel =
      channel.type === "whatsapp" && hasWabaId;

    if (isOfficialWhatsAppChannel && !input.templateName)
      throw new Error(
        "O atendimento via whatsapp só pode ser aberto com um template"
      );

    let sector: Sector | null = null;
    if (input.sectorId) {
      sector = await this.sectorsRepository.retrieve(input.sectorId);
      if (!sector) throw NotFound.throw("Setor");
    }

    const contact = Contact.fromPartner(partner, input.contactId);
    const isDialableContactType =
      contact.type === "whatsapp" ||
      contact.type === "evolution" ||
      contact.type === "meta_api";

    if (!isDialableContactType || !PhoneNormalizer.isValidPhoneNumber(contact.value)) {
      throw new Error(
        "Não é possível iniciar conversa com este contato. Selecione um número de telefone válido."
      );
    }

    let conversation =
      await this.conversationsRepository.retrieveOpenByChannelIdAndContactId(
        channel.id,
        contact.id
      );

    if (conversation) {
      if (!conversation.attendant || conversation.attendant.id !== user.id) {
        conversation.assign(user, sector ?? undefined);
      } else if (sector && !conversation.sector) {
        conversation.assign(user, sector);
      }
    } else {
      const reopenResult = await this.conversationsRepository.reopenAtomically(
        channel.id,
        contact.id,
        input.workspaceId
      );

      if (reopenResult.success && reopenResult.conversationId) {
        const reopenedConversation = await this.conversationsRepository.retrieve(
          reopenResult.conversationId
        );
        if (reopenedConversation) {
          reopenedConversation.assign(user, sector ?? undefined);
          conversation = reopenedConversation;
        }
      }

      if (!conversation) {
        conversation = Conversation.create(contact, channel);
        conversation.assign(user, sector ?? undefined);
      }
    }

    if (input.templateName) {
      const OUTBOUND_QUEUE = process.env.OUTBOUND_QUEUE || "outbound-messages";

      await this.messagingDriver.sendMessageToQueue({
        queueUrl: OUTBOUND_QUEUE,
        body: {
          content: input.templateName,
          conversationId: conversation.id,
          channelId: input.channelId,
          workspaceId: input.workspaceId,
          createdAt: new Date(),
          sender: conversation.attendant,
          type: "template",
          templateName: input.templateName,
          templateLanguage: input.templateLanguage,
          language: input.templateLanguage,
          variables: input.templateVariables ?? [],
          to: contact.value,
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
        },
        groupId: input.workspaceId,
        messageId: crypto.randomUUID(),
      });

      await this.conversationsRepository.upsert(conversation, input.workspaceId);
      return conversation.id;
    }

    await this.conversationsRepository.upsert(conversation, input.workspaceId);
    
    // Criar mensagem interna de início de conversa
    const internalMessage = Message.create({
      id: crypto.randomUUID(),
      content: `Conversa iniciada por ${user.name}`,
      type: "text",
      sender: Attendant.create({ id: user.id, name: user.name }),
      internal: true,
    });
    internalMessage.markAsSent();

    await this.messagesRepository.upsert(internalMessage, conversation.id);
    
    return conversation.id;
  }

  static instance() {
    return new CreateConversation(
      ChannelsDatabaseRepository.instance(),
      PartnersDatabaseRepository.instance(),
      UsersDatabaseRepository.instance(),
      ConversationsDatabaseRepository.instance(),
      RabbitMQMessagingDriver.instance(),
      MessagesDatabaseRepository.instance(),
      SectorsDatabaseRepository.instance()
    );
  }
}

type InputDTO = {
  channelId: string;
  userId: string;
  workspaceId: string;
  partnerId: string;
  contactId: string;
  templateName?: string;
  templateLanguage?: string;
  templateVariables?: Array<{ name: string; value: string }>;
  sectorId?: string;
};
