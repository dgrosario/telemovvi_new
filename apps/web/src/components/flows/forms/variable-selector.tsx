"use client";

import { Autocomplete, TextField, Box, Typography, Chip } from "@mui/material";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import SettingsIcon from "@mui/icons-material/Settings";
import ScheduleIcon from "@mui/icons-material/Schedule";
import {
  type FlowVariable,
  getVariableCategories,
} from "@/lib/flow-variables";
import { useListSystemVariables } from "@/hooks/use-system-variables";

interface VariableSelectorProps {
  value: string;
  flowVariables?: FlowVariable[];
  onChange: (variable: string, type: FlowVariable["type"]) => void;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
}

interface VariableOption extends FlowVariable {
  category: string;
  categoryLabel: string;
}

function getCategoryIcon(categoryId: string) {
  switch (categoryId) {
    case "system":
      return <SettingsIcon fontSize="small" />;
    case "system_context":
      return <ScheduleIcon fontSize="small" />;
    case "context":
      return <ChatBubbleOutlineIcon fontSize="small" />;
    case "contact":
      return <PersonOutlineIcon fontSize="small" />;
    case "flow":
      return <AccountTreeIcon fontSize="small" />;
    default:
      return null;
  }
}

function getTypeColor(type: FlowVariable["type"]) {
  switch (type) {
    case "string":
      return "primary";
    case "number":
      return "success";
    case "boolean":
      return "warning";
    case "array":
      return "secondary";
    case "day_of_week":
      return "info";
    case "time":
      return "info";
    case "date":
      return "info";
    default:
      return "default";
  }
}

function getTypeLabel(type: FlowVariable["type"]) {
  switch (type) {
    case "string":
      return "texto";
    case "number":
      return "número";
    case "boolean":
      return "sim/não";
    case "array":
      return "lista";
    case "day_of_week":
      return "dia";
    case "time":
      return "horário";
    case "date":
      return "data";
    default:
      return type;
  }
}

export function VariableSelector({
  value,
  flowVariables = [],
  onChange,
  disabled = false,
  error = false,
  helperText,
}: VariableSelectorProps) {
  const { data: systemVariables } = useListSystemVariables();
  const categories = getVariableCategories(flowVariables, systemVariables ?? []);

  const options: VariableOption[] = categories.flatMap((category) =>
    category.variables.map((variable) => ({
      ...variable,
      category: category.id,
      categoryLabel: category.label,
    }))
  );

  const selectedOption = options.find((opt) => opt.value === value) || null;

  return (
    <Autocomplete
      value={selectedOption}
      onChange={(_, newValue) => {
        if (newValue) {
          onChange(newValue.value, newValue.type);
        } else {
          onChange("", "string");
        }
      }}
      options={options}
      groupBy={(option) => option.categoryLabel}
      getOptionLabel={(option) => option.label}
      isOptionEqualToValue={(option, val) => option.value === val.value}
      disabled={disabled}
      size="small"
      renderGroup={(params) => (
        <li key={params.key}>
          <Box
            sx={{
              position: "sticky",
              top: -8,
              px: 1.5,
              py: 1,
              bgcolor: "background.paper",
              borderBottom: 1,
              borderColor: "divider",
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            {getCategoryIcon(
              options.find((o) => o.categoryLabel === params.group)?.category || ""
            )}
            <Typography variant="caption" fontWeight={600} color="text.secondary">
              {params.group}
            </Typography>
          </Box>
          <ul style={{ padding: 0 }}>{params.children}</ul>
        </li>
      )}
      renderOption={(props, option) => {
        const { key, ...otherProps } = props;
        return (
          <Box
            component="li"
            key={key}
            {...otherProps}
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1,
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" noWrap>
                {option.label}
              </Typography>
              {option.description && (
                <Typography variant="caption" color="text.secondary" noWrap>
                  {option.description}
                </Typography>
              )}
            </Box>
            <Chip
              label={getTypeLabel(option.type)}
              size="small"
              color={getTypeColor(option.type)}
              variant="outlined"
              sx={{ fontSize: "0.65rem", height: 20 }}
            />
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder="Selecione uma variável"
          error={error}
          helperText={helperText}
          InputProps={{
            ...params.InputProps,
            startAdornment: selectedOption ? (
              <Box sx={{ display: "flex", alignItems: "center", mr: 0.5 }}>
                {getCategoryIcon(selectedOption.category)}
              </Box>
            ) : null,
          }}
        />
      )}
    />
  );
}
