"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Icon } from "@iconify/react";
import type { MetricColorScheme, MetricFormatType } from "@/types/dashboard";

interface MetricCardProps {
  label: string;
  value: number | string | null;
  secondaryValue?: string;
  icon: string;
  colorScheme: MetricColorScheme;
  formatType: MetricFormatType;
  className?: string;
}

const colorStyles: Record<MetricColorScheme, { bg: string; icon: string }> = {
  cyan: { bg: "bg-cyan-50", icon: "text-cyan-600" },
  amber: { bg: "bg-amber-50", icon: "text-amber-600" },
  emerald: { bg: "bg-emerald-50", icon: "text-emerald-600" },
  violet: { bg: "bg-violet-50", icon: "text-violet-600" },
  rose: { bg: "bg-rose-50", icon: "text-rose-600" },
  slate: { bg: "bg-slate-50", icon: "text-slate-600" },
  blue: { bg: "bg-blue-50", icon: "text-blue-600" },
  orange: { bg: "bg-orange-50", icon: "text-orange-600" },
  green: { bg: "bg-green-50", icon: "text-green-600" },
  purple: { bg: "bg-purple-50", icon: "text-purple-600" },
  red: { bg: "bg-red-50", icon: "text-red-600" },
  teal: { bg: "bg-teal-50", icon: "text-teal-600" },
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatTime(minutes: number | null): string {
  if (minutes === null || minutes === 0) {
    return "00h 00m";
  }

  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}h ${mins.toString().padStart(2, "0")}m`;
  }

  return `${mins}m`;
}

function formatValue(
  value: number | string | null,
  formatType: MetricFormatType,
  secondaryValue?: string
): string {
  if (value === null) {
    return formatType === "time" ? "00h 00m" : "0";
  }

  if (formatType === "ratio" && secondaryValue) {
    return `${value}/${secondaryValue}`;
  }

  if (formatType === "time") {
    const numericValue = typeof value === "string" ? parseFloat(value) : value;
    return formatTime(numericValue);
  }

  if (typeof value === "number") {
    return formatNumber(value);
  }

  const numericValue = parseFloat(String(value));
  if (!isNaN(numericValue)) {
    return formatNumber(numericValue);
  }

  return String(value);
}

export function MetricCard({
  label,
  value,
  secondaryValue,
  icon,
  colorScheme,
  formatType,
  className,
}: MetricCardProps) {
  const styles = colorStyles[colorScheme];
  const displayValue = formatValue(value, formatType, secondaryValue);

  return (
    <Card className={cn("p-4 rounded-2xl border-border/70 shadow-sm", className)}>
      <div className="flex items-center gap-4">
        <div className={cn("rounded-xl p-3.5 ring-1 ring-black/5", styles.bg)}>
          <Icon icon={icon} className={cn("h-6 w-6 md:h-7 md:w-7", styles.icon)} />
        </div>
        <div className="flex flex-col">
          <span className="text-2xl md:text-3xl font-bold text-foreground">
            {displayValue}
          </span>
          <span className="text-sm md:text-base text-muted-foreground">{label}</span>
        </div>
      </div>
    </Card>
  );
}
