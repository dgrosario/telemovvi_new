"use client";

import { useState, useEffect, useMemo } from "react";
import { Button, Typography, Box, Stack, Alert, FormControlLabel, Checkbox } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { useShallow } from "zustand/shallow";
import { useFlowEditorStore } from "@/stores/flow-editor-store";
import {
  ConditionGroupCard,
  DefaultBranchCard,
  type ConditionGroupData,
  type RuleData,
} from "./condition-card";
import { extractFlowVariables, type VariableType } from "@/lib/flow-variables";
import { z } from "zod";

const ruleSchema = z.object({
  id: z.string(),
  variable: z.string().default("user.message"),
  variableType: z
    .enum(["string", "number", "boolean", "array", "day_of_week", "time", "date"])
    .catch("string"),
  operator: z.string().default("contains"),
  value: z.string().default(""),
  value2: z.string().optional(),
});

const conditionGroupSchema = z.object({
  id: z.string(),
  label: z.string().default("Condição"),
  rules: z.array(ruleSchema).min(1, "Pelo menos uma regra é necessária"),
});

const conditionalNodeSchema = z.object({
  conditions: z
    .array(conditionGroupSchema)
    .min(1, "Pelo menos uma condição é necessária"),
  defaultBranch: z.object({
    id: z.string(),
    label: z.string().default("Padrão"),
  }).nullable(),
});

interface InitialCondition {
  id: string;
  label: string;
  rules?: Array<{
    id: string;
    variable: string;
    variableType?: string;
    operator: string;
    value: string;
    value2?: string;
  }>;
  variable?: string;
  variableType?: string;
  operator?: string;
  value?: string;
  value2?: string;
}

interface ConditionalNodeFormProps {
  nodeId: string;
  initialData?: {
    label?: string;
    conditions?: InitialCondition[];
    defaultBranch?: {
      id: string;
      label: string;
    };
  };
  onClose: () => void;
}

const BR_DATE_REGEX = /^\d{2}\/\d{2}\/\d{4}$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(year: number, month: number, day: number): boolean {
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function normalizeDateToBr(value?: string): string | null {
  if (!value) return null;

  if (BR_DATE_REGEX.test(value)) {
    const [dayRaw, monthRaw, yearRaw] = value.split("/");
    const day = Number(dayRaw);
    const month = Number(monthRaw);
    const year = Number(yearRaw);
    if (!isValidDate(year, month, day)) return null;
    return value;
  }

  if (ISO_DATE_REGEX.test(value)) {
    const [yearRaw, monthRaw, dayRaw] = value.split("-");
    const day = Number(dayRaw);
    const month = Number(monthRaw);
    const year = Number(yearRaw);
    if (!isValidDate(year, month, day)) return null;
    return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
  }

  return null;
}

function normalizeInitialCondition(condition: InitialCondition): ConditionGroupData {
  if (condition.rules && condition.rules.length > 0) {
    return {
      id: condition.id,
      label: condition.label,
      rules: condition.rules.map((r) => ({
        id: r.id,
        variable: r.variable,
        variableType: (r.variableType || "string") as VariableType,
        operator: r.operator,
        value: r.value,
        value2: r.value2,
      })),
    };
  }
  return {
    id: condition.id,
    label: condition.label,
    rules: [{
      id: crypto.randomUUID(),
      variable: condition.variable || "user.message",
      variableType: (condition.variableType || "string") as VariableType,
      operator: condition.operator || "contains",
      value: condition.value || "",
      value2: condition.value2,
    }],
  };
}

export function ConditionalNodeForm({
  nodeId,
  initialData,
  onClose,
}: ConditionalNodeFormProps) {
  const updateNodeDataAndCleanup = useFlowEditorStore((s) => s.updateNodeDataAndCleanup);
  const nodes = useFlowEditorStore(useShallow((s) => s.nodes));
  const currentNode = useFlowEditorStore(
    useShallow((s) => s.nodes.find((n) => n.id === nodeId))
  );
  const nodeEdges = useFlowEditorStore(
    useShallow((s) => s.edges.filter((e) => e.source === nodeId))
  );

  const flowVariables = useMemo(() => extractFlowVariables(nodes), [nodes]);

  const [conditions, setConditions] = useState<ConditionGroupData[]>(() => {
    if (initialData?.conditions) {
      return initialData.conditions.map(normalizeInitialCondition);
    }
    return [
      {
        id: crypto.randomUUID(),
        label: "Condição 1",
        rules: [{
          id: crypto.randomUUID(),
          variable: "user.message",
          variableType: "string" as VariableType,
          operator: "contains",
          value: "",
        }],
      },
    ];
  });

  const [defaultBranch, setDefaultBranch] = useState<{id: string; label: string} | null>(() => {
    if (initialData?.defaultBranch) {
      return initialData.defaultBranch;
    }
    return null;
  });

  const [errors, setErrors] = useState<{
    conditions?: string;
    defaultBranch?: string;
  }>({});

  const [willLoseConnections, setWillLoseConnections] = useState<string[]>([]);

  useEffect(() => {
    if (!currentNode) return;

    const currentConditions = currentNode.data?.conditions || [];
    const currentConditionIds = new Set(currentConditions.map((c: { id: string }) => c.id));
    const newConditionIds = new Set(conditions.map((c) => c.id));

    const removedConditionIds = Array.from(currentConditionIds).filter(
      (id) => !newConditionIds.has(id)
    );

    const edgesToLose = nodeEdges
      .filter(
        (e) =>
          e.sourceHandle &&
          removedConditionIds.includes(e.sourceHandle)
      )
      .map((e) => {
        const condition = currentConditions.find((c: { id: string }) => c.id === e.sourceHandle);
        return condition?.label || e.sourceHandle || "";
      })
      .filter((label): label is string => Boolean(label));

    setWillLoseConnections((prev) => {
      if (prev.length !== edgesToLose.length) return edgesToLose;
      if (prev.every((label, i) => label === edgesToLose[i])) return prev;
      return edgesToLose;
    });
  }, [conditions, currentNode, nodeEdges]);

  const handleAddCondition = () => {
    const newCondition: ConditionGroupData = {
      id: crypto.randomUUID(),
      label: `Condição ${conditions.length + 1}`,
      rules: [{
        id: crypto.randomUUID(),
        variable: "user.message",
        variableType: "string",
        operator: "contains",
        value: "",
      }],
    };

    setConditions([...conditions, newCondition]);
  };

  const handleRemoveCondition = (index: number) => {
    const conditionToRemove = conditions[index];
    const edgesToLose = nodeEdges.filter(
      (e) => e.sourceHandle === conditionToRemove.id
    );

    if (edgesToLose.length > 0) {
      const confirmMessage = `Remover esta condição irá desconectar ${edgesToLose.length} conexão(ões). Deseja continuar?`;
      if (!window.confirm(confirmMessage)) {
        return;
      }
    }

    const updated = conditions.filter((_, i) => i !== index);
    setConditions(updated);
  };

  const handleUpdateCondition = (index: number, updatedCondition: ConditionGroupData) => {
    const updated = [...conditions];
    updated[index] = updatedCondition;
    setConditions(updated);
  };

  const getConnectionCount = (handleId: string) => {
    return nodeEdges.filter((e) => e.sourceHandle === handleId).length;
  };

  const handleToggleDefaultBranch = (enabled: boolean) => {
    if (!enabled && defaultBranch) {
      const edgesToLose = nodeEdges.filter((e) => e.sourceHandle === defaultBranch.id);

      if (edgesToLose.length > 0) {
        if (!window.confirm(
          `Desabilitar a saída padrão irá desconectar ${edgesToLose.length} conexão(ões). Deseja continuar?`
        )) {
          return;
        }
      }

      setDefaultBranch(null);
    } else if (enabled && !defaultBranch) {
      setDefaultBranch({
        id: "default-" + crypto.randomUUID(),
        label: "Padrão",
      });
    }
  };

  const handleSave = () => {
    const normalizedConditions = conditions.map((condition) => ({
      ...condition,
      rules: condition.rules.map((rule) => {
        if (rule.variableType !== "date") return rule;

        return {
          ...rule,
          value: normalizeDateToBr(rule.value) ?? rule.value,
          value2: normalizeDateToBr(rule.value2) ?? rule.value2,
        };
      }),
    }));

    for (const condition of normalizedConditions) {
      for (const rule of condition.rules) {
        if (rule.variableType !== "date") continue;

        const operatorNeedsValue = !["is_empty", "is_not_empty"].includes(
          rule.operator
        );
        const operatorNeedsValue2 = rule.operator === "between";

        if (operatorNeedsValue && !normalizeDateToBr(rule.value)) {
          setErrors({
            conditions: `Regra "${condition.label}" possui data inválida. Use o calendário para selecionar uma data válida.`,
          });
          return;
        }

        if (operatorNeedsValue2 && !normalizeDateToBr(rule.value2)) {
          setErrors({
            conditions: `Regra "${condition.label}" precisa de duas datas válidas para o operador "entre".`,
          });
          return;
        }
      }
    }

    const validation = conditionalNodeSchema.safeParse({
      conditions: normalizedConditions,
      defaultBranch,
    });

    if (validation.success) {
      const dataToSave = {
        ...validation.data,
        defaultBranch: validation.data.defaultBranch ?? undefined,
      };
      updateNodeDataAndCleanup(nodeId, dataToSave);
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

  return (
    <Stack spacing={3} onClick={(e) => e.stopPropagation()}>
      {willLoseConnections.length > 0 && (
        <Alert severity="warning">
          Ao salvar, {willLoseConnections.length} conexão(ões) será(ão) removida(s):{" "}
          {willLoseConnections.join(", ")}
        </Alert>
      )}

      <Box>
        <Typography variant="subtitle2" fontWeight="semibold" sx={{ mb: 1 }}>
          Condições
        </Typography>

        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
          As condições são avaliadas em ordem. Dentro de cada grupo, todas as regras devem ser verdadeiras (E). O primeiro grupo verdadeiro determina o próximo bloco.
        </Typography>

        {errors.conditions && (
          <Typography variant="caption" color="error" sx={{ mb: 1 }}>
            {errors.conditions}
          </Typography>
        )}

        <Stack spacing={2}>
          {conditions.map((condition, index) => (
            <Box key={condition.id} sx={{ position: "relative" }}>
              {index > 0 && (
                <Box
                  sx={{
                    position: "absolute",
                    top: -12,
                    left: "50%",
                    transform: "translateX(-50%)",
                    bgcolor: "background.paper",
                    px: 1,
                    zIndex: 1,
                  }}
                >
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    OU
                  </Typography>
                </Box>
              )}
              <ConditionGroupCard
                condition={condition}
                index={index}
                flowVariables={flowVariables}
                connectionCount={getConnectionCount(condition.id)}
                onChange={(updated) => handleUpdateCondition(index, updated)}
                onDelete={() => handleRemoveCondition(index)}
                canDelete={conditions.length > 1}
              />
            </Box>
          ))}

          <Box sx={{ mt: 2, mb: 1 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={defaultBranch !== null}
                  onChange={(e) => handleToggleDefaultBranch(e.target.checked)}
                />
              }
              label="Habilitar saída padrão (senão)"
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", ml: 4 }}>
              Quando habilitada, se nenhuma condição for verdadeira, o fluxo seguirá pela saída padrão
            </Typography>
          </Box>

          {defaultBranch && (
            <Box sx={{ position: "relative" }}>
              <Box
                sx={{
                  position: "absolute",
                  top: -12,
                  left: "50%",
                  transform: "translateX(-50%)",
                  bgcolor: "background.paper",
                  px: 1,
                  zIndex: 1,
                }}
              >
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  SENÃO
                </Typography>
              </Box>
              <DefaultBranchCard
                label={defaultBranch.label}
                connectionCount={getConnectionCount(defaultBranch.id)}
                onChange={(label) => setDefaultBranch({ ...defaultBranch, label })}
              />
            </Box>
          )}

          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={handleAddCondition}
            variant="outlined"
            fullWidth
            sx={{ mt: 1 }}
          >
            Adicionar Condição OU
          </Button>
        </Stack>
      </Box>

      <Button onClick={handleSave} variant="contained" fullWidth>
        Salvar Alterações
      </Button>
    </Stack>
  );
}
