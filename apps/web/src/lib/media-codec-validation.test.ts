import { describe, expect, it } from "vitest";
import { isLikelyOggOpus } from "./media-codec-validation";

describe("isLikelyOggOpus", () => {
  it("returns true for bytes that look like OGG Opus", () => {
    const bytes = new Uint8Array([
      0x4f, 0x67, 0x67, 0x53, // OggS
      0x00, 0x02, 0x00, 0x00,
      0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64, // OpusHead
      0x01, 0x01, 0x38, 0x01,
    ]);

    expect(isLikelyOggOpus(bytes)).toBe(true);
  });

  it("returns false for non-OGG buffers", () => {
    const bytes = new Uint8Array([0x52, 0x49, 0x46, 0x46]); // RIFF
    expect(isLikelyOggOpus(bytes)).toBe(false);
  });

  it("returns false for OGG buffers without Opus header", () => {
    const bytes = new Uint8Array([
      0x4f, 0x67, 0x67, 0x53, // OggS
      0x00, 0x02, 0x00, 0x00,
      0x56, 0x6f, 0x72, 0x62, 0x69, 0x73, // Vorbis
    ]);

    expect(isLikelyOggOpus(bytes)).toBe(false);
  });
});
