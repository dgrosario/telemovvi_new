import type { Partner } from "@omnichannel/core/domain/entities/partner";
import { getInstagramHandleForDisplay } from "@/utils/instagram-contact";
import { formatPhoneNumber } from "@/utils/phone-formatter";

type PartnerContact = Partner.Raw["contacts"][number];

const DIALABLE_CONTACT_TYPES = new Set<PartnerContact["type"]>([
  "whatsapp",
  "evolution",
  "meta_api",
]);

function toTimestamp(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function isDialableContactForNewConversation(contact: PartnerContact): boolean {
  if (!DIALABLE_CONTACT_TYPES.has(contact.type)) return false;
  const digits = contact.value.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 13;
}

export function getDialableContactsForNewConversation(
  contacts: PartnerContact[]
): PartnerContact[] {
  return contacts
    .filter(isDialableContactForNewConversation)
    .sort((a, b) => {
      const createdAtDiff = toTimestamp(a.createdAt) - toTimestamp(b.createdAt);
      if (createdAtDiff !== 0) return createdAtDiff;
      return a.id.localeCompare(b.id);
    });
}

export function filterPartnersForNewConversation(
  partners: Partner.Raw[]
): Partner.Raw[] {
  return partners
    .map((partner) => ({
      ...partner,
      contacts: getDialableContactsForNewConversation(partner.contacts),
    }))
    .filter((partner) => partner.contacts.length > 0);
}

export function getPrimaryDialableContactForNewConversation(
  partner?: Partner.Raw | null
): PartnerContact | null {
  if (!partner) return null;
  return getDialableContactsForNewConversation(partner.contacts)[0] ?? null;
}

export function getContactDisplayValueForNewConversation(
  contact?: PartnerContact | null
): string {
  if (!contact) return "";

  if (contact.type === "instagram") {
    return getInstagramHandleForDisplay(contact);
  }

  if (
    contact.type === "whatsapp" ||
    contact.type === "evolution" ||
    contact.type === "meta_api"
  ) {
    return formatPhoneNumber(contact.value);
  }

  return contact.value;
}

export function getPartnerOptionLabelForNewConversation(
  partner?: Partner.Raw | null
): string {
  if (!partner) return "";

  const contactValue = getContactDisplayValueForNewConversation(
    getPrimaryDialableContactForNewConversation(partner)
  );

  return [partner.name, contactValue].filter(Boolean).join(" - ");
}
