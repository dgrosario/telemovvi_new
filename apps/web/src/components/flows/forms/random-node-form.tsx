"use client";

import { useState, useEffect } from "react";
import {
  Button,
  TextField,
  Paper,
  Typography,
  IconButton,
  Stack,
  Alert,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { useShallow } from "zustand/shallow";
import { useFlowEditorStore } from "@/stores/flow-editor-store";
import { z } from "zod";

const randomNodeSchema = z.object({
  outputs: z
    .array(
      z.object({
        id: z.string(),
        label: z.string().min(1, "Label é obrigatório"),
        percentage: z.number().min(0, "Porcentagem deve ser maior ou igual a 0").max(100, "Porcentagem deve ser menor ou igual a 100"),
      })
    )
    .min(2, "Pelo menos duas saídas são necessárias")
    .refine(
      (outputs) => {
        const total = outputs.reduce((sum, output) => sum + output.percentage, 0);
        return total === 100;
      },
      { message: "A soma das porcentagens deve ser exatamente 100%" }
    ),
});

interface RandomNodeFormProps {
  nodeId: string;
  initialData?: {
    label?: string;
    outputs?: Array<{
      id: string;
      label: string;
      percentage: number;
    }>;
  };
  onClose: () => void;
}

export function RandomNodeForm({
  nodeId,
  initialData,
  onClose,
}: RandomNodeFormProps) {
  const updateNodeDataAndCleanup = useFlowEditorStore((s) => s.updateNodeDataAndCleanup);
  const currentNode = useFlowEditorStore(
    useShallow((s) => s.nodes.find((n) => n.id === nodeId))
  );
  const nodeEdges = useFlowEditorStore(
    useShallow((s) => s.edges.filter((e) => e.source === nodeId))
  );

  const [outputs, setOutputs] = useState(() => {
    if (initialData?.outputs) {
      return initialData.outputs;
    }
    return [
      {
        id: crypto.randomUUID(),
        label: "Saída 1",
        percentage: 50,
      },
      {
        id: crypto.randomUUID(),
        label: "Saída 2",
        percentage: 50,
      },
    ];
  });

  const [errors, setErrors] = useState<{
    outputs?: string;
  }>({});
  const [willLoseConnections, setWillLoseConnections] = useState<string[]>([]);

  useEffect(() => {
    if (!currentNode) return;

    const currentOutputs = (currentNode.data?.outputs as typeof outputs) || [];
    const currentOutputIds = new Set(currentOutputs.map((o) => o.id));
    const newOutputIds = new Set(outputs.map((o) => o.id));

    const removedOutputIds = Array.from(currentOutputIds).filter(
      (id) => !newOutputIds.has(id)
    );

    const edgesToLose = nodeEdges
      .filter(
        (e) =>
          e.sourceHandle &&
          removedOutputIds.includes(e.sourceHandle)
      )
      .map((e) => {
        const output = currentOutputs.find((o) => o.id === e.sourceHandle);
        return output?.label || e.sourceHandle || "";
      })
      .filter((label): label is string => Boolean(label));

    setWillLoseConnections((prev) => {
      const prevStr = JSON.stringify(prev);
      const nextStr = JSON.stringify(edgesToLose);
      return prevStr === nextStr ? prev : edgesToLose;
    });
  }, [outputs, currentNode, nodeEdges]);

  const handleAddOutput = () => {
    const newOutput = {
      id: crypto.randomUUID(),
      label: `Saída ${outputs.length + 1}`,
      percentage: 0,
    };

    setOutputs([...outputs, newOutput]);
  };

  const handleRemoveOutput = (index: number) => {
    const outputToRemove = outputs[index];
    const edgesToLose = nodeEdges.filter(
      (e) => e.sourceHandle === outputToRemove.id
    );

    if (edgesToLose.length > 0) {
      const confirmMessage = `Remover esta saída irá desconectar ${edgesToLose.length} conexão(ões). Deseja continuar?`;
      if (!window.confirm(confirmMessage)) {
        return;
      }
    }

    const updated = outputs.filter((_, i) => i !== index);
    setOutputs(updated);
  };

  const handleUpdateOutput = (
    index: number,
    field: string,
    value: string | number
  ) => {
    const updated = [...outputs];
    updated[index] = { ...updated[index], [field]: value };
    setOutputs(updated);
  };

  const handleDistributeEqually = () => {
    const equalPercentage = Math.floor(100 / outputs.length);
    const remainder = 100 - equalPercentage * outputs.length;

    const updated = outputs.map((output, index) => ({
      ...output,
      percentage: index === 0 ? equalPercentage + remainder : equalPercentage,
    }));

    setOutputs(updated);
  };

  const handleSave = () => {
    const validation = randomNodeSchema.safeParse({
      outputs,
    });

    if (validation.success) {
      updateNodeDataAndCleanup(nodeId, validation.data);
      onClose();
    } else {
      const newErrors: typeof errors = {};
      validation.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof typeof errors;
        if (!newErrors[field]) {
          newErrors[field] = issue.message;
        }
      });
      setErrors(newErrors);
    }
  };

  const totalPercentage = outputs.reduce((sum, output) => sum + output.percentage, 0);
  const isValidTotal = totalPercentage === 100;

  return (
    <Stack spacing={3} onClick={(e) => e.stopPropagation()}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle2" fontWeight="semibold">
          Saídas Aleatórias
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="outlined"
            onClick={handleDistributeEqually}
          >
            Distribuir Igualmente
          </Button>
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={handleAddOutput}
            variant="outlined"
          >
            Adicionar
          </Button>
        </Stack>
      </Stack>

      {errors.outputs && (
        <Typography variant="caption" color="error">
          {errors.outputs}
        </Typography>
      )}

      {willLoseConnections.length > 0 && (
        <Alert severity="warning">
          Ao salvar, {willLoseConnections.length} conexão(ões) será(ão) removida(s):{" "}
          {willLoseConnections.join(", ")}
        </Alert>
      )}

      {!isValidTotal && (
        <Alert severity="warning">
          Total atual: {totalPercentage}% - A soma deve ser exatamente 100%
        </Alert>
      )}

      <Stack spacing={2}>
        {outputs.map((output, index) => {
          const connectedEdges = nodeEdges.filter(
            (e) => e.sourceHandle === output.id
          );
          const hasConnections = connectedEdges.length > 0;

          return (
            <Paper
              key={output.id}
              className="p-3"
              variant="outlined"
              sx={{
                borderColor: hasConnections ? "warning.main" : "divider",
                backgroundColor: hasConnections ? "warning.50" : "transparent",
              }}
            >
              <Stack spacing={2}>
                <Stack direction="row" justifyContent="space-between" alignItems="start">
                  <Stack>
                    <Typography variant="body2" fontWeight="medium">
                      Saída {index + 1}
                    </Typography>
                    {hasConnections && (
                      <Typography variant="caption" color="warning.main">
                        {connectedEdges.length} conexão(ões) conectada(s)
                      </Typography>
                    )}
                  </Stack>
                  {outputs.length > 2 && (
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleRemoveOutput(index)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </Stack>

                <TextField
                  label="Label da Saída"
                  fullWidth
                  size="small"
                  value={output.label}
                  onChange={(e) =>
                    handleUpdateOutput(index, "label", e.target.value)
                  }
                  placeholder="Ex: Grupo A, Grupo B, etc."
                />

                <TextField
                  label="Porcentagem"
                  fullWidth
                  size="small"
                  type="number"
                  value={output.percentage}
                  onChange={(e) =>
                    handleUpdateOutput(index, "percentage", Number(e.target.value))
                  }
                  inputProps={{ min: 0, max: 100, step: 1 }}
                  helperText={`${output.percentage}% de chance desta saída ser escolhida`}
                />
              </Stack>
            </Paper>
          );
        })}
      </Stack>

      <Paper className="p-3" sx={{ bgcolor: "info.lighter" }}>
        <Stack spacing={1}>
          <Typography variant="caption" fontWeight="semibold">
            Como funciona:
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Quando o fluxo chegar neste bloco, uma das saídas será escolhida
            aleatoriamente com base nas porcentagens configuradas. Por exemplo,
            se uma saída tem 70% e outra 30%, a primeira será escolhida 70% das vezes.
          </Typography>
        </Stack>
      </Paper>

      <Button onClick={handleSave} variant="contained" fullWidth disabled={!isValidTotal}>
        Salvar Alterações
      </Button>
    </Stack>
  );
}
