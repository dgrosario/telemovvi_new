"use client";

import { Icon } from "@iconify/react";
import { MetricCard } from "./metric-card";
import { MetricCardSkeleton } from "./metric-card-skeleton";
import { useDashboardMetrics } from "@/hooks/use-dashboard";
import type { MetricConfig, DashboardData } from "@/types/dashboard";

const METRICS_CONFIG: MetricConfig[] = [
  {
    id: "open",
    label: "Em Atendimento",
    icon: "tabler:message-circle",
    colorScheme: "cyan",
    formatType: "number",
  },
  {
    id: "waiting",
    label: "Aguardando",
    icon: "tabler:clock",
    colorScheme: "amber",
    formatType: "number",
  },
  {
    id: "closed",
    label: "Finalizados",
    icon: "tabler:check",
    colorScheme: "emerald",
    formatType: "number",
  },
  {
    id: "newContacts",
    label: "Novos Contatos",
    icon: "tabler:user-plus",
    colorScheme: "blue",
    formatType: "number",
  },
  {
    id: "messagesReceived",
    label: "Msgs Recebidas",
    icon: "tabler:message-2",
    colorScheme: "green",
    formatType: "number",
  },
  {
    id: "messagesSent",
    label: "Msgs Enviadas",
    icon: "tabler:send",
    colorScheme: "purple",
    formatType: "number",
  },
  {
    id: "avgServiceTime",
    label: "T.M. Atendimento",
    icon: "tabler:clock-hour-4",
    colorScheme: "orange",
    formatType: "time",
  },
  {
    id: "avgWaitTime",
    label: "T.M. Espera",
    icon: "tabler:hourglass",
    colorScheme: "rose",
    formatType: "time",
  },
];

function getMetricValue(
  data: DashboardData | undefined,
  id: string
): { value: number | null; secondaryValue?: string } {
  if (!data) {
    return { value: null };
  }

  switch (id) {
    case "open":
      return { value: data.metrics.conversations.open };
    case "waiting":
      return { value: data.metrics.conversations.waiting };
    case "closed":
      return { value: data.metrics.conversations.closed };
    case "newContacts":
      return { value: data.metrics.activity.newContacts };
    case "messagesReceived":
      return { value: data.metrics.activity.messagesReceived };
    case "messagesSent":
      return { value: data.metrics.activity.messagesSent };
    case "avgServiceTime":
      return { value: data.metrics.performance.avgServiceTimeMinutes };
    case "avgWaitTime":
      return { value: data.metrics.performance.avgWaitTimeMinutes };
    default:
      return { value: null };
  }
}

export function MetricsGrid() {
  const { data, isLoading, isError } = useDashboardMetrics();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {METRICS_CONFIG.map((config) => (
          <MetricCardSkeleton key={config.id} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6">
        <div className="flex flex-col items-center justify-center gap-2 text-center">
          <Icon icon="tabler:alert-circle" className="h-8 w-8 text-destructive" />
          <p className="text-sm text-muted-foreground">
            Erro ao carregar metricas. Verifique suas permissoes ou tente novamente.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {METRICS_CONFIG.map((config) => {
        const { value, secondaryValue } = getMetricValue(data, config.id);
        return (
          <MetricCard
            key={config.id}
            label={config.label}
            value={value}
            secondaryValue={secondaryValue}
            icon={config.icon}
            colorScheme={config.colorScheme}
            formatType={config.formatType}
          />
        );
      })}
    </div>
  );
}
