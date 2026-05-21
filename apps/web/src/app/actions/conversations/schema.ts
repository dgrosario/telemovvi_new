import z from "zod";

export const transferConversationInputSchema = z.object({
  conversationId: z.string(),
  sectorId: z.string().min(1, "Selecione um setor"),
  attendantId: z.string().optional(),
});

export const assignConversationInputSchema = z.object({
  conversationId: z.string().uuid("ID de conversa inválido"),
  sectorId: z
    .string()
    .nullish()
    .transform((val) => {
      if (!val) return undefined;
      const trimmed = val.trim();
      return trimmed === "" ? undefined : trimmed;
    })
    .refine(
      (val) => val === undefined || z.string().uuid().safeParse(val).success,
      { message: "ID de setor inválido" }
    ),
});

export const createConversationInputSchema = z.object({
  partnerId: z
    .string()
    .min(1, "Selecione um cliente para continuar"),
  contactId: z
    .string()
    .min(1, "Selecione um contato para continuar"),
  templateName: z
    .string()
    .optional(),
  templateLanguage: z
    .string()
    .optional(),
  templateVariables: z
    .array(
      z.object({
        name: z.string().min(1, "Nome da variável inválido"),
        value: z.string(),
      })
    )
    .optional(),
  channelId: z
    .string()
    .min(1, "Selecione um canal para continuar"),
  sectorId: z
    .string()
    .uuid("ID de setor inválido")
    .optional(),
});
