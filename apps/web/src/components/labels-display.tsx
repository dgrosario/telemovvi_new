"use client";

import { Box } from "@mui/material";
import { LabelChip } from "./label-chip";
import { Label } from "@omnichannel/core/domain/entities/label";

type LabelsDisplayProps = {
  labels: Label.Raw[];
  maxVisible?: number;
};

export function LabelsDisplay({ labels, maxVisible = 3 }: LabelsDisplayProps) {
  if (labels.length === 0) {
    return null;
  }

  const visibleLabels = labels.slice(0, maxVisible);
  const remainingCount = labels.length - maxVisible;

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, alignItems: "center" }}>
      {visibleLabels.map((label) => (
        <LabelChip key={label.id} name={label.name} color={label.color} />
      ))}
      {remainingCount > 0 && (
        <Box
          component="span"
          sx={{
            fontSize: "0.75rem",
            color: "text.secondary",
            fontWeight: 500,
          }}
        >
          +{remainingCount}
        </Box>
      )}
    </Box>
  );
}
