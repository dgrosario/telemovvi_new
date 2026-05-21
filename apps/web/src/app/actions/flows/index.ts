"use server";

import { AssociateFlowWithChannels } from "@omnichannel/core/application/command/associate-flow-with-channels";
import { AssociateFlowWithSectors } from "@omnichannel/core/application/command/associate-flow-with-sectors";
import { CreateFlow } from "@omnichannel/core/application/command/create-flow";
import { DeleteFlow } from "@omnichannel/core/application/command/delete-flow";
import { DuplicateFlow } from "@omnichannel/core/application/command/duplicate-flow";
import { ExecuteFlow } from "@omnichannel/core/application/command/execute-flow";
import { RecoverStuckFlows } from "@omnichannel/core/application/command/recover-stuck-flows";
import { UpdateFlow } from "@omnichannel/core/application/command/update-flow";
import { GetFlow } from "@omnichannel/core/application/queries/get-flow";
import { ListChannelsForFlow } from "@omnichannel/core/application/queries/list-channels-for-flow";
import { ListSectorsForFlow } from "@omnichannel/core/application/queries/list-sectors-for-flow";
import { ListFlows } from "@omnichannel/core/application/queries/list-flows";
import { revalidatePath } from "next/cache";
import { securityProcedure } from "../procedure";
import {
  associateFlowWithChannelsInputSchema,
  associateFlowWithSectorsInputSchema,
  createFlowInputSchema,
  deleteFlowInputSchema,
  duplicateFlowInputSchema,
  executeFlowInputSchema,
  getFlowInputSchema,
  listChannelsForFlowInputSchema,
  listSectorsForFlowInputSchema,
  updateFlowInputSchema,
} from "./schema";

const createFlowCommand = CreateFlow.instance();
const updateFlowCommand = UpdateFlow.instance();
const deleteFlowCommand = DeleteFlow.instance();
const duplicateFlowCommand = DuplicateFlow.instance();
const executeFlowCommand = ExecuteFlow.instance();
const recoverStuckFlowsCommand = RecoverStuckFlows.instance();
const associateFlowWithChannelsCommand = AssociateFlowWithChannels.instance();
const associateFlowWithSectorsCommand = AssociateFlowWithSectors.instance();
const listFlowsQuery = ListFlows.instance();
const getFlowQuery = GetFlow.instance();
const listChannelsForFlowQuery = ListChannelsForFlow.instance();
const listSectorsForFlowQuery = ListSectorsForFlow.instance();

export const listFlows = securityProcedure(["list:flows"]).handler(
  async ({ ctx }) => {
    const flows = await listFlowsQuery.execute({
      workspaceId: ctx.membership.workspaceId,
    });

    return flows;
  }
);

export const retrieveFlow = securityProcedure(["list:flows"])
  .input(getFlowInputSchema)
  .handler(async ({ input, ctx }) => {
    const flow = await getFlowQuery.execute({
      flowId: input.flowId,
      workspaceId: ctx.membership.workspaceId,
    });

    return flow;
  });

export const createFlow = securityProcedure(["manage:flows"])
  .input(createFlowInputSchema)
  .handler(async ({ input, ctx }) => {
    const flow = await createFlowCommand.execute({
      workspaceId: ctx.membership.workspaceId,
      name: input.name,
      status: input.status,
    });

    revalidatePath("/flows", "page");

    return flow;
  });

export const updateFlow = securityProcedure(["manage:flows"])
  .input(updateFlowInputSchema)
  .handler(async ({ input, ctx }) => {
    await updateFlowCommand.execute({
      flowId: input.flowId,
      workspaceId: ctx.membership.workspaceId,
      name: input.name,
      status: input.status,
      nodes: input.nodes,
      connections: input.connections,
    });

    revalidatePath("/flows", "page");
    revalidatePath(`/flows/${input.flowId}`, "page");
  });

export const deleteFlow = securityProcedure(["manage:flows"])
  .input(deleteFlowInputSchema)
  .handler(async ({ input, ctx }) => {
    await deleteFlowCommand.execute({
      flowId: input.flowId,
      workspaceId: ctx.membership.workspaceId,
    });

    revalidatePath("/flows", "page");
  });

export const duplicateFlow = securityProcedure(["manage:flows"])
  .input(duplicateFlowInputSchema)
  .handler(async ({ input }) => {
    const duplicated = await duplicateFlowCommand.execute({
      flowId: input.flowId,
    });

    revalidatePath("/flows", "page");

    return duplicated;
  });

export const executeFlow = securityProcedure(["execute:flows"])
  .input(executeFlowInputSchema)
  .handler(async ({ input, ctx }) => {
    await executeFlowCommand.execute({
      flowId: input.flowId,
      conversationId: input.conversationId,
      workspaceId: ctx.membership.workspaceId,
    });
  });

export const associateFlowWithChannels = securityProcedure(["manage:flows"])
  .input(associateFlowWithChannelsInputSchema)
  .handler(async ({ input }) => {
    await associateFlowWithChannelsCommand.execute({
      flowId: input.flowId,
      channelIds: input.channelIds,
    });

    revalidatePath("/flows", "page");
    revalidatePath(`/flows/${input.flowId}`, "page");
  });

export const listChannelsForFlow = securityProcedure(["list:flows"])
  .input(listChannelsForFlowInputSchema)
  .handler(async ({ input }) => {
    const channels = await listChannelsForFlowQuery.execute({
      flowId: input.flowId,
    });

    return channels;
  });

export const associateFlowWithSectors = securityProcedure(["manage:flows"])
  .input(associateFlowWithSectorsInputSchema)
  .handler(async ({ input }) => {
    await associateFlowWithSectorsCommand.execute({
      flowId: input.flowId,
      sectorIds: input.sectorIds,
    });

    revalidatePath("/flows", "page");
    revalidatePath(`/flows/${input.flowId}`, "page");
  });

export const listSectorsForFlow = securityProcedure(["list:flows"])
  .input(listSectorsForFlowInputSchema)
  .handler(async ({ input }) => {
    const sectors = await listSectorsForFlowQuery.execute({
      flowId: input.flowId,
    });

    return sectors;
  });

export const recoverStuckFlows = securityProcedure(["manage:flows"]).handler(
  async ({ ctx }) => {
    const result = await recoverStuckFlowsCommand.execute({
      workspaceId: ctx.membership.workspaceId,
    });

    return result;
  }
);
