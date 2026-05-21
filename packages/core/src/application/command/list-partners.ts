import { Channel } from "../../domain/entities/channel";
import { Membership } from "../../domain/entities/membership";
import { ChannelsDatabaseRepository } from "../../infra/repositories/channels-repository";
import { ListMyChannels } from "./list-my-channels";
import {
  PartnersDatabaseRepository,
  ListInputDTO as RepositoryListInputDTO,
  ListOutputDTO,
} from "../../infra/repositories/partners-repository";

const CHANNEL_TYPE_TO_CONTACT_TYPE: Record<Channel.Type, Channel.Type[]> = {
  evolution: ["whatsapp", "evolution"],
  meta_api: ["whatsapp", "instagram"],
  whatsapp: ["whatsapp"],
  instagram: ["instagram"],
};

function mapChannelTypesToContactTypes(
  channelTypes: Channel.Type[]
): Channel.Type[] {
  const contactTypes = new Set<Channel.Type>();
  for (const channelType of channelTypes) {
    const mapped = CHANNEL_TYPE_TO_CONTACT_TYPE[channelType];
    if (mapped) {
      for (const ct of mapped) {
        contactTypes.add(ct);
      }
    }
  }
  return Array.from(contactTypes);
}

interface PartnersRepository {
  list(input: RepositoryListInputDTO): Promise<ListOutputDTO>;
}

interface ChannelsRepository {
  list(workspaceId: string): Promise<Channel.Raw[]>;
}

export class ListPartners {
  constructor(
    private readonly partnersRepository: PartnersRepository,
    private readonly channelsRepository: ChannelsRepository
  ) {}

  async execute(input: InputDTO): Promise<ListOutputDTO> {
    const { id, workspaceId, membership, pageIndex, channelFilters, query } =
      input;

    const allChannels = await this.channelsRepository.list(workspaceId);
    const channelIdToType = new Map<string, Channel.Type>(
      allChannels.map((c) => [c.id, c.type])
    );

    const listMyChannels = ListMyChannels.instance();
    const allowedChannelIds = await listMyChannels.execute({
      id,
      workspaceId,
      membership,
    });

    let channelTypes: Channel.Type[];

    if (membership.hasPermission("list:all-channels")) {
      if (channelFilters.length > 0) {
        const types = channelFilters
          .map((cid) => channelIdToType.get(cid))
          .filter((t): t is Channel.Type => t !== undefined);
        channelTypes = [...new Set(types)];
      } else {
        channelTypes = [];
      }
    } else if (allowedChannelIds.length === 0) {
      channelTypes = [];
    } else {
      const permittedIds =
        channelFilters.length === 0
          ? allowedChannelIds
          : channelFilters.filter((cid) => allowedChannelIds.includes(cid));

      const types = permittedIds
        .map((cid) => channelIdToType.get(cid))
        .filter((t): t is Channel.Type => t !== undefined);
      channelTypes = [...new Set(types)];
    }

    const contactTypes = mapChannelTypesToContactTypes(channelTypes);

    return this.partnersRepository.list({
      workspaceId,
      pageIndex,
      channelFilters: contactTypes.length > 0 ? contactTypes : undefined,
      query,
    });
  }

  static instance() {
    return new ListPartners(
      PartnersDatabaseRepository.instance(),
      ChannelsDatabaseRepository.instance()
    );
  }
}

type InputDTO = {
  id: string;
  workspaceId: string;
  membership: Membership;
  pageIndex: number;
  channelFilters: string[];
  query?: string;
};
