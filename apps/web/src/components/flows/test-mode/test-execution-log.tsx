"use client";

import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Stack,
  Chip,
  Box,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { format } from "date-fns";
import { useFlowTestStore, type ExecutionLogEntry } from "@/stores/flow-test-store";

interface LogEntryProps {
  entry: ExecutionLogEntry;
  onNodeClick?: (nodeId: string) => void;
}

function LogEntry({ entry, onNodeClick }: LogEntryProps) {
  const getActionColor = () => {
    switch (entry.action) {
      case "enter":
        return "primary";
      case "exit":
        return "success";
      case "error":
        return "error";
      case "wait":
        return "warning";
      default:
        return "default";
    }
  };

  const getActionLabel = () => {
    switch (entry.action) {
      case "enter":
        return "Entrou";
      case "exit":
        return "Saiu";
      case "error":
        return "Erro";
      case "wait":
        return "Aguardando";
      default:
        return entry.action;
    }
  };

  return (
    <Box
      sx={{
        p: 1,
        bgcolor: entry.action === "error" ? "error.lighter" : "grey.50",
        borderRadius: 1,
        cursor: onNodeClick ? "pointer" : "default",
        "&:hover": onNodeClick
          ? {
              bgcolor: entry.action === "error" ? "error.light" : "grey.100",
            }
          : {},
      }}
      onClick={() => onNodeClick?.(entry.nodeId)}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            label={getActionLabel()}
            size="small"
            color={getActionColor()}
            sx={{ minWidth: 70 }}
          />
          <Typography variant="body2" fontWeight="medium">
            {entry.nodeLabel}
          </Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {format(entry.timestamp, "HH:mm:ss")}
        </Typography>
      </Stack>
      {entry.details && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mt: 0.5, pl: 1 }}
        >
          {entry.details}
        </Typography>
      )}
    </Box>
  );
}

interface TestExecutionLogProps {
  onNodeClick?: (nodeId: string) => void;
}

export function TestExecutionLog({ onNodeClick }: TestExecutionLogProps) {
  const { executionLog } = useFlowTestStore();

  return (
    <Accordion defaultExpanded disableGutters>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="subtitle2">Log de Execucao</Typography>
          <Chip label={executionLog.length} size="small" />
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ maxHeight: 200, overflow: "auto" }}>
        {executionLog.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Nenhuma execucao registrada
          </Typography>
        ) : (
          <Stack spacing={0.5}>
            {executionLog.map((entry) => (
              <LogEntry key={entry.id} entry={entry} onNodeClick={onNodeClick} />
            ))}
          </Stack>
        )}
      </AccordionDetails>
    </Accordion>
  );
}
