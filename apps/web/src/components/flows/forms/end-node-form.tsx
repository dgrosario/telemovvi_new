"use client";

import {
  Button,
  Stack,
  Typography,
  FormControlLabel,
  Checkbox,
  Alert,
} from "@mui/material";
import { useFlowEditorStore } from "@/stores/flow-editor-store";
import { useState } from "react";

interface EndNodeFormProps {
  nodeId: string;
  initialData?: {
    label?: string;
    closeConversation?: boolean;
  };
  onClose: () => void;
}

export function EndNodeForm({ nodeId, initialData, onClose }: EndNodeFormProps) {
  const updateNodeData = useFlowEditorStore((s) => s.updateNodeData);
  const [closeConversation, setCloseConversation] = useState(
    initialData?.closeConversation || false
  );

  const handleSave = () => {
    updateNodeData(nodeId, {
      closeConversation,
    });
    onClose();
  };

  return (
    <Stack spacing={3} onClick={(e) => e.stopPropagation()}>
      <Typography variant="subtitle2" color="text.secondary">
        Configure o comportamento ao finalizar o fluxo
      </Typography>

      <Alert severity="info" sx={{ fontSize: "0.8rem" }}>
        Este nó encerra a execução do fluxo. Se uma nova mensagem for recebida,
        o fluxo será executado novamente do início.
      </Alert>

      <FormControlLabel
        control={
          <Checkbox
            checked={closeConversation}
            onChange={(e) => setCloseConversation(e.target.checked)}
          />
        }
        label="Encerrar conversa ao finalizar"
      />

      {closeConversation && (
        <Alert severity="warning" sx={{ fontSize: "0.8rem" }}>
          A conversa será fechada automaticamente. Uma nova mensagem do cliente
          abrirá uma nova conversa.
        </Alert>
      )}

      <Button onClick={handleSave} variant="contained" fullWidth>
        Salvar
      </Button>
    </Stack>
  );
}
