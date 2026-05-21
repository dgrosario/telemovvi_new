import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Typography, Box, Fade } from "@mui/material";
import MessageIcon from "@mui/icons-material/Message";
import { NodeDeleteButton, nodeContainerStyle, createSourceHandleStyle, createTargetHandleStyle } from "./node-components";

const NODE_COLOR = "#2563eb";
const ICON_BOX_SIZE = 88;

export const MessageNode = memo(({ id, data, selected }: NodeProps) => {
  const highlighted = data?.highlighted;

  const getContentPreview = () => {
    if (!data.content) return "Não configurado";
    return data.content.length > 25 ? data.content.substring(0, 25) + "..." : data.content;
  };

  return (
    <Fade in timeout={300}>
      <Box sx={nodeContainerStyle}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
          }}
        >
          <Box
            sx={{
              width: ICON_BOX_SIZE,
              height: ICON_BOX_SIZE,
              borderRadius: 2,
              backgroundColor: NODE_COLOR,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: highlighted
                ? "0 0 20px rgba(37, 99, 235, 0.6)"
                : selected
                  ? `0 0 0 2px white, 0 0 0 4px ${NODE_COLOR}`
                  : `0 2px 8px ${NODE_COLOR}40`,
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
            <MessageIcon sx={{ color: "white", fontSize: 44 }} />
            <Handle
              type="source"
              position={Position.Right}
              style={{
                ...createSourceHandleStyle(NODE_COLOR),
                right: -8,
              }}
            />
          </Box>

          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              maxWidth: 160,
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontSize: "0.7rem",
                fontWeight: 600,
                color: NODE_COLOR,
                whiteSpace: "nowrap",
              }}
            >
              Mensagem
            </Typography>
            <Typography
              variant="caption"
              sx={{
                fontSize: "0.6rem",
                color: "text.secondary",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {getContentPreview()}
            </Typography>
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
            maxWidth: 160,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {data.label || "Mensagem"}
        </Typography>

        <NodeDeleteButton nodeId={id} nodeType="message" />
      </Box>
    </Fade>
  );
});

MessageNode.displayName = "MessageNode";
