import { describe, expect, it } from "vitest";
import {
  buildPartnerContactMergePlan,
  selectCanonicalPartnerCandidate,
  type CanonicalPartnerCandidate,
  type MergePlanContactInput,
} from "./partners-repository";

function makeContact(
  overrides: Partial<MergePlanContactInput> = {},
): MergePlanContactInput {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    type: overrides.type ?? "instagram",
    value: overrides.value ?? "",
    username: overrides.username ?? "",
    ...overrides,
  };
}

describe("buildPartnerContactMergePlan", () => {
  it("prefers the source scoped-id instagram contact over a target pending username contact", () => {
    const targetPending = makeContact({
      id: "target-pending",
      value: "alanpedro",
      username: "alanpedro",
    });
    const sourceScoped = makeContact({
      id: "source-scoped",
      value: "1574724680481548",
      username: "alanpedro",
    });

    const plan = buildPartnerContactMergePlan({
      targetContacts: [targetPending],
      sourceContacts: [sourceScoped],
    });

    expect(plan.sourceContactIdsToMove).toEqual(["source-scoped"]);
    expect(plan.targetContactIdsToDelete).toEqual(["target-pending"]);
    expect(plan.sourceContactIdsToDelete).toEqual([]);
  });

  it("keeps the target scoped-id instagram contact and drops a source pending username contact", () => {
    const targetScoped = makeContact({
      id: "target-scoped",
      value: "1574724680481548",
      username: "alanpedro",
    });
    const sourcePending = makeContact({
      id: "source-pending",
      value: "alanpedro",
      username: "alanpedro",
    });

    const plan = buildPartnerContactMergePlan({
      targetContacts: [targetScoped],
      sourceContacts: [sourcePending],
    });

    expect(plan.sourceContactIdsToMove).toEqual([]);
    expect(plan.targetContactIdsToDelete).toEqual([]);
    expect(plan.sourceContactIdsToDelete).toEqual(["source-pending"]);
  });

  it("keeps both contacts when there is no instagram username collision", () => {
    const targetWhatsapp = makeContact({
      id: "target-whatsapp",
      type: "whatsapp",
      value: "5511999999999",
      username: "",
    });
    const sourceInstagram = makeContact({
      id: "source-instagram",
      value: "alanpedro",
      username: "alanpedro",
    });

    const plan = buildPartnerContactMergePlan({
      targetContacts: [targetWhatsapp],
      sourceContacts: [sourceInstagram],
    });

    expect(plan.sourceContactIdsToMove).toEqual(["source-instagram"]);
    expect(plan.targetContactIdsToDelete).toEqual([]);
    expect(plan.sourceContactIdsToDelete).toEqual([]);
  });
});

describe("selectCanonicalPartnerCandidate", () => {
  it("prefers the partner that already has a non-instagram contact", () => {
    const whatsappBackedCandidate: CanonicalPartnerCandidate = {
      partnerId: "partner-whatsapp",
      hasNonInstagramContact: true,
      contactCount: 2,
      labelCount: 0,
      metadataCount: 0,
      latestConversationActivityAt: new Date("2026-03-06T20:43:00.000Z"),
      createdAt: new Date("2026-03-06T20:42:30.000Z"),
    };
    const instagramOnlyCandidate: CanonicalPartnerCandidate = {
      partnerId: "partner-instagram-only",
      hasNonInstagramContact: false,
      contactCount: 1,
      labelCount: 3,
      metadataCount: 2,
      latestConversationActivityAt: new Date("2026-03-07T12:00:00.000Z"),
      createdAt: new Date("2026-01-13T18:33:27.000Z"),
    };

    expect(
      selectCanonicalPartnerCandidate([
        instagramOnlyCandidate,
        whatsappBackedCandidate,
      ]),
    ).toEqual(whatsappBackedCandidate);
  });

  it("uses latest activity and then oldest creation as later tie-breakers", () => {
    const moreRecentActivity: CanonicalPartnerCandidate = {
      partnerId: "partner-recent",
      hasNonInstagramContact: false,
      contactCount: 1,
      labelCount: 1,
      metadataCount: 1,
      latestConversationActivityAt: new Date("2026-03-08T10:00:00.000Z"),
      createdAt: new Date("2026-02-10T10:00:00.000Z"),
    };
    const sameScoreOlder: CanonicalPartnerCandidate = {
      partnerId: "partner-older",
      hasNonInstagramContact: false,
      contactCount: 1,
      labelCount: 1,
      metadataCount: 1,
      latestConversationActivityAt: new Date("2026-03-08T10:00:00.000Z"),
      createdAt: new Date("2026-01-10T10:00:00.000Z"),
    };

    expect(
      selectCanonicalPartnerCandidate([
        moreRecentActivity,
        sameScoreOlder,
      ]),
    ).toEqual(sameScoreOlder);
  });
});
