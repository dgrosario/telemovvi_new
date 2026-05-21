import z from "zod";
import { WHATSAPP_FAMILY, INSTAGRAM_FAMILY } from "@omnichannel/core/domain/entities/channel";

export const upsertChannelInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "O nome é obrigatório"),
  type: z.string(),
});

export const updateChannelWithPayloadSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "O nome é obrigatório"),
  payload: z
    .object({
      appId: z.string().optional(),
      appSecret: z.string().optional(),
      accessToken: z.string().optional(),
      wabaId: z.string().optional(),
      phoneId: z.string().optional(),
      businessId: z.string().optional(),
      verifyToken: z.string().optional(),
    })
    .optional(),
});

const channelTypes = [...WHATSAPP_FAMILY, ...INSTAGRAM_FAMILY] as [string, ...string[]];

export const reconnectChannelInputSchema = z.object({
  channelId: z.string().nonempty(),
  newType: z.enum(channelTypes),
  inputPayload: z.record(z.unknown()).optional().default({}),
  pendingInstanceName: z.string().optional(),
  pendingInstanceId: z.string().optional(),
  pendingPhoneNumber: z.string().nullable().optional(),
});

export const registerReceivedChannelInputSchema = z.object({
  receivedChannelId: z
    .string()
    .nonempty({ message: "Selecione o canal de recebimento para continuar" }),
  responseChannelId: z
    .string()
    .nonempty({ message: "Selecione o canal de resposta para continuar" }),
  migrateConversations: z.boolean().optional(),
});
