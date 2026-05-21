import { NextRequest, NextResponse } from "next/server";

const OMNI_GATEWAY_URL = process.env.OMNI_GATEWAY_URL ?? "http://localhost:3001";
const OMNI_GATEWAY_API_KEY = process.env.OMNI_GATEWAY_API_KEY ?? "";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: messageId } = await params;
  const channelId = request.nextUrl.searchParams.get("channelId");
  const force = request.nextUrl.searchParams.get("force");

  if (!channelId || !messageId) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  const fetchFromGateway = async (forceDownload: boolean): Promise<Response> => {
    const gatewayUrl = `${OMNI_GATEWAY_URL}/media/${encodeURIComponent(messageId)}?channelId=${channelId}${forceDownload ? "&force=true" : ""}`;
    return fetch(gatewayUrl, {
      headers: {
        "X-API-Key": OMNI_GATEWAY_API_KEY,
      },
      cache: "no-store",
    });
  };

  let response: Response;

  try {
    response = await fetchFromGateway(force === "true");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(
      `[media-route] Failed to reach gateway for ${messageId}: ${errorMessage}`
    );
    return NextResponse.json(
      { error: `Gateway unreachable: ${errorMessage}`, messageId },
      { status: 502 }
    );
  }

  if (!response.ok && force !== "true" && response.status !== 410) {
    try {
      console.warn(
        `[media-route] Retrying with force=true for ${messageId} after HTTP ${response.status}`
      );
      response = await fetchFromGateway(true);
    } catch (retryError) {
      const retryMessage =
        retryError instanceof Error ? retryError.message : "Unknown error";
      console.error(
        `[media-route] Force retry failed for ${messageId}: ${retryMessage}`
      );
    }
  }

  if (!response.ok) {
    const errorText = await response.text();

    console.error(
      `[media-route] Gateway error for ${messageId}: HTTP ${response.status} - ${errorText}`
    );

    let errorData: { error?: string } = {};
    try {
      errorData = JSON.parse(errorText);
    } catch {
      // Not JSON, use as-is
    }

    if (errorData.error === "MEDIA_UNAVAILABLE" || response.status === 410) {
      return NextResponse.json(
        {
          error: "MEDIA_UNAVAILABLE",
          message: "Midia indisponivel. Acesse o Instagram no celular ou na web para visualizar.",
        },
        { status: 410 }
      );
    }

    return NextResponse.json(
      { error: errorData.error || errorText || "Failed to download media", messageId },
      { status: response.status }
    );
  }

  const contentType = response.headers.get("Content-Type") ?? "application/octet-stream";
  const contentDisposition = response.headers.get("Content-Disposition");
  const buffer = await response.arrayBuffer();

  const headers: Record<string, string> = {
    "Content-Type": contentType,
  };

  if (contentDisposition) {
    headers["Content-Disposition"] = contentDisposition;
  }

  return new NextResponse(buffer, { headers });
}
