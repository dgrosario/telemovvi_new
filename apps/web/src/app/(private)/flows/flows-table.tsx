"use client";

import { useUpdateFlow } from "@/hooks/use-flows";
import { useFlowsUI } from "@/hooks/use-flows-ui";
import VisibilityIcon from "@mui/icons-material/Visibility";
import {
  Chip,
  IconButton,
  Paper,
  Switch,
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
import { Flip, toast } from "react-toastify";

type Flow = {
  id: string;
  name: string;
  status: "active" | "inactive" | "draft";
  nodesCount: number;
  createdAt: Date;
  updatedAt: Date;
  channels: Array<{
    id: string;
    name: string;
    type: string;
  }>;
};

type FlowsTableProps = {
  flows: Flow[];
};

export function FlowsTable({ flows }: FlowsTableProps) {
  const { mutateAsync: updateFlow, isPending: isUpdating } = useUpdateFlow();
  const { openDetails } = useFlowsUI();

  const handleToggleStatus = async (
    flowId: string,
    currentStatus: Flow["status"]
  ) => {
    if (currentStatus === "draft") {
      return;
    }

    const newStatus = currentStatus === "active" ? "inactive" : "active";

    if (currentStatus === "active") {
      const confirmed = confirm(
        "Tem certeza que deseja desativar este fluxo? Ele não será mais executado automaticamente."
      );
      if (!confirmed) return;
    }

    try {
      await updateFlow({
        flowId,
        status: newStatus,
      });
      toast.success(
        `Fluxo ${newStatus === "active" ? "ativado" : "desativado"} com sucesso!`,
        { transition: Flip }
      );
    } catch (error) {
      console.error("Error toggling flow status:", error);
      toast.error("Erro ao alterar status do fluxo", { transition: Flip });
    }
  };

  const getStatusLabel = (status: Flow["status"]) => {
    switch (status) {
      case "active":
        return "Ativo";
      case "inactive":
        return "Inativo";
      case "draft":
        return "Rascunho";
      default:
        return status;
    }
  };

  if (flows.length === 0) {
    return (
      <div className="px-6 py-10 text-center text-gray-500">
        Nenhum fluxo criado ainda. Clique em "Novo Fluxo" para começar.
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
            <TableCell>Conexões</TableCell>
            <TableCell align="center">Blocos</TableCell>
            <TableCell>Criado em</TableCell>
            <TableCell>Atualizado em</TableCell>
            <TableCell align="center">Visualizar</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {flows.map((flow) => {
            const isDraft = flow.status === "draft";
            const isActive = flow.status === "active";

            return (
              <TableRow key={flow.id} hover>
                <TableCell>{flow.name}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {isDraft ? (
                      <Tooltip title="Publique o fluxo no editor para poder ativá-lo">
                        <span className="flex items-center gap-2">
                          <Switch
                            size="small"
                            checked={false}
                            disabled
                          />
                          <span className="text-sm text-amber-600">
                            {getStatusLabel(flow.status)}
                          </span>
                        </span>
                      </Tooltip>
                    ) : (
                      <>
                        <Switch
                          size="small"
                          checked={isActive}
                          onChange={() => handleToggleStatus(flow.id, flow.status)}
                          disabled={isUpdating}
                          color="success"
                        />
                        <span className={`text-sm ${isActive ? "text-green-600" : "text-gray-500"}`}>
                          {getStatusLabel(flow.status)}
                        </span>
                      </>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {flow.channels.length === 0 ? (
                    <span className="text-gray-400">Nenhuma</span>
                  ) : (
                    <div className="flex gap-1 flex-wrap">
                      {flow.channels.map((channel) => (
                        <Chip
                          key={channel.id}
                          label={channel.name}
                          size="small"
                          variant="outlined"
                        />
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell align="center">{flow.nodesCount}</TableCell>
                <TableCell>
                  {format(new Date(flow.createdAt), "dd/MM/yyyy HH:mm", {
                    locale: ptBR,
                  })}
                </TableCell>
                <TableCell>
                  {format(new Date(flow.updatedAt), "dd/MM/yyyy HH:mm", {
                    locale: ptBR,
                  })}
                </TableCell>
                <TableCell align="center">
                  <Tooltip title="Ver detalhes">
                    <IconButton
                      size="small"
                      onClick={() => openDetails(flow.id)}
                      color="primary"
                    >
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
