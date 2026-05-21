"use client";

import { Box, Chip, Typography } from "@mui/material";
import { CampaignMessage } from "../types";

type MessageVariationCardProps = {
  message: CampaignMessage;
};

export function MessageVariationCard({ message }: MessageVariationCardProps) {
  return (
    <Box className="border rounded p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Chip
            label={`Variação ${message.variationLabel}`}
            size="small"
            color="primary"
            variant="outlined"
          />
          <Chip
            label={message.type === "text" ? "Texto" : "Template"}
            size="small"
            variant="outlined"
          />
        </div>
        <Typography variant="body2" className="text-gray-500">
          {message.sentCount} envio{message.sentCount !== 1 ? "s" : ""}
        </Typography>
      </div>

      {message.type === "template" && message.templateName && (
        <Typography variant="body2" className="text-gray-500 mb-2">
          Template: <strong>{message.templateName}</strong>
        </Typography>
      )}

      {message.content && (
        <Typography
          variant="body2"
          className="bg-gray-50 p-3 rounded whitespace-pre-wrap"
        >
          {message.content}
        </Typography>
      )}
    </Box>
  );
}
