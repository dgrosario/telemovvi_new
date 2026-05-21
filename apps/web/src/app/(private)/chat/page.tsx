import { listChannels } from "@/app/actions/channels";
import { listCurrentUserSectors } from "@/app/actions/sectors";
import {
  getUserAuthenticate,
  getWorkspaceSelected,
} from "@/app/actions/security";
import { listChatAttendants } from "@/app/actions/users";
import { Chat } from "@/components/chat";
import { loadConversationFilters } from "@/hooks/conversation-filters-loader";
import { toConversationTypeFilter } from "@/lib/chat-conversation-type";
import { MembershipsDatabaseRepository } from "@omnichannel/core/infra/repositories/membership-repository";
import { PaginatedSearchOutputDTO } from "@omnichannel/core/infra/repositories/conversations-repository";
import { listConversationsPaginated } from "../../actions/conversations";
import { redirect } from "next/navigation";

type PageProps = {
  searchParams: Promise<Record<string, string>>;
};

type StatusFilter = "open" | "waiting" | "expired" | "closed" | "internal";
type SearchType = "phone" | "instagram" | "client-name" | "attendant-name" | "all";
type DateType = "creation" | "lastMessage";
type SortOrder = "desc" | "asc";
type WaitingStatus = "attendant" | "client" | "";

type ParsedConversationFilters = {
  q: string;
  statusFilters: string[];
  channelFilters: string[];
  sectorFilters: string[];
  userFilters: string[];
  showAll: string;
  searchType: string;
  dateStart: string;
  dateEnd: string;
  dateType: string;
  sortOrder: string;
  waitingStatus: string;
  conversationType: string;
};

const DEFAULT_FILTERS: ParsedConversationFilters = {
  q: "",
  statusFilters: ["open"],
  channelFilters: [],
  sectorFilters: [],
  userFilters: [],
  showAll: "false",
  searchType: "all",
  dateStart: "",
  dateEnd: "",
  dateType: "lastMessage",
  sortOrder: "desc",
  waitingStatus: "",
  conversationType: "contacts",
};

function parseStatusFilters(filters: string[]): StatusFilter[] {
  const validStatuses: StatusFilter[] = ["open", "waiting", "expired", "closed", "internal"];
  return filters.filter((f): f is StatusFilter => validStatuses.includes(f as StatusFilter));
}

function parseSearchType(value: string): SearchType {
  const validTypes: SearchType[] = ["phone", "instagram", "client-name", "attendant-name", "all"];
  return validTypes.includes(value as SearchType) ? (value as SearchType) : "all";
}

function parseDateType(value: string): DateType {
  return value === "creation" ? "creation" : "lastMessage";
}

function parseSortOrder(value: string): SortOrder {
  return value === "asc" ? "asc" : "desc";
}

function parseWaitingStatus(value: string): WaitingStatus {
  const validStatuses: WaitingStatus[] = ["attendant", "client", ""];
  return validStatuses.includes(value as WaitingStatus) ? (value as WaitingStatus) : "";
}

const membershipsRepository = MembershipsDatabaseRepository.instance();

export default async function Page({ searchParams }: PageProps) {
  let parsedFilters: ParsedConversationFilters = DEFAULT_FILTERS;

  try {
    parsedFilters = await loadConversationFilters.parse(searchParams, {
      strict: true,
    }) as ParsedConversationFilters;
  } catch (strictError) {
    console.error("[ChatPage] Strict filter parse failed, falling back", {
      error:
        strictError instanceof Error
          ? strictError.message
          : String(strictError),
    });

    try {
      parsedFilters = await loadConversationFilters.parse(searchParams, {
        strict: false,
      }) as ParsedConversationFilters;
    } catch (fallbackError) {
      console.error("[ChatPage] Fallback filter parse failed, using defaults", {
        error:
          fallbackError instanceof Error
            ? fallbackError.message
            : String(fallbackError),
      });
      parsedFilters = DEFAULT_FILTERS;
    }
  }

  const {
    q,
    statusFilters,
    channelFilters,
    sectorFilters,
    userFilters,
    showAll,
    searchType,
    dateStart,
    dateEnd,
    dateType,
    sortOrder,
    waitingStatus,
    conversationType,
  } = parsedFilters;

  const [userAuthenticatedResult, workspaceId] = await Promise.all([
    getUserAuthenticate(),
    getWorkspaceSelected(),
  ]);
  const userAuthenticated = userAuthenticatedResult[0];

  if (!userAuthenticated) {
    redirect("/signin");
  }

  const membership = workspaceId
    ? await membershipsRepository.retrieveByUserIdAndWorkspaceId(
        userAuthenticated.id,
        workspaceId
      )
    : null;
  const canViewWhatsappGroups =
    membership?.hasPermission("view:whatsapp-groups") ?? false;

  const results = await Promise.allSettled([
    listConversationsPaginated({
      query: q,
      statusFilters: parseStatusFilters(statusFilters),
      channelFilters,
      sectorFilters,
      userFilters,
      showAll: showAll === "true",
      searchType: parseSearchType(searchType),
      dateStart: dateStart || undefined,
      dateEnd: dateEnd || undefined,
      dateType: parseDateType(dateType),
      sortOrder: parseSortOrder(sortOrder),
      waitingStatus: parseWaitingStatus(waitingStatus),
      conversationTypeFilter: toConversationTypeFilter(
        conversationType,
        canViewWhatsappGroups
      ),
      limit: 30,
      cursor: null,
    }),
    listChannels({}),
    listChatAttendants(),
    listCurrentUserSectors(),
  ]);

  const response = results[0].status === "fulfilled" ? results[0].value[0] : null;
  const channels = results[1].status === "fulfilled" ? results[1].value[0] : [];
  const users = results[2].status === "fulfilled" ? results[2].value[0] : [];
  const sectors = results[3].status === "fulfilled" ? results[3].value[0] : [];

  const {
    conversations = [],
    counters = { closed: 0, open: 0, waiting: 0, expired: 0, internal: 0 },
  } = (response as PaginatedSearchOutputDTO) || {};

  return (
    <div className="h-full w-full">
      <Chat
        conversations={conversations ?? []}
        userAuthenticated={userAuthenticated.raw()}
        workspaceId={workspaceId ?? ""}
        channels={channels ?? []}
        sectors={sectors ?? []}
        users={users ?? []}
        counters={counters}
      />
    </div>
  );
}
