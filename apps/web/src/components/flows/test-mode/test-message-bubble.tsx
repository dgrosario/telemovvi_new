"use client";

import { Paper, Typography, Chip, Stack } from "@mui/material";
import { format } from "date-fns";
import type { TestMessage } from "@/stores/flow-test-store";

interface TestMessageBubbleProps {
  message: TestMessage;
  onOptionSelect?: (value: string) => void;
}

export function TestMessageBubble({ message, onOptionSelect }: TestMessageBubbleProps) {
  const isBot = message.type === "bot";
  const isUser = message.type === "user";
  const isSystem = message.type === "system";

  const getBubbleStyles = () => {
    if (isBot) {
      return {
        bgcolor: "grey.100",
        alignSelf: "flex-start",
        borderTopLeftRadius: 4,
      };
    }
    if (isUser) {
      return {
        bgcolor: "primary.main",
        color: "primary.contrastText",
        alignSelf: "flex-end",
        borderTopRightRadius: 4,
      };
    }
    return {
      bgcolor: "warning.lighter",
      alignSelf: "center",
      borderRadius: 2,
    };
  };

  const formatContent = (content: string) => {
    return content.split("\n").map((line, idx) => (
      <span key={idx}>
        {line}
        {idx < content.split("\n").length - 1 && <br />}
      </span>
    ));
  };

  return (
    <Paper
      elevation={0}
      sx={{
        px: 2,
        py: 1.5,
        maxWidth: isSystem ? "90%" : "80%",
        borderRadius: 3,
        ...getBubbleStyles(),
      }}
    >
      <Typography
        variant="body2"
        sx={{
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          color: isSystem ? "text.secondary" : undefined,
          fontStyle: isSystem ? "italic" : undefined,
          fontSize: isSystem ? "0.8rem" : undefined,
        }}
      >
        {formatContent(message.content)}
      </Typography>

      {message.metadata?.options && onOptionSelect && (
        <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 1.5 }}>
          {message.metadata.options.map((option) => (
            <Chip
              key={option.id}
              label={option.label}
              size="small"
              variant="outlined"
              onClick={() => onOptionSelect(option.value)}
              sx={{
                cursor: "pointer",
                "&:hover": {
                  bgcolor: "primary.lighter",
                  borderColor: "primary.main",
                },
              }}
            />
          ))}
        </Stack>
      )}

      <Typography
        variant="caption"
        sx={{
          display: "block",
          mt: 0.5,
          textAlign: isUser ? "right" : "left",
          color: isUser ? "primary.contrastText" : "text.disabled",
          opacity: 0.7,
        }}
      >
        {format(message.timestamp, "HH:mm")}
      </Typography>
    </Paper>
  );
}
