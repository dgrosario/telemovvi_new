import { describe, it, expect } from "vitest";
import {
  getMessageTypeLabel,
  getMessagePreviewText,
  MESSAGE_TYPE_LABELS,
} from "../message-utils";
import type { Message } from "@omnichannel/core/domain/entities/message";

describe("message-utils", () => {
  describe("MESSAGE_TYPE_LABELS", () => {
    it("should have labels for all message types", () => {
      const expectedTypes: Message.Type[] = [
        "text",
        "image",
        "video",
        "audio",
        "document",
        "sticker",
        "template",
      ];

      expectedTypes.forEach((type) => {
        expect(type in MESSAGE_TYPE_LABELS).toBe(true);
      });
    });
  });

  describe("getMessageTypeLabel", () => {
    it("should return correct label for text", () => {
      expect(getMessageTypeLabel("text")).toBe("Texto");
    });

    it("should return correct label for image", () => {
      expect(getMessageTypeLabel("image")).toBe("Imagem");
    });

    it("should return correct label for video", () => {
      expect(getMessageTypeLabel("video")).toBe("Vídeo");
    });

    it("should return correct label for audio", () => {
      expect(getMessageTypeLabel("audio")).toBe("Áudio");
    });

    it("should return correct label for document", () => {
      expect(getMessageTypeLabel("document")).toBe("Documento");
    });

    it("should return correct label for sticker", () => {
      expect(getMessageTypeLabel("sticker")).toBe("Figurinha");
    });

    it("should return correct label for template", () => {
      expect(getMessageTypeLabel("template")).toBe("Template");
    });

    it("should return fallback for unknown type", () => {
      expect(getMessageTypeLabel("unknown" as Message.Type)).toBe("Mensagem");
    });
  });

  describe("getMessagePreviewText", () => {
    describe("text messages", () => {
      it("should return content for text message", () => {
        const message = { type: "text" as const, content: "Hello world" };
        expect(getMessagePreviewText(message)).toBe("Hello world");
      });

      it("should return fallback for empty content", () => {
        const message = { type: "text" as const, content: "" };
        expect(getMessagePreviewText(message)).toBe("Mensagem");
      });

      it("should return fallback for whitespace-only content", () => {
        const message = { type: "text" as const, content: "   " };
        expect(getMessagePreviewText(message)).toBe("Mensagem");
      });

      it("should return fallback for null content", () => {
        const message = { type: "text" as const, content: null as unknown as string };
        expect(getMessagePreviewText(message)).toBe("Mensagem");
      });

      it("should trim content", () => {
        const message = { type: "text" as const, content: "  Hello  " };
        expect(getMessagePreviewText(message)).toBe("Hello");
      });
    });

    describe("image messages", () => {
      it("should return caption for image message", () => {
        const message = { type: "image" as const, content: "", caption: "My photo" };
        expect(getMessagePreviewText(message)).toBe("My photo");
      });

      it("should return fallback for image without caption", () => {
        const message = { type: "image" as const, content: "" };
        expect(getMessagePreviewText(message)).toBe("Imagem");
      });

      it("should return fallback for empty caption", () => {
        const message = { type: "image" as const, content: "", caption: "" };
        expect(getMessagePreviewText(message)).toBe("Imagem");
      });

      it("should return fallback for whitespace-only caption", () => {
        const message = { type: "image" as const, content: "", caption: "   " };
        expect(getMessagePreviewText(message)).toBe("Imagem");
      });
    });

    describe("video messages", () => {
      it("should return caption for video message", () => {
        const message = { type: "video" as const, content: "", caption: "My video" };
        expect(getMessagePreviewText(message)).toBe("My video");
      });

      it("should return fallback for video without caption", () => {
        const message = { type: "video" as const, content: "" };
        expect(getMessagePreviewText(message)).toBe("Vídeo");
      });

      it("should return fallback for empty caption", () => {
        const message = { type: "video" as const, content: "", caption: "" };
        expect(getMessagePreviewText(message)).toBe("Vídeo");
      });
    });

    describe("audio messages", () => {
      it("should return fixed label for audio", () => {
        const message = { type: "audio" as const, content: "" };
        expect(getMessagePreviewText(message)).toBe("Áudio");
      });
    });

    describe("document messages", () => {
      it("should return filename for document message", () => {
        const message = { type: "document" as const, content: "", filename: "report.pdf" };
        expect(getMessagePreviewText(message)).toBe("report.pdf");
      });

      it("should return fallback for document without filename", () => {
        const message = { type: "document" as const, content: "" };
        expect(getMessagePreviewText(message)).toBe("Documento");
      });

      it("should return fallback for empty filename", () => {
        const message = { type: "document" as const, content: "", filename: "" };
        expect(getMessagePreviewText(message)).toBe("Documento");
      });

      it("should return fallback for whitespace-only filename", () => {
        const message = { type: "document" as const, content: "", filename: "   " };
        expect(getMessagePreviewText(message)).toBe("Documento");
      });
    });

    describe("sticker messages", () => {
      it("should return fixed label for sticker", () => {
        const message = { type: "sticker" as const, content: "" };
        expect(getMessagePreviewText(message)).toBe("Figurinha");
      });
    });

    describe("template messages", () => {
      it("should return content for template message", () => {
        const message = { type: "template" as const, content: "Template content" };
        expect(getMessagePreviewText(message)).toBe("Template content");
      });

      it("should return fallback for template without content", () => {
        const message = { type: "template" as const, content: "" };
        expect(getMessagePreviewText(message)).toBe("Template");
      });

      it("should return fallback for null content", () => {
        const message = { type: "template" as const, content: null as unknown as string };
        expect(getMessagePreviewText(message)).toBe("Template");
      });
    });

  });
});
