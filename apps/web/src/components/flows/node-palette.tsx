"use client";

import { Chip, Stack, Tooltip } from "@mui/material";
import ListIcon from "@mui/icons-material/List";
import TimerIcon from "@mui/icons-material/Timer";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import BoltIcon from "@mui/icons-material/Bolt";
import ShuffleIcon from "@mui/icons-material/Shuffle";
import StopCircleIcon from "@mui/icons-material/StopCircle";

const nodeTypes = [
  { type: "action", label: "Ação", icon: BoltIcon, color: "#8b5cf6" },
  { type: "menu", label: "Menu", icon: ListIcon, color: "#9333ea" },
  { type: "conditional", label: "Condicional", icon: AccountTreeIcon, color: "#ea580c" },
  { type: "interval", label: "Intervalo", icon: TimerIcon, color: "#ca8a04" },
  { type: "random", label: "Randomização", icon: ShuffleIcon, color: "#dc2626" },
  { type: "end", label: "Finalizar", icon: StopCircleIcon, color: "#ef4444" },
];

export function NodePalette() {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
      {nodeTypes.map((node) => {
        const Icon = node.icon;
        return (
          <Tooltip key={node.type} title={`Arraste para adicionar bloco`} placement="bottom">
            <Chip
              icon={<Icon sx={{ color: "white !important", fontSize: 16 }} />}
              label={node.label}
              draggable
              onDragStart={(e) => onDragStart(e, node.type)}
              sx={{
                backgroundColor: node.color,
                color: "white",
                fontWeight: 500,
                cursor: "grab",
                transition: "all 0.2s ease",
                "&:hover": {
                  backgroundColor: node.color,
                  filter: "brightness(1.1)",
                  transform: "translateY(-2px)",
                  boxShadow: 2,
                },
                "&:active": {
                  cursor: "grabbing",
                },
              }}
            />
          </Tooltip>
        );
      })}
    </Stack>
  );
}
