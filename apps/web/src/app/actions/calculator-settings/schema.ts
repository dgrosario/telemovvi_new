import z from "zod";

export const calculatorSettingItemSchema = z.object({
  installmentNumber: z.number().int().min(1).max(99),
  interestRate: z.number().min(0).max(100),
  isEnabled: z.boolean(),
});

export const updateCalculatorSettingsSchema = z.object({
  settings: z.array(calculatorSettingItemSchema).min(1),
});

export const updateSingleSettingSchema = z.object({
  installmentNumber: z.number().int().min(1).max(99),
  interestRate: z.number().min(0).max(100),
  isEnabled: z.boolean(),
});

export const createCalculatorSettingSchema = z.object({
  installmentNumber: z.number().int().min(1).max(99),
  interestRate: z.number().min(0).max(100),
  isEnabled: z.boolean().default(true),
});

export const deleteCalculatorSettingSchema = z.object({
  installmentNumber: z.number().int().min(1),
});
