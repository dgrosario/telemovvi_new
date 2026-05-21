"use client";

import { Popover, Box, Typography } from "@mui/material";
import ListIcon from "@mui/icons-material/List";
import TimerIcon from "@mui/icons-material/Timer";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import BoltIcon from "@mui/icons-material/Bolt";
import ShuffleIcon from "@mui/icons-material/Shuffle";
import StopCircleIcon from "@mui/icons-material/StopCircle";
import type { FlowNodeType } from "@/stores/flow-editor-store";

const nodeTypes = [
  { type: "action" as const, label: "Ação", icon: BoltIcon, color: "#8b5cf6" },
  { type: "menu" as const, label: "Menu", icon: ListIcon, color: "#9333ea" },
  { type: "conditional" as const, label: "Condicional", icon: AccountTreeIcon, color: "#ea580c" },
  { type: "interval" as const, label: "Intervalo", icon: TimerIcon, color: "#ca8a04" },
  { type: "random" as const, label: "Randomização", icon: ShuffleIcon, color: "#dc2626" },
  { type: "end" as const, label: "Finalizar", icon: StopCircleIcon, color: "#ef4444" },
];

interface NodeTypeMenuProps {
  position: { x: number; y: number } | null;
  onSelectType: (type: FlowNodeType) => void;
  onClose: () => void;
}

export function NodeTypeMenu({ position, onSelectType, onClose }: NodeTypeMenuProps) {
  const open = Boolean(position);

  const handleItemClick = (event: React.MouseEvent, type: FlowNodeType) => {
    event.stopPropagation();
    onSelectType(type);
  };

  return (
    <Popover
      open={open}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={position ? { top: position.y, left: position.x } : undefined}
      transformOrigin={{
        vertical: "top",
        horizontal: "left",
      }}
      slotProps={{
        paper: {
          sx: {
            borderRadius: 1.5,
            boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
            p: 1.5,
            minWidth: "320px !important",
            width: "320px !important",
          },
        },
      }}
    >
      <Box display="flex" flexDirection="column" gap={0.5}>
        {nodeTypes.map((node) => {
          const Icon = node.icon;
          return (
            <Box
              key={node.type}
              onClick={(event) => handleItemClick(event, node.type)}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                px: 2.5,
                py: 1.25,
                cursor: "pointer",
                borderRadius: 1,
                transition: "all 0.15s ease",
                "&:hover": {
                  backgroundColor: node.color,
                  "& .MuiTypography-root": {
                    color: "white",
                  },
                  "& .MuiSvgIcon-root": {
                    color: "white",
                  },
                },
              }}
            >
              <Icon
                sx={{
                  fontSize: 24,
                  color: node.color,
                  transition: "color 0.15s ease",
                }}
              />
              <Typography
                variant="body1"
                fontWeight={500}
                sx={{
                  color: "text.primary",
                  transition: "color 0.15s ease",
                }}
              >
                {node.label}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Popover>
  );
}
