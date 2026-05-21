"use client";

import { Autocomplete, TextField, Box, Typography } from "@mui/material";
import { type Operator, type VariableType, getOperatorsForType } from "@/lib/flow-variables";

interface OperatorSelectorProps {
  value: string;
  variableType: VariableType;
  onChange: (operator: string) => void;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
}

export function OperatorSelector({
  value,
  variableType,
  onChange,
  disabled = false,
  error = false,
  helperText,
}: OperatorSelectorProps) {
  const operators = getOperatorsForType(variableType);
  const selectedOperator = operators.find((op) => op.value === value);

  return (
    <Autocomplete
      value={selectedOperator}
      onChange={(_, newValue) => {
        onChange(newValue?.value || "");
      }}
      options={operators}
      getOptionLabel={(option) => option.label}
      isOptionEqualToValue={(option, val) => option.value === val.value}
      disabled={disabled}
      disableClearable
      size="small"
      renderOption={(props, option) => {
        const { key, ...otherProps } = props;
        return (
          <Box
            component="li"
            key={key}
            {...otherProps}
            sx={{ display: "flex", alignItems: "center", gap: 1.5 }}
          >
            <Box
              sx={{
                width: 28,
                height: 28,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "action.hover",
                borderRadius: 1,
                fontFamily: "monospace",
                fontSize: "0.75rem",
                fontWeight: 600,
              }}
            >
              {option.icon}
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2">{option.label}</Typography>
              {!option.requiresValue && (
                <Typography variant="caption" color="text.secondary">
                  Sem valor adicional
                </Typography>
              )}
            </Box>
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder="Selecione um operador"
          error={error}
          helperText={helperText}
          InputProps={{
            ...params.InputProps,
            startAdornment: selectedOperator ? (
              <Box
                sx={{
                  width: 24,
                  height: 24,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: "action.hover",
                  borderRadius: 0.5,
                  fontFamily: "monospace",
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  mr: 0.5,
                }}
              >
                {selectedOperator.icon}
              </Box>
            ) : null,
          }}
        />
      )}
    />
  );
}
