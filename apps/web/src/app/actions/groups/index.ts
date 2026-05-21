"use server";

import { gatewayActions, GroupInfoResponse, GroupParticipant } from "@/lib/gateway-client";
import { getAllowedChannelIdsForUser } from "@/app/actions/scope-cache";
import { Membership } from "@omnichannel/core/domain/entities/membership";
import { NotAuthorized } from "@omnichannel/core/domain/errors/not-authorized";
import { securityProcedure } from "../procedure";
import { z } from "zod";

export type { GroupInfoResponse, GroupParticipant } from "@/lib/gateway-client";

const FORBIDDEN_CHANNEL_SCOPE = "FORBIDDEN_CHANNEL_SCOPE";

function throwForbiddenChannelScope(): never {
  const error = NotAuthorized.throw([FORBIDDEN_CHANNEL_SCOPE]) as NotAuthorized & {
    status?: number;
    code?: string;
  };
  error.status = 403;
  error.code = FORBIDDEN_CHANNEL_SCOPE;
  throw error;
}

async function assertChannelScopeAccess(
  ctx: { user: { id: string }; membership: Membership },
  channelId: string
) {
  if (ctx.membership.hasPermission("list:all-sectors")) return;
  if (ctx.membership.hasPermission("list:all-channels")) return;

  const allowedChannelIds = await getAllowedChannelIdsForUser(
    ctx.user.id,
    ctx.membership.workspaceId
  );

  if (!allowedChannelIds.includes(channelId)) {
    throwForbiddenChannelScope();
  }
}

const getGroupInfoInputSchema = z.object({
  channelId: z.string().uuid(),
  groupJid: z.string().min(1),
});

export const getGroupInfo = securityProcedure()
  .input(getGroupInfoInputSchema)
  .handler(async ({ input, ctx }): Promise<GroupInfoResponse | null> => {
    await assertChannelScopeAccess(ctx, input.channelId);
    const response = await gatewayActions.getGroupInfo(
      ctx.membership.workspaceId,
      input.channelId,
      input.groupJid
    );

    if (!response.success) {
      console.error("[getGroupInfo] Gateway error:", response.error);
      return null;
    }

    return response.data ?? null;
  });

export const getGroupParticipants = securityProcedure()
  .input(getGroupInfoInputSchema)
  .handler(async ({ input, ctx }): Promise<GroupParticipant[]> => {
    await assertChannelScopeAccess(ctx, input.channelId);
    const response = await gatewayActions.getGroupParticipants(
      ctx.membership.workspaceId,
      input.channelId,
      input.groupJid
    );

    if (!response.success) {
      console.error("[getGroupParticipants] Gateway error:", response.error);
      return [];
    }

    return response.data?.participants ?? [];
  });

export const getGroupPicture = securityProcedure()
  .input(getGroupInfoInputSchema)
  .handler(async ({ input, ctx }): Promise<string | null> => {
    await assertChannelScopeAccess(ctx, input.channelId);
    const response = await gatewayActions.getGroupPicture(
      ctx.membership.workspaceId,
      input.channelId,
      input.groupJid
    );

    if (!response.success) {
      console.error("[getGroupPicture] Gateway error:", response.error);
      return null;
    }

    return response.data?.pictureUrl ?? null;
  });


const getParticipantNamesInputSchema = z.object({
  participantJids: z.array(z.string()),
});

export const getParticipantNames = securityProcedure()
  .input(getParticipantNamesInputSchema)
  .handler(async ({ input, ctx }): Promise<Record<string, string>> => {
    const { PartnersDatabaseRepository } = await import(
      "@omnichannel/core/infra/repositories/partners-repository"
    );

    const partnersRepository = PartnersDatabaseRepository.instance();

    // Extract phone numbers from JIDs
    const phoneNumbers = input.participantJids.map((jid) =>
      jid.replace("@s.whatsapp.net", "").replace("@lid", "").replace("@c.us", "")
    );

    const namesMap = await partnersRepository.findNamesByContactValues(
      phoneNumbers,
      ctx.membership.workspaceId
    );

    // Convert Map to Record, mapping back to original JIDs
    const result: Record<string, string> = {};
    for (let i = 0; i < input.participantJids.length; i++) {
      const jid = input.participantJids[i];
      const phone = phoneNumbers[i];
      const name = namesMap.get(phone);
      if (name) {
        result[jid] = name;
      }
    }

    return result;
  });
