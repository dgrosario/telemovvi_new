"use client";

import { FormControl, FormLabel, TextField, Box } from "@mui/material";

interface TimeRangePickerProps {
  startValue: string;
  endValue: string;
  onStartChange: (time: string) => void;
  onEndChange: (time: string) => void;
  label?: string;
}

export function TimeRangePicker({
  startValue,
  endValue,
  onStartChange,
  onEndChange,
  label = "Horário de funcionamento",
}: TimeRangePickerProps) {
  const formatTimeForInput = (time: string): string => {
    return time.slice(0, 5);
  };

  const formatTimeForStorage = (time: string): string => {
    return `${time}:00`;
  };

  const handleStartChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    onStartChange(formatTimeForStorage(value));
  };

  const handleEndChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    onEndChange(formatTimeForStorage(value));
  };

  const isValidRange = startValue < endValue;

  return (
    <FormControl fullWidth margin="dense">
      <FormLabel>{label}</FormLabel>
      <Box sx={{ display: "flex", gap: 2, mt: 1 }}>
        <TextField
          type="time"
          label="Início"
          value={formatTimeForInput(startValue)}
          onChange={handleStartChange}
          InputLabelProps={{
            shrink: true,
          }}
          inputProps={{
            step: 300,
          }}
          size="small"
          fullWidth
          error={!isValidRange}
        />
        <TextField
          type="time"
          label="Fim"
          value={formatTimeForInput(endValue)}
          onChange={handleEndChange}
          InputLabelProps={{
            shrink: true,
          }}
          inputProps={{
            step: 300,
          }}
          size="small"
          fullWidth
          error={!isValidRange}
          helperText={
            !isValidRange ? "Horário de fim deve ser maior que o início" : ""
          }
        />
      </Box>
    </FormControl>
  );
}
