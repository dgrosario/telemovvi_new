import z from "zod";

// Plan schemas
export const createPlanSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(100),
  description: z.string().max(500).nullable().optional(),
  isDefault: z.boolean().optional(),
  isEnabled: z.boolean().optional(),
  copyFromPlanId: z.string().uuid().nullable().optional(),
});

export const updatePlanSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  isDefault: z.boolean().optional(),
  isEnabled: z.boolean().optional(),
});

export const deletePlanSchema = z.object({
  id: z.string().uuid(),
});

export const duplicatePlanSchema = z.object({
  sourcePlanId: z.string().uuid(),
  newName: z.string().min(1, "Nome é obrigatório").max(100),
});

export const setDefaultPlanSchema = z.object({
  planId: z.string().uuid(),
});

// Installment schemas
export const installmentItemSchema = z.object({
  installmentNumber: z.number().int().min(1).max(99),
  interestRate: z.number().min(0).max(100),
  additionalFee: z.number().min(0).max(100),
  isEnabled: z.boolean(),
});

export const updateInstallmentsSchema = z.object({
  planId: z.string().uuid(),
  installments: z.array(installmentItemSchema).min(1),
});

export const createInstallmentSchema = z.object({
  planId: z.string().uuid(),
  installmentNumber: z.number().int().min(1).max(99),
  interestRate: z.number().min(0).max(100),
  additionalFee: z.number().min(0).max(100).default(0),
  isEnabled: z.boolean().default(true),
});

export const deleteInstallmentSchema = z.object({
  planId: z.string().uuid(),
  installmentNumber: z.number().int().min(1),
});

// Message schema
export const updateMessageSchema = z.object({
  footerMessage: z.string().max(500),
});

// Chat calculator schema
export const getPlanForChatSchema = z.object({
  planId: z.string().uuid(),
});
