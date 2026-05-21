"use client";

import { Button, TextField } from "@mui/material";
import { useFormState } from "@/hooks/use-form-state";
import { useFlowEditorStore } from "@/stores/flow-editor-store";
import { z } from "zod";

const messageNodeSchema = z.object({
  content: z.string().min(1, "Conteúdo é obrigatório"),
});

interface MessageNodeFormProps {
  nodeId: string;
  initialData?: {
    label?: string;
    content?: string;
  };
  onClose: () => void;
}

export function MessageNodeForm({
  nodeId,
  initialData,
  onClose,
}: MessageNodeFormProps) {
  const updateNodeData = useFlowEditorStore((s) => s.updateNodeData);

  const { form, setField, errors, validateAll } = useFormState(
    messageNodeSchema,
    {
      content: initialData?.content || "",
    }
  );

  const handleSave = () => {
    const validation = validateAll();
    if (validation.ok && validation.value) {
      updateNodeData(nodeId, validation.value);
      onClose();
    }
  };

  return (
    <div className="flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
      <TextField
        label="Conteúdo da mensagem"
        fullWidth
        multiline
        rows={6}
        value={form.content}
        onChange={(e) => setField("content", e.target.value)}
        error={Boolean(errors.content)}
        helperText={errors.content || "Use {{variavel}} para substituir valores dinâmicos"}
      />
      <Button onClick={handleSave} variant="contained" fullWidth>
        Salvar Alterações
      </Button>
    </div>
  );
}
