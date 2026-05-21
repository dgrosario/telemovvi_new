import { Partner } from "../../domain/entities/partner";
import { Channel } from "../../domain/entities/channel";
import { ChannelsDatabaseRepository } from "../../infra/repositories/channels-repository";
import { PartnersDatabaseRepository } from "../../infra/repositories/partners-repository";
import { OnContactUpsertProps } from "../../infra/controllers/evolution-event-handler";

interface ChannelsRepository {
  retrieveByTypeAndPayload(
    type: Channel.Type,
    payload: Record<string, unknown>
  ): Promise<{ channel: Channel; workspaceId: string } | null>;
}

interface PartnersRepository {
  retrieveByContactTypeAndValue(
    type: string,
    value: string,
    workspaceId: string
  ): Promise<Partner | null>;
  upsert(partner: Partner, workspaceId: string): Promise<void>;
}

export type UpdateContactOutput = {
  partner: Partner;
  workspaceId: string;
  isNew: boolean;
} | null;

export class UpdateContact {
  constructor(
    private readonly channelsRepository: ChannelsRepository,
    private readonly partnersRepository: PartnersRepository
  ) {}

  private extractPhoneNumber(remoteJid: string): string {
    return remoteJid.replace("@s.whatsapp.net", "").replace("@g.us", "");
  }

  async execute(input: OnContactUpsertProps): Promise<UpdateContactOutput> {
    console.log(
      "[UpdateContact] Updating contact:",
      input.contactId,
      "name:",
      input.contactName
    );

    const channelResult = await this.channelsRepository.retrieveByTypeAndPayload(
      "evolution",
      { instanceName: input.instanceName }
    );

    if (!channelResult) {
      console.log(
        "[UpdateContact] Channel not found for instance:",
        input.instanceName
      );
      return null;
    }

    const { workspaceId } = channelResult;
    const phoneNumber = this.extractPhoneNumber(input.contactId);

    let partner = await this.partnersRepository.retrieveByContactTypeAndValue(
      "evolution",
      phoneNumber,
      workspaceId
    );

    let isNew = false;

    if (!partner) {
      console.log(
        "[UpdateContact] Partner not found for phone:",
        phoneNumber,
        "- skipping (will be created on first message)"
      );
      return null;
    }

    const incomingName = input.contactName.trim();
    const incomingNameHasLetters = /\p{L}/u.test(incomingName);
    const currentNameIsOnlyDigits = /^\d+$/.test(partner.name);
    const canAutoUpdateName =
      incomingName.length > 0 &&
      (incomingNameHasLetters || currentNameIsOnlyDigits);
    const nameChanged =
      !partner.isNameCustom &&
      canAutoUpdateName &&
      partner.name !== incomingName;
    const thumbnailChanged = input.contactThumbnail &&
      partner.contacts.some((c) => c.thumbnail !== input.contactThumbnail);

    const hasChanges = nameChanged || thumbnailChanged;

    if (hasChanges) {
      if (nameChanged) {
        partner.setName(incomingName);
      }

      if (input.contactThumbnail) {
        const contact = partner.retrieveContactByValue(phoneNumber);
        if (contact) {
          contact.thumbnail = input.contactThumbnail;
        }
      }

      await this.partnersRepository.upsert(partner, workspaceId);
      console.log("[UpdateContact] Partner updated:", partner.id);
    }

    return { partner, workspaceId, isNew };
  }

  static instance(): UpdateContact {
    return new UpdateContact(
      ChannelsDatabaseRepository.instance(),
      PartnersDatabaseRepository.instance()
    );
  }
}
