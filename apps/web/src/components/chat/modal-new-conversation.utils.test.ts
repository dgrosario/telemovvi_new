import { describe, expect, it } from "vitest";
import type { Partner } from "@omnichannel/core/domain/entities/partner";
import {
  filterPartnersForNewConversation,
  getContactDisplayValueForNewConversation,
  getDialableContactsForNewConversation,
  getPartnerOptionLabelForNewConversation,
  getPrimaryDialableContactForNewConversation,
  isDialableContactForNewConversation,
} from "./modal-new-conversation.utils";

function createContact(
  overrides: Partial<Partner.Raw["contacts"][number]>
): Partner.Raw["contacts"][number] {
  return {
    id: overrides.id ?? "contact-1",
    type: overrides.type ?? "whatsapp",
    value: overrides.value ?? "5511999999999",
    username: overrides.username ?? "",
    thumbnail: overrides.thumbnail ?? "",
    channelId: overrides.channelId ?? null,
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00.000Z",
  };
}

function createPartner(
  overrides: Partial<Partner.Raw> = {}
): Partner.Raw {
  return {
    id: overrides.id ?? "partner-1",
    name: overrides.name ?? "Cliente",
    isNameCustom: overrides.isNameCustom ?? false,
    birthday: overrides.birthday ?? null,
    contacts: overrides.contacts ?? [createContact({})],
    metadata: overrides.metadata ?? [],
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-01-01T00:00:00.000Z",
  };
}

describe("modal-new-conversation utils", () => {
  it("accepts only dialable whatsapp contact values with 7 to 13 digits", () => {
    expect(
      isDialableContactForNewConversation(
        createContact({ type: "whatsapp", value: "5511999999999" })
      )
    ).toBe(true);

    expect(
      isDialableContactForNewConversation(
        createContact({ type: "meta_api", value: "12345678901234" })
      )
    ).toBe(false);
  });

  it("rejects instagram contacts even when numeric", () => {
    expect(
      isDialableContactForNewConversation(
        createContact({ type: "instagram", value: "5511999999999" })
      )
    ).toBe(false);
  });

  it("filters and sorts dialable contacts by createdAt then id", () => {
    const contacts = getDialableContactsForNewConversation([
      createContact({
        id: "b",
        type: "whatsapp",
        value: "5511999999999",
        createdAt: "2026-01-03T00:00:00.000Z",
      }),
      createContact({
        id: "c",
        type: "instagram",
        value: "softtor",
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
      createContact({
        id: "a",
        type: "evolution",
        value: "5511888888888",
        createdAt: "2026-01-03T00:00:00.000Z",
      }),
      createContact({
        id: "d",
        type: "meta_api",
        value: "12345678901234",
        createdAt: "2026-01-02T00:00:00.000Z",
      }),
    ]);

    expect(contacts.map((contact) => contact.id)).toEqual(["a", "b"]);
  });

  it("removes partners without dialable contacts and normalizes remaining contacts", () => {
    const partners = filterPartnersForNewConversation([
      createPartner({
        id: "partner-1",
        contacts: [
          createContact({ type: "instagram", value: "softtor" }),
        ],
      }),
      createPartner({
        id: "partner-2",
        contacts: [
          createContact({
            id: "2-b",
            type: "whatsapp",
            value: "5511999999999",
            createdAt: "2026-02-02T00:00:00.000Z",
          }),
          createContact({
            id: "2-a",
            type: "meta_api",
            value: "5511888888888",
            createdAt: "2026-02-01T00:00:00.000Z",
          }),
        ],
      }),
    ]);

    expect(partners.map((partner) => partner.id)).toEqual(["partner-2"]);
    expect(partners[0]?.contacts.map((contact) => contact.id)).toEqual([
      "2-a",
      "2-b",
    ]);
  });

  it("returns first dialable contact as primary contact", () => {
    const partner = createPartner({
      contacts: [
        createContact({ id: "instagram", type: "instagram", value: "softtor" }),
        createContact({
          id: "phone",
          type: "whatsapp",
          value: "5511999999999",
          createdAt: "2026-02-01T00:00:00.000Z",
        }),
      ],
    });

    expect(getPrimaryDialableContactForNewConversation(partner)?.id).toBe("phone");
  });

  it("formats the contact display value for dialable channels", () => {
    expect(
      getContactDisplayValueForNewConversation(
        createContact({ type: "whatsapp", value: "5561996105046" })
      )
    ).toBe("55 61 9 9610-5046");
  });

  it("builds the partner label without appending the channel name", () => {
    const partner = createPartner({
      name: "Softtor",
      contacts: [
        createContact({
          id: "phone",
          type: "meta_api",
          value: "5561996105046",
        }),
      ],
    });

    expect(getPartnerOptionLabelForNewConversation(partner)).toBe(
      "Softtor - 55 61 9 9610-5046"
    );
    expect(getPartnerOptionLabelForNewConversation(partner)).not.toContain(
      "WhatsApp Cloud"
    );
  });
});
