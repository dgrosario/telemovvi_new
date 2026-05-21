import { gatewayActions, MetaChannelType } from "@/lib/gateway-client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const channelType = searchParams.get("channelType") as MetaChannelType | null;

  if (!channelType) {
    return NextResponse.json(
      { error: "channelType parameter is required" },
      { status: 400 }
    );
  }

  const validChannelTypes: MetaChannelType[] = [
    "whatsapp",
    "instagram",
    "messenger",
  ];

  if (!validChannelTypes.includes(channelType)) {
    return NextResponse.json(
      { error: "Invalid channelType. Must be whatsapp, instagram, or messenger" },
      { status: 400 }
    );
  }

  try {
    const response = await gatewayActions.getMetaEmbeddedLoginConfig(channelType);

    if (!response.success) {
      return NextResponse.json(
        { error: response.error || "Failed to get embedded login config" },
        { status: 404 }
      );
    }

    return NextResponse.json(response.data);
  } catch (error) {
    console.error("[Meta Embedded Config] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
