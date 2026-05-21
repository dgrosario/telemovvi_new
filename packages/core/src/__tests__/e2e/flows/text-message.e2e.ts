import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { testClient, dbHelper, testEnv } from "../setup/test-environment";
import { MessageBuilder } from "../utils/message-builder";
import { waitFor, delay } from "../utils/wait-for";
import amqp from "amqplib";

describe("Text Message E2E", () => {
  beforeAll(async () => {
    if (!testEnv.PLATFORM_CHANNEL_ID || !testEnv.CLIENT_PHONE_NUMBER) {
      console.warn("[Text Message E2E] Skipping: Environment not configured");
      return;
    }
  });

  describe("Inbound (Test Client -> Platform)", () => {
    it("should receive and process text message in platform database", async () => {
      if (!testEnv.PLATFORM_CHANNEL_ID) {
        console.log("Skipping: PLATFORM_CHANNEL_ID not configured");
        return;
      }

      const uniqueText = MessageBuilder.text("INBOUND");
      console.log(`[Test] Sending message: ${uniqueText}`);

      const { messageId } = await testClient.sendTextMessage(
        testEnv.PLATFORM_PHONE_NUMBER,
        uniqueText
      );

      console.log(`[Test] Message sent with ID: ${messageId}`);

      await delay(2000);

      const conversation = await waitFor(
        () => dbHelper.findOpenConversationByContact(
          testEnv.CLIENT_PHONE_NUMBER,
          testEnv.PLATFORM_CHANNEL_ID
        ),
        {
          timeout: testEnv.MESSAGE_DELIVERY_TIMEOUT,
          interval: testEnv.POLL_INTERVAL,
          timeoutMessage: "Conversation not created within timeout",
        }
      );

      expect(conversation).toBeDefined();
      console.log(`[Test] Conversation found: ${conversation.id}`);

      const dbMessage = await dbHelper.waitForMessage(
        conversation.id,
        (msg) => msg.content.includes(uniqueText),
        {
          timeout: testEnv.MESSAGE_DELIVERY_TIMEOUT,
          interval: testEnv.POLL_INTERVAL,
        }
      );

      expect(dbMessage).toBeDefined();
      expect(dbMessage.content).toContain(uniqueText);
      expect(dbMessage.senderType).toBe("contact");

      console.log(`[Test] Message verified in database: ${dbMessage.id}`);
    });

    it("should create new conversation for new contact", async () => {
      if (!testEnv.PLATFORM_CHANNEL_ID) {
        console.log("Skipping: PLATFORM_CHANNEL_ID not configured");
        return;
      }

      await dbHelper.cleanupTestData(testEnv.CLIENT_PHONE_NUMBER);
      console.log("[Test] Cleaned up existing test data");

      const uniqueText = MessageBuilder.text("NEW-CONV");
      console.log(`[Test] Sending message to create new conversation: ${uniqueText}`);

      await testClient.sendTextMessage(
        testEnv.PLATFORM_PHONE_NUMBER,
        uniqueText
      );

      const conversation = await waitFor(
        () => dbHelper.findOpenConversationByContact(
          testEnv.CLIENT_PHONE_NUMBER,
          testEnv.PLATFORM_CHANNEL_ID
        ),
        {
          timeout: testEnv.MESSAGE_DELIVERY_TIMEOUT,
          interval: testEnv.POLL_INTERVAL,
        }
      );

      expect(conversation).toBeDefined();
      expect(["open", "waiting"]).toContain(conversation.status);
      expect(conversation.channel).toBe(testEnv.PLATFORM_CHANNEL_ID);

      console.log(`[Test] New conversation created: ${conversation.id}`);
    });

    it("should reuse existing open conversation", async () => {
      if (!testEnv.PLATFORM_CHANNEL_ID) {
        console.log("Skipping: PLATFORM_CHANNEL_ID not configured");
        return;
      }

      const firstMessage = MessageBuilder.text("FIRST");
      await testClient.sendTextMessage(testEnv.PLATFORM_PHONE_NUMBER, firstMessage);

      const firstConversation = await waitFor(
        () => dbHelper.findOpenConversationByContact(
          testEnv.CLIENT_PHONE_NUMBER,
          testEnv.PLATFORM_CHANNEL_ID
        ),
        { timeout: testEnv.MESSAGE_DELIVERY_TIMEOUT }
      );

      expect(firstConversation).toBeDefined();

      await delay(2000);

      const secondMessage = MessageBuilder.text("SECOND");
      await testClient.sendTextMessage(testEnv.PLATFORM_PHONE_NUMBER, secondMessage);

      await delay(3000);

      const secondConversation = await dbHelper.findOpenConversationByContact(
        testEnv.CLIENT_PHONE_NUMBER,
        testEnv.PLATFORM_CHANNEL_ID
      );

      expect(secondConversation).toBeDefined();
      expect(secondConversation!.id).toBe(firstConversation.id);

      const messageCount = await dbHelper.getConversationMessageCount(firstConversation.id);
      expect(messageCount).toBeGreaterThanOrEqual(2);

      console.log(`[Test] Both messages added to same conversation: ${firstConversation.id}`);
    });
  });

  describe("Outbound (Platform -> Test Client)", () => {
    it("should deliver response to test client via RabbitMQ", async () => {
      if (!testEnv.RABBITMQ_URL || !testEnv.PLATFORM_CHANNEL_ID) {
        console.log("Skipping: RABBITMQ_URL or PLATFORM_CHANNEL_ID not configured");
        return;
      }

      const conversation = await dbHelper.findOpenConversationByContact(
        testEnv.CLIENT_PHONE_NUMBER,
        testEnv.PLATFORM_CHANNEL_ID
      );

      if (!conversation) {
        const setupMessage = MessageBuilder.text("SETUP");
        await testClient.sendTextMessage(testEnv.PLATFORM_PHONE_NUMBER, setupMessage);

        await waitFor(
          () => dbHelper.findOpenConversationByContact(
            testEnv.CLIENT_PHONE_NUMBER,
            testEnv.PLATFORM_CHANNEL_ID
          ),
          { timeout: testEnv.MESSAGE_DELIVERY_TIMEOUT }
        );
      }

      const activeConversation = await dbHelper.findOpenConversationByContact(
        testEnv.CLIENT_PHONE_NUMBER,
        testEnv.PLATFORM_CHANNEL_ID
      );

      expect(activeConversation).toBeDefined();

      const responseText = MessageBuilder.text("RESPONSE");
      const correlationId = MessageBuilder.uniqueId();

      console.log(`[Test] Sending outbound response: ${responseText}`);

      const connection = await amqp.connect(testEnv.RABBITMQ_URL);
      const channel = await connection.createChannel();

      const DLQ_NAME = `${testEnv.OUTBOUND_QUEUE_NAME}.dlq`;
      await channel.assertQueue(DLQ_NAME, { durable: true });
      await channel.assertQueue(testEnv.OUTBOUND_QUEUE_NAME, {
        durable: true,
        arguments: {
          "x-dead-letter-exchange": "",
          "x-dead-letter-routing-key": DLQ_NAME,
        },
      });

      const payload = {
        content: responseText,
        conversationId: activeConversation!.id,
        channelId: testEnv.PLATFORM_CHANNEL_ID,
        workspaceId: testEnv.PLATFORM_WORKSPACE_ID,
        createdAt: new Date().toISOString(),
        sender: {
          id: "test-system",
          name: "E2E Test",
          type: "attendant",
        },
        type: "text",
        correlationId,
      };

      channel.sendToQueue(
        testEnv.OUTBOUND_QUEUE_NAME,
        Buffer.from(JSON.stringify(payload)),
        { persistent: true }
      );

      console.log(`[Test] Message enqueued with correlationId: ${correlationId}`);

      await channel.close();
      await connection.close();

      const receivedMessage = await testClient.waitForMessage(
        testEnv.PLATFORM_PHONE_NUMBER,
        (msg) => {
          const text = testClient.getMessageText(msg);
          return text?.includes(responseText) || false;
        },
        {
          timeout: testEnv.RESPONSE_TIMEOUT,
          interval: 2000,
        }
      );

      expect(receivedMessage).toBeDefined();
      const messageText = testClient.getMessageText(receivedMessage);
      expect(messageText).toContain(responseText);

      console.log(`[Test] Response received by test client: ${receivedMessage.key.id}`);
    });
  });

  describe("Round Trip (Test -> Platform -> Test)", () => {
    it("should complete full message round trip", async () => {
      if (!testEnv.RABBITMQ_URL || !testEnv.PLATFORM_CHANNEL_ID) {
        console.log("Skipping: Environment not fully configured");
        return;
      }

      const inboundText = MessageBuilder.text("ROUNDTRIP-IN");
      console.log(`[Test] Step 1: Sending inbound message: ${inboundText}`);

      await testClient.sendTextMessage(testEnv.PLATFORM_PHONE_NUMBER, inboundText);

      const conversation = await waitFor(
        () => dbHelper.findOpenConversationByContact(
          testEnv.CLIENT_PHONE_NUMBER,
          testEnv.PLATFORM_CHANNEL_ID
        ),
        { timeout: testEnv.MESSAGE_DELIVERY_TIMEOUT }
      );

      expect(conversation).toBeDefined();

      const inboundDbMessage = await dbHelper.waitForMessage(
        conversation.id,
        (msg) => msg.content.includes(inboundText),
        { timeout: testEnv.MESSAGE_DELIVERY_TIMEOUT }
      );

      expect(inboundDbMessage).toBeDefined();
      console.log(`[Test] Step 2: Inbound message processed: ${inboundDbMessage.id}`);

      const outboundText = MessageBuilder.text("ROUNDTRIP-OUT");
      const connection = await amqp.connect(testEnv.RABBITMQ_URL);
      const channel = await connection.createChannel();

      const DLQ_NAME = `${testEnv.OUTBOUND_QUEUE_NAME}.dlq`;
      await channel.assertQueue(DLQ_NAME, { durable: true });
      await channel.assertQueue(testEnv.OUTBOUND_QUEUE_NAME, {
        durable: true,
        arguments: {
          "x-dead-letter-exchange": "",
          "x-dead-letter-routing-key": DLQ_NAME,
        },
      });

      const payload = {
        content: outboundText,
        conversationId: conversation.id,
        channelId: testEnv.PLATFORM_CHANNEL_ID,
        workspaceId: testEnv.PLATFORM_WORKSPACE_ID,
        createdAt: new Date().toISOString(),
        sender: {
          id: "test-system",
          name: "E2E Test",
          type: "attendant",
        },
        type: "text",
        correlationId: MessageBuilder.uniqueId(),
      };

      channel.sendToQueue(
        testEnv.OUTBOUND_QUEUE_NAME,
        Buffer.from(JSON.stringify(payload)),
        { persistent: true }
      );

      console.log(`[Test] Step 3: Outbound message enqueued: ${outboundText}`);

      await channel.close();
      await connection.close();

      const receivedMessage = await testClient.waitForMessage(
        testEnv.PLATFORM_PHONE_NUMBER,
        (msg) => {
          const text = testClient.getMessageText(msg);
          return text?.includes(outboundText) || false;
        },
        { timeout: testEnv.RESPONSE_TIMEOUT }
      );

      expect(receivedMessage).toBeDefined();
      console.log(`[Test] Step 4: Outbound message received: ${receivedMessage.key.id}`);

      console.log("[Test] Full round trip completed successfully!");
    });
  });
});
