"use client";

import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  TextField,
} from "@mui/material";
import { useState, useEffect } from "react";
import {
  useUpdateFlow,
  useAssociateFlowWithChannels,
  useListChannelsForFlow,
} from "@/hooks/use-flows";
import CustomAvatar from "@/components/custom-avatar";
import { useServerActionQuery } from "@/hooks/server-action-hooks";
import { listChannels } from "@/app/actions/channels";
import { Flip, toast } from "react-toastify";

interface EditFlowDialogProps {
  open: boolean;
  onClose: () => void;
  flow: {
    id: string;
    name: string;
    status: "active" | "inactive" | "draft";
  };
}

export function EditFlowDialog({ open, onClose, flow }: EditFlowDialogProps) {
  const [flowName, setFlowName] = useState(flow.name);
  const [flowStatus, setFlowStatus] = useState(flow.status);
  const [selectedChannels, setSelectedChannels] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const { mutateAsync: updateFlow } = useUpdateFlow();
  const { mutateAsync: associateChannels } = useAssociateFlowWithChannels();

  const { data: allChannels, refetch: refetchAllChannels } =
    useServerActionQuery(listChannels, {
      input: undefined,
      queryKey: ["channels"],
      enabled: false,
    });

  const { data: flowChannels, refetch: refetchFlowChannels } =
    useListChannelsForFlow(flow.id);

  useEffect(() => {
    if (open) {
      setFlowName(flow.name);
      setFlowStatus(flow.status);
      refetchAllChannels();
      refetchFlowChannels();
    }
  }, [open, flow, refetchAllChannels, refetchFlowChannels]);

  useEffect(() => {
    if (flowChannels && allChannels) {
      const currentChannels = allChannels.filter((channel) =>
        flowChannels.some((fc) => fc.id === channel.id)
      );
      setSelectedChannels(currentChannels);
    }
  }, [flowChannels, allChannels]);

  const handleSave = async () => {
    if (!flowName.trim()) {
      toast.error("Nome do fluxo é obrigatório", { transition: Flip });
      return;
    }

    try {
      setIsSaving(true);

      await updateFlow({
        flowId: flow.id,
        name: flowName,
        status: flowStatus,
      });

      await associateChannels({
        flowId: flow.id,
        channelIds: selectedChannels.map((c) => c.id),
      });

      toast.success("Fluxo atualizado com sucesso!", { transition: Flip });
      handleClose();
    } catch (error) {
      console.error("Error updating flow:", error);
      toast.error("Erro ao atualizar fluxo", { transition: Flip });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setFlowName(flow.name);
    setFlowStatus(flow.status);
    setSelectedChannels([]);
    onClose();
  };

  const toggleChannel = (channel: any) => {
    const isSelected = selectedChannels.find((c) => c.id === channel.id);
    if (isSelected) {
      setSelectedChannels(selectedChannels.filter((c) => c.id !== channel.id));
    } else {
      setSelectedChannels([...selectedChannels, channel]);
    }
  };

  const getStatusLabel = (status: string) => {
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

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      closeAfterTransition={false}
    >
      <DialogTitle>Editar Fluxo</DialogTitle>
      <DialogContentText
        classes={{
          root: "!pl-7",
        }}
      >
        Atualize o nome, status e conexões do fluxo
      </DialogContentText>
      <DialogContent
        classes={{
          root: "!px-7",
        }}
      >
        <TextField
          autoFocus
          margin="dense"
          label="Nome do Fluxo"
          type="text"
          fullWidth
          value={flowName}
          onChange={(e) => setFlowName(e.target.value)}
          required
          error={!flowName.trim() && flowName.length > 0}
          helperText={
            !flowName.trim() && flowName.length > 0 ? "Nome é obrigatório" : ""
          }
          className="mb-4"
        />

        <FormControl fullWidth margin="dense" className="mb-4">
          <InputLabel id="flow-status-label">Status</InputLabel>
          <Select
            labelId="flow-status-label"
            id="flow-status"
            value={flowStatus}
            label="Status"
            onChange={(e) =>
              setFlowStatus(e.target.value as "active" | "inactive" | "draft")
            }
          >
            <MenuItem value="draft">Rascunho</MenuItem>
            <MenuItem value="inactive">Inativo</MenuItem>
            <MenuItem value="active">Ativo</MenuItem>
          </Select>
        </FormControl>

        <DialogContentText className="!mb-2 !mt-4">
          Conexões (opcional)
        </DialogContentText>

        <List>
          {allChannels?.map((channel) => (
            <ListItem
              key={channel.id}
              disablePadding
              secondaryAction={
                <Checkbox
                  edge="end"
                  tabIndex={-1}
                  disableRipple
                  onChange={() => toggleChannel(channel)}
                  checked={!!selectedChannels.find((c) => c.id === channel.id)}
                />
              }
            >
              <ListItemButton onClick={() => toggleChannel(channel)}>
                <ListItemAvatar>
                  <CustomAvatar color="primary" alt={channel.name}>
                    {channel.name
                      .split(" ")
                      .map((w: string) => w[0])
                      .join("")}
                  </CustomAvatar>
                </ListItemAvatar>
                <ListItemText
                  primary={channel.name}
                  secondary={channel.type}
                  className="mr-2"
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions
        classes={{
          root: "!pb-6 !px-7",
        }}
      >
        <Button onClick={handleClose} disabled={isSaving}>
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          disabled={isSaving || !flowName.trim()}
          variant="contained"
        >
          {isSaving ? "Salvando..." : "Salvar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
