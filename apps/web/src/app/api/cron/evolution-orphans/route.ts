import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { and, createDatabaseConnection, eq, isNull } from "@omnichannel/core/infra/database";
import { channels } from "@omnichannel/core/infra/database/schemas";
import { gatewayActions } from "@/lib/gateway-client";

const CRON_SECRET = process.env.CRON_SECRET;
const LOCK_TIMEOUT_MS = 15 * 60 * 1000;
const DEFAULT_MAX_PER_RUN = 20;

// Lock is process-local: only effective in single-instance deployments
let isProcessing = false;
let lastProcessingStarted: Date | null = null;

function parseMaxPerRun(): number {
  const rawValue = process.env.EVOLUTION_ORPHAN_CLEANUP_MAX_PER_RUN;
  const parsed = Number.parseInt(rawValue ?? "", 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MAX_PER_RUN;
  }

  return parsed;
}

async function verifySecret(request: NextRequest): Promise<boolean> {
  if (!CRON_SECRET) {
    console.error(
      "[Cron/EvolutionOrphans] CRON_SECRET not configured - rejecting request"
    );
    return false;
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return false;
  }

  const token = authHeader.substring(7);
  const tokenBuf = Buffer.from(token);
  const secretBuf = Buffer.from(CRON_SECRET);
  return tokenBuf.length === secretBuf.length && timingSafeEqual(tokenBuf, secretBuf);
}

function extractInstanceName(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const value = (payload as { instanceName?: unknown }).instanceName;
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export async function GET(request: NextRequest) {
  const startedAt = new Date();

  try {
    const isAuthorized = await verifySecret(request);
    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const lockExpired =
      lastProcessingStarted &&
      startedAt.getTime() - lastProcessingStarted.getTime() > LOCK_TIMEOUT_MS;

    if (isProcessing && !lockExpired) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: "Previous execution still in progress",
        startedAt: lastProcessingStarted?.toISOString(),
        timestamp: startedAt.toISOString(),
      });
    }

    if (lockExpired) {
      console.warn(
        "[Cron/EvolutionOrphans] Lock expired, forcing release"
      );
    }

    isProcessing = true;
    lastProcessingStarted = startedAt;

    const db = createDatabaseConnection();
    const evolutionChannels = await db
      .select({
        id: channels.id,
        payload: channels.payload,
      })
      .from(channels)
      .where(and(eq(channels.type, "evolution"), isNull(channels.deletedAt)));

    const activeChannelInstances = new Set<string>();
    for (const channel of evolutionChannels) {
      const instanceName = extractInstanceName(channel.payload);
      if (instanceName) {
        activeChannelInstances.add(instanceName);
      }
    }

    const listInstancesResponse = await gatewayActions.listEvolutionInstances();
    if (!listInstancesResponse.success) {
      throw new Error(
        listInstancesResponse.error ||
          "Failed to list instances from Evolution API"
      );
    }

    const allEvolutionInstances = listInstancesResponse.data?.instances ?? [];
    const orphanNameSet = new Set<string>();

    for (const instance of allEvolutionInstances) {
      const instanceName = instance?.name?.trim();
      if (!instanceName) continue;
      if (activeChannelInstances.has(instanceName)) continue;
      orphanNameSet.add(instanceName);
    }

    const orphanNames = Array.from(orphanNameSet);
    const maxPerRun = parseMaxPerRun();
    const orphanNamesToProcess = orphanNames.slice(0, maxPerRun);
    const orphansSkippedByLimit = Math.max(
      0,
      orphanNames.length - orphanNamesToProcess.length
    );

    if (orphansSkippedByLimit > 0) {
      console.warn(
        `[Cron/EvolutionOrphans] Safety limit reached. Processing ${orphanNamesToProcess.length} of ${orphanNames.length} orphans.`
      );
    }

    const failures: Array<{ instanceName: string; error: string }> = [];
    let orphansProcessed = 0;

    for (const instanceName of orphanNamesToProcess) {
      try {
        const removeResponse =
          await gatewayActions.removeEvolutionInstance(instanceName);

        if (!removeResponse.success) {
          failures.push({
            instanceName,
            error:
              removeResponse.error ||
              "Unknown error removing Evolution instance",
          });
          continue;
        }

        orphansProcessed++;
      } catch (error) {
        failures.push({
          instanceName,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();

    return NextResponse.json({
      success: true,
      timestamp: finishedAt.toISOString(),
      durationMs,
      totalEvolutionInstances: allEvolutionInstances.length,
      totalActiveChannelInstances: activeChannelInstances.size,
      orphansFound: orphanNames.length,
      orphansProcessed,
      orphansSkippedByLimit,
      maxPerRun,
      failures,
    });
  } catch (error) {
    console.error("[Cron/EvolutionOrphans] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  } finally {
    isProcessing = false;
  }
}
