import z from "zod";

export const createCampaignInputSchema = z.object({
  name: z.string().min(1, { message: "Nome da campanha é obrigatório" }),
  channelId: z.string().uuid({ message: "Canal é obrigatório" }),
  type: z.enum(["manual", "birthday"]).optional().default("manual"),
  filterLabelIds: z.array(z.string().uuid()).optional().default([]),
  minIntervalMs: z
    .number()
    .int()
    .min(1000, { message: "Intervalo mínimo deve ser pelo menos 1 segundo" })
    .max(300000, { message: "Intervalo mínimo deve ser no máximo 5 minutos" })
    .optional()
    .default(5000),
  maxIntervalMs: z
    .number()
    .int()
    .min(1000, { message: "Intervalo máximo deve ser pelo menos 1 segundo" })
    .max(300000, { message: "Intervalo máximo deve ser no máximo 5 minutos" })
    .optional()
    .default(30000),
  scheduledAt: z.coerce.date().optional(),
  messages: z
    .array(
      z.object({
        variationLabel: z.string().min(1),
        type: z.enum(["text", "template"]),
        content: z.string().optional(),
        templateName: z.string().optional(),
        variables: z
          .array(
            z.object({
              name: z.string(),
              value: z.string(),
            })
          )
          .optional(),
      })
    )
    .min(1, { message: "Adicione pelo menos uma variação de mensagem" }),
});

export const listCampaignsInputSchema = z.object({
  status: z
    .array(
      z.enum([
        "draft",
        "scheduled",
        "running",
        "completed",
        "cancelled",
        "failed",
      ])
    )
    .optional(),
  pageIndex: z.number().int().min(0).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
});

export const getCampaignInputSchema = z.object({
  campaignId: z.string().uuid({ message: "ID da campanha é obrigatório" }),
});

export const startCampaignInputSchema = z.object({
  campaignId: z.string().uuid({ message: "ID da campanha é obrigatório" }),
});

export const cancelCampaignInputSchema = z.object({
  campaignId: z.string().uuid({ message: "ID da campanha é obrigatório" }),
});

export const countRecipientsInputSchema = z.object({
  labelIds: z.array(z.string().uuid()).optional().default([]),
});
