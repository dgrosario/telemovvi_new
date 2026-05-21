import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    const inboundConsumer = (global as GlobalThis).inboundMessageConsumer;

    if (!inboundConsumer) {
      return NextResponse.json(
        { error: "InboundMessageConsumer not initialized" },
        { status: 503 }
      );
    }

    const registeredInstances = Array.from(
      inboundConsumer.registeredInstances || []
    );

    return NextResponse.json({
      status: "ok",
      registeredInstances,
      count: registeredInstances.length,
    });
  } catch (error) {
    console.error("[API Evolution Consumers] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const inboundConsumer = (global as GlobalThis).inboundMessageConsumer;

    if (!inboundConsumer) {
      return NextResponse.json(
        { error: "InboundMessageConsumer not initialized" },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { instanceName, rescanAll } = body as {
      instanceName?: string;
      rescanAll?: boolean;
    };

    if (rescanAll) {
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

      const results: Array<{
        name: string;
        instanceName: string;
        status: string;
      }> = [];

      for (const channel of evolutionChannels) {
        const payload = channel.payload as { instanceName?: string };
        const instance = payload?.instanceName;
        if (!instance) continue;

        try {
          await inboundConsumer.registerEvolutionInstance(instance);
          results.push({
            name: channel.name,
            instanceName: instance,
            status: "registered",
          });
        } catch (err) {
          results.push({
            name: channel.name,
            instanceName: instance,
            status: `error: ${err instanceof Error ? err.message : "unknown"}`,
          });
        }
      }

      return NextResponse.json({
        status: "ok",
        action: "rescan_all",
        results,
      });
    }

    if (instanceName) {
      await inboundConsumer.registerEvolutionInstance(instanceName);

      return NextResponse.json({
        status: "ok",
        action: "register",
        instanceName,
        message: `Consumer registered for instance: ${instanceName}`,
      });
    }

    return NextResponse.json(
      {
        error: "Missing instanceName or rescanAll parameter",
        usage: {
          registerOne: { instanceName: "instance-name" },
          rescanAll: { rescanAll: true },
        },
      },
      { status: 400 }
    );
  } catch (error) {
    console.error("[API Evolution Consumers] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

interface GlobalThis {
  inboundMessageConsumer?: {
    registeredInstances: Set<string>;
    registerEvolutionInstance: (instanceName: string) => Promise<void>;
  };
}
