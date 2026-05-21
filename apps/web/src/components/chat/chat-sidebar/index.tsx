"use client";
import { closeConversation } from "@/app/actions/conversations";
import { getNotificationSettings } from "@/app/actions/notifications";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { useConversationFilters } from "@/hooks/conversation-filters-loader";
import { useServerActionMutation } from "@/hooks/server-action-hooks";
import { useChat } from "@/hooks/use-chat";
import { useForwardMessage } from "@/hooks/use-forward-message";
import { useConversationsQuery } from "@/hooks/use-conversations-query";
import { useListLabels } from "@/hooks/use-labels";
import { useInternalConversationsQuery } from "@/hooks/use-internal-conversations-query";
import { useConversationStore, type ConversationStatus } from "@/hooks/use-conversation-store";
import { getSearchTypeLabel } from "@/hooks/use-smart-search";
import { usePermissionCheck } from "@/hooks/use-permission-check";
import { META_CHANNEL_TYPES } from "@omnichannel/core/domain/entities/channel";
import { CircularProgress } from "@mui/material";
import { Inbox, Clock, CheckCircle, AlertTriangle, MessageSquare, Plus } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format, parse } from "date-fns";
import { debounce } from "nuqs";
import React, { useEffect, useMemo, useRef, useTransition, useCallback } from "react";
import CustomTextField from "../../custom-text-field";
import {
  ActiveFiltersDisplay,
  type ActiveFilter,
} from "../active-filters-display";
import { AttendantFilterPopover } from "../filters/attendant-filter-popover";
import { FilterConversationsDrawer } from "../filters/filter-conversations-drawer";
import { SectorFilterPopover } from "../filters/sector-filter-popover";
import { ModalNewConversation } from "../modal-new-conversation";
import { ModalNewInternalConversation } from "../modal-new-internal-conversation";
import { ModalPreviewConversation } from "../modal-preview-conversation";
import { QuickFiltersBar } from "../quick-filters-bar";
import { ChatItem } from "./chat-item";
import { Loading } from "./loading";
import { ConversationTypeTabs } from "../conversation-type-tabs";
import { ChatUserMenu } from "../chat-user-menu";
import { getMessagePreviewText } from "@/lib/message-utils";
import { useCrossChannelIndicators } from "@/hooks/use-cross-channel-indicators";
import { PERMISSION_MAPPINGS } from "@/lib/permissions-map";
import {
  normalizeConversationType,
  shouldShowStatusFilters,
  toConversationTypeFilter,
} from "@/lib/chat-conversation-type";

const SCROLL_LOAD_THRESHOLD_PX = 240;

const NewInternalConversationButton: React.FC<{ currentUserId: string }> = ({
  currentUserId,
}) => {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-600 text-sm font-medium transition-colors"
      >
        <Plus className="size-4" />
        <span>Nova conversa interna</span>
      </button>
      <ModalNewInternalConversation
        currentUserId={currentUserId}
        externalOpen={open}
        onExternalClose={() => setOpen(false)}
      />
    </>
  );
};

export const ChatSidebar: React.FC = () => {
  const [isPending, startTransition] = useTransition();
  const [sectorAnchorEl, setSectorAnchorEl] =
    React.useState<HTMLElement | null>(null);
  const [userAnchorEl, setUserAnchorEl] =
    React.useState<HTMLElement | null>(null);
  const store = useChat();
  const { messageToForward, clearMessageToForward } = useForwardMessage();
  const { hasPermission: canListAllConversations } = usePermissionCheck(["list:all-conversations"]);
  const { hasPermission: canListChatAttendants } = usePermissionCheck(["list:chat-attendants"]);
  const { hasPermission: canViewWhatsappGroups } = usePermissionCheck(
    PERMISSION_MAPPINGS.conversations.viewGroups
  );
  const preferenceLoadedRef = useRef(false);
  const { data: allLabels = [] } = useListLabels();
  const {
    statusFilters,
    setStatusFilters,
    query,
    setQuery,
    filters,
    searchType,
    setSearchType,
    sortOrder,
    setSortOrder,
    waitingStatus,
    setWaitingStatus,
    showAll,
    setShowAll,
    dateRange,
    dateType,
    setDateRange,
    clearAllFilters,
    onChange,
    conversationType,
    setConversationType,
  } = useConversationFilters();

  const closeConversationMutation = useServerActionMutation(closeConversation);
  const { getIndicator: getCrossChannelIndicator } = useCrossChannelIndicators();
  const normalizedConversationType = normalizeConversationType(
    conversationType,
    canViewWhatsappGroups
  );

  const currentStatus = (statusFilters[0] || "open") as ConversationStatus;
  const isInternalMode = normalizedConversationType === "internal";
  const conversationTypeFilter = toConversationTypeFilter(
    normalizedConversationType,
    canViewWhatsappGroups
  );
  const [pageLimit, setPageLimit] = React.useState(50);

  const isGroupsMode = normalizedConversationType === "groups";
  const canFilterByAttendant = canListAllConversations && canListChatAttendants;

  const {
    conversations: regularConversations,
    counters,
    unreadByStatus: queryUnreadByStatus,
    hasNextPage,
    isFetching: regularIsFetching,
    isFetchingNextPage,
    isLoading: regularIsLoading,
    fetchNextPage,
    refetch,
  } = useConversationsQuery({
    status: isGroupsMode ? undefined : currentStatus,
    filters: {
      query,
      searchType,
      channelFilters: filters.channelFilters,
      sectorFilters: filters.sectorFilters,
      userFilters: filters.userFilters,
      labelFilters: filters.labelFilters,
      dateStart: dateRange.start || undefined,
      dateEnd: dateRange.end || undefined,
      dateType,
      sortOrder,
      waitingStatus,
      showAll,
      conversationTypeFilter,
    },
    limit: pageLimit,
    enabled: !isInternalMode,
  });

  const {
    conversations: internalConversations,
    isLoading: internalIsLoading,
    isFetching: internalIsFetching,
  } = useInternalConversationsQuery({
    enabled: isInternalMode,
  });

  const conversations = isInternalMode ? internalConversations : regularConversations;
  const isLoading = isInternalMode ? internalIsLoading : regularIsLoading;
  const isFetching = isInternalMode ? internalIsFetching : regularIsFetching;

  useEffect(() => {
    const updateLimit = () => {
      setPageLimit(window.innerWidth < 768 ? 25 : 50);
    };

    updateLimit();
    window.addEventListener("resize", updateLimit);
    return () => window.removeEventListener("resize", updateLimit);
  }, []);

  useEffect(() => {
    if (preferenceLoadedRef.current || !canListAllConversations) return;
    preferenceLoadedRef.current = true;

    getNotificationSettings({})
      .then((result) => {
        if (result[0]?.showAllConversations && !showAll) {
          setShowAll(true);
        }
      })
      .catch(() => {});
  }, [canListAllConversations, showAll, setShowAll]);

  useEffect(() => {
    if (conversationType !== "groups" || canViewWhatsappGroups) {
      return;
    }

    startTransition(() => {
      setConversationType("contacts");
      if (statusFilters.length === 0) {
        setStatusFilters(["open"]);
      }
    });
  }, [
    canViewWhatsappGroups,
    conversationType,
    setConversationType,
    setStatusFilters,
    startTransition,
    statusFilters.length,
  ]);

  const handleSidebarScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      if (isInternalMode || !hasNextPage || isFetchingNextPage) {
        return;
      }

      const element = event.currentTarget;
      const distanceFromBottom =
        element.scrollHeight - element.scrollTop - element.clientHeight;

      if (distanceFromBottom <= SCROLL_LOAD_THRESHOLD_PX) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage, isInternalMode]
  );

  const hasMetaChannels = useMemo(
    () =>
      store.channels.some((ch) =>
        META_CHANNEL_TYPES.includes(ch.type as typeof META_CHANNEL_TYPES[number])
      ),
    [store.channels]
  );

  const filtersList = useMemo(
    () => [
      {
        title: "Abertas",
        value: "open" as const,
        count: counters?.open || 0,
      },
      {
        title: "Pendentes",
        value: "waiting" as const,
        count: counters?.waiting || 0,
      },
      {
        title: "Concluídas",
        value: "closed" as const,
        count: counters?.closed || 0,
      },
      ...(hasMetaChannels
        ? [
            {
              title: "Expiradas",
              value: "expired" as const,
              count: counters?.expired || 0,
            },
          ]
        : []),
    ],
    [counters, hasMetaChannels]
  );

  const handleConversationTypeChange = useCallback(
    (type: "contacts" | "groups" | "internal") => {
      const nextType = normalizeConversationType(type, canViewWhatsappGroups);

      startTransition(() => {
        setConversationType(nextType);
        if (nextType === "groups") {
          setStatusFilters([]);
        } else if (
          nextType !== "internal" &&
          (statusFilters.includes("internal") || statusFilters.length === 0)
        ) {
          setStatusFilters(["open"]);
        }
      });
    },
    [
      canViewWhatsappGroups,
      setConversationType,
      setStatusFilters,
      startTransition,
      statusFilters,
    ]
  );

  const unreadByStatus = queryUnreadByStatus ?? { open: 0, waiting: 0, closed: 0, expired: 0, internal: 0 };

  const activeFilters = useMemo<ActiveFilter[]>(() => {
    const active: ActiveFilter[] = [];

    if (query && searchType !== "all") {
      active.push({
        key: "search",
        label: `${getSearchTypeLabel(searchType)}: ${query}`,
        value: query,
      });
    }

    if (dateRange.start && dateRange.end) {
      const typeLabel =
        dateType === "lastMessage" ? "Última mensagem" : "Criação";
      try {
        const startFormatted = format(
          parse(dateRange.start, "yyyy-MM-dd", new Date()),
          "dd/MM/yyyy"
        );
        const endFormatted = format(
          parse(dateRange.end, "yyyy-MM-dd", new Date()),
          "dd/MM/yyyy"
        );
        active.push({
          key: "dateRange",
          label: `${typeLabel}: ${startFormatted} - ${endFormatted}`,
          value: [dateRange.start, dateRange.end],
        });
      } catch {
        active.push({
          key: "dateRange",
          label: `${typeLabel}: ${dateRange.start} - ${dateRange.end}`,
          value: [dateRange.start, dateRange.end],
        });
      }
    }

    if (filters.channelFilters.length > 0) {
      const channelNames = store.channels
        .filter((ch) => filters.channelFilters.includes(ch.id))
        .map((ch) => ch.name)
        .join(", ");
      active.push({
        key: "channels",
        label: `Canais: ${channelNames}`,
        value: filters.channelFilters,
      });
    }

    if (filters.sectorFilters.length > 0) {
      const sectorNames = store.sectors
        .filter((s) => filters.sectorFilters.includes(s.id))
        .map((s) => s.name)
        .join(", ");
      active.push({
        key: "sectors",
        label: `Setores: ${sectorNames}`,
        value: filters.sectorFilters,
      });
    }

    if (filters.userFilters.length > 0) {
      const userNames = store.users
        .filter((u) => filters.userFilters.includes(u.id))
        .map((u) => u.name)
        .join(", ");
      active.push({
        key: "users",
        label: `Atendentes: ${userNames}`,
        value: filters.userFilters,
      });
    }

    if (filters.labelFilters.length > 0) {
      const labelNames = filters.labelFilters
        .map((id) => {
          const label = allLabels.find((l) => l.id === id);
          return label?.name || id;
        })
        .join(", ");
      active.push({
        key: "labels",
        label: `Etiquetas: ${labelNames}`,
        value: filters.labelFilters,
      });
    }

    return active;
  }, [
    filters,
    store.channels,
    store.sectors,
    store.users,
    dateRange,
    dateType,
    query,
    searchType,
    allLabels,
  ]);

  const handleRemoveFilter = (filterKey: string) => {
    startTransition(() => {
      if (filterKey === "search") {
        setQuery("");
        setSearchType("all");
      } else if (filterKey === "dateRange") {
        setDateRange("", "");
      } else if (filterKey === "channels") {
        onChange("channel", []);
      } else if (filterKey === "sectors") {
        onChange("sector", []);
      } else if (filterKey === "users") {
        onChange("user", []);
      } else if (filterKey === "labels") {
        onChange("label", []);
      }
    });
  };

  const handleClearAllFilters = () => {
    startTransition(() => {
      clearAllFilters();
    });
  };

  const handleSectorClick = (event: React.MouseEvent<HTMLElement>) => {
    setSectorAnchorEl(event.currentTarget);
  };

  const handleSectorPopoverClose = () => {
    setSectorAnchorEl(null);
  };

  const handleSectorApply = (sectorIds: string[]) => {
    startTransition(() => {
      onChange("sector", sectorIds);
    });
  };

  const handleUserClick = (event: React.MouseEvent<HTMLElement>) => {
    setUserAnchorEl(event.currentTarget);
  };

  const handleUserPopoverClose = () => {
    setUserAnchorEl(null);
  };

  const handleUserApply = (userIds: string[]) => {
    startTransition(() => {
      // Backend só aplica filtro por atendente quando showAll=true.
      if (userIds.length > 0 && canListAllConversations && !showAll) {
        setShowAll(true);
      }
      onChange("user", userIds);
    });
  };

  const handleSortToggle = () => {
    setSortOrder(sortOrder === "desc" ? "asc" : "desc");
  };

  const handleWaitingToggle = (status: "attendant" | "client") => {
    setWaitingStatus(waitingStatus === status ? "" : status);
  };

  const handleShowAllToggle = () => {
    setShowAll(!showAll);
  };

  const statusLabels: Record<string, string> = {
    open: "abertas",
    waiting: "pendentes",
  };

  const handleCompleteAll = async () => {
    const targetConversations = conversations.filter(
      (c) => c.status === currentStatus
    );

    if (targetConversations.length === 0) {
      return;
    }

    for (const conversation of targetConversations) {
      await closeConversationMutation.mutateAsync({
        conversationId: conversation.id,
      });
    }

    refetch();
  };

  const canCompleteAll = currentStatus === "open" || currentStatus === "waiting";
  const completeAllLabel = `Concluir todas as conversas ${statusLabels[currentStatus] || "abertas"}`;

  const hasSectorFilter = filters.sectorFilters.length > 0;
  const hasUserFilter = filters.userFilters.length > 0;
  const waitingCount = counters?.waiting ?? 0;
  const openCount = counters?.open ?? 0;
  const closedCount = counters?.closed ?? 0;
  const groupsCount = normalizedConversationType === "groups" ? conversations.length : 0;
  const totalUnread =
    (unreadByStatus.open ?? 0) +
    (unreadByStatus.waiting ?? 0) +
    (unreadByStatus.closed ?? 0) +
    (unreadByStatus.expired ?? 0);
  const activeSectorCount = filters.sectorFilters.length;
  const waitingUnread = unreadByStatus.waiting ?? 0;
  const openUnread = unreadByStatus.open ?? 0;

  const showSkeleton = isLoading && conversations.length === 0;

  const hasOpenConversation = !!store.conversationOpenedId;

  return (
    <Sidebar
      collapsible="none"
      className={`
        bg-white border-r flex-col w-full h-full
        ${hasOpenConversation ? "hidden" : "flex"}
        md:flex md:w-full lg:min-w-[420px] lg:max-w-[460px] lg:flex-1
      `}
    >
      <SidebarHeader className="gap-3.5 pt-4 pb-0 px-0 shrink-0">
        {messageToForward && (
          <div
            role="status"
            aria-live="polite"
            className="mx-2 md:mx-4 mb-2 p-3 bg-blue-50 border border-blue-200 rounded-lg animate-in fade-in slide-in-from-top-2 duration-200"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <i className="tabler-arrow-forward size-4 text-blue-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-blue-700">
                    Encaminhando mensagem
                  </p>
                  <p
                    className="text-xs text-blue-600 truncate"
                    title={messageToForward.type === "text" ? messageToForward.content : undefined}
                  >
                    {getMessagePreviewText(messageToForward)}
                  </p>
                </div>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={clearMessageToForward}
                    className="shrink-0 p-1.5 rounded-full hover:bg-blue-100 text-blue-600 transition-colors"
                    aria-label="Cancelar encaminhamento"
                  >
                    <i className="tabler-x size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Cancelar encaminhamento</TooltipContent>
              </Tooltip>
            </div>
            <p className="text-xs text-blue-500 mt-2">
              Selecione uma conversa para encaminhar
            </p>
          </div>
        )}
        <div className="flex gap-1 justify-center items-center px-2 md:px-4 pb-2">
          {/* User menu - visible only on mobile */}
          <div className="md:hidden">
            <ChatUserMenu user={store.user ?? undefined} />
          </div>
          <CustomTextField
            placeholder="Buscar por número, @instagram ou nome"
            name="search"
            variant="outlined"
            fullWidth
            size="small"
            value={query}
            slotProps={{
              input: {
                className: "!pr-0.5",
                endAdornment: (
                  <>
                    <FilterConversationsDrawer
                      channelsList={store.channels}
                      sectorsList={store.sectors}
                      usersList={store.users}
                      canFilterByAttendant={canFilterByAttendant}
                    />
                    <ModalNewConversation />
                  </>
                ),
              },
            }}
            onChange={(e) => {
              setQuery(e.target.value, {
                limitUrlUpdates:
                  e.target.value === "" ? undefined : debounce(500),
              });
            }}
          />
        </div>

        <ActiveFiltersDisplay
          filters={activeFilters}
          onRemove={handleRemoveFilter}
          onClearAll={handleClearAllFilters}
        />

        <QuickFiltersBar
          sectors={store.sectors}
          users={store.users}
          hasSectorFilter={hasSectorFilter}
          hasUserFilter={hasUserFilter}
          sortOrder={sortOrder}
          waitingStatus={waitingStatus}
          showAll={showAll}
          canViewAll={canListAllConversations}
          showAttendantFilter={canFilterByAttendant}
          completeAllLabel={completeAllLabel}
          showCompleteAll={canCompleteAll}
          onSectorClick={handleSectorClick}
          onUserClick={handleUserClick}
          onSortToggle={handleSortToggle}
          onWaitingToggle={handleWaitingToggle}
          onShowAllToggle={handleShowAllToggle}
          onCompleteAll={handleCompleteAll}
          onClearAllFilters={handleClearAllFilters}
        />

        <SectorFilterPopover
          anchorEl={sectorAnchorEl}
          onClose={handleSectorPopoverClose}
          sectorsList={store.sectors}
          selectedSectors={filters.sectorFilters}
          onApply={handleSectorApply}
        />

        {canFilterByAttendant && (
          <AttendantFilterPopover
            anchorEl={userAnchorEl}
            onClose={handleUserPopoverClose}
            usersList={store.users}
            selectedUsers={filters.userFilters}
            onApply={handleUserApply}
          />
        )}

        <div className="px-2 md:px-4 pb-2">
          <div className="grid grid-cols-3 gap-2 rounded-2xl border bg-white p-1.5">
            <button
              type="button"
              onClick={() => setStatusFilters(["open"])}
              className={`rounded-xl px-2 py-2 text-sm font-semibold transition ${
                statusFilters.includes("open")
                  ? "bg-emerald-100 text-emerald-700 shadow-sm"
                  : "text-gray-600"
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                <span>Abertos</span>
                <span className="rounded-full bg-white/90 px-1.5 py-0.5 text-[11px] leading-none">
                  {openCount}
                </span>
                {totalUnread > 0 && (
                  <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[11px] leading-none text-white">
                    {totalUnread}
                  </span>
                )}
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleConversationTypeChange("groups")}
              className={`rounded-xl px-2 py-2 text-sm font-semibold transition ${
                normalizedConversationType === "groups"
                  ? "bg-blue-100 text-blue-700 shadow-sm"
                  : "text-gray-600"
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                <span>Grupos</span>
                <span className="rounded-full bg-white/90 px-1.5 py-0.5 text-[11px] leading-none">
                  {groupsCount}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilters(["closed"])}
              className={`rounded-xl px-2 py-2 text-sm font-semibold transition ${
                statusFilters.includes("closed")
                  ? "bg-orange-100 text-orange-700 shadow-sm"
                  : "text-gray-600"
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                <span>Finaliz.</span>
                <span className="rounded-full bg-white/90 px-1.5 py-0.5 text-[11px] leading-none">
                  {closedCount}
                </span>
              </span>
            </button>
          </div>
        </div>

        <div className="px-2 md:px-4 pb-2">
          <div className="grid grid-cols-3 gap-2 rounded-2xl border bg-gray-50 p-1.5">
            <button
              type="button"
              onClick={() => setShowAll(false)}
              className={`rounded-xl px-2 py-2 text-sm font-semibold transition ${
                !showAll ? "bg-blue-100 text-blue-700 shadow-sm" : "text-gray-600"
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                <span>Meus</span>
                <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[11px] leading-none">
                  {openCount}
                </span>
                {openUnread > 0 && (
                  <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[11px] leading-none text-white">
                    {openUnread}
                  </span>
                )}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilters(["waiting"]);
                setWaitingStatus("client");
              }}
              className={`rounded-xl px-2 py-2 text-sm font-semibold transition ${
                statusFilters.includes("waiting")
                  ? "bg-amber-100 text-amber-700 shadow-sm"
                  : "text-gray-600"
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                <span>Em espera</span>
                <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[11px] leading-none">
                  {waitingCount}
                </span>
                {waitingUnread > 0 && (
                  <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[11px] leading-none text-white">
                    {waitingUnread}
                  </span>
                )}
              </span>
            </button>
            <button
              type="button"
              onClick={(event) =>
                setSectorAnchorEl(event.currentTarget as HTMLElement)
              }
              className={`rounded-xl px-2 py-2 text-sm font-semibold transition ${
                filters.sectorFilters.length > 0
                  ? "bg-orange-100 text-orange-700 shadow-sm"
                  : "text-gray-600"
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                <span>Setor</span>
                <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[11px] leading-none">
                  {activeSectorCount}
                </span>
              </span>
            </button>
          </div>
        </div>

        {shouldShowStatusFilters(normalizedConversationType) && (
        <div className="flex items-center gap-2 px-2 md:px-4 pt-1 mb-3 overflow-x-auto whitespace-nowrap" role="group" aria-label="filtrar conversas por status">
          {filtersList.map((f) => {
            const isSelected = statusFilters.includes(f.value);
            const unreadCount = unreadByStatus[f.value];

            const icons: Record<string, React.ReactNode> = {
              open: <Inbox className="size-3.5" />,
              waiting: <Clock className="size-3.5" />,
              closed: <CheckCircle className="size-3.5" />,
              expired: <AlertTriangle className="size-3.5" />,
              internal: <MessageSquare className="size-3.5" />,
            };

            const shortLabels: Record<string, string> = {
              open: "Abert.",
              waiting: "Pend.",
              closed: "Concl.",
              expired: "Expir.",
              internal: "Inter.",
            };

            const selectedStyles: Record<string, string> = {
              open: "bg-blue-100 text-blue-600",
              waiting: "bg-amber-100 text-amber-600",
              closed: "bg-green-100 text-green-600",
              expired: "bg-red-100 text-red-600",
              internal: "bg-purple-100 text-purple-600",
            };

            const unselectedStyles: Record<string, string> = {
              open: "text-blue-500 hover:bg-blue-50",
              waiting: "text-amber-500 hover:bg-amber-50",
              closed: "text-green-500 hover:bg-green-50",
              expired: "text-red-500 hover:bg-red-50",
              internal: "text-purple-500 hover:bg-purple-50",
            };

            return (
              <Tooltip key={f.value}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => {
                      startTransition(() => {
                        setStatusFilters([f.value]);
                      });
                    }}
                    aria-label={`${f.title} (${f.count})`}
                    aria-pressed={isSelected}
                    className={`
                      relative flex items-center gap-1 px-3 py-2 rounded-xl
                      text-xs font-semibold transition-all cursor-pointer border
                      ${isSelected
                        ? selectedStyles[f.value]
                        : unselectedStyles[f.value]
                      }
                    `}
                  >
                    {unreadCount > 0 && (
                      <span className="absolute -top-1.5 -right-1 px-1 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full min-w-[16px] text-center leading-none">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                    {icons[f.value]}
                    <span>{shortLabels[f.value]}</span>
                    <span className="opacity-60">{f.count}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={4}>
                  {f.title}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
        )}
      </SidebarHeader>
      <SidebarContent
        className="flex-1 overflow-y-auto overflow-x-hidden"
        style={{ WebkitOverflowScrolling: "touch" }}
        onScroll={handleSidebarScroll}
      >
        <SidebarGroup className="px-0 relative h-full">
          {showSkeleton && <Loading isLoading={true} />}

          <SidebarGroupContent
            data-hidden={showSkeleton}
            className="bg-white"
          >
            {conversations.length === 0 && !isLoading && !isFetching ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className="w-16 h-16 mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                  {normalizedConversationType === "groups" ? (
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  ) : normalizedConversationType === "internal" ? (
                    <MessageSquare className="w-8 h-8 text-gray-400" />
                  ) : (
                    <Inbox className="w-8 h-8 text-gray-400" />
                  )}
                </div>
                <h3 className="text-sm font-medium text-gray-900 mb-1">
                  {normalizedConversationType === "groups"
                    ? "Nenhum grupo encontrado"
                    : normalizedConversationType === "internal"
                      ? "Nenhuma conversa interna"
                      : "Nenhuma conversa encontrada"}
                </h3>
                <p className="text-xs text-gray-500 max-w-[200px]">
                  {normalizedConversationType === "groups"
                    ? "Grupos de WhatsApp aparecerão aqui quando houver conversas ativas."
                    : normalizedConversationType === "internal"
                      ? "Inicie uma conversa interna com sua equipe."
                      : activeFilters.length > 0
                        ? "Tente ajustar os filtros para encontrar conversas."
                        : "Novas conversas aparecerão aqui."}
                </p>
              </div>
            ) : (
              conversations.map((c) => (
                <ChatItem
                  key={c.id}
                  conversation={c}
                  crossChannelStatus={getCrossChannelIndicator(c.contact?.id)}
                />
              ))
            )}

            <div className="h-10 flex items-center justify-center">
              {isFetchingNextPage && <CircularProgress size={20} />}
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      {/* Botão de nova conversa interna - aparece apenas na aba internas */}
      {isInternalMode && (
        <div className="shrink-0 px-4 py-2 border-t bg-gray-50">
          <NewInternalConversationButton currentUserId={store.user?.id || ""} />
        </div>
      )}
      <div className="shrink-0 border-t bg-white">
        <ConversationTypeTabs
          activeType={normalizedConversationType}
          onTypeChange={handleConversationTypeChange}
          showGroupsTab={canViewWhatsappGroups}
        />
      </div>
      <ModalPreviewConversation />
    </Sidebar>
  );
};
