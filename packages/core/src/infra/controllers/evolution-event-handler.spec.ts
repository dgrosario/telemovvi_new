import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EvolutionEventHandler,
  EvolutionEventHandlerCallbacks,
  EvolutionEvent,
} from "./evolution-event-handler";
import { RabbitMQMessage } from "../drivers/rabbitmq-consumer-driver";

describe("EvolutionEventHandler", () => {
  let callbacks: EvolutionEventHandlerCallbacks;
  let handler: EvolutionEventHandler;

  beforeEach(() => {
    callbacks = {
      onMessageReceived: vi.fn().mockResolvedValue(undefined),
      onMessageStatusUpdate: vi.fn().mockResolvedValue(undefined),
      onConnectionUpdate: vi.fn().mockResolvedValue(undefined),
      onQrcodeUpdate: vi.fn().mockResolvedValue(undefined),
      onContactUpsert: vi.fn().mockResolvedValue(undefined),
      onPresenceUpdate: vi.fn().mockResolvedValue(undefined),
      onMessageDelete: vi.fn().mockResolvedValue(undefined),
      onSendMessage: vi.fn().mockResolvedValue(undefined),
    };
    handler = EvolutionEventHandler.create(callbacks);
  });

  describe("handleMessagesUpsert", () => {
    it("should process incoming text message", async () => {
      const event: RabbitMQMessage<EvolutionEvent.MessagesUpsertData> = {
        event: "messages.upsert",
        instance: "test-instance",
        data: {
          key: {
            remoteJid: "5511999999999@s.whatsapp.net",
            fromMe: false,
            id: "msg-123",
          },
          message: {
            conversation: "Hello, this is a test message",
          },
          messageTimestamp: 1700000000,
          pushName: "John Doe",
        },
      };

      await handler.handleMessagesUpsert(event);

      expect(callbacks.onMessageReceived).toHaveBeenCalledWith({
        instanceName: "test-instance",
        messageId: "msg-123",
        remoteJid: "5511999999999@s.whatsapp.net",
        fromMe: false,
        content: "Hello, this is a test message",
        type: "text",
        timestamp: 1700000000,
        contactName: "John Doe",
        mediaUrl: undefined,
        mimetype: undefined,
        caption: undefined,
        filename: undefined,
        mediaKey: undefined,
        expectedChannelType: "evolution",
        isGroup: false,
        groupJid: undefined,
        participantJid: undefined,
        participantName: undefined,
      });
    });

    it("should process extended text message", async () => {
      const event: RabbitMQMessage<EvolutionEvent.MessagesUpsertData> = {
        event: "messages.upsert",
        instance: "test-instance",
        data: {
          key: {
            remoteJid: "5511999999999@s.whatsapp.net",
            fromMe: false,
            id: "msg-456",
          },
          message: {
            extendedTextMessage: {
              text: "Extended message with link",
            },
          },
          messageTimestamp: 1700000001,
          pushName: "Jane Doe",
        },
      };

      await handler.handleMessagesUpsert(event);

      expect(callbacks.onMessageReceived).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "Extended message with link",
          type: "text",
        })
      );
    });

    it("should process image message", async () => {
      const event: RabbitMQMessage<EvolutionEvent.MessagesUpsertData> = {
        event: "messages.upsert",
        instance: "test-instance",
        data: {
          key: {
            remoteJid: "5511999999999@s.whatsapp.net",
            fromMe: false,
            id: "msg-789",
          },
          message: {
            imageMessage: {
              url: "https://example.com/image.jpg",
              mimetype: "image/jpeg",
              caption: "Check this out!",
              fileSha256: "abc123",
              fileLength: "1024",
              mediaKey: "key123",
            },
          },
          messageTimestamp: 1700000002,
          pushName: "John Doe",
        },
      };

      await handler.handleMessagesUpsert(event);

      expect(callbacks.onMessageReceived).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "image",
          mediaUrl: "https://example.com/image.jpg",
          mimetype: "image/jpeg",
          caption: "Check this out!",
        })
      );
    });

    it("should process audio message", async () => {
      const event: RabbitMQMessage<EvolutionEvent.MessagesUpsertData> = {
        event: "messages.upsert",
        instance: "test-instance",
        data: {
          key: {
            remoteJid: "5511999999999@s.whatsapp.net",
            fromMe: false,
            id: "msg-audio",
          },
          message: {
            audioMessage: {
              url: "https://example.com/audio.ogg",
              mimetype: "audio/ogg",
              fileSha256: "abc123",
              fileLength: "2048",
              seconds: 30,
              ptt: true,
              mediaKey: "key456",
            },
          },
          messageTimestamp: 1700000003,
          pushName: "John Doe",
        },
      };

      await handler.handleMessagesUpsert(event);

      expect(callbacks.onMessageReceived).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "audio",
          mediaUrl: "https://example.com/audio.ogg",
          mimetype: "audio/ogg",
        })
      );
    });

    it("should process document message", async () => {
      const event: RabbitMQMessage<EvolutionEvent.MessagesUpsertData> = {
        event: "messages.upsert",
        instance: "test-instance",
        data: {
          key: {
            remoteJid: "5511999999999@s.whatsapp.net",
            fromMe: false,
            id: "msg-doc",
          },
          message: {
            documentMessage: {
              url: "https://example.com/document.pdf",
              mimetype: "application/pdf",
              title: "report.pdf",
              fileSha256: "abc123",
              fileLength: "4096",
              mediaKey: "key789",
            },
          },
          messageTimestamp: 1700000004,
          pushName: "John Doe",
        },
      };

      await handler.handleMessagesUpsert(event);

      expect(callbacks.onMessageReceived).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "document",
          mediaUrl: "https://example.com/document.pdf",
          mimetype: "application/pdf",
          filename: "report.pdf",
        })
      );
    });

    it("should ignore outgoing messages (fromMe: true)", async () => {
      const event: RabbitMQMessage<EvolutionEvent.MessagesUpsertData> = {
        event: "messages.upsert",
        instance: "test-instance",
        data: {
          key: {
            remoteJid: "5511999999999@s.whatsapp.net",
            fromMe: true,
            id: "msg-outgoing",
          },
          message: {
            conversation: "Outgoing message",
          },
          messageTimestamp: 1700000005,
          pushName: "Me",
        },
      };

      await handler.handleMessagesUpsert(event);

      expect(callbacks.onMessageReceived).not.toHaveBeenCalled();
    });

    it("should skip empty messages", async () => {
      const event: RabbitMQMessage<EvolutionEvent.MessagesUpsertData> = {
        event: "messages.upsert",
        instance: "test-instance",
        data: {
          key: {
            remoteJid: "5511999999999@s.whatsapp.net",
            fromMe: false,
            id: "msg-empty",
          },
          message: {},
          messageTimestamp: 1700000006,
          pushName: "John Doe",
        },
      };

      await handler.handleMessagesUpsert(event);

      expect(callbacks.onMessageReceived).not.toHaveBeenCalled();
    });

    it("should use phone number as contact name when pushName is missing", async () => {
      const event: RabbitMQMessage<EvolutionEvent.MessagesUpsertData> = {
        event: "messages.upsert",
        instance: "test-instance",
        data: {
          key: {
            remoteJid: "5511999999999@s.whatsapp.net",
            fromMe: false,
            id: "msg-no-name",
          },
          message: {
            conversation: "Message without pushName",
          },
          messageTimestamp: 1700000007,
          pushName: "",
        },
      };

      await handler.handleMessagesUpsert(event);

      expect(callbacks.onMessageReceived).toHaveBeenCalledWith(
        expect.objectContaining({
          contactName: "5511999999999",
        })
      );
    });
  });

  describe("handleMessagesUpdate", () => {
    it("should process status update for sent message", async () => {
      const event: RabbitMQMessage<EvolutionEvent.MessagesUpdateData[]> = {
        event: "messages.update",
        instance: "test-instance",
        data: [
          {
            key: {
              remoteJid: "5511999999999@s.whatsapp.net",
              fromMe: true,
              id: "msg-status",
            },
            update: {
              status: 3,
            },
          },
        ],
      };

      await handler.handleMessagesUpdate(event);

      expect(callbacks.onMessageStatusUpdate).toHaveBeenCalledWith({
        instanceName: "test-instance",
        messageId: "msg-status",
        remoteJid: "5511999999999@s.whatsapp.net",
        status: "delivered",
      });
    });

    it("should map status 2 to sent", async () => {
      const event: RabbitMQMessage<EvolutionEvent.MessagesUpdateData[]> = {
        event: "messages.update",
        instance: "test-instance",
        data: [
          {
            key: {
              remoteJid: "5511999999999@s.whatsapp.net",
              fromMe: true,
              id: "msg-sent",
            },
            update: {
              status: 2,
            },
          },
        ],
      };

      await handler.handleMessagesUpdate(event);

      expect(callbacks.onMessageStatusUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "sent",
        })
      );
    });

    it("should map status 4 to viewed", async () => {
      const event: RabbitMQMessage<EvolutionEvent.MessagesUpdateData[]> = {
        event: "messages.update",
        instance: "test-instance",
        data: [
          {
            key: {
              remoteJid: "5511999999999@s.whatsapp.net",
              fromMe: true,
              id: "msg-viewed",
            },
            update: {
              status: 4,
            },
          },
        ],
      };

      await handler.handleMessagesUpdate(event);

      expect(callbacks.onMessageStatusUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "viewed",
        })
      );
    });

    it("should map status 5 to failed", async () => {
      const event: RabbitMQMessage<EvolutionEvent.MessagesUpdateData[]> = {
        event: "messages.update",
        instance: "test-instance",
        data: [
          {
            key: {
              remoteJid: "5511999999999@s.whatsapp.net",
              fromMe: true,
              id: "msg-failed-code",
            },
            update: {
              status: 5,
            },
          },
        ],
      };

      await handler.handleMessagesUpdate(event);

      expect(callbacks.onMessageStatusUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "failed",
        })
      );
    });

    it("should map FAILED string status to failed", async () => {
      const event: RabbitMQMessage<EvolutionEvent.MessagesUpdateData[]> = {
        event: "messages.update",
        instance: "test-instance",
        data: [
          {
            keyId: "msg-failed-string",
            remoteJid: "5511999999999@s.whatsapp.net",
            fromMe: true,
            status: "FAILED",
          },
        ],
      };

      await handler.handleMessagesUpdate(event);

      expect(callbacks.onMessageStatusUpdate).toHaveBeenCalledWith({
        instanceName: "test-instance",
        messageId: "msg-failed-string",
        remoteJid: "5511999999999@s.whatsapp.net",
        status: "failed",
      });
    });

    it("should process status updates even when fromMe is false", async () => {
      const event: RabbitMQMessage<EvolutionEvent.MessagesUpdateData[]> = {
        event: "messages.update",
        instance: "test-instance",
        data: [
          {
            key: {
              remoteJid: "5511999999999@s.whatsapp.net",
              fromMe: false,
              id: "msg-incoming",
            },
            update: {
              status: 3,
            },
          },
        ],
      };

      await handler.handleMessagesUpdate(event);

      expect(callbacks.onMessageStatusUpdate).toHaveBeenCalledWith({
        instanceName: "test-instance",
        messageId: "msg-incoming",
        remoteJid: "5511999999999@s.whatsapp.net",
        status: "delivered",
      });
    });
  });

  describe("handleConnectionUpdate", () => {
    it("should process connection open", async () => {
      const event: RabbitMQMessage<EvolutionEvent.ConnectionUpdateData> = {
        event: "connection.update",
        instance: "test-instance",
        data: {
          state: "open",
        },
      };

      await handler.handleConnectionUpdate(event);

      expect(callbacks.onConnectionUpdate).toHaveBeenCalledWith({
        instanceName: "test-instance",
        state: "open",
        statusReason: undefined,
      });
    });

    it("should process connection close with status reason", async () => {
      const event: RabbitMQMessage<EvolutionEvent.ConnectionUpdateData> = {
        event: "connection.update",
        instance: "test-instance",
        data: {
          state: "close",
          statusReason: 401,
        },
      };

      await handler.handleConnectionUpdate(event);

      expect(callbacks.onConnectionUpdate).toHaveBeenCalledWith({
        instanceName: "test-instance",
        state: "close",
        statusReason: 401,
      });
    });
  });

  describe("handleQrcodeUpdate", () => {
    it("should process QR code update", async () => {
      const event: RabbitMQMessage<EvolutionEvent.QrcodeUpdateData> = {
        event: "qrcode.updated",
        instance: "test-instance",
        data: {
          qrcode: {
            base64: "data:image/png;base64,iVBORw0KGgo...",
            code: "2@ABC123",
          },
        },
      };

      await handler.handleQrcodeUpdate(event);

      expect(callbacks.onQrcodeUpdate).toHaveBeenCalledWith({
        instanceName: "test-instance",
        qrcodeBase64: "data:image/png;base64,iVBORw0KGgo...",
      });
    });
  });

  describe("handleContactsUpsert", () => {
    it("should process contact upsert with name", async () => {
      const event: RabbitMQMessage<EvolutionEvent.ContactsUpsertData> = {
        event: "contacts.upsert",
        instance: "test-instance",
        data: {
          contacts: [
            {
              id: "5511999999999@s.whatsapp.net",
              name: "John Doe",
              imgUrl: "https://example.com/avatar.jpg",
            },
          ],
        },
      };

      await handler.handleContactsUpsert(event);

      expect(callbacks.onContactUpsert).toHaveBeenCalledWith({
        instanceName: "test-instance",
        contactId: "5511999999999@s.whatsapp.net",
        contactName: "John Doe",
        contactThumbnail: "https://example.com/avatar.jpg",
      });
    });

    it("should use notify as fallback for contact name", async () => {
      const event: RabbitMQMessage<EvolutionEvent.ContactsUpsertData> = {
        event: "contacts.upsert",
        instance: "test-instance",
        data: {
          contacts: [
            {
              id: "5511999999999@s.whatsapp.net",
              notify: "Johnny",
            },
          ],
        },
      };

      await handler.handleContactsUpsert(event);

      expect(callbacks.onContactUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          contactName: "Johnny",
        })
      );
    });

    it("should use phone number as fallback for contact name", async () => {
      const event: RabbitMQMessage<EvolutionEvent.ContactsUpsertData> = {
        event: "contacts.upsert",
        instance: "test-instance",
        data: {
          contacts: [
            {
              id: "5511999999999@s.whatsapp.net",
            },
          ],
        },
      };

      await handler.handleContactsUpsert(event);

      expect(callbacks.onContactUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          contactName: "5511999999999",
        })
      );
    });

    it("should process multiple contacts", async () => {
      const event: RabbitMQMessage<EvolutionEvent.ContactsUpsertData> = {
        event: "contacts.upsert",
        instance: "test-instance",
        data: {
          contacts: [
            { id: "5511111111111@s.whatsapp.net", name: "Contact 1" },
            { id: "5522222222222@s.whatsapp.net", name: "Contact 2" },
          ],
        },
      };

      await handler.handleContactsUpsert(event);

      expect(callbacks.onContactUpsert).toHaveBeenCalledTimes(2);
    });
  });

  describe("handlePresenceUpdate", () => {
    it("should process presence update", async () => {
      const event: RabbitMQMessage<EvolutionEvent.PresenceUpdateData> = {
        event: "presence.update",
        instance: "test-instance",
        data: {
          id: "5511999999999@s.whatsapp.net",
          presences: {
            "5511999999999@s.whatsapp.net": {
              lastKnownPresence: "composing",
            },
          },
        },
      };

      await handler.handlePresenceUpdate(event);

      expect(callbacks.onPresenceUpdate).toHaveBeenCalledWith({
        instanceName: "test-instance",
        remoteJid: "5511999999999@s.whatsapp.net",
        presence: "composing",
        lastSeen: undefined,
      });
    });

    it("should include lastSeen when available", async () => {
      const event: RabbitMQMessage<EvolutionEvent.PresenceUpdateData> = {
        event: "presence.update",
        instance: "test-instance",
        data: {
          id: "5511999999999@s.whatsapp.net",
          presences: {
            "5511999999999@s.whatsapp.net": {
              lastKnownPresence: "unavailable",
              lastSeen: 1700000000,
            },
          },
        },
      };

      await handler.handlePresenceUpdate(event);

      expect(callbacks.onPresenceUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          presence: "unavailable",
          lastSeen: 1700000000,
        })
      );
    });
  });

  describe("handleMessagesDelete", () => {
    it("should process message deletion", async () => {
      const event: RabbitMQMessage<EvolutionEvent.MessagesDeleteData> = {
        event: "messages.delete",
        instance: "test-instance",
        data: {
          key: {
            remoteJid: "5511999999999@s.whatsapp.net",
            fromMe: false,
            id: "msg-deleted",
          },
        },
      };

      await handler.handleMessagesDelete(event);

      expect(callbacks.onMessageDelete).toHaveBeenCalledWith({
        instanceName: "test-instance",
        messageId: "msg-deleted",
        remoteJid: "5511999999999@s.whatsapp.net",
      });
    });

    it("should prefer the revoke target id when delete payload includes protocolMessage", async () => {
      const event: RabbitMQMessage<EvolutionEvent.MessagesDeleteData> = {
        event: "messages.delete",
        instance: "test-instance",
        data: {
          id: "cmn-delete-event-1",
          remoteJid: "5511999999999@s.whatsapp.net",
          message: {
            protocolMessage: {
              key: {
                remoteJid: "5511999999999@s.whatsapp.net",
                fromMe: true,
                id: "msg-target",
              },
              type: "REVOKE",
            },
          },
        },
      };

      await handler.handleMessagesDelete(event);

      expect(callbacks.onMessageDelete).toHaveBeenCalledWith({
        instanceName: "test-instance",
        messageId: "msg-target",
        remoteJid: "5511999999999@s.whatsapp.net",
      });
    });
  });

  describe("handleSendMessage", () => {
    it("should process send message confirmation", async () => {
      const event: RabbitMQMessage<EvolutionEvent.SendMessageData> = {
        event: "send.message",
        instance: "test-instance",
        data: {
          key: {
            remoteJid: "5511999999999@s.whatsapp.net",
            fromMe: true,
            id: "msg-sent-confirm",
          },
          message: {
            conversation: "Hello!",
          },
          messageTimestamp: 1700000010,
          status: "PENDING",
        },
      };

      await handler.handleSendMessage(event);

      expect(callbacks.onSendMessage).toHaveBeenCalledWith({
        instanceName: "test-instance",
        messageId: "msg-sent-confirm",
        remoteJid: "5511999999999@s.whatsapp.net",
        status: "PENDING",
        timestamp: 1700000010,
      });
    });
  });
});
