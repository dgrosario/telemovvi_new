import z from "zod";

export const upsertTemplateInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().nonempty({ message: "Não pode ficar vazio!" }),
  text: z
    .string()
    .nonempty({ message: "O conteúdo da mensagem não pode estar vazio" })
    .refine(
      (value) => !value.trim().startsWith("{{") && !value.trim().endsWith("}}"),
      { message: "Não pode iniciar ou terminar uma mensagem com variável" }
    ),
  channelId: z
    .string()
    .nonempty({ message: "Selecione um canal para continuar" }),
  lang: z.enum(["pt_BR", "en_US"]),
  variables: z.array(
    z.object({
      name: z.string(),
      example: z.string().nonempty({ message: "Não pode ficar vazio!" }),
    })
  ),
  category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]),
  type: z.enum(["whatsapp", "general"]),
});

export const addGeneralTemplateInputSchema = z.object({
  name: z.string(),
  text: z.string(),
  channelId: z.string(),
  lang: z.enum(["pt_BR", "en_US"]),
  variables: z
    .array(
      z.object({
        name: z.string(),
        example: z.string(),
      })
    )
    .optional(),
});

export const updateGeneralTemplateInputSchema = z.object({
  id: z.string(),
  name: z.string(),
  text: z.string(),
  channelId: z.string(),
  lang: z.enum(["pt_BR", "en_US"]),
  variables: z.array(
    z.object({
      name: z.string(),
      example: z.string(),
    })
  ),
});
