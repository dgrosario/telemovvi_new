import { describe, expect, it } from "vitest";
import { canDownloadDocumentInChat } from "../chat-download-permissions";

describe("canDownloadDocumentInChat", () => {
  it("allows download when user has bypass permission", () => {
    expect(
      canDownloadDocumentInChat({
        hasBypassAttendance: true,
        conversationType: "external",
        conversationAttendantId: null,
        currentUserId: "user-1",
      })
    ).toBe(true);
  });

  it("allows download in external conversation when current user is attendant", () => {
    expect(
      canDownloadDocumentInChat({
        hasBypassAttendance: false,
        conversationType: "external",
        conversationAttendantId: "user-1",
        currentUserId: "user-1",
      })
    ).toBe(true);
  });

  it("blocks download in external conversation when current user is not attendant", () => {
    expect(
      canDownloadDocumentInChat({
        hasBypassAttendance: false,
        conversationType: "external",
        conversationAttendantId: "user-2",
        currentUserId: "user-1",
      })
    ).toBe(false);
  });

  it("blocks download in external conversation without attendant assignment", () => {
    expect(
      canDownloadDocumentInChat({
        hasBypassAttendance: false,
        conversationType: "external",
        conversationAttendantId: null,
        currentUserId: "user-1",
      })
    ).toBe(false);
  });

  it("allows download in direct conversation without bypass", () => {
    expect(
      canDownloadDocumentInChat({
        hasBypassAttendance: false,
        conversationType: "direct",
        conversationAttendantId: null,
        currentUserId: "user-1",
      })
    ).toBe(true);
  });

  it("allows download in group conversation without bypass", () => {
    expect(
      canDownloadDocumentInChat({
        hasBypassAttendance: false,
        conversationType: "group",
        conversationAttendantId: null,
        currentUserId: "user-1",
      })
    ).toBe(true);
  });

  it("allows download in whatsapp-group conversation without bypass", () => {
    expect(
      canDownloadDocumentInChat({
        hasBypassAttendance: false,
        conversationType: "whatsapp-group",
        conversationAttendantId: null,
        currentUserId: "user-1",
      })
    ).toBe(true);
  });
});
