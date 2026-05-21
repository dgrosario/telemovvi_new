import { NextRequest, NextResponse } from "next/server";
import { ProcessScheduledCampaigns } from "@omnichannel/core/application/command/process-scheduled-campaigns";
import { ProcessBirthdayCampaigns } from "@omnichannel/core/application/command/process-birthday-campaigns";
import { ExecuteCampaignBatch } from "@omnichannel/core/application/command/execute-campaign-batch";
import { CampaignsDatabaseRepository } from "@omnichannel/core/infra/repositories/campaigns-repository";

const CRON_SECRET = process.env.CRON_SECRET;

let isProcessing = false;
let lastProcessingStarted: Date | null = null;
const LOCK_TIMEOUT_MS = 5 * 60 * 1000;

async function verifySecret(request: NextRequest): Promise<boolean> {
  if (!CRON_SECRET) {
    console.error("[Cron/Campaigns] CRON_SECRET not configured - rejecting request");
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
  try {
    const isAuthorized = await verifySecret(request);
    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const now = new Date();
    const lockExpired = lastProcessingStarted &&
      (now.getTime() - lastProcessingStarted.getTime()) > LOCK_TIMEOUT_MS;

    if (isProcessing && !lockExpired) {
      console.log("[Cron/Campaigns] Skipping - previous execution still running");
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: "Previous execution still in progress",
        startedAt: lastProcessingStarted?.toISOString(),
        timestamp: now.toISOString(),
      });
    }

    if (lockExpired) {
      console.warn("[Cron/Campaigns] Lock expired, forcing release");
    }

    isProcessing = true;
    lastProcessingStarted = now;

    const processScheduledCommand = ProcessScheduledCampaigns.instance();
    const scheduledResult = await processScheduledCommand.execute();

    console.log(
      `[Cron/Campaigns] Started ${scheduledResult.processedCount} scheduled campaigns`
    );

    const processBirthdayCommand = ProcessBirthdayCampaigns.instance();
    const birthdayResult = await processBirthdayCommand.execute();

    console.log(
      `[Cron/Campaigns] Processed ${birthdayResult.processedCampaigns} birthday campaigns, added ${birthdayResult.newRecipients} new recipients`
    );

    const campaignsRepository = CampaignsDatabaseRepository.instance();
    const runningCampaigns = await campaignsRepository.listRunningCampaigns();

    const executeBatchCommand = ExecuteCampaignBatch.instance();
    const batchResults = [];

    for (const campaign of runningCampaigns) {
      try {
        const result = await executeBatchCommand.execute({
          campaignId: campaign.id,
        });
        batchResults.push({
          campaignId: campaign.id,
          campaignName: campaign.name,
          processed: result.processed,
          sent: result.sent,
          failed: result.failed,
          hasMore: result.hasMore,
          completed: result.completed,
        });
      } catch (error) {
        console.error(
          `[Cron/Campaigns] Error processing campaign ${campaign.id}:`,
          error
        );
        batchResults.push({
          campaignId: campaign.id,
          campaignName: campaign.name,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    isProcessing = false;

    return NextResponse.json({
      success: true,
      scheduledCampaigns: {
        started: scheduledResult.processedCount,
        campaignIds: scheduledResult.campaignIds,
      },
      birthdayCampaigns: {
        processed: birthdayResult.processedCampaigns,
        newRecipients: birthdayResult.newRecipients,
        results: birthdayResult.campaignResults,
      },
      batchExecution: {
        processed: batchResults.length,
        results: batchResults,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    isProcessing = false;
    console.error("[Cron/Campaigns] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
