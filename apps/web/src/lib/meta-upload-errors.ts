type ParsedMetaError = {
  message: string;
  code?: number;
  subcode?: number;
};

export type NormalizedMetaUploadError = {
  type:
    | "token"
    | "unsupported"
    | "too_large"
    | "permission"
    | "scrutiny_failed"
    | "generic";
  message: string;
};

function parseMetaError(raw: string): ParsedMetaError {
  const trimmed = raw
    .replace(/^Upload failed:\s*/i, "")
    .replace(/^Falha no upload:\s*/i, "")
    .trim();

  let message = trimmed || raw;
  let code: number | undefined;
  let subcode: number | undefined;

  const jsonStart = trimmed.indexOf("{");
  if (jsonStart !== -1) {
    try {
      const parsed = JSON.parse(trimmed.slice(jsonStart));
      const err = parsed?.error ?? parsed;
      if (err?.message) {
        message = String(err.message);
      }
      if (typeof err?.code === "number") {
        code = err.code;
      }
      if (typeof err?.error_subcode === "number") {
        subcode = err.error_subcode;
      }
    } catch (parseError) {
      console.warn("[normalizeMetaUploadError] Failed to parse Meta error JSON:", parseError);
    }
  }

  return { message, code, subcode };
}

export function normalizeMetaUploadError(raw: string): NormalizedMetaUploadError {
  const { message, code, subcode } = parseMetaError(raw);
  const lower = message.toLowerCase();

  if (
    lower.includes("channel_token_invalid") ||
    lower.includes("invalid oauth access token") ||
    code === 190 ||
    subcode === 463 ||
    subcode === 467
  ) {
    return { type: "token", message };
  }

  if (
    lower.includes("media file scrutiny") ||
    lower.includes("mediaenginestatus") ||
    lower.includes("scrutiny for the file failed")
  ) {
    return { type: "scrutiny_failed", message };
  }

  if (
    lower.includes("unsupported file type") ||
    lower.includes("file type not supported") ||
    lower.includes("unsupported media type") ||
    lower.includes("mime type not supported") ||
    lower.includes("mimetype not supported") ||
    lower.includes("invalid file type") ||
    lower.includes("param file must be a file") ||
    lower.includes("received file of type")
  ) {
    return { type: "unsupported", message };
  }

  if (
    lower.includes("file size") ||
    lower.includes("too large") ||
    lower.includes("exceeds") ||
    lower.includes("payload too large")
  ) {
    return { type: "too_large", message };
  }

  if (lower.includes("permission") || lower.includes("not permitted")) {
    return { type: "permission", message };
  }

  return { type: "generic", message };
}
