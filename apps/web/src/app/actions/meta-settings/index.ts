"use server";
import * as z from "zod";
import { securityProcedure } from "../procedure";
import { gatewayHttpClient } from "@/lib/gateway/http-client";
import type { MetaChannelType, MetaSaveSettingsPayload } from "@/lib/gateway-client";

const metaSettingsProcedure = securityProcedure(["manage:meta-settings"]);

const metaChannelTypeSchema = z.enum([
  "whatsapp",
  "instagram",
  "messenger",
  "evolution",
]);

const saveSettingsInputSchema = z.object({
  channelType: metaChannelTypeSchema,
  appId: z.string().min(1, "App ID is required"),
  appSecret: z.string().min(1, "App Secret is required"),
  configId: z.string().optional(),
}).superRefine((val, ctx) => {
  if (val.channelType !== "evolution" && val.appSecret.length < 32) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "App Secret must be at least 32 characters",
      path: ["appSecret"],
    });
  }

  if (val.channelType !== "instagram" && (!val.configId || val.configId.trim() === "")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Config ID is required for non-Instagram channels",
      path: ["configId"],
    });
  }
});

export const getMetaSettings = metaSettingsProcedure
  .input(z.object({ 
    channelType: metaChannelTypeSchema,
    includeSecret: z.boolean().optional().default(false)
  }))
  .handler(async ({ input }) => {
    const response = await gatewayHttpClient.getMetaSettings(
      input.channelType as MetaChannelType,
      input.includeSecret
    );

    if (!response.success) {
      throw new Error(response.error || "Failed to get Meta settings");
    }

    return response.data;
  });

export const getAllMetaSettings = metaSettingsProcedure.handler(async () => {
  try {
    console.log("[getAllMetaSettings] Starting HTTP request to gateway...");
    const response = await gatewayHttpClient.getAllMetaSettings();
    console.log("[getAllMetaSettings] Gateway response:", { success: response.success, hasData: !!response.data });

    if (!response.success) {
      console.warn("[getAllMetaSettings] Gateway request failed:", response.error);
      return [];
    }

    return response.data || [];
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[getAllMetaSettings] Gateway HTTP error:", errorMessage);
    return [];
  }
});

export const saveMetaSettings = metaSettingsProcedure
  .input(saveSettingsInputSchema)
  .handler(async ({ input }) => {
    const payload: MetaSaveSettingsPayload = {
      channelType: input.channelType as MetaChannelType,
      appId: input.appId,
      appSecret: input.appSecret,
      configId: input.configId || "",
    };

    const response = await gatewayHttpClient.saveMetaSettings(payload);

    if (!response.success) {
      throw new Error(response.error || "Failed to save Meta settings");
    }

    return response.data;
  });

export const setMetaSettingsActive = metaSettingsProcedure
  .input(
    z.object({
      channelType: metaChannelTypeSchema,
      isActive: z.boolean(),
    })
  )
  .handler(async ({ input }) => {
    const response = await gatewayHttpClient.setMetaActive(
      input.channelType as MetaChannelType,
      input.isActive
    );

    if (!response.success) {
      throw new Error(response.error || "Failed to update Meta settings");
    }

    return { success: true };
  });
