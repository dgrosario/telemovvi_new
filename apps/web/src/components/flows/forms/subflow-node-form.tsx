"use client";

import {
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  FormControlLabel,
  Switch,
  CircularProgress,
  Typography,
} from "@mui/material";
import { useFormState } from "@/hooks/use-form-state";
import { useListFlows } from "@/hooks/use-flows";
import { useFlowEditorStore } from "@/stores/flow-editor-store";
import { z } from "zod";

const subflowNodeSchema = z.object({
  targetFlowId: z.string().nullable(),
  waitForCompletion: z.boolean(),
});

interface SubflowNodeFormProps {
  nodeId: string;
  initialData?: {
    label?: string;
    targetFlowId?: string | null;
    targetFlowName?: string | null;
    waitForCompletion?: boolean;
  };
  onClose: () => void;
}

export function SubflowNodeForm({
  nodeId,
  initialData,
  onClose,
}: SubflowNodeFormProps) {
  const updateNodeData = useFlowEditorStore((s) => s.updateNodeData);
  const currentFlowId = useFlowEditorStore((s) => s.flowId);

  const { form, setField, errors, validateAll } = useFormState(
    subflowNodeSchema,
    {
      targetFlowId: initialData?.targetFlowId || null,
      waitForCompletion: initialData?.waitForCompletion ?? true,
    }
  );

  const { data: flows, isLoading } = useListFlows();

  const availableFlows = flows?.filter((flow) => flow.id !== currentFlowId) || [];

  const handleSave = () => {
    const validation = validateAll();
    if (validation.ok && validation.value) {
      const selectedFlow = availableFlows.find((f) => f.id === validation.value.targetFlowId);
      updateNodeData(nodeId, {
        ...validation.value,
        targetFlowName: selectedFlow?.name || null,
      });
      onClose();
    }
  };

  return (
    <div className="flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
      <FormControl fullWidth>
        <InputLabel id="subflow-select-label">Fluxo a executar</InputLabel>
        <Select
          labelId="subflow-select-label"
          value={form.targetFlowId || ""}
          onChange={(e) => setField("targetFlowId", e.target.value || null)}
          label="Fluxo a executar"
          disabled={isLoading}
          startAdornment={isLoading ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
        >
          <MenuItem value="">
            <em>Nenhum fluxo selecionado</em>
          </MenuItem>
          {availableFlows.map((flow) => (
            <MenuItem key={flow.id} value={flow.id}>
              <div className="flex items-center justify-between w-full gap-2">
                <span>{flow.name}</span>
                <Typography
                  variant="caption"
                  color={flow.status === "active" ? "success.main" : "text.secondary"}
                >
                  {flow.status === "active" ? "Ativo" : flow.status === "draft" ? "Rascunho" : "Inativo"}
                </Typography>
              </div>
            </MenuItem>
          ))}
        </Select>
        <FormHelperText>
          Selecione qual fluxo será executado quando este bloco for atingido
        </FormHelperText>
      </FormControl>

      <FormControlLabel
        control={
          <Switch
            checked={form.waitForCompletion}
            onChange={(e) => setField("waitForCompletion", e.target.checked)}
          />
        }
        label="Aguardar conclusão do subfluxo"
      />
      <Typography variant="caption" color="text.secondary" sx={{ mt: -1 }}>
        {form.waitForCompletion
          ? "O fluxo principal aguardará o subfluxo terminar antes de continuar"
          : "O subfluxo será executado em paralelo (fire and forget)"}
      </Typography>

      <Button onClick={handleSave} variant="contained" fullWidth>
        Salvar Alterações
      </Button>
    </div>
  );
}
