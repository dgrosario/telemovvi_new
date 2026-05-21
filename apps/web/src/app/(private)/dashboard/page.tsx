"use client";

import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
import { MetricsGrid } from "@/components/dashboard/metrics-grid";
import { AttendantMetricsTable } from "@/components/dashboard/attendant-metrics-table";

export default function DashboardPage() {
  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <h1 className="text-2xl font-bold">Indicadores</h1>
        <DateRangeFilter />
      </header>
      <main className="flex-1 overflow-auto p-6 space-y-6">
        <MetricsGrid />
        <AttendantMetricsTable />
      </main>
    </div>
  );
}
