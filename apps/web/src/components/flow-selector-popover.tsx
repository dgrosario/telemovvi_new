"use client";

import {
  Box,
  CircularProgress,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Popover,
  TextField,
  Typography,
} from "@mui/material";
import { Workflow, Search } from "lucide-react";
import { useState, useMemo, type MouseEvent } from "react";
import {
  useServerActionMutation,
  useServerActionQuery,
} from "@/hooks/server-action-hooks";
import { listFlows, executeFlow } from "@/app/actions/flows";
import { toast } from "react-toastify";
import { usePermissionCheck } from "@/hooks/use-permission-check";

interface FlowSelectorPopoverProps {
  conversationId?: string;
  disabled?: boolean;
}

export function FlowSelectorPopover({
  conversationId,
  disabled,
}: FlowSelectorPopoverProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { hasPermission: canListFlows } = usePermissionCheck(["list:flows"]);

  const { data: flows = [], isLoading } = useServerActionQuery(listFlows, {
    input: undefined,
    queryKey: ["list-flows"],
    enabled: canListFlows,
  });

  const executeFlowMutation = useServerActionMutation(executeFlow, {
    onSuccess: () => {
      toast.success("Fluxo iniciado com sucesso!");
      handleClose();
    },
    onError: (error) => {
      toast.error("Erro ao iniciar fluxo: " + error.message);
    },
  });

  const handleClick = (event: MouseEvent<HTMLElement>) => {
    if (!conversationId) {
      toast.warn("Selecione uma conversa para iniciar um fluxo");
      return;
    }
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setSearchQuery("");
  };

  const handleSelect = (flowId: string) => {
    if (!conversationId) return;

    executeFlowMutation.mutate({
      flowId,
      conversationId,
    });
  };

  const activeFlows = useMemo(() => {
    return flows.filter((flow) => flow.status === "active");
  }, [flows]);

  const filteredFlows = useMemo(() => {
    if (!searchQuery.trim()) return activeFlows;

    const query = searchQuery.toLowerCase();
    return activeFlows.filter((flow) => flow.name.toLowerCase().includes(query));
  }, [activeFlows, searchQuery]);

  const open = Boolean(anchorEl);

  return (
    <>
      <IconButton
        size="small"
        title="Iniciar Fluxo"
        onClick={handleClick}
        disabled={disabled || !conversationId}
        className="hover:bg-gray-100"
      >
        <Workflow className="size-5 text-gray-600" />
      </IconButton>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        slotProps={{
          paper: {
            sx: { width: 360, p: 0 },
          },
        }}
      >
        <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
          <Typography variant="subtitle2" fontWeight={600}>
            Iniciar Fluxo
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Selecione um fluxo para enviar ao cliente
          </Typography>
        </Box>
        <Box sx={{ p: 1.5, borderBottom: 1, borderColor: "divider" }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Buscar fluxo por nome..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search className="size-4 text-gray-400" />
                  </InputAdornment>
                ),
              },
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: "8px",
              },
            }}
          />
        </Box>
        {isLoading || executeFlowMutation.isPending ? (
          <Box sx={{ p: 3, display: "flex", justifyContent: "center" }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <List dense sx={{ maxHeight: 320, overflow: "auto", py: 0 }}>
            {filteredFlows.map((flow) => (
              <ListItemButton
                key={flow.id}
                onClick={() => handleSelect(flow.id)}
                sx={{
                  "&:hover": {
                    bgcolor: "action.hover",
                  },
                }}
              >
                <ListItemText
                  primary={
                    <Typography
                      sx={{
                        fontSize: "0.875rem",
                        fontWeight: 600,
                      }}
                    >
                      {flow.name}
                    </Typography>
                  }
                  secondary={
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ mt: 0.5 }}
                    >
                      {flow.nodesCount || 0} passos
                    </Typography>
                  }
                />
              </ListItemButton>
            ))}
            {filteredFlows.length === 0 && (
              <Box sx={{ p: 2, textAlign: "center" }}>
                <Typography variant="body2" color="text.secondary">
                  {searchQuery
                    ? "Nenhum fluxo encontrado"
                    : activeFlows.length === 0
                      ? "Nenhum fluxo ativo disponível"
                      : "Nenhum fluxo encontrado"}
                </Typography>
              </Box>
            )}
          </List>
        )}
      </Popover>
    </>
  );
}
