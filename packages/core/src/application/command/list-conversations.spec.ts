import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Membership } from "../../domain/entities/membership";
import {
  CounterConversations,
  PaginatedSearchOutputDTO,
  UnreadByStatus,
} from "../../infra/repositories/conversations-repository";
import { ListConversations } from "./list-conversations";
import { ListMyChannels } from "./list-my-channels";
import { ListMySector } from "./list-my-sector";

const EMPTY_COUNTERS: CounterConversations = {
  open: 0,
  waiting: 0,
  expired: 0,
  closed: 0,
  internal: 0,
};

const EMPTY_UNREAD: UnreadByStatus = {
  open: 0,
  waiting: 0,
  expired: 0,
  closed: 0,
  internal: 0,
};

describe("ListConversations", () => {
  let repository: {
    search: ReturnType<typeof vi.fn>;
    searchPaginated: ReturnType<typeof vi.fn>;
  };
  let listMyChannelsExecute: ReturnType<typeof vi.fn>;
  let listMySectorExecute: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    repository = {
      search: vi.fn(),
      searchPaginated: vi.fn(),
    };

    listMyChannelsExecute = vi.fn();
    listMySectorExecute = vi.fn();

    vi.spyOn(ListMyChannels, "instance").mockReturnValue({
      execute: listMyChannelsExecute,
    } as never);
    vi.spyOn(ListMySector, "instance").mockReturnValue({
      execute: listMySectorExecute,
    } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty result when selected channel is outside user scope", async () => {
    listMyChannelsExecute.mockResolvedValue(["channel-allowed"]);

    const command = new ListConversations(repository);
    const membership = createMembership([
      "list:all-conversations",
      "list:all-sectors",
    ]);

    const result = await command.execute(
      createExecuteInput(membership, {
        showAll: true,
        channelFilters: ["channel-blocked"],
      })
    );

    expect(result).toEqual({
      conversations: [],
      counters: EMPTY_COUNTERS,
      unreadByStatus: EMPTY_UNREAD,
    });
    expect(repository.search).not.toHaveBeenCalled();
    expect(listMySectorExecute).not.toHaveBeenCalled();
  });

  it("applies permission channel scope even when user can list all sectors", async () => {
    listMyChannelsExecute.mockResolvedValue(["channel-1", "channel-2"]);
    repository.search.mockResolvedValue({
      conversations: [],
      counters: EMPTY_COUNTERS,
      unreadByStatus: EMPTY_UNREAD,
    });

    const command = new ListConversations(repository);
    const membership = createMembership([
      "list:all-conversations",
      "list:all-sectors",
    ]);

    await command.execute(
      createExecuteInput(membership, {
        showAll: true,
        channelFilters: ["channel-1"],
        userFilters: ["attendant-1"],
      })
    );

    expect(repository.search).toHaveBeenCalledWith(
      expect.objectContaining({
        channelFilters: ["channel-1", "channel-2", null],
        userSelectedChannelIds: ["channel-1"],
        sectorFilters: [],
        userFilters: ["attendant-1"],
      })
    );
    expect(listMySectorExecute).not.toHaveBeenCalled();
  });

  it("intersects selected channels with allowed channels for users without all-sectors", async () => {
    listMyChannelsExecute.mockResolvedValue(["channel-1"]);
    listMySectorExecute.mockResolvedValue([{ id: "sector-1", name: "Sector 1" }]);
    repository.search.mockResolvedValue({
      conversations: [],
      counters: EMPTY_COUNTERS,
      unreadByStatus: EMPTY_UNREAD,
    });

    const command = new ListConversations(repository);
    const membership = createMembership(["list:all-conversations"]);

    await command.execute(
      createExecuteInput(membership, {
        showAll: true,
        channelFilters: ["channel-1", "channel-blocked"],
        sectorFilters: [],
      })
    );

    expect(repository.search).toHaveBeenCalledWith(
      expect.objectContaining({
        channelFilters: ["channel-1", null],
        sectorFilters: ["sector-1", null],
        userSelectedChannelIds: ["channel-1"],
      })
    );
  });

  it("returns empty paginated result when selected channel is outside user scope", async () => {
    listMyChannelsExecute.mockResolvedValue(["channel-allowed"]);

    const command = new ListConversations(repository);
    const membership = createMembership([
      "list:all-conversations",
      "list:all-sectors",
    ]);

    const result = await command.executePaginated(
      createExecutePaginatedInput(membership, {
        showAll: true,
        channelFilters: ["channel-blocked"],
      })
    );

    const expected: PaginatedSearchOutputDTO = {
      conversations: [],
      counters: EMPTY_COUNTERS,
      unreadByStatus: EMPTY_UNREAD,
      nextCursor: null,
      hasMore: false,
    };

    expect(result).toEqual(expected);
    expect(repository.searchPaginated).not.toHaveBeenCalled();
  });
});

function createMembership(permissions: string[]): Membership {
  return Membership.instance({
    id: "membership-1",
    workspaceId: "workspace-1",
    userId: "user-1",
    permissions: permissions as Membership["permissions"],
  });
}

function createExecuteInput(
  membership: Membership,
  overrides: Partial<{
    showAll: boolean;
    channelFilters: (string | null)[];
    sectorFilters: (string | null)[];
    userFilters: string[];
  }> = {}
) {
  return {
    id: "user-1",
    workspaceId: "workspace-1",
    membership,
    channelFilters: overrides.channelFilters ?? [],
    sectorFilters: overrides.sectorFilters ?? [],
    userFilters: overrides.userFilters ?? [],
    showAll: overrides.showAll ?? false,
  };
}

function createExecutePaginatedInput(
  membership: Membership,
  overrides: Partial<{
    showAll: boolean;
    channelFilters: (string | null)[];
    sectorFilters: (string | null)[];
    userFilters: string[];
  }> = {}
) {
  return {
    ...createExecuteInput(membership, overrides),
    cursor: null,
    limit: 50,
  };
}
