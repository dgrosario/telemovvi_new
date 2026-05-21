import * as client from "nuqs";
import { useQueryStates } from "nuqs";
import * as server from "nuqs/server";

export const conversationFilters = {
  sectorFilters: server.parseAsArrayOf(server.parseAsString).withDefault([]),
  channelFilters: server.parseAsArrayOf(server.parseAsString).withDefault([]),
  userFilters: server.parseAsArrayOf(server.parseAsString).withDefault([]),
  labelFilters: server.parseAsArrayOf(server.parseAsString).withDefault([]),
  statusFilters: server.parseAsArrayOf(server.parseAsString)
    .withDefault(["open"])
    .withOptions({ shallow: false }),
  q: server.parseAsString.withDefault("").withOptions({ shallow: false }),
  searchType: server.parseAsString.withDefault("all"),
  dateStart: server.parseAsString.withDefault(""),
  dateEnd: server.parseAsString.withDefault(""),
  dateType: server.parseAsString.withDefault("lastMessage"),
  sortOrder: server.parseAsString.withDefault("desc"),
  waitingStatus: server.parseAsString.withDefault(""),
  showAll: server.parseAsString.withDefault("false"),
  conversationType: server.parseAsString.withDefault("contacts"),
};

export const loadConversationFilters =
  server.createSearchParamsCache(conversationFilters);

type FilterName = "sector" | "channel" | "user" | "label";

export const useConversationFilters = () => {
  const [filters, setFilters] = useQueryStates(
    {
      sectorFilters: client
        .parseAsArrayOf(client.parseAsString)
        .withDefault([]),
      channelFilters: client
        .parseAsArrayOf(client.parseAsString)
        .withDefault([]),
      userFilters: client.parseAsArrayOf(client.parseAsString).withDefault([]),
      labelFilters: client.parseAsArrayOf(client.parseAsString).withDefault([]),
      statusFilters: client
        .parseAsArrayOf(client.parseAsString)
        .withDefault(["open"]),
      searchType: client.parseAsString.withDefault("all"),
      dateStart: client.parseAsString.withDefault(""),
      dateEnd: client.parseAsString.withDefault(""),
      dateType: client.parseAsString.withDefault("lastMessage"),
      sortOrder: client.parseAsString.withDefault("desc"),
      waitingStatus: client.parseAsString.withDefault(""),
      showAll: client.parseAsString.withDefault("false"),
      conversationType: client.parseAsString.withDefault("contacts"),
    },
    { shallow: false }
  );

  const [query, setQuery] = client.useQueryState(
    "q",
    client.parseAsString.withDefault("").withOptions({ shallow: false })
  );

  const waitingStatus =
    filters.waitingStatus === "attendant" || filters.waitingStatus === "client"
      ? filters.waitingStatus
      : "";

  const conversationType =
    filters.conversationType === "groups" || filters.conversationType === "internal"
      ? filters.conversationType
      : "contacts";

  return {
    statusFilters: filters.statusFilters as Array<"open" | "waiting" | "expired" | "closed" | "internal">,
    setStatusFilters: (values: string[]) => {
      setFilters({ statusFilters: values.length > 0 ? values : ["open"] });
    },
    channels: filters.channelFilters || [],
    sectors: filters.sectorFilters || [],
    users: filters.userFilters || [],
    labels: filters.labelFilters || [],
    searchType: filters.searchType as "phone" | "instagram" | "client-name" | "attendant-name" | "all",
    dateRange: {
      start: filters.dateStart || null,
      end: filters.dateEnd || null,
    },
    dateType: filters.dateType as "lastMessage" | "creation",
    sortOrder: filters.sortOrder as "desc" | "asc",
    waitingStatus: waitingStatus as "attendant" | "client" | "",
    showAll: filters.showAll === "true",
    query,
    setQuery,
    filters,
    setSearchType(type: "phone" | "instagram" | "client-name" | "attendant-name" | "all") {
      setFilters({ searchType: type });
    },
    setDateRange(start: string, end: string) {
      setFilters({ dateStart: start, dateEnd: end });
    },
    setDateType(type: "lastMessage" | "creation") {
      setFilters({ dateType: type });
    },
    setSortOrder(order: "desc" | "asc") {
      setFilters({ sortOrder: order });
    },
    setWaitingStatus(status: "attendant" | "client" | "") {
      setFilters({ waitingStatus: status });
    },
    setShowAll(value: boolean) {
      setFilters({ showAll: value.toString() });
    },
    conversationType: conversationType as "contacts" | "groups" | "internal",
    setConversationType(type: "contacts" | "groups" | "internal") {
      setFilters({ conversationType: type });
    },
    clearFilters() {
      setFilters({
        channelFilters: [],
        sectorFilters: [],
        userFilters: [],
        labelFilters: [],
      });
    },
    clearAllFilters() {
      setFilters({
        channelFilters: [],
        sectorFilters: [],
        userFilters: [],
        labelFilters: [],
        statusFilters: ["open"],
        searchType: "all",
        dateStart: "",
        dateEnd: "",
        dateType: "lastMessage",
        sortOrder: "desc",
        waitingStatus: "",
        showAll: "false",
        conversationType: "contacts",
      });
      setQuery("");
    },
    onChange: (filterName: FilterName, values: string[]) => {
      if (filterName === "channel") {
        setFilters({ channelFilters: values });
      }
      if (filterName === "sector") {
        setFilters({ sectorFilters: values });
      }
      if (filterName === "user") {
        setFilters({ userFilters: values });
      }
      if (filterName === "label") {
        setFilters({ labelFilters: values });
      }
    },
  };
};
