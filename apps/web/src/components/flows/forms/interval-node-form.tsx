"use client";

import { Button, TextField, Stack, Slider, Chip, Box, Typography, Divider } from "@mui/material";
import { useFormState } from "@/hooks/use-form-state";
import { useFlowEditorStore } from "@/stores/flow-editor-store";
import { z } from "zod";

const MAX_DELAY_SECONDS = 30 * 24 * 60 * 60; // 30 dias

const intervalNodeSchema = z.object({
  label: z.string().optional(),
  delay: z.number().min(1, "Intervalo deve ser no mínimo 1 segundo").max(MAX_DELAY_SECONDS, "Intervalo máximo é 30 dias"),
});

const DELAY_PRESETS = [
  { label: "1m", value: 60 },
  { label: "1h", value: 3600 },
  { label: "12h", value: 43200 },
  { label: "1d", value: 86400 },
  { label: "7d", value: 604800 },
  { label: "30d", value: 2592000 },
];

const SLIDER_MARKS = [
  { value: 1, label: "1s" },
  { value: 3600, label: "1h" },
  { value: 86400, label: "1d" },
  { value: 604800, label: "7d" },
];

const formatDuration = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds} segundo${seconds !== 1 ? "s" : ""}`;
  }

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 && days === 0) parts.push(`${secs}s`);

  return parts.join(" ") || "0s";
};

interface IntervalNodeFormProps {
  nodeId: string;
  initialData?: {
    label?: string;
    delay?: number;
  };
  onClose: () => void;
}

export function IntervalNodeForm({
  nodeId,
  initialData,
  onClose,
}: IntervalNodeFormProps) {
  const updateNodeData = useFlowEditorStore((s) => s.updateNodeData);

  const { form, setField, errors, validateAll } = useFormState(
    intervalNodeSchema,
    {
      label: initialData?.label || "",
      delay: initialData?.delay || 5,
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
    <Stack spacing={3} onClick={(e) => e.stopPropagation()}>
      <TextField
        label="Nome do intervalo"
        fullWidth
        size="small"
        value={form.label}
        onChange={(e) => setField("label", e.target.value)}
        placeholder="Intervalo"
        helperText="Opcional - para identificar este intervalo"
      />

      <Divider />

      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Duração: {formatDuration(form.delay)}
        </Typography>

        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 2 }}>
          {DELAY_PRESETS.map((preset) => (
            <Chip
              key={preset.value}
              label={preset.label}
              size="small"
              variant={form.delay === preset.value ? "filled" : "outlined"}
              color={form.delay === preset.value ? "primary" : "default"}
              onClick={() => setField("delay", preset.value)}
              sx={{ cursor: "pointer" }}
            />
          ))}
        </Box>

        <Slider
          value={Math.min(form.delay, 604800)}
          onChange={(_, value) => setField("delay", value as number)}
          min={1}
          max={604800}
          step={60}
          marks={SLIDER_MARKS}
          valueLabelDisplay="auto"
          valueLabelFormat={formatDuration}
          sx={{ mt: 1 }}
        />
      </Box>

      <TextField
        label="Valor exato (segundos)"
        fullWidth
        size="small"
        type="number"
        value={form.delay}
        onChange={(e) => setField("delay", Number(e.target.value))}
        error={Boolean(errors.delay)}
        helperText={errors.delay || "1 segundo até 30 dias (2592000 segundos)"}
        inputProps={{ min: 1, max: MAX_DELAY_SECONDS }}
      />

      <Button onClick={handleSave} variant="contained" fullWidth>
        Salvar Alterações
      </Button>
    </Stack>
  );
}
