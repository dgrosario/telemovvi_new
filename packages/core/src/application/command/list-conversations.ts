import { Membership } from "../../domain/entities/membership";
import { ListMySector } from "./list-my-sector";
import { ListMyChannels } from "./list-my-channels";
import {
  ConversationsDatabaseRepository,
  SearchConversationsOutputDTO,
  SearchInputDTO,
  PaginatedSearchInputDTO,
  PaginatedSearchOutputDTO,
} from "../../infra/repositories/conversations-repository";
import { Conversation } from "../../domain/entities/conversation";

interface ConversationsRepository {
  search({
    workspaceId,
    query,
    statusFilters,
    channelFilters,
    sectorFilters,
    userFilters,
  }: SearchInputDTO): Promise<SearchConversationsOutputDTO>;
  searchPaginated(input: PaginatedSearchInputDTO): Promise<PaginatedSearchOutputDTO>;
}

export class ListConversations {
  constructor(
    private readonly conversationsRepository: ConversationsRepository
  ) {}

  async execute(input: InputDTO) {
    const {
      id,
      workspaceId,
      membership,
      query,
      searchType,
      statusFilters,
      channelFilters,
      sectorFilters,
      userFilters,
      labelFilters,
      dateStart,
      dateEnd,
      dateStartAt,
      dateEndAt,
      dateType,
      sortOrder,
      waitingStatus,
      showAll,
      conversationTypeFilter,
    } = input;

    // showAll so funciona se o usuario tem permissao para ver todas as conversas
    const canViewAllConversations = membership.hasPermission(
      "list:all-conversations"
    );
    const shouldViewAll = showAll && canViewAllConversations;
    const safeUserFilters = shouldViewAll
      ? userFilters // Usa o filtro passado (vazio por default mostra todas do escopo)
      : [id]; // So ve proprias + pendentes
    const channelScope = await this.resolveChannelScope({
      id,
      workspaceId,
      membership,
      channelFilters,
    });

    if (channelScope.hasOutOfScopeSelection) {
      return this.emptyResult();
    }

    if (membership.hasPermission("list:all-sectors")) {
      return await this.conversationsRepository.search({
        workspaceId,
        query,
        searchType,
        statusFilters,
        channelFilters: channelScope.permissionChannelFilters,
        sectorFilters: sectorFilters ?? [],
        userFilters: safeUserFilters,
        userSelectedChannelIds: channelScope.userSelectedChannelIds,
        labelFilters,
        dateStart,
        dateEnd,
        dateStartAt,
        dateEndAt,
        dateType,
        sortOrder,
        waitingStatus,
        conversationTypeFilter,
      });
    }

    const listMySector = ListMySector.instance();
    const allowedSectors = await listMySector.execute({
      id,
      workspaceId,
      membership,
    });

    const allowedSectorIds = allowedSectors.map((s) => s.id);

    const safeSectorFilters =
      sectorFilters?.length === 0
        ? [...allowedSectorIds, null]
        : [
            ...sectorFilters
              .filter((sf): sf is string => sf !== null)
              .filter((sf) => allowedSectorIds.includes(sf)),
            null,
          ];

    return await this.conversationsRepository.search({
      workspaceId,
      query,
      searchType,
      statusFilters,
      channelFilters: channelScope.permissionChannelFilters,
      sectorFilters: safeSectorFilters,
      userFilters: safeUserFilters,
      userSelectedChannelIds: channelScope.userSelectedChannelIds,
      labelFilters,
      dateStart,
      dateEnd,
      dateStartAt,
      dateEndAt,
      dateType,
      sortOrder,
      waitingStatus,
      conversationTypeFilter,
    });
  }

  async executePaginated(input: PaginatedInputDTO): Promise<PaginatedSearchOutputDTO> {
    const {
      id,
      workspaceId,
      membership,
      query,
      searchType,
      statusFilters,
      channelFilters,
      sectorFilters,
      userFilters,
      labelFilters,
      dateStart,
      dateEnd,
      dateStartAt,
      dateEndAt,
      dateType,
      sortOrder,
      waitingStatus,
      cursor,
      limit,
      showAll,
      conversationTypeFilter,
    } = input;

    // showAll so funciona se o usuario tem permissao para ver todas as conversas
    const canViewAllConversations = membership.hasPermission(
      "list:all-conversations"
    );
    const shouldViewAll = showAll && canViewAllConversations;
    const safeUserFilters = shouldViewAll
      ? userFilters // Usa o filtro passado (vazio por default mostra todas do escopo)
      : [id]; // So ve proprias + pendentes
    const channelScope = await this.resolveChannelScope({
      id,
      workspaceId,
      membership,
      channelFilters,
    });

    if (channelScope.hasOutOfScopeSelection) {
      return this.emptyPaginatedResult();
    }

    if (membership.hasPermission("list:all-sectors")) {
      return await this.conversationsRepository.searchPaginated({
        workspaceId,
        query,
        searchType,
        statusFilters,
        channelFilters: channelScope.permissionChannelFilters,
        sectorFilters: sectorFilters ?? [],
        userFilters: safeUserFilters,
        userSelectedChannelIds: channelScope.userSelectedChannelIds,
        labelFilters,
        dateStart,
        dateEnd,
        dateStartAt,
        dateEndAt,
        dateType,
        sortOrder,
        waitingStatus,
        cursor,
        limit,
        conversationTypeFilter,
      });
    }

    const listMySector = ListMySector.instance();
    const allowedSectors = await listMySector.execute({
      id,
      workspaceId,
      membership,
    });

    const allowedSectorIds = allowedSectors.map((s) => s.id);

    const safeSectorFilters =
      sectorFilters?.length === 0
        ? [...allowedSectorIds, null]
        : [
            ...sectorFilters
              .filter((sf): sf is string => sf !== null)
              .filter((sf) => allowedSectorIds.includes(sf)),
            null,
          ];

    return await this.conversationsRepository.searchPaginated({
      workspaceId,
      query,
      searchType,
      statusFilters,
      channelFilters: channelScope.permissionChannelFilters,
      sectorFilters: safeSectorFilters,
      userFilters: safeUserFilters,
      userSelectedChannelIds: channelScope.userSelectedChannelIds,
      labelFilters,
      dateStart,
      dateEnd,
      dateStartAt,
      dateEndAt,
      dateType,
      sortOrder,
      waitingStatus,
      cursor,
      limit,
      conversationTypeFilter,
    });
  }

  private extractSelectedChannelIds(channelFilters: (string | null)[]): string[] {
    if (!channelFilters.length) {
      return [];
    }

    return channelFilters.filter((cf): cf is string => cf !== null);
  }

  private async resolveChannelScope(input: {
    id: string;
    workspaceId: string;
    membership: Membership;
    channelFilters: (string | null)[];
  }): Promise<{
    permissionChannelFilters: (string | null)[];
    userSelectedChannelIds?: string[];
    hasOutOfScopeSelection: boolean;
  }> {
    const selectedChannelIds = this.extractSelectedChannelIds(input.channelFilters);

    if (input.membership.hasPermission("list:all-channels")) {
      return {
        permissionChannelFilters: [],
        userSelectedChannelIds:
          selectedChannelIds.length > 0 ? selectedChannelIds : undefined,
        hasOutOfScopeSelection: false,
      };
    }

    const listMyChannels = ListMyChannels.instance();
    const allowedChannelIds = await listMyChannels.execute({
      id: input.id,
      workspaceId: input.workspaceId,
      membership: input.membership,
    });
    const userScopedChannelIds = selectedChannelIds.filter((channelId) =>
      allowedChannelIds.includes(channelId)
    );

    return {
      permissionChannelFilters:
        allowedChannelIds.length === 0 ? [null] : [...allowedChannelIds, null],
      userSelectedChannelIds:
        selectedChannelIds.length > 0 ? userScopedChannelIds : undefined,
      hasOutOfScopeSelection:
        selectedChannelIds.length > 0 && userScopedChannelIds.length === 0,
    };
  }

  private emptyResult(): SearchConversationsOutputDTO {
    return {
      conversations: [],
      counters: { open: 0, waiting: 0, expired: 0, closed: 0, internal: 0 },
      unreadByStatus: { open: 0, waiting: 0, expired: 0, closed: 0, internal: 0 },
    };
  }

  private emptyPaginatedResult(): PaginatedSearchOutputDTO {
    return {
      ...this.emptyResult(),
      nextCursor: null,
      hasMore: false,
    };
  }

  static instance() {
    return new ListConversations(
      ConversationsDatabaseRepository.instance()
    );
  }
}

type InputDTO = {
  id: string;
  workspaceId: string;
  membership: Membership;
  query?: string;
  searchType?: "phone" | "instagram" | "client-name" | "attendant-name" | "all";
  statusFilters?: Conversation.Status[];
  channelFilters: (string | null)[];
  sectorFilters: (string | null)[];
  userFilters: string[];
  labelFilters?: string[];
  dateStart?: string;
  dateEnd?: string;
  dateStartAt?: number;
  dateEndAt?: number;
  dateType?: "creation" | "lastMessage";
  sortOrder?: "desc" | "asc";
  waitingStatus?: "attendant" | "client" | "";
  showAll?: boolean;
  conversationTypeFilter?: "contacts" | "groups" | "all";
};

type PaginatedInputDTO = InputDTO & {
  cursor?: string | null;
  limit?: number;
};
