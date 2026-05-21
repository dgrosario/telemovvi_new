"use client";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
} from "@mui/material";
import { useState } from "react";
import { toast } from "react-toastify";
import { useQueryClient } from "@tanstack/react-query";
import { useServerActionMutation } from "@/hooks/server-action-hooks";
import { upsertLabel } from "@/app/actions/labels";
import { LABEL_COLORS } from "@/lib/constants/label-colors";

interface CreateLabelDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (labelId: string) => void;
}

export function CreateLabelDialog({
  open,
  onClose,
  onSuccess,
}: CreateLabelDialogProps) {
  const queryClient = useQueryClient();
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState<string>(LABEL_COLORS[0]);

  const createLabelMutation = useServerActionMutation(upsertLabel, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["labels"] });
    },
  });

  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) return;

    try {
      const result = await createLabelMutation.mutateAsync({
        name: newLabelName,
        color: newLabelColor,
      });

      if (result) {
        onSuccess?.(result.id);
        handleClose();
        toast.success("Etiqueta criada com sucesso!");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Erro ao criar etiqueta";
      toast.error(errorMessage);
    }
  };

  const handleClose = () => {
    setNewLabelName("");
    setNewLabelColor(LABEL_COLORS[0]);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Criar Nova Etiqueta</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="Nome"
          fullWidth
          value={newLabelName}
          onChange={(e) => setNewLabelName(e.target.value)}
        />
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Cor
          </Typography>
          <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
            {LABEL_COLORS.map((color) => (
              <Box
                key={color}
                onClick={() => setNewLabelColor(color)}
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  backgroundColor: color,
                  cursor: "pointer",
                  border: newLabelColor === color ? "3px solid black" : "none",
                }}
              />
            ))}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancelar</Button>
        <Button
          variant="contained"
          disabled={!newLabelName.trim() || createLabelMutation.isPending}
          onClick={handleCreateLabel}
        >
          Criar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
