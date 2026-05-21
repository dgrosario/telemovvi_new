import { NextRequest, NextResponse } from "next/server";
import type { InboundMessageConsumer } from "@/lib/inbound-message-consumer";

function getInboundConsumer(): InboundMessageConsumer | null {
  return (global as unknown as { inboundMessageConsumer?: InboundMessageConsumer }).inboundMessageConsumer ?? null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { instanceName } = body as { instanceName?: string };

    if (!instanceName) {
      return NextResponse.json(
        { success: false, error: "instanceName is required" },
        { status: 400 }
      );
    }

    const consumer = getInboundConsumer();
    if (!consumer) {
      return NextResponse.json(
        { success: false, error: "InboundMessageConsumer not initialized" },
        { status: 503 }
      );
    }

    await consumer.registerEvolutionInstance(instanceName);

    return NextResponse.json({
      success: true,
      message: `Subscribed to queues for instance: ${instanceName}`,
    });
  } catch (error) {
    console.error("[API /consumers/refresh] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const consumer = getInboundConsumer();
    if (!consumer) {
      return NextResponse.json(
        { success: false, error: "InboundMessageConsumer not initialized" },
        { status: 503 }
      );
    }

    const { createDatabaseConnection, eq } = await import(
      "@omnichannel/core/infra/database"
    );
    const { channels } = await import(
      "@omnichannel/core/infra/database/schemas"
    );

    const db = createDatabaseConnection();
    const evolutionChannels = await db
      .select({
        id: channels.id,
        name: channels.name,
        payload: channels.payload,
      })
      .from(channels)
      .where(eq(channels.type, "evolution"));

    const results = [];

    for (const channel of evolutionChannels) {
      const payload = channel.payload as { instanceName?: string };
      const instanceName = payload?.instanceName;
      if (!instanceName) {
        results.push({
          channelId: channel.id,
          name: channel.name,
          instanceName: null,
          status: "skipped",
          reason: "No instanceName",
        });
        continue;
      }

      try {
        await consumer.registerEvolutionInstance(instanceName);
        results.push({
          channelId: channel.id,
          name: channel.name,
          instanceName,
          status: "subscribed",
        });
      } catch (error) {
        results.push({
          channelId: channel.id,
          name: channel.name,
          instanceName,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Refreshed all Evolution channel subscriptions",
      results,
    });
  } catch (error) {
    console.error("[API /consumers/refresh] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
