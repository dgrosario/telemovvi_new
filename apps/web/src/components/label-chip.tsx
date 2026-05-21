"use client";

import { Chip, ChipProps } from "@mui/material";

type LabelChipProps = {
  name: string;
  color: string;
  onDelete?: (event?: React.SyntheticEvent) => void;
  size?: ChipProps["size"];
};

export function LabelChip({ name, color, onDelete, size = "small" }: LabelChipProps) {
  return (
    <Chip
      label={name}
      size={size}
      onDelete={onDelete}
      sx={{
        backgroundColor: `${color}20`,
        color: color,
        borderColor: color,
        border: "1px solid",
        fontWeight: 500,
        "& .MuiChip-deleteIcon": {
          color: color,
          "&:hover": {
            color: `${color}CC`,
          },
        },
      }}
    />
  );
}
