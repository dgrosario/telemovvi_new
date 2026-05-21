export type ChatConversationType = "contacts" | "groups" | "internal";
export type ChatConversationListFilter = "contacts" | "groups" | "all";

export function normalizeConversationType(
  value: string | null | undefined,
  canViewWhatsappGroups: boolean
): ChatConversationType {
  const normalizedType: ChatConversationType =
    value === "groups" || value === "internal" ? value : "contacts";

  if (normalizedType === "groups" && !canViewWhatsappGroups) {
    return "contacts";
  }

  return normalizedType;
}

export function toConversationTypeFilter(
  value: string | null | undefined,
  canViewWhatsappGroups: boolean
): "contacts" | "groups" {
  return normalizeConversationType(value, canViewWhatsappGroups) === "groups"
    ? "groups"
    : "contacts";
}

export function normalizeConversationListFilter(
  value: ChatConversationListFilter,
  canViewWhatsappGroups: boolean
): ChatConversationListFilter {
  if (value === "all") {
    return canViewWhatsappGroups ? value : "contacts";
  }

  return toConversationTypeFilter(value, canViewWhatsappGroups);
}

export function shouldShowStatusFilters(
  conversationType: ChatConversationType
): boolean {
  return conversationType === "contacts";
}
