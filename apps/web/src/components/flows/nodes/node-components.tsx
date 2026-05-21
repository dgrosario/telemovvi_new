"use client";

import { Handle, Position } from "reactflow";
import { IconButton, Box, Tooltip } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { useFlowEditorStore } from "@/stores/flow-editor-store";

export const HANDLE_SIZE = 16;
const HANDLE_SIZE_HOVER = 20;

export const createSourceHandleStyle = (color: string): React.CSSProperties => ({
  width: HANDLE_SIZE,
  height: HANDLE_SIZE,
  backgroundColor: color,
  border: "3px solid white",
  boxShadow: `0 0 0 2px ${color}, 0 2px 8px ${color}60`,
  transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
  cursor: "crosshair",
});

export const createTargetHandleStyle = (color: string): React.CSSProperties => ({
  width: HANDLE_SIZE,
  height: HANDLE_SIZE,
  backgroundColor: "white",
  border: `3px solid ${color}`,
  boxShadow: `0 0 0 2px white, 0 2px 6px rgba(0,0,0,0.2)`,
  transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
  cursor: "crosshair",
});

export const NODE_SIZE = 140;
export const NODE_HEIGHT = 80;

export const nodeSquareStyle = {
  width: NODE_SIZE,
  height: NODE_HEIGHT,
  minWidth: NODE_SIZE,
  minHeight: NODE_HEIGHT,
  maxWidth: NODE_SIZE,
  maxHeight: NODE_HEIGHT,
  display: "flex" as const,
  flexDirection: "column" as const,
  justifyContent: "center" as const,
  overflow: "hidden" as const,
};

export const nodeFlexibleHeightStyle = {
  width: NODE_SIZE,
  minWidth: NODE_SIZE,
  maxWidth: NODE_SIZE,
  minHeight: NODE_HEIGHT,
  maxHeight: 280,
  display: "flex" as const,
  flexDirection: "column" as const,
  justifyContent: "flex-start" as const,
  overflow: "hidden" as const,
};

interface CustomHandleProps {
  type: "source" | "target";
  position: Position;
  color: string;
  id?: string;
  style?: React.CSSProperties;
}

export function CustomHandle({
  type,
  position,
  color,
  id,
  style,
}: CustomHandleProps) {
  const isSource = type === "source";

  const baseStyle: React.CSSProperties = {
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
    cursor: "crosshair",
    ...(isSource ? {
      backgroundColor: color,
      border: "3px solid white",
      boxShadow: `0 0 0 2px ${color}, 0 2px 8px ${color}60`,
    } : {
      backgroundColor: "white",
      border: `3px solid ${color}`,
      boxShadow: `0 0 0 2px white, 0 2px 6px rgba(0,0,0,0.2)`,
    }),
    ...style,
  };

  return (
    <Handle
      type={type}
      position={position}
      id={id}
      style={baseStyle}
      onMouseEnter={(e) => {
        const target = e.currentTarget;
        target.style.width = `${HANDLE_SIZE_HOVER}px`;
        target.style.height = `${HANDLE_SIZE_HOVER}px`;
        target.style.transform = "translate(-50%, -50%) scale(1.1)";
        if (isSource) {
          target.style.boxShadow = `0 0 0 3px ${color}, 0 0 20px ${color}80, 0 4px 12px ${color}60`;
        } else {
          target.style.boxShadow = `0 0 0 3px white, 0 0 15px ${color}50, 0 4px 12px rgba(0,0,0,0.3)`;
          target.style.backgroundColor = color;
          target.style.border = "3px solid white";
        }
      }}
      onMouseLeave={(e) => {
        const target = e.currentTarget;
        target.style.width = `${HANDLE_SIZE}px`;
        target.style.height = `${HANDLE_SIZE}px`;
        target.style.transform = "translate(-50%, -50%)";
        if (isSource) {
          target.style.boxShadow = `0 0 0 2px ${color}, 0 2px 8px ${color}60`;
        } else {
          target.style.boxShadow = `0 0 0 2px white, 0 2px 6px rgba(0,0,0,0.2)`;
          target.style.backgroundColor = "white";
          target.style.border = `3px solid ${color}`;
        }
      }}
    />
  );
}

interface NodeDeleteButtonProps {
  nodeId: string;
  nodeType: string;
}

export function NodeDeleteButton({ nodeId, nodeType }: NodeDeleteButtonProps) {
  const deleteNode = useFlowEditorStore((s) => s.deleteNode);
  const duplicateNode = useFlowEditorStore((s) => s.duplicateNode);

  if (nodeType === "start") {
    return null;
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteNode(nodeId);
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    duplicateNode(nodeId);
  };

  return (
    <Box
      className="node-delete-button"
      sx={{
        position: "absolute",
        top: -8,
        right: -8,
        opacity: 0,
        transition: "opacity 0.2s ease-in-out",
        zIndex: 10,
        display: "flex",
        gap: 0.5,
      }}
    >
      <Tooltip title="Duplicar" placement="top">
        <IconButton
          size="small"
          onClick={handleDuplicate}
          sx={{
            width: 28,
            height: 28,
            backgroundColor: "primary.main",
            color: "white",
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
            "&:hover": {
              backgroundColor: "primary.dark",
              transform: "scale(1.1)",
            },
          }}
        >
          <ContentCopyIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Excluir" placement="top">
        <IconButton
          size="small"
          onClick={handleDelete}
          sx={{
            width: 28,
            height: 28,
            backgroundColor: "error.main",
            color: "white",
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
            "&:hover": {
              backgroundColor: "error.dark",
              transform: "scale(1.1)",
            },
          }}
        >
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

export const nodeContainerStyle = {
  position: "relative" as const,
  "&:hover .node-delete-button": {
    opacity: 1,
  },
};
