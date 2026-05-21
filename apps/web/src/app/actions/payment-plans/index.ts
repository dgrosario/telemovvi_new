"use server";

import { PaymentPlan } from "@omnichannel/core/domain/entities/payment-plan";
import { PaymentPlanInstallment } from "@omnichannel/core/domain/entities/payment-plan-installment";
import { PaymentPlanRepository } from "@omnichannel/core/infra/repositories/payment-plan-repository";
import { PaymentPlanInstallmentRepository } from "@omnichannel/core/infra/repositories/payment-plan-installment-repository";
import { CalculatorMessageRepository } from "@omnichannel/core/infra/repositories/calculator-message-repository";
import { revalidatePath } from "next/cache";
import { securityProcedure } from "../procedure";
import {
  createPlanSchema,
  updatePlanSchema,
  deletePlanSchema,
  duplicatePlanSchema,
  setDefaultPlanSchema,
  updateInstallmentsSchema,
  createInstallmentSchema,
  deleteInstallmentSchema,
  updateMessageSchema,
  getPlanForChatSchema,
} from "./schema";

const planRepository = PaymentPlanRepository.instance();
const installmentRepository = PaymentPlanInstallmentRepository.instance();
const messageRepository = CalculatorMessageRepository.instance();

// ============ PLAN ACTIONS ============

export const listPlans = securityProcedure(["manage:calculator-settings"]).handler(
  async ({ ctx }) => {
    const plans = await planRepository.listByWorkspace(ctx.membership.workspaceId);
    return plans.map((p) => p.raw());
  }
);

export const listPlansForChat = securityProcedure(["send:message"]).handler(
  async ({ ctx }) => {
    const plans = await planRepository.listEnabledByWorkspace(ctx.membership.workspaceId);
    return plans.map((p) => p.raw());
  }
);

export const createPlan = securityProcedure(["manage:calculator-settings"])
  .input(createPlanSchema)
  .handler(async ({ ctx, input }) => {
    // If copying from another plan
    if (input.copyFromPlanId) {
      const newPlan = await planRepository.duplicatePlan(
        input.copyFromPlanId,
        input.name,
        ctx.membership.workspaceId
      );
      revalidatePath("/settings/calculator", "page");
      return newPlan.raw();
    }

    // Create new plan with default installments
    const plan = PaymentPlan.create({
      workspaceId: ctx.membership.workspaceId,
      name: input.name,
      description: input.description ?? null,
      isDefault: input.isDefault ?? false,
      isEnabled: input.isEnabled ?? true,
    });

    const installments = PaymentPlanInstallment.createDefaultInstallments(plan.id);
    
    try {
      const createdPlan = await planRepository.createWithInstallments(plan, installments);
      revalidatePath("/settings/calculator", "page");
      return createdPlan.raw();
    } catch (error) {
      console.error("[createPlan] Error:", error);
      throw error;
    }
  });

export const updatePlan = securityProcedure(["manage:calculator-settings"])
  .input(updatePlanSchema)
  .handler(async ({ input }) => {
    const updated = await planRepository.update(input.id, {
      name: input.name,
      description: input.description,
      isDefault: input.isDefault,
      isEnabled: input.isEnabled,
    });

    if (!updated) {
      throw new Error("Plano não encontrado");
    }

    revalidatePath("/settings/calculator", "page");
    return updated.raw();
  });

export const deletePlan = securityProcedure(["manage:calculator-settings"])
  .input(deletePlanSchema)
  .handler(async ({ input }) => {
    await planRepository.delete(input.id);
    revalidatePath("/settings/calculator", "page");
  });

export const duplicatePlan = securityProcedure(["manage:calculator-settings"])
  .input(duplicatePlanSchema)
  .handler(async ({ ctx, input }) => {
    const newPlan = await planRepository.duplicatePlan(
      input.sourcePlanId,
      input.newName,
      ctx.membership.workspaceId
    );
    revalidatePath("/settings/calculator", "page");
    return newPlan.raw();
  });

export const setDefaultPlan = securityProcedure(["manage:calculator-settings"])
  .input(setDefaultPlanSchema)
  .handler(async ({ ctx, input }) => {
    await planRepository.setDefault(ctx.membership.workspaceId, input.planId);
    revalidatePath("/settings/calculator", "page");
  });

// ============ INSTALLMENT ACTIONS ============

export const listInstallments = securityProcedure(["manage:calculator-settings"])
  .input(getPlanForChatSchema)
  .handler(async ({ input }) => {
    const installments = await installmentRepository.listByPlan(input.planId);
    return installments.map((i) => i.raw());
  });

export const listInstallmentsForChat = securityProcedure(["send:message"])
  .input(getPlanForChatSchema)
  .handler(async ({ input }) => {
    const installments = await installmentRepository.listEnabledByPlan(input.planId);
    return installments.map((i) => i.raw());
  });

export const updateInstallments = securityProcedure(["manage:calculator-settings"])
  .input(updateInstallmentsSchema)
  .handler(async ({ input }) => {
    const updated = await installmentRepository.bulkUpsert(input.planId, input.installments);
    revalidatePath("/settings/calculator", "page");
    return updated.map((i) => i.raw());
  });

export const createInstallment = securityProcedure(["manage:calculator-settings"])
  .input(createInstallmentSchema)
  .handler(async ({ input }) => {
    const existing = await installmentRepository.findByPlanAndInstallment(
      input.planId,
      input.installmentNumber
    );

    if (existing) {
      throw new Error(`Já existe configuração para ${input.installmentNumber}x`);
    }

    const installment = PaymentPlanInstallment.create({
      planId: input.planId,
      installmentNumber: input.installmentNumber,
      interestRate: input.interestRate,
      additionalFee: input.additionalFee,
      isEnabled: input.isEnabled,
    });

    const created = await installmentRepository.create(installment);
    revalidatePath("/settings/calculator", "page");
    return created.raw();
  });

export const deleteInstallment = securityProcedure(["manage:calculator-settings"])
  .input(deleteInstallmentSchema)
  .handler(async ({ input }) => {
    await installmentRepository.deleteByPlanAndInstallment(input.planId, input.installmentNumber);
    revalidatePath("/settings/calculator", "page");
  });

// ============ MESSAGE ACTIONS ============

export const getCalculatorMessage = securityProcedure(["manage:calculator-settings"]).handler(
  async ({ ctx }) => {
    const message = await messageRepository.getOrCreate(ctx.membership.workspaceId);
    return message.raw();
  }
);

export const getCalculatorMessageForChat = securityProcedure(["send:message"]).handler(
  async ({ ctx }) => {
    const message = await messageRepository.getOrCreate(ctx.membership.workspaceId);
    return message.raw();
  }
);

export const updateCalculatorMessage = securityProcedure(["manage:calculator-settings"])
  .input(updateMessageSchema)
  .handler(async ({ ctx, input }) => {
    const updated = await messageRepository.updateFooterMessage(
      ctx.membership.workspaceId,
      input.footerMessage
    );
    revalidatePath("/settings/calculator", "page");
    return updated.raw();
  });
