"use client";

import { TitlePage } from "@/components/title-page";
import { Calculator } from "lucide-react";

export function HeaderCalculator() {
  return (
    <header className="pt-6 flex justify-between items-center px-6">
      <div className="flex items-center gap-3">
        <Calculator className="size-6 text-green-500" />
        <div>
          <TitlePage>Calculadora de Pagamento</TitlePage>
          <p className="text-sm text-gray-500">
            Configure planos de pagamento com taxas de juros personalizadas
          </p>
        </div>
      </div>
    </header>
  );
}
