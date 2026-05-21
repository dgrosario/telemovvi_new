import { describe, expect, it } from "vitest";
import { normalizeMetaUploadError } from "./meta-upload-errors";

describe("normalizeMetaUploadError", () => {
  it("detects scrutiny failures from Meta media engine", () => {
    const result = normalizeMetaUploadError(
      "Upload failed: Media file scrutiny for the file failed with mediaEngineStatus: 0",
    );

    expect(result.type).toBe("scrutiny_failed");
  });

  it("detects invalid token by parsed code", () => {
    const result = normalizeMetaUploadError(
      `Upload failed: ${JSON.stringify({
        error: {
          message: "Invalid OAuth access token.",
          code: 190,
          error_subcode: 463,
        },
      })}`,
    );

    expect(result.type).toBe("token");
  });

  it("detects unsupported mime/file types", () => {
    const result = normalizeMetaUploadError(
      "Upload failed: Unsupported file type for this endpoint",
    );

    expect(result.type).toBe("unsupported");
  });

  it("returns generic for unknown errors", () => {
    const result = normalizeMetaUploadError("Upload failed: Random failure");

    expect(result.type).toBe("generic");
  });
});
