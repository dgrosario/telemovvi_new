import z from "zod";

export const resolverTypeSchema = z.enum([
  "contact_field",
  "attendant_field",
  "time_based",
  "current_time",
  "current_date",
  "day_of_week",
  "conversation_field",
  "custom",
]);

export const resolverConfigSchema = z.object({
  field: z.string().optional(),
  timezone: z.string().optional(),
  format: z.string().optional(),
  type: z.string().optional(),
  value: z.string().optional(),
});

export const createSystemVariableSchema = z.object({
  key: z
    .string()
    .min(1, { message: "A chave é obrigatória" })
    .max(100, { message: "A chave pode ter no máximo 100 caracteres" })
    .regex(/^[a-z0-9_]+$/, {
      message: "A chave deve conter apenas letras minúsculas, números e _",
    }),
  label: z
    .string()
    .min(1, { message: "O nome é obrigatório" })
    .max(255, { message: "O nome pode ter no máximo 255 caracteres" }),
  description: z.string().max(1000).nullable().optional(),
  resolverType: resolverTypeSchema,
  resolverConfig: resolverConfigSchema,
});

export const updateSystemVariableSchema = z.object({
  id: z.string().uuid(),
  label: z
    .string()
    .min(1, { message: "O nome é obrigatório" })
    .max(255)
    .optional(),
  description: z.string().max(1000).nullable().optional(),
  resolverConfig: resolverConfigSchema.optional(),
  isActive: z.boolean().optional(),
});
