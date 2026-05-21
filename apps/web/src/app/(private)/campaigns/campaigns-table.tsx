"use client";

import { cancelCampaign, startCampaign } from "@/app/actions/campaigns";
import CancelIcon from "@mui/icons-material/Cancel";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import VisibilityIcon from "@mui/icons-material/Visibility";
import {
  Chip,
  IconButton,
  LinearProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
} from "@mui/material";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Flip, toast } from "react-toastify";
import { CampaignListItem, CampaignStatus } from "./types";

type CampaignsTableProps = {
  campaigns: CampaignListItem[];
};

const statusConfig: Record<CampaignStatus, { label: string; color: "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" }> = {
  draft: { label: "Rascunho", color: "default" },
  scheduled: { label: "Agendada", color: "info" },
  running: { label: "Em execução", color: "warning" },
  completed: { label: "Concluída", color: "success" },
  cancelled: { label: "Cancelada", color: "error" },
  failed: { label: "Falhou", color: "error" },
};

export function CampaignsTable({ campaigns }: CampaignsTableProps) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleStart = async (campaignId: string) => {
    const confirmed = confirm(
      "Tem certeza que deseja iniciar esta campanha? As mensagens serão enviadas imediatamente."
    );
    if (!confirmed) return;

    setLoadingId(campaignId);
    try {
      const [, error] = await startCampaign({ campaignId });
      if (error) {
        toast.error(error.message ?? "Erro ao iniciar campanha", { transition: Flip });
        return;
      }
      toast.success("Campanha iniciada com sucesso!", { transition: Flip });
      router.refresh();
    } catch {
      toast.error("Erro ao iniciar campanha", { transition: Flip });
    } finally {
      setLoadingId(null);
    }
  };

  const handleCancel = async (campaignId: string) => {
    const confirmed = confirm(
      "Tem certeza que deseja cancelar esta campanha? Mensagens já enviadas não serão afetadas."
    );
    if (!confirmed) return;

    setLoadingId(campaignId);
    try {
      const [, error] = await cancelCampaign({ campaignId });
      if (error) {
        toast.error(error.message ?? "Erro ao cancelar campanha", { transition: Flip });
        return;
      }
      toast.success("Campanha cancelada!", { transition: Flip });
      router.refresh();
    } catch {
      toast.error("Erro ao cancelar campanha", { transition: Flip });
    } finally {
      setLoadingId(null);
    }
  };

  if (campaigns.length === 0) {
    return (
      <div className="px-6 py-10 text-center text-gray-500">
        Nenhuma campanha criada ainda. Clique em "Nova Campanha" para começar.
      </div>
    );
  }

  return (
    <TableContainer component={Paper} elevation={0}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Nome</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Canal</TableCell>
            <TableCell>Progresso</TableCell>
            <TableCell>Agendamento</TableCell>
            <TableCell>Criada em</TableCell>
            <TableCell align="center">Ações</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {campaigns.map((campaign) => {
            const { label, color } = statusConfig[campaign.status];
            const isLoading = loadingId === campaign.id;
            const canStart = campaign.status === "draft" || campaign.status === "scheduled";
            const canCancel = campaign.status === "scheduled" || campaign.status === "running";

            return (
              <TableRow key={campaign.id} hover>
                <TableCell className="font-medium">{campaign.name}</TableCell>
                <TableCell>
                  <Chip label={label} color={color} size="small" />
                </TableCell>
                <TableCell>{campaign.channelName}</TableCell>
                <TableCell>
                  <div className="min-w-[150px]">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{campaign.progress.sent} enviadas</span>
                      <span>{campaign.progress.percentage}%</span>
                    </div>
                    <LinearProgress
                      variant="determinate"
                      value={campaign.progress.percentage}
                      color={campaign.progress.failed > 0 ? "warning" : "success"}
                    />
                    {campaign.progress.failed > 0 && (
                      <div className="text-xs text-red-500 mt-1">
                        {campaign.progress.failed} falhas
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {campaign.scheduledAt
                    ? format(new Date(campaign.scheduledAt), "dd/MM/yyyy HH:mm", {
                        locale: ptBR,
                      })
                    : "-"}
                </TableCell>
                <TableCell>
                  {format(new Date(campaign.createdAt), "dd/MM/yyyy HH:mm", {
                    locale: ptBR,
                  })}
                </TableCell>
                <TableCell align="center">
                  <div className="flex justify-center gap-1">
                    <Tooltip title="Ver detalhes">
                      <IconButton
                        size="small"
                        onClick={() => router.push(`/campaigns/${campaign.id}`)}
                        color="primary"
                      >
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {canStart && (
                      <Tooltip title="Iniciar campanha">
                        <IconButton
                          size="small"
                          onClick={() => handleStart(campaign.id)}
                          color="success"
                          disabled={isLoading}
                        >
                          <PlayArrowIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {canCancel && (
                      <Tooltip title="Cancelar campanha">
                        <IconButton
                          size="small"
                          onClick={() => handleCancel(campaign.id)}
                          color="error"
                          disabled={isLoading}
                        >
                          <CancelIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
