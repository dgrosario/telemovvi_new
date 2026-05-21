import { config } from "dotenv";
import * as path from "path";
import { beforeAll, afterAll } from "vitest";
import { EvolutionTestClient } from "./evolution-test-client";
import { DatabaseHelper } from "../helpers/database-helper";

const envPath = path.join(__dirname, "..", "..", "..", "..", ".env.test");
config({ path: envPath });

export const testEnv = {
  EVOLUTION_URL: process.env.TEST_EVOLUTION_URL || "http://localhost:8080",
  EVOLUTION_API_KEY: process.env.TEST_EVOLUTION_API_KEY || "",
  EVOLUTION_INSTANCE_NAME: process.env.TEST_EVOLUTION_INSTANCE_NAME || "test-client",

  PLATFORM_INSTANCE_NAME: process.env.TEST_PLATFORM_INSTANCE_NAME || "",
  PLATFORM_CHANNEL_ID: process.env.TEST_PLATFORM_CHANNEL_ID || "",
  PLATFORM_WORKSPACE_ID: process.env.TEST_PLATFORM_WORKSPACE_ID || "",

  CLIENT_PHONE_NUMBER: process.env.TEST_CLIENT_PHONE_NUMBER || "",
  PLATFORM_PHONE_NUMBER: process.env.TEST_PLATFORM_PHONE_NUMBER || "",

  MESSAGE_DELIVERY_TIMEOUT: parseInt(process.env.TEST_MESSAGE_DELIVERY_TIMEOUT || "30000", 10),
  RESPONSE_TIMEOUT: parseInt(process.env.TEST_RESPONSE_TIMEOUT || "60000", 10),
  POLL_INTERVAL: parseInt(process.env.TEST_POLL_INTERVAL || "1000", 10),

  RABBITMQ_URL: process.env.RABBITMQ_URL || "",
  OUTBOUND_QUEUE_NAME: process.env.OUTBOUND_QUEUE_NAME || "outbound-messages",
};

export let testClient: EvolutionTestClient;
export let dbHelper: DatabaseHelper;

function validateEnvironment(): void {
  const requiredVars = [
    "TEST_EVOLUTION_URL",
    "TEST_EVOLUTION_API_KEY",
    "TEST_EVOLUTION_INSTANCE_NAME",
    "TEST_PLATFORM_CHANNEL_ID",
    "TEST_PLATFORM_WORKSPACE_ID",
    "TEST_CLIENT_PHONE_NUMBER",
    "TEST_PLATFORM_PHONE_NUMBER",
  ];

  const missing = requiredVars.filter((v) => !process.env[v]);

  if (missing.length > 0) {
    console.warn(
      `[E2E Setup] Warning: Missing environment variables: ${missing.join(", ")}`
    );
    console.warn("[E2E Setup] Please check your .env.test file");
  }
}

beforeAll(async () => {
  console.log("[E2E Setup] Initializing test environment...");

  validateEnvironment();

  testClient = EvolutionTestClient.create({
    baseUrl: testEnv.EVOLUTION_URL,
    apiKey: testEnv.EVOLUTION_API_KEY,
    instanceName: testEnv.EVOLUTION_INSTANCE_NAME,
  });

  dbHelper = DatabaseHelper.instance();

  try {
    await testClient.ensureConnected();
    console.log("[E2E Setup] Test client connected successfully");
  } catch (error) {
    console.error("[E2E Setup] Test client connection check failed:", error);
    console.warn("[E2E Setup] Tests may fail if Evolution instance is not connected");
  }

  console.log("[E2E Setup] Test environment initialized");
  console.log(`[E2E Setup] Test client instance: ${testEnv.EVOLUTION_INSTANCE_NAME}`);
  console.log(`[E2E Setup] Platform channel ID: ${testEnv.PLATFORM_CHANNEL_ID}`);
  console.log(`[E2E Setup] Client phone: ${testEnv.CLIENT_PHONE_NUMBER}`);
  console.log(`[E2E Setup] Platform phone: ${testEnv.PLATFORM_PHONE_NUMBER}`);
});

afterAll(async () => {
  console.log("[E2E Teardown] Cleaning up test environment...");
  console.log("[E2E Teardown] Test environment cleaned up");
});

export function skipIfNotConfigured(): void {
  if (!testEnv.PLATFORM_CHANNEL_ID || !testEnv.CLIENT_PHONE_NUMBER) {
    console.log("[E2E] Skipping test: Environment not fully configured");
    return;
  }
}
