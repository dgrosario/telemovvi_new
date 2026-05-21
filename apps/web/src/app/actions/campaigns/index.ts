"use server";

import { CancelCampaign } from "@omnichannel/core/application/command/cancel-campaign";
import { CreateCampaign } from "@omnichannel/core/application/command/create-campaign";
import { StartCampaign } from "@omnichannel/core/application/command/start-campaign";
import { CountRecipients } from "@omnichannel/core/application/queries/count-recipients";
import { GetCampaign } from "@omnichannel/core/application/queries/get-campaign";
import { ListCampaigns } from "@omnichannel/core/application/queries/list-campaigns";
import { revalidatePath } from "next/cache";
import { securityProcedure } from "../procedure";
import {
  cancelCampaignInputSchema,
  countRecipientsInputSchema,
  createCampaignInputSchema,
  getCampaignInputSchema,
  listCampaignsInputSchema,
  startCampaignInputSchema,
} from "./schema";

const createCampaignCommand = CreateCampaign.instance();
const startCampaignCommand = StartCampaign.instance();
const cancelCampaignCommand = CancelCampaign.instance();
const listCampaignsQuery = ListCampaigns.instance();
const getCampaignQuery = GetCampaign.instance();
const countRecipientsQuery = CountRecipients.instance();

export const listCampaigns = securityProcedure(["list:campaigns"])
  .input(listCampaignsInputSchema)
  .handler(async ({ input, ctx }) => {
    const result = await listCampaignsQuery.execute({
      workspaceId: ctx.membership.workspaceId,
      status: input.status,
      pageIndex: input.pageIndex,
      pageSize: input.pageSize,
    });

    return result;
  });

export const getCampaign = securityProcedure(["list:campaigns"])
  .input(getCampaignInputSchema)
  .handler(async ({ input, ctx }) => {
    const campaign = await getCampaignQuery.execute({
      campaignId: input.campaignId,
      workspaceId: ctx.membership.workspaceId,
    });

    return campaign;
  });

export const createCampaign = securityProcedure(["create:campaigns"])
  .input(createCampaignInputSchema)
  .handler(async ({ input, ctx }) => {
    const result = await createCampaignCommand.execute({
      workspaceId: ctx.membership.workspaceId,
      channelId: input.channelId,
      name: input.name,
      type: input.type,
      filterLabelIds: input.filterLabelIds,
      minIntervalMs: input.minIntervalMs,
      maxIntervalMs: input.maxIntervalMs,
      scheduledAt: input.scheduledAt,
      createdBy: ctx.user.id,
      messages: input.messages,
    });

    revalidatePath("/campaigns", "page");

    return result;
  });

export const startCampaign = securityProcedure(["execute:campaigns"])
  .input(startCampaignInputSchema)
  .handler(async ({ input, ctx }) => {
    await startCampaignCommand.execute({
      campaignId: input.campaignId,
      workspaceId: ctx.membership.workspaceId,
    });

    revalidatePath("/campaigns", "page");
    revalidatePath(`/campaigns/${input.campaignId}`, "page");
  });

export const cancelCampaign = securityProcedure(["execute:campaigns"])
  .input(cancelCampaignInputSchema)
  .handler(async ({ input, ctx }) => {
    await cancelCampaignCommand.execute({
      campaignId: input.campaignId,
      workspaceId: ctx.membership.workspaceId,
    });

    revalidatePath("/campaigns", "page");
    revalidatePath(`/campaigns/${input.campaignId}`, "page");
  });

export const countRecipients = securityProcedure(["list:campaigns"])
  .input(countRecipientsInputSchema)
  .handler(async ({ input, ctx }) => {
    const result = await countRecipientsQuery.execute({
      workspaceId: ctx.membership.workspaceId,
      labelIds: input.labelIds,
    });

    return result;
  });
