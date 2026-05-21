import z from "zod";

export const createQuickMessageSchema = z.object({
  shortcode: z
    .string()
    .min(1, { message: "O atalho é obrigatório" })
    .max(50, { message: "O atalho pode ter no máximo 50 caracteres" })
    .regex(/^[a-z0-9_]+$/, {
      message: "O atalho deve conter apenas letras minúsculas, números e _",
    }),
  message: z
    .string()
    .min(1, { message: "A mensagem é obrigatória" })
    .max(4096, { message: "A mensagem pode ter no máximo 4096 caracteres" }),
  isPublic: z.boolean().default(false),
  mediaUrl: z.string().nullable().optional(),
  mediaType: z
    .enum(["image", "document", "audio", "video"])
    .nullable()
    .optional(),
  mediaName: z.string().nullable().optional(),
});

export const updateQuickMessageSchema = z.object({
  id: z.string().uuid(),
  shortcode: z
    .string()
    .min(1, { message: "O atalho é obrigatório" })
    .max(50, { message: "O atalho pode ter no máximo 50 caracteres" })
    .regex(/^[a-z0-9_]+$/, {
      message: "O atalho deve conter apenas letras minúsculas, números e _",
    })
    .optional(),
  message: z
    .string()
    .min(1, { message: "A mensagem é obrigatória" })
    .max(4096, { message: "A mensagem pode ter no máximo 4096 caracteres" })
    .optional(),
  isPublic: z.boolean().optional(),
  mediaUrl: z.string().nullable().optional(),
  mediaType: z
    .enum(["image", "document", "audio", "video"])
    .nullable()
    .optional(),
  mediaName: z.string().nullable().optional(),
});

export const searchQuickMessageSchema = z.object({
  query: z.string().min(1).max(50),
});

export const resolveQuickMessageVariablesSchema = z.object({
  quickMessageId: z.string().uuid({ message: "ID da mensagem rápida inválido" }),
  conversationId: z.string().uuid({ message: "ID da conversação inválido" }).optional(),
});

export const resolveMessageVariablesSchema = z.object({
  content: z.string(),
  conversationId: z.string().uuid({ message: "ID da conversação inválido" }),
});
