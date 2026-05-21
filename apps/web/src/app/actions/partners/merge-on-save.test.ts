import { describe, expect, it } from "vitest";
import {
  buildInstagramCanonicalizationRequests,
  buildUpsertContactsAfterMerge,
  mergeLabelIdsAfterPartnerMerge,
  mergeMetadataAfterPartnerMerge,
} from "./merge-on-save";

describe("buildUpsertContactsAfterMerge", () => {
  it("reuses the inherited scoped-id instagram contact after merge and preserves inherited contacts", () => {
    const result = buildUpsertContactsAfterMerge({
      originalContacts: [
        {
          id: "target-whatsapp",
          type: "whatsapp",
          value: "5511999999999",
          channelId: null,
          createdAt: "2026-03-06T12:00:00.000Z",
        },
        {
          id: "target-pending-instagram",
          type: "instagram",
          value: "alanpedro",
          channelId: "instagram-channel",
          createdAt: "2026-03-06T12:00:00.000Z",
        },
      ],
      refreshedContacts: [
        {
          id: "target-whatsapp",
          type: "whatsapp",
          value: "5511999999999",
          username: "",
          channelId: null,
          createdAt: "2026-03-06T12:00:00.000Z",
        },
        {
          id: "source-scoped-instagram",
          type: "instagram",
          value: "1574724680481548",
          username: "alanpedro",
          channelId: "instagram-channel",
          createdAt: "2026-03-06T12:00:00.000Z",
        },
        {
          id: "source-extra-whatsapp",
          type: "whatsapp",
          value: "5511888888888",
          username: "",
          channelId: null,
          createdAt: "2026-03-06T12:00:00.000Z",
        },
      ],
      inputContacts: [
        {
          id: "target-whatsapp",
          type: "whatsapp",
          value: "5511999999999",
          channelId: null,
          createdAt: "2026-03-06T12:00:00.000Z",
        },
        {
          id: "target-pending-instagram",
          type: "instagram",
          value: "@alanpedro",
          channelId: "instagram-channel",
          createdAt: "2026-03-06T12:00:00.000Z",
        },
      ],
    });

    expect(result).toEqual([
      expect.objectContaining({
        id: "target-whatsapp",
        type: "whatsapp",
        value: "5511999999999",
      }),
      expect.objectContaining({
        id: "source-scoped-instagram",
        type: "instagram",
        value: "1574724680481548",
        username: "alanpedro",
      }),
      expect.objectContaining({
        id: "source-extra-whatsapp",
        type: "whatsapp",
        value: "5511888888888",
      }),
    ]);
  });
});

describe("buildInstagramCanonicalizationRequests", () => {
  it("includes the current partner together with existing username matches and ignores scoped ids", () => {
    const result = buildInstagramCanonicalizationRequests({
      currentPartnerId: "partner-whatsapp",
      inputContacts: [
        {
          id: "whatsapp-contact",
          type: "whatsapp",
          value: "5511999999999",
          channelId: null,
          createdAt: "2026-03-06T12:00:00.000Z",
        },
        {
          id: "instagram-pending",
          type: "instagram",
          value: "@softtor.ds",
          channelId: "instagram-channel",
          createdAt: "2026-03-06T12:00:00.000Z",
        },
        {
          id: "instagram-scoped",
          type: "instagram",
          value: "827726543705946",
          channelId: "instagram-channel",
          createdAt: "2026-03-06T12:00:00.000Z",
        },
      ],
      matchedPartnerIdsByUsername: {
        "softtor.ds": ["partner-instagram"],
      },
    });

    expect(result).toEqual([
      {
        username: "softtor.ds",
        candidatePartnerIds: ["partner-whatsapp", "partner-instagram"],
      },
    ]);
  });
});

describe("mergeMetadataAfterPartnerMerge", () => {
  it("preserves metadata inherited from the merged partner while honoring edits on the original target metadata", () => {
    const result = mergeMetadataAfterPartnerMerge({
      originalMetadata: [{ label: "cpf", value: "123" }],
      refreshedMetadata: [
        { label: "cpf", value: "123" },
        { label: "instagram_origin", value: "inbound" },
      ],
      inputMetadata: [],
    });

    expect(result).toEqual([{ label: "instagram_origin", value: "inbound" }]);
  });
});

describe("mergeLabelIdsAfterPartnerMerge", () => {
  it("preserves labels inherited from the merged partner while honoring user edits on original labels", () => {
    const result = mergeLabelIdsAfterPartnerMerge({
      originalLabelIds: ["vip"],
      currentLabelIds: ["vip", "instagram"],
      inputLabelIds: [],
    });

    expect(result).toEqual(["instagram"]);
  });
});
