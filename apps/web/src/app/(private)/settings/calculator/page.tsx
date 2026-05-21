import { listPlans } from "@/app/actions/payment-plans";
import { CalculatorSettingsContent } from "./calculator-settings-content";
import { HeaderCalculator } from "./header-calculator";

export default async function CalculatorSettingsPage() {
  const [plans] = await listPlans();

  return (
    <div className="h-full overflow-auto">
      <HeaderCalculator />
      <CalculatorSettingsContent plans={plans ?? []} />
    </div>
  );
}
