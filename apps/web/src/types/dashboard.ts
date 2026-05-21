export type DateRangePreset = "today" | "last7days" | "last30days" | "custom";

export interface DateRangeFilter {
  preset: DateRangePreset;
  startDate: string;
  endDate: string;
}

export interface ConversationMetrics {
  open: number;
  waiting: number;
  closed: number;
}

export interface ActivityMetrics {
  activeAttendants: number;
  totalAttendants: number;
  newContacts: number;
  messagesReceived: number;
  messagesSent: number;
}

export interface PerformanceMetrics {
  avgServiceTimeMinutes: number | null;
  avgWaitTimeMinutes: number | null;
}

export interface DashboardMetrics {
  conversations: ConversationMetrics;
  activity: ActivityMetrics;
  performance: PerformanceMetrics;
}

export interface AttendantMetric {
  id: string;
  name: string;
  thumbnail: string | null;
  isOnline: boolean;
  conversationsInProgress: number;
  conversationsFinished: number;
  messagesSent: number;
  avgServiceTimeMinutes: number | null;
  avgFirstResponseMinutes: number | null;
}

export interface DashboardData {
  metrics: DashboardMetrics;
  attendants: AttendantMetric[];
  generatedAt: string;
}

export type MetricColorScheme =
  | "cyan"
  | "amber"
  | "emerald"
  | "violet"
  | "rose"
  | "slate"
  | "blue"
  | "orange"
  | "green"
  | "purple"
  | "red"
  | "teal";

export type MetricFormatType = "number" | "time" | "ratio";

export interface MetricConfig {
  id: string;
  label: string;
  icon: string;
  colorScheme: MetricColorScheme;
  formatType: MetricFormatType;
}
