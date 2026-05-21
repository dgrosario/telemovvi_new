"use client";
import { Button, Chip, Stack } from "@mui/material";
import React from "react";

export interface ActiveFilter {
  key: string;
  label: string;
  value: string | string[];
}

interface ActiveFiltersDisplayProps {
  filters: ActiveFilter[];
  onRemove: (filterKey: string) => void;
  onClearAll: () => void;
}

export const ActiveFiltersDisplay: React.FC<ActiveFiltersDisplayProps> = ({
  filters,
  onRemove,
  onClearAll,
}) => {
  if (filters.length === 0) return null;

  return (
    <Stack
      direction="row"
      spacing={1}
      flexWrap="wrap"
      px={2}
      py={1}
      gap={1}
      alignItems="center"
    >
      {filters.map((filter) => (
        <Chip
          key={filter.key}
          label={filter.label}
          onDelete={() => onRemove(filter.key)}
          size="small"
          color="primary"
          variant="outlined"
          sx={{
            borderRadius: "6px",
            fontWeight: 500,
          }}
        />
      ))}
      {filters.length > 0 && (
        <Button
          size="small"
          variant="text"
          onClick={onClearAll}
          sx={{
            textTransform: "none",
            minWidth: "auto",
            padding: "4px 8px",
            fontSize: "0.75rem",
          }}
        >
          Limpar todos
        </Button>
      )}
    </Stack>
  );
};
