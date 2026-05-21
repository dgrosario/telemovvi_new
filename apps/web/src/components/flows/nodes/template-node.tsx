import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Typography, Box, Fade } from "@mui/material";
import DescriptionIcon from "@mui/icons-material/Description";
import { NodeDeleteButton, nodeContainerStyle, createSourceHandleStyle, createTargetHandleStyle } from "./node-components";

const NODE_COLOR = "#059669";
const ICON_BOX_SIZE = 88;

export const TemplateNode = memo(({ id, data, selected }: NodeProps) => {
  const highlighted = data?.highlighted;

  const getStatusText = () => {
    if (data.templateId) return "Template configurado";
    return "Não configurado";
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
                ? "0 0 20px rgba(5, 150, 105, 0.6)"
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
            <DescriptionIcon sx={{ color: "white", fontSize: 44 }} />
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
              Template
            </Typography>
            <Typography
              variant="caption"
              sx={{
                fontSize: "0.6rem",
                color: "text.secondary",
                whiteSpace: "nowrap",
              }}
            >
              {getStatusText()}
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
          {data.label || "Template"}
        </Typography>

        <NodeDeleteButton nodeId={id} nodeType="template" />
      </Box>
    </Fade>
  );
});

TemplateNode.displayName = "TemplateNode";
