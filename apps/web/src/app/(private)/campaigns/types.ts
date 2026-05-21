export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "running"
  | "completed"
  | "cancelled"
  | "failed";

export type VariationLabel = string;

export type MessageType = "text" | "template";

export type CampaignMessage = {
  id: string;
  variationLabel: VariationLabel;
  type: MessageType;
  content: string | null;
  templateName: string | null;
  sentCount: number;
};

export type CampaignProgress = {
  sent: number;
  failed: number;
  pending: number;
  total: number;
  percentage: number;
};

export type CampaignListItem = {
  id: string;
  name: string;
  status: CampaignStatus;
  channelId: string;
  channelName: string;
  channelType: string;
  filterLabelIds: string[];
  scheduledAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  progress: CampaignProgress;
  createdAt: Date;
  updatedAt: Date;
};

export type CampaignDetails = {
  id: string;
  name: string;
  status: CampaignStatus;
  channelName: string;
  filterLabelIds: string[];
  totalRecipients: number;
  scheduledAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  progress: CampaignProgress;
  messages: CampaignMessage[];
  createdAt: Date;
};
