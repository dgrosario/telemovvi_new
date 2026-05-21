"use client";

import {
  Box,
  IconButton,
  TextField,
  Typography,
  Paper,
  Chip,
  Stack,
  Button,
  Divider,
  Autocomplete,
  Tooltip,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import LinkIcon from "@mui/icons-material/Link";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import { useEffect, useState } from "react";
import { useServerActionQuery } from "@/hooks/server-action-hooks";
import { listLabels } from "@/app/actions/labels";
import { listChannels } from "@/app/actions/channels";
import { listSectors } from "@/app/actions/sectors";
import { listSystemVariables } from "@/app/actions/system-variables";
import { CreateLabelDialog } from "@/components/labels/create-label-dialog";
import { VariableSelector } from "./variable-selector";
import { OperatorSelector } from "./operator-selector";
import {
  type FlowVariable,
  type VariableType,
  getOperatorByValue,
} from "@/lib/flow-variables";

const DAYS_OF_WEEK = [
  { value: "0", label: "Domingo" },
  { value: "1", label: "Segunda-feira" },
  { value: "2", label: "Terça-feira" },
  { value: "3", label: "Quarta-feira" },
  { value: "4", label: "Quinta-feira" },
  { value: "5", label: "Sexta-feira" },
  { value: "6", label: "Sábado" },
];

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

function toDateStorageValue(value: string): string | null {
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

function toDateInputValue(value?: string): string {
  if (!value) return "";

  if (ISO_DATE_REGEX.test(value)) return value;

  if (BR_DATE_REGEX.test(value)) {
    const [dayRaw, monthRaw, yearRaw] = value.split("/");
    const day = Number(dayRaw);
    const month = Number(monthRaw);
    const year = Number(yearRaw);
    if (!isValidDate(year, month, day)) return "";
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return "";
}

export interface RuleData {
  id: string;
  variable: string;
  variableType: VariableType;
  operator: string;
  value: string;
  value2?: string;
}

export interface ConditionGroupData {
  id: string;
  label: string;
  rules: RuleData[];
}

export interface LegacyConditionData {
  id: string;
  variable: string;
  variableType?: VariableType;
  operator: string;
  value: string;
  value2?: string;
  label: string;
}

export type ConditionData = ConditionGroupData | LegacyConditionData;

export function isLegacyCondition(condition: ConditionData): condition is LegacyConditionData {
  return "variable" in condition && !("rules" in condition);
}

export function normalizeCondition(condition: ConditionData): ConditionGroupData {
  if (isLegacyCondition(condition)) {
    return {
      id: condition.id,
      label: condition.label,
      rules: [{
        id: crypto.randomUUID(),
        variable: condition.variable,
        variableType: condition.variableType || "string",
        operator: condition.operator,
        value: condition.value,
        value2: condition.value2,
      }],
    };
  }
  return condition;
}

interface RuleRowProps {
  rule: RuleData;
  flowVariables: FlowVariable[];
  showAndSeparator: boolean;
  canDelete: boolean;
  onChange: (rule: RuleData) => void;
  onDelete: () => void;
}

function RuleRow({
  rule,
  flowVariables,
  showAndSeparator,
  canDelete,
  onChange,
  onDelete,
}: RuleRowProps) {
  const [labelDialogOpen, setLabelDialogOpen] = useState(false);

  const { data: labels = [] } = useServerActionQuery(listLabels, {
    input: undefined,
    queryKey: ["labels"],
  });

  const { data: channels = [] } = useServerActionQuery(listChannels, {
    input: undefined,
    queryKey: ["channels"],
  });

  const { data: sectors = [] } = useServerActionQuery(listSectors, {
    input: undefined,
    queryKey: ["sectors"],
  });

  const { data: systemVariables = [] } = useServerActionQuery(listSystemVariables, {
    input: undefined,
    queryKey: ["system-variables"],
  });

  const systemVariableResolverType = systemVariables.find(
    (variable) => variable.key === rule.variable
  )?.resolverType;

  const isDateVariable =
    rule.variableType === "date" ||
    rule.variable === "system.current_date" ||
    systemVariableResolverType === "current_date";

  const effectiveVariableType: VariableType = isDateVariable
    ? "date"
    : rule.variableType;

  const operator = getOperatorByValue(rule.operator, effectiveVariableType);
  const showValueField = operator?.requiresValue !== false;
  const showSecondValue = operator?.valueCount === 2;
  const isLabelVariable = rule.variable === "partner.labels";
  const isChannelVariable = rule.variable === "conversation.channel";
  const isSectorVariable = rule.variable === "conversation.sector";
  const isDayOfWeekVariable =
    effectiveVariableType === "day_of_week" ||
    rule.variable === "system.day_of_week";
  const isTimeVariable =
    effectiveVariableType === "time" ||
    rule.variable === "system.current_time";

  useEffect(() => {
    if (isDateVariable && rule.variableType !== "date") {
      onChange({
        ...rule,
        variableType: "date",
      });
    }
  }, [isDateVariable, onChange, rule]);

  const handleVariableChange = (variable: string, type: VariableType) => {
    const currentOperatorValid = getOperatorByValue(rule.operator, type);
    let defaultOperator = "equals";
    if (type === "day_of_week") defaultOperator = "in_days";
    if (type === "time") defaultOperator = "between";

    onChange({
      ...rule,
      variable,
      variableType: type,
      operator: currentOperatorValid ? rule.operator : defaultOperator,
      value: "",
      value2: undefined,
    });
  };

  const handleOperatorChange = (operatorValue: string) => {
    onChange({
      ...rule,
      operator: operatorValue,
      variableType: effectiveVariableType,
    });
  };

  const handleValueChange = (value: string) => {
    onChange({
      ...rule,
      value,
    });
  };

  const handleValue2Change = (value2: string) => {
    onChange({
      ...rule,
      value2,
    });
  };

  const handleDateValueChange = (value: string) => {
    if (!value) {
      onChange({
        ...rule,
        variableType: "date",
        value: "",
      });
      return;
    }

    const normalizedDate = toDateStorageValue(value);
    if (!normalizedDate) return;
    onChange({
      ...rule,
      variableType: "date",
      value: normalizedDate,
    });
  };

  const handleDateValue2Change = (value: string) => {
    if (!value) {
      onChange({
        ...rule,
        variableType: "date",
        value2: "",
      });
      return;
    }

    const normalizedDate = toDateStorageValue(value);
    if (!normalizedDate) return;
    onChange({
      ...rule,
      variableType: "date",
      value2: normalizedDate,
    });
  };

  const handleLabelCreated = (labelId: string) => {
    handleValueChange(labelId);
  };

  return (
    <Box>
      {showAndSeparator && (
        <Box sx={{ display: "flex", alignItems: "center", my: 1.5 }}>
          <Divider sx={{ flex: 1 }} />
          <Chip
            label="E"
            size="small"
            color="primary"
            variant="outlined"
            sx={{ mx: 1, fontWeight: 600 }}
          />
          <Divider sx={{ flex: 1 }} />
        </Box>
      )}

      <Paper
        elevation={0}
        sx={{
          p: 1.5,
          bgcolor: "grey.50",
          borderRadius: 1,
          border: 1,
          borderColor: "grey.200",
        }}
      >
        <Stack spacing={1.5}>
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
                Variável
              </Typography>
              <VariableSelector
                value={rule.variable}
                flowVariables={flowVariables}
                onChange={handleVariableChange}
              />
            </Box>
            {canDelete && (
              <IconButton
                size="small"
                onClick={onDelete}
                color="error"
                sx={{ mt: 2.5 }}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            )}
          </Box>

          <Box sx={{ display: "flex", gap: 1.5 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
                Operador
              </Typography>
              <OperatorSelector
                value={rule.operator}
                variableType={effectiveVariableType}
                onChange={handleOperatorChange}
              />
            </Box>

            {showValueField && (
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
                  {showSecondValue && isTimeVariable
                    ? "Horário inicial"
                    : showSecondValue && isDateVariable
                      ? "Data inicial"
                      : showSecondValue
                        ? "Valor mínimo"
                        : "Valor"}
                </Typography>

                {isDayOfWeekVariable ? (
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {DAYS_OF_WEEK.map((day) => {
                      const selectedDays = (rule.value || "").split(",").filter(Boolean);
                      const isSelected = selectedDays.includes(day.value);
                      return (
                        <Chip
                          key={day.value}
                          label={day.label}
                          size="small"
                          color={isSelected ? "primary" : "default"}
                          variant={isSelected ? "filled" : "outlined"}
                          onClick={() => {
                            const updated = isSelected
                              ? selectedDays.filter((d) => d !== day.value)
                              : [...selectedDays, day.value];
                            handleValueChange(updated.sort().join(","));
                          }}
                          sx={{ cursor: "pointer" }}
                        />
                      );
                    })}
                  </Box>
                ) : isTimeVariable ? (
                  <TextField
                    type="time"
                    value={rule.value}
                    onChange={(e) => handleValueChange(e.target.value)}
                    size="small"
                    fullWidth
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                ) : isDateVariable ? (
                  <TextField
                    type="date"
                    value={toDateInputValue(rule.value)}
                    onChange={(e) => handleDateValueChange(e.target.value)}
                    size="small"
                    fullWidth
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                ) : isLabelVariable ? (
                  <Box sx={{ display: "flex", gap: 1 }}>
                    <Autocomplete
                      fullWidth
                      size="small"
                      options={labels}
                      getOptionLabel={(option) => option.name}
                      value={labels.find((l) => l.id === rule.value) || null}
                      onChange={(_, newValue) => {
                        handleValueChange(newValue?.id || "");
                      }}
                      renderInput={(params) => (
                        <TextField {...params} placeholder="Selecione etiqueta" />
                      )}
                      renderOption={(props, option) => {
                        const { key, ...otherProps } = props;
                        return (
                          <Box
                            component="li"
                            key={key}
                            {...otherProps}
                            sx={{ display: "flex", alignItems: "center", gap: 1 }}
                          >
                            <Box
                              sx={{
                                width: 12,
                                height: 12,
                                borderRadius: "50%",
                                backgroundColor: option.color,
                                flexShrink: 0,
                              }}
                            />
                            {option.name}
                          </Box>
                        );
                      }}
                    />
                    <Tooltip title="Criar nova etiqueta">
                      <IconButton size="small" onClick={() => setLabelDialogOpen(true)}>
                        <AddIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                ) : isChannelVariable ? (
                  <Autocomplete
                    fullWidth
                    size="small"
                    options={channels}
                    getOptionLabel={(option) => option.name}
                    value={channels.find((c) => c.id === rule.value) || null}
                    onChange={(_, newValue) => {
                      handleValueChange(newValue?.id || "");
                    }}
                    renderInput={(params) => (
                      <TextField {...params} placeholder="Selecione canal" />
                    )}
                    renderOption={(props, option) => {
                      const { key, ...otherProps } = props;
                      const typeLabels: Record<string, string> = {
                        whatsapp: "WhatsApp",
                        evolution: "Evolution",
                        meta_api: "Meta API",
                        instagram: "Instagram",
                      };
                      return (
                        <Box
                          component="li"
                          key={key}
                          {...otherProps}
                          sx={{ display: "flex", alignItems: "center", gap: 1 }}
                        >
                          <Box sx={{ flex: 1 }}>{option.name}</Box>
                          <Chip
                            size="small"
                            label={typeLabels[option.type] || option.type}
                            sx={{ fontSize: "0.65rem", height: 20 }}
                          />
                        </Box>
                      );
                    }}
                  />
                ) : isSectorVariable ? (
                  <Autocomplete
                    fullWidth
                    size="small"
                    options={sectors}
                    getOptionLabel={(option) => option.name}
                    value={sectors.find((s) => s.id === rule.value) || null}
                    onChange={(_, newValue) => {
                      handleValueChange(newValue?.id || "");
                    }}
                    renderInput={(params) => (
                      <TextField {...params} placeholder="Selecione setor" />
                    )}
                    renderOption={(props, option) => {
                      const { key, ...otherProps } = props;
                      return (
                        <Box
                          component="li"
                          key={key}
                          {...otherProps}
                          sx={{ display: "flex", alignItems: "center", gap: 1 }}
                        >
                          <Box
                            sx={{
                              width: 12,
                              height: 12,
                              borderRadius: "50%",
                              backgroundColor: option.color,
                              flexShrink: 0,
                            }}
                          />
                          {option.name}
                        </Box>
                      );
                    }}
                  />
                ) : (
                  <TextField
                    value={rule.value}
                    onChange={(e) => handleValueChange(e.target.value)}
                    size="small"
                    fullWidth
                    placeholder="Digite o valor"
                  />
                )}
              </Box>
            )}

            {showSecondValue && (
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
                  {isTimeVariable
                    ? "Horário final"
                    : isDateVariable
                      ? "Data final"
                      : "Valor máximo"}
                </Typography>
                {isTimeVariable ? (
                  <TextField
                    type="time"
                    value={rule.value2 || ""}
                    onChange={(e) => handleValue2Change(e.target.value)}
                    size="small"
                    fullWidth
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                ) : isDateVariable ? (
                  <TextField
                    type="date"
                    value={toDateInputValue(rule.value2)}
                    onChange={(e) => handleDateValue2Change(e.target.value)}
                    size="small"
                    fullWidth
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                ) : (
                  <TextField
                    value={rule.value2 || ""}
                    onChange={(e) => handleValue2Change(e.target.value)}
                    size="small"
                    fullWidth
                    placeholder="Digite o valor"
                  />
                )}
              </Box>
            )}
          </Box>
        </Stack>
      </Paper>

      <CreateLabelDialog
        open={labelDialogOpen}
        onClose={() => setLabelDialogOpen(false)}
        onSuccess={handleLabelCreated}
      />
    </Box>
  );
}

interface ConditionGroupCardProps {
  condition: ConditionGroupData;
  index: number;
  flowVariables?: FlowVariable[];
  connectionCount: number;
  onChange: (condition: ConditionGroupData) => void;
  onDelete: () => void;
  canDelete?: boolean;
}

export function ConditionGroupCard({
  condition,
  index,
  flowVariables = [],
  connectionCount,
  onChange,
  onDelete,
  canDelete = true,
}: ConditionGroupCardProps) {
  const handleAddRule = () => {
    const newRule: RuleData = {
      id: crypto.randomUUID(),
      variable: "user.message",
      variableType: "string",
      operator: "contains",
      value: "",
    };
    onChange({
      ...condition,
      rules: [...condition.rules, newRule],
    });
  };

  const handleUpdateRule = (ruleIndex: number, updatedRule: RuleData) => {
    const updatedRules = [...condition.rules];
    updatedRules[ruleIndex] = updatedRule;
    onChange({
      ...condition,
      rules: updatedRules,
    });
  };

  const handleDeleteRule = (ruleIndex: number) => {
    if (condition.rules.length <= 1) return;
    const updatedRules = condition.rules.filter((_, i) => i !== ruleIndex);
    onChange({
      ...condition,
      rules: updatedRules,
    });
  };

  const handleLabelChange = (label: string) => {
    onChange({
      ...condition,
      label,
    });
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        border: 2,
        borderColor: "primary.main",
        borderRadius: 2,
        position: "relative",
        bgcolor: "background.paper",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mb: 2 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            bgcolor: "primary.main",
            color: "primary.contrastText",
            borderRadius: 1,
            fontSize: "0.75rem",
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {String(index + 1).padStart(2, "0")}
        </Box>

        <Typography variant="subtitle2" sx={{ flex: 1, pt: 0.5 }}>
          SE {condition.rules.length > 1 && `(${condition.rules.length} regras)`}
        </Typography>

        <Stack direction="row" spacing={0.5} alignItems="center">
          <Chip
            size="small"
            icon={connectionCount > 0 ? <LinkIcon fontSize="small" /> : <LinkOffIcon fontSize="small" />}
            label={`${connectionCount} conexão${connectionCount !== 1 ? "es" : ""}`}
            color={connectionCount > 0 ? "success" : "warning"}
            variant="outlined"
            sx={{ fontSize: "0.7rem", height: 24 }}
          />
          {canDelete && (
            <IconButton size="small" onClick={onDelete} color="error">
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          )}
        </Stack>
      </Box>

      <Stack spacing={0}>
        {condition.rules.map((rule, ruleIndex) => (
          <RuleRow
            key={rule.id}
            rule={rule}
            flowVariables={flowVariables}
            showAndSeparator={ruleIndex > 0}
            canDelete={condition.rules.length > 1}
            onChange={(updatedRule) => handleUpdateRule(ruleIndex, updatedRule)}
            onDelete={() => handleDeleteRule(ruleIndex)}
          />
        ))}
      </Stack>

      <Button
        size="small"
        startIcon={<AddIcon />}
        onClick={handleAddRule}
        variant="text"
        sx={{ mt: 1.5 }}
      >
        Adicionar regra E
      </Button>

      <Box sx={{ mt: 2 }}>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
          Nome da saída
        </Typography>
        <TextField
          value={condition.label}
          onChange={(e) => handleLabelChange(e.target.value)}
          size="small"
          fullWidth
          placeholder="Ex: Se respondeu sim"
        />
      </Box>
    </Paper>
  );
}

interface DefaultBranchCardProps {
  label: string;
  connectionCount: number;
  onChange: (label: string) => void;
}

export function DefaultBranchCard({ label, connectionCount, onChange }: DefaultBranchCardProps) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        border: 2,
        borderColor: "grey.400",
        borderRadius: 2,
        bgcolor: "grey.50",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            bgcolor: "grey.500",
            color: "white",
            borderRadius: 1,
            fontSize: "0.65rem",
            fontWeight: 700,
          }}
        >
          ...
        </Box>

        <Typography variant="subtitle2" sx={{ flex: 1 }}>
          SENÃO (Padrão)
        </Typography>

        <Chip
          size="small"
          icon={connectionCount > 0 ? <LinkIcon fontSize="small" /> : <LinkOffIcon fontSize="small" />}
          label={`${connectionCount} conexão${connectionCount !== 1 ? "es" : ""}`}
          color={connectionCount > 0 ? "success" : "default"}
          variant="outlined"
          sx={{ fontSize: "0.7rem", height: 24 }}
        />
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: "block" }}>
        Executado quando nenhuma condição acima for verdadeira
      </Typography>

      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
          Nome da saída
        </Typography>
        <TextField
          value={label}
          onChange={(e) => onChange(e.target.value)}
          size="small"
          fullWidth
          placeholder="Ex: Caso contrário"
        />
      </Box>
    </Paper>
  );
}

export { ConditionGroupCard as ConditionCard };
