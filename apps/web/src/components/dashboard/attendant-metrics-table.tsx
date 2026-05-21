"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardMetrics } from "@/hooks/use-dashboard";
import type { AttendantMetric } from "@/types/dashboard";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatTime(minutes: number | null): string {
  if (minutes === null || minutes === 0) {
    return "-";
  }

  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);

  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }

  return `${mins}m`;
}

interface AttendantRowProps {
  attendant: AttendantMetric;
}

function AttendantRow({ attendant }: AttendantRowProps) {
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar>
            {attendant.thumbnail ? (
              <AvatarImage src={attendant.thumbnail} alt={attendant.name} />
            ) : null}
            <AvatarFallback>{getInitials(attendant.name)}</AvatarFallback>
          </Avatar>
          <span className="font-medium">{attendant.name}</span>
        </div>
      </TableCell>
      <TableCell className="text-center">
        {attendant.conversationsInProgress}
      </TableCell>
      <TableCell className="text-center">
        {attendant.conversationsFinished}
      </TableCell>
      <TableCell className="text-center">{attendant.messagesSent}</TableCell>
      <TableCell className="text-center">
        {formatTime(attendant.avgServiceTimeMinutes)}
      </TableCell>
      <TableCell className="text-center">
        {formatTime(attendant.avgFirstResponseMinutes)}
      </TableCell>
    </TableRow>
  );
}

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </div>
          </TableCell>
          <TableCell className="text-center">
            <Skeleton className="mx-auto h-4 w-8" />
          </TableCell>
          <TableCell className="text-center">
            <Skeleton className="mx-auto h-4 w-8" />
          </TableCell>
          <TableCell className="text-center">
            <Skeleton className="mx-auto h-4 w-8" />
          </TableCell>
          <TableCell className="text-center">
            <Skeleton className="mx-auto h-4 w-12" />
          </TableCell>
          <TableCell className="text-center">
            <Skeleton className="mx-auto h-4 w-12" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function AttendantMetricsTable() {
  const { data, isLoading, isError } = useDashboardMetrics();

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Metricas por Atendente</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-4">
            Erro ao carregar dados dos atendentes.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Metricas por Atendente</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Atendente</TableHead>
              <TableHead className="text-center">Em Atendimento</TableHead>
              <TableHead className="text-center">Finalizados</TableHead>
              <TableHead className="text-center">Msgs Enviadas</TableHead>
              <TableHead className="text-center">T.M. Atendimento</TableHead>
              <TableHead className="text-center">T.M. 1a Resposta</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton />
            ) : data?.attendants.length ? (
              data.attendants.map((attendant) => (
                <AttendantRow key={attendant.id} attendant={attendant} />
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Nenhum atendente encontrado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
