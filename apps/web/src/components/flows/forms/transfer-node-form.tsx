"use client";

import {
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
} from "@mui/material";
import { useFormState } from "@/hooks/use-form-state";
import { useServerActionQuery } from "@/hooks/server-action-hooks";
import { listSectors } from "@/app/actions/sectors";
import { useFlowEditorStore } from "@/stores/flow-editor-store";
import { z } from "zod";

const transferNodeSchema = z.object({
  sectorId: z.string().nullable(),
});

interface TransferNodeFormProps {
  nodeId: string;
  initialData?: {
    label?: string;
    sectorId?: string | null;
  };
  onClose: () => void;
}

export function TransferNodeForm({
  nodeId,
  initialData,
  onClose,
}: TransferNodeFormProps) {
  const updateNodeData = useFlowEditorStore((s) => s.updateNodeData);

  const { form, setField, errors, validateAll } = useFormState(
    transferNodeSchema,
    {
      sectorId: initialData?.sectorId || null,
    }
  );

  const { data: sectors } = useServerActionQuery(listSectors, {
    input: undefined,
    queryKey: ["sectors"],
  });

  const handleSave = () => {
    const validation = validateAll();
    if (validation.ok && validation.value) {
      updateNodeData(nodeId, validation.value);
      onClose();
    }
  };

  return (
    <div className="flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
      <FormControl fullWidth>
        <InputLabel id="sector-select-label">Setor</InputLabel>
        <Select
          labelId="sector-select-label"
          value={form.sectorId || ""}
          onChange={(e) => setField("sectorId", e.target.value || null)}
          label="Setor"
        >
          <MenuItem value="">
            <em>Qualquer setor disponível</em>
          </MenuItem>
          {sectors?.map((sector) => (
            <MenuItem key={sector.id} value={sector.id}>
              {sector.name}
            </MenuItem>
          ))}
        </Select>
        <FormHelperText>
          Selecione um setor específico ou deixe vazio para transferir para qualquer setor disponível
        </FormHelperText>
      </FormControl>
      <Button onClick={handleSave} variant="contained" fullWidth>
        Salvar Alterações
      </Button>
    </div>
  );
}
