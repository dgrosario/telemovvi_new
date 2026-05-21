import { z } from "zod";

export const upsertSectorInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().nonempty({ message: "O nome não pode estar vazio" }),
  removed: z.boolean().default(false).optional(),
  workingHoursStart: z.string().regex(/^([0-1][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])$/).optional(),
  workingHoursEnd: z.string().regex(/^([0-1][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])$/).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  isDefault: z.boolean().optional(),
});

export type UpsertSectorInput = z.infer<typeof upsertSectorInputSchema>;
