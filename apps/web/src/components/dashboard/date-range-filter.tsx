"use client";

import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { cn } from "@/lib/utils";
import type { DateRangeFilter as DateRangeFilterType, DateRangePreset } from "@/types/dashboard";
import { useDashboardStore, calculateDateRange } from "@/hooks/use-dashboard";

const presets: { value: DateRangePreset; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "last7days", label: "7 dias" },
  { value: "last30days", label: "30 dias" },
  { value: "custom", label: "Personalizado" },
];

interface DateRangeFilterProps {
  className?: string;
}

export function DateRangeFilter({ className }: DateRangeFilterProps) {
  const dateFilter = useDashboardStore((state) => state.dateFilter);
  const setDateFilter = useDashboardStore((state) => state.setDateFilter);
  const setPreset = useDashboardStore((state) => state.setPreset);

  const handlePresetClick = (preset: DateRangePreset) => {
    if (preset === "custom") {
      setDateFilter({
        ...dateFilter,
        preset: "custom",
      });
    } else {
      setPreset(preset);
    }
  };

  const handleCustomDateChange = (startDate: string, endDate: string) => {
    setDateFilter({
      preset: "custom",
      startDate: startDate || dateFilter.startDate,
      endDate: endDate || dateFilter.endDate,
    });
  };

  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end", className)}>
      <div className="flex gap-2">
        {presets.map((preset) => (
          <Button
            key={preset.value}
            variant={dateFilter.preset === preset.value ? "primary" : "outline"}
            onClick={() => handlePresetClick(preset.value)}
          >
            {preset.label}
          </Button>
        ))}
      </div>
      {dateFilter.preset === "custom" && (
        <div className="max-w-xs">
          <DateRangePicker
            startDate={dateFilter.startDate}
            endDate={dateFilter.endDate}
            onChange={handleCustomDateChange}
          />
        </div>
      )}
    </div>
  );
}
