import { create } from "zustand";
import { useServerActionQuery } from "./server-action-hooks";
import { getDashboardMetrics } from "@/app/actions/dashboard";
import type {
  DateRangeFilter,
  DateRangePreset,
  DashboardData,
} from "@/types/dashboard";

type DashboardState = {
  dateFilter: DateRangeFilter;
  onlineUsers: Set<string>;
};

type DashboardActions = {
  setDateFilter: (filter: DateRangeFilter) => void;
  setPreset: (preset: DateRangePreset) => void;
  setOnlineUsers: (userIds: string[]) => void;
  addOnlineUser: (userId: string) => void;
  removeOnlineUser: (userId: string) => void;
};

type DashboardStore = DashboardState & DashboardActions;

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function calculateDateRange(preset: DateRangePreset): {
  startDate: string;
  endDate: string;
} {
  const today = new Date();

  switch (preset) {
    case "today":
      return {
        startDate: formatDate(today),
        endDate: formatDate(today),
      };
    case "last7days": {
      const last7 = new Date(today);
      last7.setDate(last7.getDate() - 6);
      return {
        startDate: formatDate(last7),
        endDate: formatDate(today),
      };
    }
    case "last30days": {
      const last30 = new Date(today);
      last30.setDate(last30.getDate() - 29);
      return {
        startDate: formatDate(last30),
        endDate: formatDate(today),
      };
    }
    case "custom":
    default:
      return {
        startDate: formatDate(today),
        endDate: formatDate(today),
      };
  }
}

const initialDateRange = calculateDateRange("today");

export const useDashboardStore = create<DashboardStore>((set, get) => ({
  dateFilter: {
    preset: "today",
    ...initialDateRange,
  },
  onlineUsers: new Set(),

  setDateFilter: (filter) => {
    set({ dateFilter: filter });
  },

  setPreset: (preset) => {
    const range = calculateDateRange(preset);
    set({
      dateFilter: {
        preset,
        ...range,
      },
    });
  },

  setOnlineUsers: (userIds) => {
    set({ onlineUsers: new Set(userIds) });
  },

  addOnlineUser: (userId) => {
    const current = get().onlineUsers;
    const updated = new Set(current);
    updated.add(userId);
    set({ onlineUsers: updated });
  },

  removeOnlineUser: (userId) => {
    const current = get().onlineUsers;
    const updated = new Set(current);
    updated.delete(userId);
    set({ onlineUsers: updated });
  },
}));

export function useDashboardMetrics() {
  const dateFilter = useDashboardStore((state) => state.dateFilter);
  const onlineUsers = useDashboardStore((state) => state.onlineUsers);

  const query = useServerActionQuery(getDashboardMetrics, {
    input: {
      startDate: dateFilter.startDate,
      endDate: dateFilter.endDate,
    },
    queryKey: ["dashboard-metrics", dateFilter.startDate, dateFilter.endDate],
    refetchInterval: 30000,
  });

  const data: DashboardData | undefined = query.data
    ? {
        ...query.data,
        metrics: {
          ...query.data.metrics,
          activity: {
            ...query.data.metrics.activity,
            activeAttendants: onlineUsers.size,
          },
        },
        attendants: query.data.attendants.map((a) => ({
          ...a,
          isOnline: onlineUsers.has(a.id),
        })),
      }
    : undefined;

  return {
    ...query,
    data,
  };
}

export { calculateDateRange };
