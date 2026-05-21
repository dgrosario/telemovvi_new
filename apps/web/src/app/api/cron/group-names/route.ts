import { NextRequest, NextResponse } from "next/server";
import { syncGroupNames } from "@/lib/group-name-sync-service";

const CRON_SECRET = process.env.CRON_SECRET;
const LOCK_TIMEOUT_MS = 15 * 60 * 1000;

let isProcessing = false;
let lastProcessingStarted: Date | null = null;

async function verifySecret(request: NextRequest): Promise<boolean> {
  if (!CRON_SECRET) {
    console.error(
      "[Cron/GroupNames] CRON_SECRET não configurado - rejeitando requisição"
    );
    return false;
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return false;
  }

  const token = authHeader.substring(7);
  return token === CRON_SECRET;
}

export async function GET(request: NextRequest) {
  const now = new Date();

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
      now.getTime() - lastProcessingStarted.getTime() > LOCK_TIMEOUT_MS;

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
      console.warn("[Cron/GroupNames] Lock expirado, liberando execução");
    }

    isProcessing = true;
    lastProcessingStarted = now;

    const result = await syncGroupNames();

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Cron/GroupNames] Erro:", error);
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
