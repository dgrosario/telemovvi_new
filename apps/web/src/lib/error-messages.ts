export const ERROR_MESSAGES: Record<string, string> = {
  CONFLICT: "Esta conversa já está sendo atendida",
  NOT_FOUND: "Conversa não encontrada",
  UNAUTHORIZED: "Você não tem permissão para esta ação",
  SECTOR_NOT_FOUND: "Setor selecionado não encontrado",
  INVALID_STATUS: "Status da conversa não permite esta ação",
  WHATSAPP_GROUP_ASSIGNMENT_FORBIDDEN:
    "Grupos do WhatsApp não podem ter atendentes atribuídos",
};

type ErrorParseResult = {
  message: string;
  isConflict: boolean;
};

type ParsedError = {
  code?: string;
  message?: string;
};

const isParsedError = (value: unknown): value is ParsedError => {
  return (
    typeof value === "object" &&
    value !== null &&
    (!("code" in value) || typeof (value as ParsedError).code === "string") &&
    (!("message" in value) ||
      typeof (value as ParsedError).message === "string")
  );
};

const tryParseJson = (value: string): unknown | null => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const parseErrorPayload = (rawMessage: string): ParsedError | null => {
  const trimmed = rawMessage.trim();
  const candidates = new Set<string>([trimmed]);

  if (trimmed.startsWith("Error:")) {
    candidates.add(trimmed.replace(/^Error:\s*/, ""));
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.add(trimmed.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    const parsed = tryParseJson(candidate);
    if (isParsedError(parsed)) {
      return parsed;
    }

    // Handle double-serialized payloads: "\"{...}\""
    if (typeof parsed === "string") {
      const parsedTwice = tryParseJson(parsed);
      if (isParsedError(parsedTwice)) {
        return parsedTwice;
      }
    }
  }

  return null;
};

export const getErrorMessage = (
  error: unknown,
  defaultMessage: string
): ErrorParseResult => {
  const errorMessage =
    error instanceof Error ? error.message : String(error);
  const normalizedError = errorMessage.toLowerCase();

  if (
    normalizedError.includes("grupos do whatsapp") &&
    normalizedError.includes("atendentes atribuidos")
  ) {
    return {
      message: ERROR_MESSAGES.WHATSAPP_GROUP_ASSIGNMENT_FORBIDDEN,
      isConflict: false,
    };
  }

  const parsed = parseErrorPayload(errorMessage);
  if (parsed) {
    const isConflict = parsed.code === "CONFLICT";
    const message = parsed.code
      ? ERROR_MESSAGES[parsed.code] ?? parsed.message ?? defaultMessage
      : parsed.message ?? defaultMessage;
    return { message, isConflict };
  }

  if (errorMessage.toUpperCase().includes("CONFLICT")) {
    return { message: ERROR_MESSAGES.CONFLICT, isConflict: true };
  }

  return { message: defaultMessage, isConflict: false };
};
