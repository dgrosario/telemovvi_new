"use client";

import { PaymentPlan } from "@omnichannel/core/domain/entities/payment-plan";
import { Button, Card, CardContent } from "@mui/material";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { InstallmentTable } from "./installment-table";
import { MessageSettings } from "./message-settings";
import { PlanList } from "./plan-list";

type Props = {
  plans: PaymentPlan.Raw[];
};

type View = "list" | "installments";

export function CalculatorSettingsContent({ plans }: Props) {
  const [currentView, setCurrentView] = useState<View>("list");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  const handleSelectPlan = (planId: string) => {
    setSelectedPlanId(planId);
    setCurrentView("installments");
  };

  const handleBackToList = () => {
    setCurrentView("list");
    setSelectedPlanId(null);
  };

  // View: Lista de planos e mensagem
  if (currentView === "list") {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Card variant="outlined" className="mb-6">
          <CardContent>
            <PlanList plans={plans} onSelectPlan={handleSelectPlan} />
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent>
            <MessageSettings />
          </CardContent>
        </Card>
      </div>
    );
  }

  // View: Parcelas do plano selecionado
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-4">
        <Button
          variant="text"
          startIcon={<ArrowLeft className="size-4" />}
          onClick={handleBackToList}
          className="text-gray-600"
        >
          Voltar para Planos
        </Button>
      </div>

      <Card variant="outlined">
        <CardContent>
          {selectedPlan ? (
            <InstallmentTable planId={selectedPlan.id} planName={selectedPlan.name} />
          ) : (
            <div className="text-center py-8 text-gray-500">Plano não encontrado</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
