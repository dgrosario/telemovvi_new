"use client";

import { useState } from "react";
import {
  Box,
  FormControl,
  FormLabel,
  TextField,
  Paper,
  Grid,
} from "@mui/material";

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
}

const PRESET_COLORS = [
  "#3B82F6", // blue
  "#10B981", // green
  "#F59E0B", // amber
  "#EF4444", // red
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#14B8A6", // teal
  "#F97316", // orange
  "#6366F1", // indigo
  "#84CC16", // lime
  "#F43F5E", // rose
  "#0EA5E9", // sky
];

export function ColorPicker({ value, onChange, label = "Cor" }: ColorPickerProps) {
  const [customColor, setCustomColor] = useState(value);

  const handlePresetClick = (color: string) => {
    setCustomColor(color);
    onChange(color);
  };

  const handleCustomChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = event.target.value;
    setCustomColor(newColor);

    if (/^#[0-9A-Fa-f]{6}$/.test(newColor)) {
      onChange(newColor);
    }
  };

  return (
    <FormControl fullWidth margin="dense">
      <FormLabel>{label}</FormLabel>
      <Box sx={{ mt: 1 }}>
        <Grid container spacing={1} sx={{ mb: 2 }}>
          {PRESET_COLORS.map((color) => (
            <Grid key={color} sx={{ padding: 0.5 }}>
              <Paper
                onClick={() => handlePresetClick(color)}
                sx={{
                  width: 40,
                  height: 40,
                  backgroundColor: color,
                  cursor: "pointer",
                  border: value === color ? "3px solid #000" : "1px solid #ddd",
                  borderRadius: 1,
                  transition: "all 0.2s",
                  "&:hover": {
                    transform: "scale(1.1)",
                    boxShadow: 2,
                  },
                }}
              />
            </Grid>
          ))}
        </Grid>

        <TextField
          fullWidth
          size="small"
          label="Cor personalizada (hex)"
          value={customColor}
          onChange={handleCustomChange}
          placeholder="#3B82F6"
          error={customColor.length > 0 && !/^#[0-9A-Fa-f]{6}$/.test(customColor)}
          helperText={
            customColor.length > 0 && !/^#[0-9A-Fa-f]{6}$/.test(customColor)
              ? "Formato inválido. Use #RRGGBB"
              : ""
          }
          InputProps={{
            startAdornment: (
              <Box
                sx={{
                  width: 24,
                  height: 24,
                  backgroundColor: /^#[0-9A-Fa-f]{6}$/.test(customColor)
                    ? customColor
                    : "#fff",
                  border: "1px solid #ddd",
                  borderRadius: 1,
                  mr: 1,
                }}
              />
            ),
          }}
        />
      </Box>
    </FormControl>
  );
}
