"use client";

import CustomTextField from "@/components/custom-text-field";
import { ColorPicker } from "@/components/color-picker";
import { TimeRangePicker } from "@/components/time-range-picker";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import { useSectors } from "@/hooks/use-sectors";
import { useQueryClient } from "@tanstack/react-query";
import { useFormState } from "@/hooks/use-form-state";
import { upsertSectorInputSchema } from "@/app/actions/sectors/schema";
import {
  useServerActionMutation,
  useServerActionQuery,
} from "@/hooks/server-action-hooks";
import { upsertSector, retrieveSector } from "@/app/actions/sectors";
import { Flip, toast } from "react-toastify";
import { useEffect } from "react";

export default function ModalRegisterSectors() {
  const queryClient = useQueryClient();
  const { form, setField, reset, errors, validateAll, setForm } = useFormState(
    upsertSectorInputSchema,
    {
      id: "",
      name: "",
      workingHoursStart: "08:00:00",
      workingHoursEnd: "19:00:00",
      color: "#3B82F6",
      isDefault: false,
    }
  );

  const { open, toggleOpen, id, setId } = useSectors();

  const upsertSectorAction = useServerActionMutation(upsertSector, {
    onError() {
      toast.error("Erro ao salvar setor", { transition: Flip });
    },
    onSuccess() {
      toast.success(
        id ? "Setor atualizado com sucesso!" : "Setor criado com sucesso!",
        { transition: Flip }
      );
      toggleOpen();
      reset();
      setId("");
      queryClient.invalidateQueries({
        exact: true,
        queryKey: ["list-sectors"],
      });
    },
  });

  const retrieveSectorQuery = useServerActionQuery(retrieveSector, {
    input: { id },
    enabled: false,
    queryKey: ["retrieve-sector"],
  });

  useEffect(() => {
    if (retrieveSectorQuery.data) {
      setForm({
        id: retrieveSectorQuery.data.id,
        name: retrieveSectorQuery.data.name,
        workingHoursStart:
          retrieveSectorQuery.data.workingHoursStart || "08:00:00",
        workingHoursEnd: retrieveSectorQuery.data.workingHoursEnd || "19:00:00",
        color: retrieveSectorQuery.data.color || "#3B82F6",
        isDefault: retrieveSectorQuery.data.isDefault || false,
      });
    }
  }, [retrieveSectorQuery.data]);

  useEffect(() => {
    if (open && id) {
      retrieveSectorQuery.refetch();
    }
  }, [open, id]);

  const handleClose = () => {
    toggleOpen();
    queryClient.removeQueries({ queryKey: ["retrieve-sector"] });
    reset();
    setId("");
  };

  const handleSubmit = () => {
    const result = validateAll();
    if (!result.ok) return;
    upsertSectorAction.mutate(form);
  };

  return (
    <Dialog fullWidth maxWidth="md" open={open} onClose={handleClose}>
      <DialogTitle>{id ? "Editar Setor" : "Novo Setor"}</DialogTitle>
      <DialogContent>
        <div className="flex flex-col gap-4">
          <CustomTextField
            label="Nome"
            fullWidth
            value={form.name}
            error={!!errors.name}
            helperText={errors.name}
            required
            onChange={(e) => setField("name", e.target.value)}
            variant="outlined"
            disabled={retrieveSectorQuery.isFetching}
          />

          <ColorPicker
            value={form.color || "#3B82F6"}
            onChange={(color) => setField("color", color)}
            label="Cor do setor"
          />

          <TimeRangePicker
            startValue={form.workingHoursStart || "08:00:00"}
            endValue={form.workingHoursEnd || "19:00:00"}
            onStartChange={(time) => setField("workingHoursStart", time)}
            onEndChange={(time) => setField("workingHoursEnd", time)}
            label="Horario de funcionamento"
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={form.isDefault || false}
                onChange={(e) => setField("isDefault", e.target.checked)}
              />
            }
            label="Setor padrão (conversas sem setor serão direcionadas aqui)"
          />
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancelar</Button>
        <Button
          onClick={handleSubmit}
          loading={upsertSectorAction.isPending}
          loadingPosition="start"
          variant="contained"
        >
          {upsertSectorAction.isPending
            ? id
              ? "Salvando..."
              : "Cadastrando..."
            : id
              ? "Salvar Alteracoes"
              : "Cadastrar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
