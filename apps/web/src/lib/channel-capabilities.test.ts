import { describe, expect, it } from "vitest";
import {
  validateMessageForChannel,
  validateMimeTypeForChannel,
} from "./channel-capabilities";

describe("validateMimeTypeForChannel", () => {
  it("accepts zip uploads on official Meta channels", () => {
    const resultMetaApi = validateMimeTypeForChannel(
      "meta_api",
      "document",
      "application/zip",
    );
    const resultWhatsAppAlias = validateMimeTypeForChannel(
      "whatsapp",
      "document",
      "application/x-zip-compressed",
    );

    expect(resultMetaApi).toBeNull();
    expect(resultWhatsAppAlias).toBeNull();
  });

  it("does not apply strict Meta mime validation to evolution", () => {
    const result = validateMimeTypeForChannel(
      "evolution",
      "document",
      "application/x-rar-compressed",
    );

    expect(result).toBeNull();
  });

  it("keeps validation for unsupported document types on official Meta channels", () => {
    const result = validateMimeTypeForChannel(
      "meta_api",
      "document",
      "application/x-rar-compressed",
    );

    expect(result).not.toBeNull();
    expect(result?.type).toBe("unsupported_mime_type");
  });

  it("does not apply strict WhatsApp mime validation to instagram", () => {
    const result = validateMimeTypeForChannel(
      "instagram",
      "audio",
      "audio/webm",
    );

    expect(result).toBeNull();
  });

  it("enforces 5MB image limit on official WhatsApp channels", () => {
    const overLimit = 5 * 1024 * 1024 + 1;
    const result = validateMessageForChannel("whatsapp", "image", overLimit);

    expect(result).not.toBeNull();
    expect(result?.type).toBe("file_too_large");
  });
});
