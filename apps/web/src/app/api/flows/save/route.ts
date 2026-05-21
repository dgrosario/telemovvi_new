import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { JWTTokenDriver } from "@omnichannel/core/infra/drivers/token-driver";
import { UsersDatabaseRepository } from "@omnichannel/core/infra/repositories/users-repository";
import { MembershipsDatabaseRepository } from "@omnichannel/core/infra/repositories/membership-repository";
import { UpdateFlow } from "@omnichannel/core/application/command/update-flow";
import { AuthorizationService } from "@omnichannel/core/domain/services/authorization-service";
import { COOKIE_TOKEN_NAME, COOKIE_WORKSPACE_NAME } from "@/app/constants";
import { updateFlowInputSchema } from "@/app/actions/flows/schema";

const usersRepository = UsersDatabaseRepository.instance();
const membershipsRepository = MembershipsDatabaseRepository.instance();
const authorizationService = AuthorizationService.instance();
const updateFlowCommand = UpdateFlow.instance();

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_TOKEN_NAME);
    const workspaceId = cookieStore.get(COOKIE_WORKSPACE_NAME)?.value;

    if (!token?.value || !workspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = JWTTokenDriver.instance().decode(token.value);
    if (!userId) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const user = await usersRepository.retrieve(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    const membership = await membershipsRepository.retrieveByUserIdAndWorkspaceId(
      user.id,
      workspaceId
    );

    if (!membership?.id) {
      return NextResponse.json({ error: "Membership not found" }, { status: 403 });
    }

    const isAllowed = authorizationService.can(["manage:flows"], user, membership);
    if (!isAllowed) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    const body = await request.text();
    const data = JSON.parse(body);

    const parsed = updateFlowInputSchema.safeParse(data);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid data", details: parsed.error.errors }, { status: 400 });
    }

    const input = parsed.data;

    await updateFlowCommand.execute({
      flowId: input.flowId,
      workspaceId,
      nodes: input.nodes,
      connections: input.connections,
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[API] /api/flows/save error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
