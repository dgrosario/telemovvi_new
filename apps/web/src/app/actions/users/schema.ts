import z from "zod";

export const authenticateInputSchema = z.object({
  email: z.string().nonempty({ message: "Não pode ficar vazio" }),
  password: z.string().nonempty({ message: "Não pode ficar vazio" }),
});

export const upsertUserInputSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  email: z.string().email({ message: "Email inválido" }),
  sectorId: z.string().optional(),
  password: z
    .string()
    .min(6, "Senha deve ter no mínimo 6 caracteres")
    .optional(),
  displayName: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  birthDate: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
});

export const resetPasswordInputSchema = z.object({
  userId: z.string(),
  newPassword: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
});

export const changeOwnPasswordInputSchema = z
  .object({
    currentPassword: z.string().min(1, "Senha atual obrigatória"),
    newPassword: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Senhas não conferem",
    path: ["confirmPassword"],
  });
