import { memo, useMemo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Typography, Box, Fade } from "@mui/material";
import CallSplitIcon from "@mui/icons-material/CallSplit";
import { NodeDeleteButton, nodeContainerStyle, createTargetHandleStyle, HANDLE_SIZE } from "./node-components";
import { useFlowEditorStore } from "@/stores/flow-editor-store";

const NODE_COLOR = "#ea580c";
const DEFAULT_BRANCH_COLOR = "#6b7280";
const ICON_BOX_WIDTH = 104;
const ICON_BOX_MIN_HEIGHT = 104;
const OUTPUT_ROW_HEIGHT = 56;
const LINE_LENGTH = 60;

export const ConditionalNode = memo(({ id, data, selected }: NodeProps) => {
  const highlighted = data?.highlighted;
  const conditions = data.conditions || [];
  const defaultBranch = data.defaultBranch;
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

  const totalOutputs = conditions.length + (defaultBranch ? 1 : 0);
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
                ? "0 0 20px rgba(59, 130, 246, 0.6)"
                : selected
                  ? `0 0 0 2px white, 0 0 0 4px ${NODE_COLOR}`
                  : "0 2px 8px rgba(234, 88, 12, 0.3)",
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
            <CallSplitIcon sx={{ color: "white", fontSize: 52, transform: "rotate(90deg)" }} />
          </Box>

          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-around",
              height: nodeHeight,
            }}
          >
            {conditions.map((condition: { id: string; label?: string }) => {
              const isConnected = connectedHandles.has(condition.id);
              return (
                <Box
                  key={condition.id}
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
                      {condition.label || "Condição"}
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
                    id={condition.id}
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

            {defaultBranch && (() => {
              const isConnected = connectedHandles.has(defaultBranch.id);
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
                        color: isConnected ? DEFAULT_BRANCH_COLOR : "text.secondary",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        mb: 0.25,
                        pr: 0.5,
                        textAlign: "right",
                      }}
                    >
                      {defaultBranch.label || "Padrão"}
                    </Typography>
                    <Box
                      sx={{
                        height: 2,
                        backgroundColor: isConnected ? DEFAULT_BRANCH_COLOR : "grey.300",
                        transition: "background-color 0.2s ease",
                      }}
                    />
                  </Box>
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={defaultBranch.id}
                    style={{
                      position: "relative",
                      top: 0,
                      right: 0,
                      transform: "translateY(10px)",
                      width: HANDLE_SIZE,
                      height: HANDLE_SIZE,
                      backgroundColor: DEFAULT_BRANCH_COLOR,
                      border: "3px solid white",
                      boxShadow: isConnected
                        ? `0 0 0 2px ${DEFAULT_BRANCH_COLOR}, 0 0 12px ${DEFAULT_BRANCH_COLOR}80`
                        : `0 0 0 2px ${DEFAULT_BRANCH_COLOR}, 0 2px 8px ${DEFAULT_BRANCH_COLOR}60`,
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
            mt: 0.75,
            color: "text.secondary",
            fontWeight: 500,
            fontSize: "0.75rem",
            minWidth: ICON_BOX_WIDTH,
            whiteSpace: "nowrap",
          }}
        >
          {data.label || "Condicional"}
        </Typography>

        <NodeDeleteButton nodeId={id} nodeType="conditional" />
      </Box>
    </Fade>
  );
});

ConditionalNode.displayName = "ConditionalNode";
