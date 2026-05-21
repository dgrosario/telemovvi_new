import type { Channel } from "@omnichannel/core/domain/entities/channel";

export type UpsertContactInput = {
  id: string;
  type: Channel.Type;
  value: string;
  channelId?: string | null;
  createdAt?: string;
};

export type ExistingPartnerContact = UpsertContactInput & {
  username?: string | null;
  thumbnail?: string | null;
};

export type MetadataInput = {
  label: string;
  value: string;
};

export type InstagramCanonicalizationRequest = {
  username: string;
  candidatePartnerIds: string[];
};

function normalizeInstagramUsername(value: string): string {
  return value.trim().replace(/^@/, "");
}

function isInstagramScopedId(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

export function buildInstagramCanonicalizationRequests(input: {
  currentPartnerId: string;
  inputContacts: UpsertContactInput[];
  matchedPartnerIdsByUsername: Record<string, string[]>;
}): InstagramCanonicalizationRequest[] {
  const requests: InstagramCanonicalizationRequest[] = [];
  const seenUsernames = new Set<string>();

  for (const contact of input.inputContacts) {
    if (contact.type !== "instagram") continue;

    const normalizedUsername = normalizeInstagramUsername(contact.value).toLowerCase();
    if (!normalizedUsername || isInstagramScopedId(normalizedUsername)) {
      continue;
    }

    if (seenUsernames.has(normalizedUsername)) {
      continue;
    }
    seenUsernames.add(normalizedUsername);

    const candidatePartnerIds = Array.from(
      new Set([
        input.currentPartnerId,
        ...(input.matchedPartnerIdsByUsername[normalizedUsername] ?? []),
      ]),
    );

    if (candidatePartnerIds.length <= 1) {
      continue;
    }

    requests.push({
      username: normalizedUsername,
      candidatePartnerIds,
    });
  }

  return requests;
}

function findMatchingInstagramContact(
  contacts: ExistingPartnerContact[],
  contact: UpsertContactInput,
): ExistingPartnerContact | undefined {
  if (contact.type !== "instagram") return undefined;

  const normalizedInstagramValue = normalizeInstagramUsername(contact.value);
  if (!normalizedInstagramValue) return undefined;

  return contacts.find((existingContact) => {
    if (existingContact.type !== "instagram") return false;

    const normalizedUsername = normalizeInstagramUsername(
      existingContact.username ?? "",
    );
    const normalizedValue = normalizeInstagramUsername(existingContact.value);

    return (
      normalizedUsername.toLowerCase() === normalizedInstagramValue.toLowerCase() ||
      (!normalizedUsername &&
        !isInstagramScopedId(normalizedValue) &&
        normalizedValue.toLowerCase() === normalizedInstagramValue.toLowerCase())
    );
  });
}

export function buildUpsertContactsAfterMerge(input: {
  originalContacts: UpsertContactInput[];
  refreshedContacts: ExistingPartnerContact[];
  inputContacts: UpsertContactInput[];
}): ExistingPartnerContact[] {
  const originalContactIds = new Set(input.originalContacts.map((contact) => contact.id));

  const mappedContacts = input.inputContacts.map((contact) => {
    const isInstagram = contact.type === "instagram";
    const normalizedInstagramValue = isInstagram
      ? normalizeInstagramUsername(contact.value)
      : contact.value;

    const existingContact =
      input.refreshedContacts.find((candidate) => candidate.id === contact.id) ??
      findMatchingInstagramContact(input.refreshedContacts, contact);

    const existingInstagramIsId =
      existingContact?.type === "instagram" &&
      isInstagramScopedId(existingContact.value);
    const isInstagramId =
      isInstagram && isInstagramScopedId(normalizedInstagramValue);

    return {
      id: existingContact?.id ?? contact.id,
      type: contact.type,
      value:
        isInstagram && !isInstagramId && existingInstagramIsId
          ? existingContact!.value
          : isInstagram
            ? normalizedInstagramValue
            : contact.value,
      username: isInstagram
        ? isInstagramId
          ? existingContact?.username ?? ""
          : normalizedInstagramValue
        : existingContact?.username ?? "",
      thumbnail: existingContact?.thumbnail ?? "",
      channelId: contact.channelId ?? existingContact?.channelId ?? null,
      createdAt: contact.createdAt ?? existingContact?.createdAt,
    };
  });

  const mappedContactIds = new Set(mappedContacts.map((contact) => contact.id));
  const inheritedContacts = input.refreshedContacts.filter(
    (contact) =>
      !originalContactIds.has(contact.id) && !mappedContactIds.has(contact.id),
  );

  return [...mappedContacts, ...inheritedContacts];
}

export function mergeMetadataAfterPartnerMerge(input: {
  originalMetadata: MetadataInput[];
  refreshedMetadata: MetadataInput[];
  inputMetadata: MetadataInput[];
}): MetadataInput[] {
  const originalLabels = new Set(
    input.originalMetadata.map((metadata) => metadata.label),
  );
  const inputLabels = new Set(input.inputMetadata.map((metadata) => metadata.label));
  const inheritedMetadata = input.refreshedMetadata.filter(
    (metadata) =>
      !originalLabels.has(metadata.label) && !inputLabels.has(metadata.label),
  );

  return [...input.inputMetadata, ...inheritedMetadata];
}

export function mergeLabelIdsAfterPartnerMerge(input: {
  originalLabelIds: string[];
  currentLabelIds: string[];
  inputLabelIds: string[];
}): string[] {
  const originalLabelIds = new Set(input.originalLabelIds);
  const mergedLabelIds = input.currentLabelIds.filter(
    (labelId) => !originalLabelIds.has(labelId),
  );

  return Array.from(new Set([...input.inputLabelIds, ...mergedLabelIds]));
}
