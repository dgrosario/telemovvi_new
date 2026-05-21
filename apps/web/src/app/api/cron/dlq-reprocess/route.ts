import { NextRequest, NextResponse } from "next/server";
import amqp from "amqplib";
import { and, createDatabaseConnection, isNull } from "@omnichannel/core/infra/database";
import { channels } from "@omnichannel/core/infra/database/schemas";

const CRON_SECRET = process.env.CRON_SECRET;
const RABBITMQ_URL = process.env.RABBITMQ_URL || process.env.EVOLUTION_RABBITMQ_URL;
const DLQ_NAME = "omnichannel.dlq";
const BATCH_SIZE = 100;
const MAX_AGE_DAYS = 3;
const MAX_AGE_MS = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

let isProcessing = false;
let lastProcessingStarted: Date | null = null;
const LOCK_TIMEOUT_MS = 5 * 60 * 1000;

async function verifySecret(request: NextRequest): Promise<boolean> {
  if (!CRON_SECRET) {
    console.error("[Cron/DLQ] CRON_SECRET not configured - rejecting request");
    return false;
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return false;
  }

  const token = authHeader.substring(7);
  return token === CRON_SECRET;
}

function extractInstanceFromBody(content: Buffer): string | null {
  try {
    const parsed = JSON.parse(content.toString("utf-8")) as { instance?: unknown };
    if (typeof parsed.instance === "string" && parsed.instance.length > 0) {
      return parsed.instance;
    }
  } catch {
    // ignore parse errors
  }
  return null;
}

async function loadActiveInstances(): Promise<Set<string>> {
  const db = createDatabaseConnection();
  const rows = await db
    .select({ payload: channels.payload })
    .from(channels)
    .where(and(isNull(channels.deletedAt)));

  const instances = new Set<string>();
  for (const row of rows) {
    const payload = row.payload as Record<string, unknown>;
    if (typeof payload.instanceName === "string") instances.add(payload.instanceName);
    if (typeof payload.phoneId === "string") instances.add(payload.phoneId);
  }
  return instances;
}

function getFirstFailureTimestamp(headers: Record<string, unknown>): Date | null {
  const firstFailure = headers["x-first-failure-timestamp"];
  if (typeof firstFailure === "string") {
    const date = new Date(firstFailure);
    if (!isNaN(date.getTime())) return date;
  }

  const failureTimestamp = headers["x-failure-timestamp"];
  if (typeof failureTimestamp === "string") {
    const date = new Date(failureTimestamp);
    if (!isNaN(date.getTime())) return date;
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const isAuthorized = await verifySecret(request);
    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!RABBITMQ_URL) {
      return NextResponse.json({
        success: false,
        error: "RABBITMQ_URL not configured",
      }, { status: 500 });
    }

    const now = new Date();
    const lockExpired = lastProcessingStarted &&
      (now.getTime() - lastProcessingStarted.getTime()) > LOCK_TIMEOUT_MS;

    if (isProcessing && !lockExpired) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: "Previous execution still in progress",
        startedAt: lastProcessingStarted?.toISOString(),
        timestamp: now.toISOString(),
      });
    }

    if (lockExpired) {
      console.warn("[Cron/DLQ] Lock expired, forcing release");
    }

    isProcessing = true;
    lastProcessingStarted = now;
    const batchStartTime = now.toISOString();

    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();

    await channel.assertQueue(DLQ_NAME, { durable: true, autoDelete: false });

    let processed = 0;
    let republished = 0;
    let expired = 0;
    let noExchange = 0;
    let deferred = 0;
    let orphaned = 0;

    const activeInstances = await loadActiveInstances();

    for (let i = 0; i < BATCH_SIZE; i++) {
      const msg = await channel.get(DLQ_NAME, { noAck: false });
      if (!msg) break;

      processed++;
      const headers = (msg.properties.headers || {}) as Record<string, unknown>;
      const firstFailure = getFirstFailureTimestamp(headers);

      // Discard messages older than MAX_AGE_DAYS
      if (firstFailure && (now.getTime() - firstFailure.getTime()) > MAX_AGE_MS) {
        channel.ack(msg);
        expired++;
        continue;
      }

      // Check if this message was already reprocessed during THIS batch run.
      // If so, it failed again and came back to DLQ. Move it to the tail
      // and stop the batch - we've cycled through all fresh messages.
      const reprocessedAt = headers["x-dlq-reprocessed-at"];
      if (typeof reprocessedAt === "string" && reprocessedAt >= batchStartTime) {
        channel.publish("", DLQ_NAME, msg.content, {
          persistent: true,
          headers: { ...headers },
        });
        channel.ack(msg);
        deferred++;
        break;
      }

      const instance = extractInstanceFromBody(msg.content);
      if (instance && !activeInstances.has(instance)) {
        channel.ack(msg);
        orphaned++;
        continue;
      }

      const originalExchange = headers["x-original-exchange"];
      const originalRoutingKey = headers["x-original-routing-key"];

      if (typeof originalExchange !== "string" || typeof originalRoutingKey !== "string") {
        channel.ack(msg);
        noExchange++;
        continue;
      }

      // Republish to the original exchange for retry, tagging with batch timestamp
      channel.publish(originalExchange, originalRoutingKey, msg.content, {
        persistent: true,
        headers: {
          "x-first-failure-timestamp": firstFailure?.toISOString() ?? now.toISOString(),
          "x-dlq-reprocessed-at": batchStartTime,
        },
      });

      channel.ack(msg);
      republished++;
    }

    await channel.close();
    await connection.close();

    isProcessing = false;

    console.log(
      `[Cron/DLQ] Batch done: ${republished} republished, ${expired} expired (>${MAX_AGE_DAYS}d), ${noExchange} discarded, ${orphaned} orphaned (no channel), ${deferred} deferred to next cycle (${processed} total)`
    );

    return NextResponse.json({
      success: true,
      processed,
      republished,
      expired,
      discarded: noExchange,
      orphaned,
      deferred,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    isProcessing = false;
    console.error("[Cron/DLQ] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
