export interface MetaChannelPayload {
  phoneId?: string;
  accessToken?: string;
  pageId?: string;
}

export interface EvolutionChannelPayload {
  instanceName: string;
  apiKey?: string;
}

export interface MetaMediaUploadResponse {
  id: string;
}

export function isMetaChannelPayload(payload: unknown): payload is MetaChannelPayload {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  const hasPhoneId =
    Object.prototype.hasOwnProperty.call(payload, "phoneId") &&
    typeof (payload as { phoneId?: unknown }).phoneId === "string";
  const hasAccessToken =
    Object.prototype.hasOwnProperty.call(payload, "accessToken") &&
    typeof (payload as { accessToken?: unknown }).accessToken === "string";
  const hasPageId =
    Object.prototype.hasOwnProperty.call(payload, "pageId") &&
    typeof (payload as { pageId?: unknown }).pageId === "string";

  return hasPhoneId || hasAccessToken || hasPageId;
}

export function extractMetaChannelPayload(payload: Record<string, unknown>): MetaChannelPayload | null {
  if (!isMetaChannelPayload(payload)) {
    return null;
  }
  return {
    phoneId: typeof payload.phoneId === "string" ? payload.phoneId : undefined,
    accessToken: typeof payload.accessToken === "string" ? payload.accessToken : undefined,
    pageId: typeof payload.pageId === "string" ? payload.pageId : undefined,
  };
}

export function isEvolutionChannelPayload(payload: unknown): payload is EvolutionChannelPayload {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  return (
    Object.prototype.hasOwnProperty.call(payload, "instanceName") &&
    typeof (payload as { instanceName?: unknown }).instanceName === "string"
  );
}

export function isMetaMediaUploadResponse(data: unknown): data is MetaMediaUploadResponse {
  if (typeof data !== "object" || data === null) {
    return false;
  }

  return (
    Object.prototype.hasOwnProperty.call(data, "id") &&
    typeof (data as { id?: unknown }).id === "string"
  );
}
