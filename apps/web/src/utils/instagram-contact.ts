type InstagramLikeContact = {
  type?: string | null;
  value?: string | null;
  username?: string | null;
};

export function normalizeInstagramUsername(value?: string | null): string {
  return value?.trim().replace(/^@/, "") ?? "";
}

export function isInstagramScopedId(value?: string | null): boolean {
  const normalized = normalizeInstagramUsername(value);
  return /^\d+$/.test(normalized);
}

export function getInstagramUsernameForDisplay(
  contact?: InstagramLikeContact | null,
): string {
  if (!contact || contact.type !== "instagram") return "";

  const username = normalizeInstagramUsername(contact.username);
  if (username) return username;

  const value = normalizeInstagramUsername(contact.value);
  if (!value || isInstagramScopedId(value)) return "";

  return value;
}

export function getInstagramHandleForDisplay(
  contact?: InstagramLikeContact | null,
): string {
  const username = getInstagramUsernameForDisplay(contact);
  return username ? `@${username}` : "";
}
