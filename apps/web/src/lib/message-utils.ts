import { Message } from "@omnichannel/core/domain/entities/message";

// Type-safe labels com Record para garantir exhaustiveness em compile-time
export const MESSAGE_TYPE_LABELS: Record<Message.Type, string> = {
  text: "Texto",
  image: "Imagem",
  video: "Vídeo",
  audio: "Áudio",
  document: "Documento",
  sticker: "Figurinha",
  template: "Template",
  location: "Localização",
};

export function getMessageTypeLabel(type: Message.Type): string {
  return MESSAGE_TYPE_LABELS[type] ?? "Mensagem";
}

// Strategy pattern para preview de mensagens
type MessagePreviewData = Pick<Message.Raw, "type" | "content"> & {
  caption?: string | null;
  filename?: string | null;
};

type PreviewStrategy = (message: MessagePreviewData) => string;

// Record garante que todos os tipos de Message.Type estao cobertos
const previewStrategies: Record<Message.Type, PreviewStrategy> = {
  text: (m) => m.content?.trim() || "Mensagem",
  image: (m) => m.caption?.trim() || "Imagem",
  video: (m) => m.caption?.trim() || "Vídeo",
  audio: () => "Áudio",
  document: (m) => m.filename?.trim() || "Documento",
  sticker: () => "Figurinha",
  template: (m) => m.content?.trim() || "Template",
  location: (m) => {
    try {
      const data = JSON.parse(m.content);
      return data.name || data.address || "Localização";
    } catch {
      return "Localização";
    }
  },
};

export function getMessagePreviewText(message: MessagePreviewData): string {
  return previewStrategies[message.type](message);
}
