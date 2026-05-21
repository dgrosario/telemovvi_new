import { memo, useMemo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Typography, Box, Fade, Tooltip } from "@mui/material";
import ListIcon from "@mui/icons-material/List";
import SmartButtonIcon from "@mui/icons-material/SmartButton";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import TextFieldsIcon from "@mui/icons-material/TextFields";
import { NodeDeleteButton, nodeContainerStyle, createTargetHandleStyle, HANDLE_SIZE } from "./node-components";
import { useFlowEditorStore } from "@/stores/flow-editor-store";

type MenuDisplayMode = "auto" | "text" | "buttons" | "list";

const NODE_COLOR = "#9333ea";
const ICON_BOX_WIDTH = 96;
const ICON_BOX_MIN_HEIGHT = 96;
const OUTPUT_ROW_HEIGHT = 52;
const LINE_LENGTH = 56;

export const MenuNode = memo(({ id, data, selected }: NodeProps) => {
  const highlighted = data?.highlighted;
  const options = data.options || [];
  const displayMode = (data.displayMode || "auto") as MenuDisplayMode;
  const edges = useFlowEditorStore((s) => s.edges);

  const connectedHandles = useMemo(() => {
    const connected = new Set<string>();
    edges
      .filter((e) => e.source === id)
      .forEach((e) => {
        if (e.sourceHandle) {
          connected.add(e.sourceHandle);
        }
      });
    return connected;
  }, [edges, id]);

  const effectiveDisplayMode = useMemo((): "text" | "buttons" | "list" => {
    if (displayMode !== "auto") return displayMode;
    const count = options.length;
    if (count <= 3) return "buttons";
    if (count <= 10) return "list";
    return "text";
  }, [displayMode, options.length]);

  const getDisplayModeIcon = () => {
    switch (effectiveDisplayMode) {
      case "buttons":
        return <SmartButtonIcon sx={{ fontSize: 12, color: "white", opacity: 0.9 }} />;
      case "list":
        return <FormatListBulletedIcon sx={{ fontSize: 12, color: "white", opacity: 0.9 }} />;
      default:
        return <TextFieldsIcon sx={{ fontSize: 12, color: "white", opacity: 0.9 }} />;
    }
  };

  const getDisplayModeLabel = () => {
    switch (effectiveDisplayMode) {
      case "buttons":
        return "Botões interativos";
      case "list":
        return "Lista interativa";
      default:
        return "Texto simples";
    }
  };

  const totalOutputs = options.length + (data.errorBranch?.enabled ? 1 : 0);
  const outputsHeight = totalOutputs * OUTPUT_ROW_HEIGHT;
  const nodeHeight = Math.max(ICON_BOX_MIN_HEIGHT, outputsHeight);

  return (
    <Fade in timeout={300}>
      <Box sx={nodeContainerStyle}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            position: "relative",
          }}
        >
          <Box
            sx={{
              width: ICON_BOX_WIDTH,
              height: nodeHeight,
              borderRadius: 2,
              backgroundColor: NODE_COLOR,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: highlighted
                ? "0 0 20px rgba(147, 51, 234, 0.6)"
                : selected
                  ? `0 0 0 2px white, 0 0 0 4px ${NODE_COLOR}`
                  : "0 2px 8px rgba(147, 51, 234, 0.3)",
              transition: "all 0.2s ease-in-out",
              animation: highlighted ? "pulse 1.5s ease-in-out infinite" : undefined,
              "@keyframes pulse": {
                "0%, 100%": { transform: "scale(1)" },
                "50%": { transform: "scale(1.05)" },
              },
              position: "relative",
              flexShrink: 0,
            }}
          >
            <Handle
              type="target"
              position={Position.Left}
              style={{
                ...createTargetHandleStyle(NODE_COLOR),
                left: -8,
              }}
            />
            <ListIcon sx={{ color: "white", fontSize: 48 }} />
            <Tooltip title={getDisplayModeLabel()} placement="top">
              <Box
                sx={{
                  position: "absolute",
                  top: 4,
                  right: 4,
                  backgroundColor: "rgba(0, 0, 0, 0.3)",
                  borderRadius: 0.5,
                  p: 0.25,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {getDisplayModeIcon()}
              </Box>
            </Tooltip>
          </Box>

          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-around",
              height: nodeHeight,
            }}
          >
            {options.map((option: { id: string; label: string }) => {
              const isConnected = connectedHandles.has(option.id);
              return (
                <Box
                  key={option.id}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "stretch",
                      minWidth: LINE_LENGTH,
                      maxWidth: LINE_LENGTH + 40,
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: "0.75rem",
                        fontWeight: 500,
                        color: isConnected ? NODE_COLOR : "text.secondary",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        mb: 0.25,
                        pr: 0.5,
                        textAlign: "right",
                      }}
                    >
                      {option.label || "Opção"}
                    </Typography>
                    <Box
                      sx={{
                        height: 2,
                        backgroundColor: isConnected ? NODE_COLOR : "grey.300",
                        transition: "background-color 0.2s ease",
                      }}
                    />
                  </Box>
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={option.id}
                    style={{
                      position: "relative",
                      top: 0,
                      right: 0,
                      transform: "translateY(10px)",
                      width: HANDLE_SIZE,
                      height: HANDLE_SIZE,
                      backgroundColor: NODE_COLOR,
                      border: "3px solid white",
                      boxShadow: isConnected
                        ? `0 0 0 2px ${NODE_COLOR}, 0 0 12px ${NODE_COLOR}80`
                        : `0 0 0 2px ${NODE_COLOR}, 0 2px 8px ${NODE_COLOR}60`,
                      transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                  />
                </Box>
              );
            })}

            {data.errorBranch?.enabled && (() => {
              const isConnected = connectedHandles.has("error");
              return (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "stretch",
                      minWidth: LINE_LENGTH,
                      maxWidth: LINE_LENGTH + 40,
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: "0.75rem",
                        fontWeight: 500,
                        color: isConnected ? "#EF4444" : "text.secondary",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        mb: 0.25,
                        pr: 0.5,
                        pl: 1,
                        textAlign: "right",
                      }}
                    >
                      Erro ({data.errorBranch.maxAttempts}x)
                    </Typography>
                    <Box
                      sx={{
                        height: 2,
                        backgroundColor: isConnected ? "#EF4444" : "grey.300",
                        transition: "background-color 0.2s ease",
                      }}
                    />
                  </Box>
                  <Handle
                    type="source"
                    position={Position.Right}
                    id="error"
                    style={{
                      position: "relative",
                      top: 0,
                      right: 0,
                      transform: "translateY(10px)",
                      width: HANDLE_SIZE,
                      height: HANDLE_SIZE,
                      backgroundColor: "#EF4444",
                      border: "3px solid white",
                      boxShadow: isConnected
                        ? "0 0 0 2px #EF4444, 0 0 12px #EF444480"
                        : "0 0 0 2px #EF4444, 0 2px 8px #EF444460",
                      transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                  />
                </Box>
              );
            })()}
          </Box>
        </Box>

        <Typography
          variant="caption"
          sx={{
            display: "block",
            textAlign: "center",
            mt: 0.5,
            color: "text.secondary",
            fontWeight: 500,
            fontSize: "0.7rem",
            minWidth: ICON_BOX_WIDTH,
            whiteSpace: "nowrap",
          }}
        >
          {data.label || "Menu"}
        </Typography>

        <NodeDeleteButton nodeId={id} nodeType="menu" />
      </Box>
    </Fade>
  );
});

MenuNode.displayName = "MenuNode";
