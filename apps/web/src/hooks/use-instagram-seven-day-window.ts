export const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const SIX_DAYS_MS = 6 * 24 * 60 * 60 * 1000;
const SIX_DAYS_18_HOURS_MS = 6 * 24 * 60 * 60 * 1000 + 18 * 60 * 60 * 1000;

export type InstagramWindowStatus =
  | "active"
  | "human_agent"
  | "expiring_soon"
  | "expiring"
  | "expired";

export type InstagramWindowInfo = {
  status: InstagramWindowStatus;
  timeRemainingMs: number;
  formattedTimeRemaining: string;
};

export function formatWindowTimeRemaining(ms: number): string {
  if (ms <= 0) return "Expirada";

  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor(
    (ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
  );
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function getInstagramWindowInfo(
  channelType: string | undefined,
  lastClientMessageCreatedAt: string | Date | null | undefined,
  conversationStatus: string | null | undefined
): InstagramWindowInfo | null {
  if (channelType !== "instagram") return null;
  if (conversationStatus === "closed") return null;

  if (!lastClientMessageCreatedAt) {
    return {
      status: "expired",
      timeRemainingMs: 0,
      formattedTimeRemaining: "Expirada",
    };
  }

  const lastMessageTime = new Date(lastClientMessageCreatedAt).getTime();
  const elapsed = Date.now() - lastMessageTime;
  const timeRemainingMs = Math.max(SEVEN_DAYS_MS - elapsed, 0);

  if (elapsed > SEVEN_DAYS_MS) {
    return {
      status: "expired",
      timeRemainingMs: 0,
      formattedTimeRemaining: "Expirada",
    };
  }

  if (elapsed >= SIX_DAYS_18_HOURS_MS) {
    return {
      status: "expiring",
      timeRemainingMs,
      formattedTimeRemaining: formatWindowTimeRemaining(timeRemainingMs),
    };
  }

  if (elapsed >= SIX_DAYS_MS) {
    return {
      status: "expiring_soon",
      timeRemainingMs,
      formattedTimeRemaining: formatWindowTimeRemaining(timeRemainingMs),
    };
  }

  if (elapsed >= TWENTY_FOUR_HOURS_MS) {
    return {
      status: "human_agent",
      timeRemainingMs,
      formattedTimeRemaining: formatWindowTimeRemaining(timeRemainingMs),
    };
  }

  return {
    status: "active",
    timeRemainingMs,
    formattedTimeRemaining: formatWindowTimeRemaining(timeRemainingMs),
  };
}

export type ConversationWindowColor = "success" | "warning" | "error";

export type ConversationWindowInfo = {
  timeRemainingMs: number;
  formattedTimeRemaining: string;
  color: ConversationWindowColor;
  tooltip: string;
};

const WINDOW_BY_CHANNEL: Record<string, number> = {
  whatsapp: TWENTY_FOUR_HOURS_MS,
  meta_api: TWENTY_FOUR_HOURS_MS,
  instagram: SEVEN_DAYS_MS,
};

export function getConversationWindowInfo(
  channelType: string | undefined,
  lastClientMessageCreatedAt: string | Date | null | undefined,
  conversationStatus: string | null | undefined
): ConversationWindowInfo | null {
  if (!channelType) return null;
  if (conversationStatus === "closed") return null;

  const windowMs = WINDOW_BY_CHANNEL[channelType];
  if (!windowMs) return null;

  if (!lastClientMessageCreatedAt) {
    return {
      timeRemainingMs: 0,
      formattedTimeRemaining: "0h",
      color: "error",
      tooltip: "Janela expirada. Aguarde nova mensagem do contato.",
    };
  }

  const elapsed = Date.now() - new Date(lastClientMessageCreatedAt).getTime();
  const remaining = Math.max(windowMs - elapsed, 0);

  if (remaining <= 0) {
    return {
      timeRemainingMs: 0,
      formattedTimeRemaining: "0h",
      color: "error",
      tooltip: "Janela expirada. Aguarde nova mensagem do contato.",
    };
  }

  const ratio = remaining / windowMs;
  const formatted = formatWindowTimeRemaining(remaining);
  const windowLabel = windowMs === SEVEN_DAYS_MS ? "7 dias" : "24h";

  if (ratio > 0.25) {
    return {
      timeRemainingMs: remaining,
      formattedTimeRemaining: formatted,
      color: "success",
      tooltip: `Janela de ${windowLabel} expira em ${formatted}`,
    };
  }

  return {
    timeRemainingMs: remaining,
    formattedTimeRemaining: formatted,
    color: "warning",
    tooltip: `Janela de ${windowLabel} expira em ${formatted}`,
  };
}
