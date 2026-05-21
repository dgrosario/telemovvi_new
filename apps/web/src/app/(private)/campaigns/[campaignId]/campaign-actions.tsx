"use client";

import { cancelCampaign, startCampaign } from "@/app/actions/campaigns";
import CancelIcon from "@mui/icons-material/Cancel";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { Button, Paper, Typography } from "@mui/material";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Flip, toast } from "react-toastify";
import { CampaignStatus } from "../types";

type CampaignActionsProps = {
  campaignId: string;
  status: CampaignStatus;
};

export function CampaignActions({ campaignId, status }: CampaignActionsProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const canStart = status === "draft" || status === "scheduled";
  const canCancel = status === "scheduled" || status === "running";

  const handleStart = async () => {
    const confirmed = confirm(
      "Tem certeza que deseja iniciar esta campanha? As mensagens serão enviadas imediatamente."
    );
    if (!confirmed) return;

    setIsLoading(true);
    try {
      const [, error] = await startCampaign({ campaignId });
      if (error) {
        toast.error(error.message ?? "Erro ao iniciar campanha", {
          transition: Flip,
        });
        return;
      }
      toast.success("Campanha iniciada com sucesso!", { transition: Flip });
      router.refresh();
    } catch {
      toast.error("Erro ao iniciar campanha", { transition: Flip });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = async () => {
    const confirmed = confirm(
      "Tem certeza que deseja cancelar esta campanha? Mensagens já enviadas não serão afetadas."
    );
    if (!confirmed) return;

    setIsLoading(true);
    try {
      const [, error] = await cancelCampaign({ campaignId });
      if (error) {
        toast.error(error.message ?? "Erro ao cancelar campanha", {
          transition: Flip,
        });
        return;
      }
      toast.success("Campanha cancelada!", { transition: Flip });
      router.refresh();
    } catch {
      toast.error("Erro ao cancelar campanha", { transition: Flip });
    } finally {
      setIsLoading(false);
    }
  };

  if (!canStart && !canCancel) {
    return null;
  }

  return (
    <Paper elevation={0} className="border rounded p-6">
      <Typography variant="h6" className="mb-4">
        Ações
      </Typography>

      <div className="space-y-3">
        {canStart && (
          <Button
            variant="contained"
            color="success"
            fullWidth
            startIcon={<PlayArrowIcon />}
            onClick={handleStart}
            disabled={isLoading}
          >
            Iniciar Campanha
          </Button>
        )}

        {canCancel && (
          <Button
            variant="outlined"
            color="error"
            fullWidth
            startIcon={<CancelIcon />}
            onClick={handleCancel}
            disabled={isLoading}
          >
            Cancelar Campanha
          </Button>
        )}
      </div>
    </Paper>
  );
}
