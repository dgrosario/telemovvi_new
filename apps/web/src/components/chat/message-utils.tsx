import {
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
} from "lucide-react";
import type { Message } from "@omnichannel/core/domain/entities/message";

export function MessageStatusIcon({ status }: { status: Message.Status }) {
  switch (status) {
    case "senting":
      return <Clock className="size-3 text-gray-400" />;
    case "sent":
      return <Check className="size-3 text-gray-400" />;
    case "delivered":
      return <CheckCheck className="size-3 text-gray-400" />;
    case "viewed":
      return <CheckCheck className="size-3 text-blue-500" />;
    case "failed":
      return <AlertCircle className="size-3 text-red-500" />;
    default:
      return null;
  }
}

export function processContent(content: string): string {
  let processed = content;

  processed = processed
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  processed = processed.replace(
    /```([^`]+)```/g,
    '<code class="bg-gray-100 px-1 py-0.5 rounded font-mono text-xs">$1</code>'
  );
  processed = processed.replace(
    /`([^`]+)`/g,
    '<code class="bg-gray-100 px-1 rounded">$1</code>'
  );
  processed = processed.replace(
    /\*([^*\n]+)\*/g,
    '<strong class="font-bold">$1</strong>'
  );
  processed = processed.replace(
    /_([^_\n]+)_/g,
    '<em class="italic">$1</em>'
  );
  processed = processed.replace(
    /~([^~\n]+)~/g,
    '<del class="line-through">$1</del>'
  );
  processed = processed.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_, text, url) => {
      if (/^(https?:|mailto:)/i.test(url) || url.startsWith("/")) {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline">${text}</a>`;
      }
      return `${text} (${url})`;
    }
  );
  processed = processed.replace(
    /(?<!href="|href='|src="|src='|<code[^>]*>)(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi,
    (match) => {
      const url = match.startsWith("www.") ? `https://${match}` : match;
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline break-all">${match}</a>`;
    }
  );
  processed = processed.replace(
    /^&gt;\s*(.+)$/gm,
    '<blockquote class="border-l-4 border-gray-300 pl-3 italic text-gray-600">$1</blockquote>'
  );
  processed = processed.replace(/ {2,}/g, (match) => "&nbsp;".repeat(match.length));
  processed = processed.replace(/\n/g, "<br />");

  return processed;
}

export const conversationStatusConfig: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  open: { label: "Aberta", color: "text-green-700", bg: "bg-green-100" },
  waiting: { label: "Aguardando", color: "text-amber-700", bg: "bg-amber-100" },
  closed: { label: "Fechada", color: "text-gray-600", bg: "bg-gray-100" },
  expired: { label: "Expirada", color: "text-red-700", bg: "bg-red-100" },
};

export function contentLabel(type: Message.Type): string {
  const labels: Record<string, string> = {
    audio: "Mensagem de áudio",
    image: "Imagem",
    video: "Vídeo",
    document: "Documento",
    sticker: "Figurinha",
    template: "Template",
    location: "Localização",
  };
  return labels[type] ?? type;
}
