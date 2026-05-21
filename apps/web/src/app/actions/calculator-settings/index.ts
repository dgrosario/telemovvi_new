"use server";
import { CalculatorSettings } from "@omnichannel/core/domain/entities/calculator-settings";
import { CalculatorSettingsDatabaseRepository } from "@omnichannel/core/infra/repositories/calculator-settings-repository";
import { revalidatePath } from "next/cache";
import { securityProcedure } from "../procedure";
import {
  createCalculatorSettingSchema,
  deleteCalculatorSettingSchema,
  updateCalculatorSettingsSchema,
  updateSingleSettingSchema,
} from "./schema";

const calculatorSettingsRepository =
  CalculatorSettingsDatabaseRepository.instance();

export const listCalculatorSettings = securityProcedure([
  "manage:calculator-settings",
]).handler(async ({ ctx }) => {
  const settings = await calculatorSettingsRepository.getOrInitialize(
    ctx.membership.workspaceId
  );
  return settings.map((s) => s.raw());
});

export const getCalculatorSettingsForChat = securityProcedure([
  "send:message",
]).handler(async ({ ctx }) => {
  const settings = await calculatorSettingsRepository.listEnabledByWorkspace(
    ctx.membership.workspaceId
  );
  return settings.map((s) => s.raw());
});

export const updateCalculatorSettings = securityProcedure([
  "manage:calculator-settings",
])
  .input(updateCalculatorSettingsSchema)
  .handler(async ({ ctx, input }) => {
    const updated = await calculatorSettingsRepository.bulkUpsert(
      ctx.membership.workspaceId,
      input.settings
    );

    revalidatePath("/settings/calculator", "page");
    return updated.map((s) => s.raw());
  });

export const updateSingleCalculatorSetting = securityProcedure([
  "manage:calculator-settings",
])
  .input(updateSingleSettingSchema)
  .handler(async ({ ctx, input }) => {
    const updated = await calculatorSettingsRepository.upsertByWorkspaceAndInstallment(
      ctx.membership.workspaceId,
      input.installmentNumber,
      {
        interestRate: input.interestRate,
        isEnabled: input.isEnabled,
      }
    );

    revalidatePath("/settings/calculator", "page");
    return updated.raw();
  });

export const initializeCalculatorSettings = securityProcedure([
  "manage:calculator-settings",
]).handler(async ({ ctx }) => {
  const settings = await calculatorSettingsRepository.initializeDefaultSettings(
    ctx.membership.workspaceId
  );

  revalidatePath("/settings/calculator", "page");
  return settings.map((s) => s.raw());
});

export const createCalculatorSetting = securityProcedure([
  "manage:calculator-settings",
])
  .input(createCalculatorSettingSchema)
  .handler(async ({ ctx, input }) => {
    const existing = await calculatorSettingsRepository.findByWorkspaceAndInstallment(
      ctx.membership.workspaceId,
      input.installmentNumber
    );

    if (existing) {
      throw new Error(`Ja existe uma configuracao para ${input.installmentNumber}x`);
    }

    const setting = CalculatorSettings.create({
      workspaceId: ctx.membership.workspaceId,
      installmentNumber: input.installmentNumber,
      interestRate: input.interestRate,
      isEnabled: input.isEnabled,
    });

    const created = await calculatorSettingsRepository.create(setting);

    revalidatePath("/settings/calculator", "page");
    return created.raw();
  });

export const deleteCalculatorSetting = securityProcedure([
  "manage:calculator-settings",
])
  .input(deleteCalculatorSettingSchema)
  .handler(async ({ ctx, input }) => {
    await calculatorSettingsRepository.deleteByWorkspaceAndInstallment(
      ctx.membership.workspaceId,
      input.installmentNumber
    );

    revalidatePath("/settings/calculator", "page");
  });
