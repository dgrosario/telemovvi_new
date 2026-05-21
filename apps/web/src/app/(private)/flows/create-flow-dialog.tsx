"use client";

import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  TextField,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useCreateFlow } from "@/hooks/use-flows";
import CustomAvatar from "@/components/custom-avatar";
import { useServerActionMutation, useServerActionQuery } from "@/hooks/server-action-hooks";
import { associateFlowWithChannels } from "@/app/actions/flows";
import { listChannels } from "@/app/actions/channels";
import { Flip, toast } from "react-toastify";

interface CreateFlowDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CreateFlowDialog({ open, onClose }: CreateFlowDialogProps) {
  const router = useRouter();
  const [flowName, setFlowName] = useState("");
  const [selectedChannels, setSelectedChannels] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const { mutateAsync: createFlow } = useCreateFlow();
  const { data: channels, refetch: refetchChannels } = useServerActionQuery(
    listChannels,
    {
      input: undefined,
      queryKey: ["channels"],
      enabled: false,
    }
  );

  useEffect(() => {
    if (open) {
      refetchChannels();
    }
  }, [open, refetchChannels]);

  const associateChannelsAction = useServerActionMutation(
    associateFlowWithChannels,
    {
      onError() {
        toast.error("Erro ao associar canais ao fluxo", { transition: Flip });
      },
    }
  );

  const handleCreate = async () => {
    if (!flowName.trim()) {
      toast.error("Nome do fluxo é obrigatório", { transition: Flip });
      return;
    }

    try {
      setIsCreating(true);
      const result = await createFlow({
        name: flowName,
        status: "draft",
      });

      if (result && selectedChannels.length > 0) {
        await associateChannelsAction.mutateAsync({
          flowId: result.id,
          channelIds: selectedChannels.map((c) => c.id),
        });
      }

      toast.success("Fluxo criado com sucesso!", { transition: Flip });
      handleClose();

      if (result) {
        router.push(`/flows/${result.id}`);
      }
    } catch (error) {
      console.error("Error creating flow:", error);
      toast.error("Erro ao criar fluxo", { transition: Flip });
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setFlowName("");
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

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      closeAfterTransition={false}
    >
      <DialogTitle>Criar Novo Fluxo</DialogTitle>
      <DialogContentText
        classes={{
          root: "!pl-7",
        }}
      >
        Defina um nome e selecione as conexões para este fluxo
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
            !flowName.trim() && flowName.length > 0
              ? "Nome é obrigatório"
              : ""
          }
          className="mb-4"
        />

        <DialogContentText className="!mb-2">
          Conexões (opcional)
        </DialogContentText>

        <List>
          {channels?.map((channel) => (
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
        <Button onClick={handleClose} disabled={isCreating}>
          Cancelar
        </Button>
        <Button
          onClick={handleCreate}
          disabled={isCreating || !flowName.trim()}
          variant="contained"
        >
          {isCreating ? "Criando..." : "Criar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
