"use server";

import { DashboardDatabaseRepository } from "@omnichannel/core/infra/repositories/dashboard-repository";
import { z } from "zod";
import { securityProcedure } from "../procedure";
import type {
  ActivityMetrics,
  AttendantMetric,
  ConversationMetrics,
  DashboardData,
  PerformanceMetrics,
} from "@/types/dashboard";

const dashboardRepository = DashboardDatabaseRepository.instance();

const dateRangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const getDashboardMetrics = securityProcedure(["view:dashboard"])
  .input(dateRangeSchema)
  .handler(async ({ input, ctx }): Promise<DashboardData> => {
    const metrics = await dashboardRepository.getMetrics({
      workspaceId: ctx.membership.workspaceId,
      startDate: input.startDate,
      endDate: input.endDate,
    });

    const attendantsData = await dashboardRepository.getAttendantMetrics({
      workspaceId: ctx.membership.workspaceId,
      startDate: input.startDate,
      endDate: input.endDate,
    });

    const conversations: ConversationMetrics = {
      open: metrics.conversations.open,
      waiting: metrics.conversations.waiting,
      closed: metrics.conversations.closed,
    };

    const activity: ActivityMetrics = {
      activeAttendants: 0,
      totalAttendants: metrics.activity.totalAttendants,
      newContacts: metrics.activity.newContacts,
      messagesReceived: metrics.activity.messagesReceived,
      messagesSent: metrics.activity.messagesSent,
    };

    const performance: PerformanceMetrics = {
      avgServiceTimeMinutes: metrics.performance.avgServiceTimeMinutes,
      avgWaitTimeMinutes: metrics.performance.avgWaitTimeMinutes,
    };

    const attendants: AttendantMetric[] = attendantsData.map((a) => ({
      id: a.id,
      name: a.name,
      thumbnail: a.thumbnail,
      isOnline: false,
      conversationsInProgress: a.conversationsInProgress,
      conversationsFinished: a.conversationsFinished,
      messagesSent: a.messagesSent,
      avgServiceTimeMinutes: a.avgServiceTimeMinutes,
      avgFirstResponseMinutes: a.avgFirstResponseMinutes,
    }));

    return {
      metrics: {
        conversations,
        activity,
        performance,
      },
      attendants,
      generatedAt: new Date().toISOString(),
    };
  });
