import { z } from "zod";

export const labelSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Nome é obrigatório"),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Cor deve estar no formato #RRGGBB")
    .optional(),
});

export type LabelInput = z.infer<typeof labelSchema>;
