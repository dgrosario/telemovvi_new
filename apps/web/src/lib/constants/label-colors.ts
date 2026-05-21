export const LABEL_COLORS = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
] as const;

export type LabelColor = (typeof LABEL_COLORS)[number];
