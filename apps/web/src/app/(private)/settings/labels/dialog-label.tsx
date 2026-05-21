"use client";

import { retrieveLabel, upsertLabel } from "@/app/actions/labels";
import { labelSchema } from "@/app/actions/labels/schema";
import CustomTextField from "@/components/custom-text-field";
import {
  useServerActionMutation,
  useServerActionQuery,
} from "@/hooks/server-action-hooks";
import { useFormState } from "@/hooks/use-form-state";
import { useLabelsDialog } from "@/hooks/use-labels";
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  Typography,
} from "@mui/material";
import { LABEL_PRESET_COLORS } from "@omnichannel/core/domain/entities/label";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "react-toastify";

export default function DialogLabel() {
  const { open, setOpen, setId, id } = useLabelsDialog();
  const queryClient = useQueryClient();

  const { form, setField, validateAll, errors, reset } = useFormState(
    labelSchema,
    {
      name: "",
      color: "#3B82F6",
    }
  );

  const upsertAction = useServerActionMutation(upsertLabel, {
    onSuccess() {
      setOpen(false);
      toast.success(id ? "Etiqueta atualizada com sucesso!" : "Etiqueta criada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["labels"] });
    },
    onError(err) {
      toast.error(err.message);
    },
  });

  const getAction = useServerActionQuery(retrieveLabel, {
    input: { id },
    queryKey: ["labels", id],
    enabled: !!id && open,
  });

  useEffect(() => {
    if (id && getAction.data) {
      reset({
        id: getAction.data.id,
        name: getAction.data.name,
        color: getAction.data.color,
      });
    }
  }, [id, getAction.data, reset]);

  useEffect(() => {
    if (!open) {
      reset({
        name: "",
        color: "#3B82F6",
      });
    }
  }, [open, reset]);

  const handleSave = async () => {
    const result = validateAll();
    if (!result) return;

    upsertAction.mutate({
      id: id || undefined,
      name: form.name,
      color: form.color,
    });
  };

  const handleClose = () => {
    setOpen(false);
    reset({
      name: "",
      color: "#3B82F6",
    });
    setId("");
    queryClient.invalidateQueries({
      exact: true,
      queryKey: ["labels"],
    });
  };

  return (
    <Dialog fullWidth maxWidth="sm" open={open} onClose={handleClose}>
      <DialogContent>
        <div className="w-full">
          <div className="flex justify-between pb-5 items-center">
            <Typography variant="h5" className="font-semibold">
              {id ? "Editar etiqueta" : "Nova etiqueta"}
            </Typography>
            <div className="flex gap-2">
              <Button variant="outlined" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                variant="contained"
                onClick={handleSave}
                loading={upsertAction.isPending}
                loadingPosition="start"
              >
                Salvar
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <CustomTextField
              label="Nome"
              value={form.name}
              required
              fullWidth
              placeholder="ex: Urgente, VIP, Novo Cliente"
              error={!!errors.name}
              helperText={errors.name || "Nome da etiqueta"}
              onChange={(e) => setField("name", e.target.value)}
            />

            <div>
              <Typography variant="body2" color="text.secondary" className="mb-2">
                Cor da etiqueta
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {LABEL_PRESET_COLORS.map((color) => (
                  <Box
                    key={color}
                    onClick={() => setField("color", color)}
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      backgroundColor: color,
                      cursor: "pointer",
                      border: form.color === color ? "3px solid" : "2px solid",
                      borderColor: form.color === color ? "primary.main" : "divider",
                      transition: "all 0.2s",
                      "&:hover": {
                        transform: "scale(1.1)",
                      },
                    }}
                  />
                ))}
              </Box>
            </div>

            <div className="flex items-center gap-3 mt-2">
              <Typography variant="body2" color="text.secondary">
                Pré-visualização:
              </Typography>
              <Box
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 1,
                  backgroundColor: form.color,
                  color: "white",
                  px: 2,
                  py: 0.5,
                  borderRadius: 2,
                  fontSize: "0.875rem",
                  fontWeight: 500,
                }}
              >
                {form.name || "Etiqueta"}
              </Box>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
