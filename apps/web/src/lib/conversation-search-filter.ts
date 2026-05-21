import type { Conversation } from "@omnichannel/core/domain/entities/conversation";

export type ConversationSearchType =
  | "phone"
  | "instagram"
  | "client-name"
  | "attendant-name"
  | "all";

type MatchConversationSearchInput = {
  query?: string | null;
  searchType?: ConversationSearchType;
};

function normalize(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

export function matchesConversationSearch(
  conversation: Conversation.Raw,
  input: MatchConversationSearchInput,
): boolean {
  const query = normalize(input.query);
  if (!query) return true;

  const searchType = input.searchType ?? "all";

  const contactValue = normalize(conversation.contact?.value);
  const contactUsername = normalize(conversation.contact?.username);
  const contactName = normalize(conversation.contact?.name);
  const attendantName = normalize(conversation.attendant?.name);

  const normalizedQuery = query.toLocaleLowerCase();
  const normalizedContactValue = contactValue.toLocaleLowerCase();
  const normalizedContactUsername = contactUsername.toLocaleLowerCase();
  const normalizedContactName = contactName.toLocaleLowerCase();
  const normalizedAttendantName = attendantName.toLocaleLowerCase();

  if (searchType === "phone") {
    return contactValue === query;
  }

  if (searchType === "instagram") {
    if (conversation.contact?.type !== "instagram") {
      return false;
    }

    const normalizedInstagramQuery = normalizedQuery.replace(/^@/, "");
    return (
      normalizedContactUsername.startsWith(normalizedInstagramQuery) ||
      normalizedContactUsername === normalizedInstagramQuery ||
      (!normalizedContactUsername &&
        (normalizedContactValue.startsWith(normalizedInstagramQuery) ||
          normalizedContactValue === normalizedInstagramQuery))
    );
  }

  if (searchType === "client-name") {
    return normalizedContactName.includes(normalizedQuery);
  }

  if (searchType === "attendant-name") {
    return normalizedAttendantName.includes(normalizedQuery);
  }

  return (
    normalizedContactValue.includes(normalizedQuery) ||
    normalizedContactUsername.includes(normalizedQuery.replace(/^@/, "")) ||
    normalizedContactName.includes(normalizedQuery)
  );
}
