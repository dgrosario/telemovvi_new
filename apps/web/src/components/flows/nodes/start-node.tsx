import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Typography, Box, Fade, Chip, Stack } from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { Icon } from "@iconify/react";
import { Channel, typeChannelsAvailable } from "@omnichannel/core/domain/entities/channel";
import { createSourceHandleStyle } from "./node-components";

const NODE_COLOR = "#16a34a";
const ICON_BOX_SIZE = 88;
const MIN_CARD_WIDTH = 280;

interface ChannelData {
  id: string;
  name: string;
  type: string;
  status?: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  waiting: "Pendentes",
  open: "Em Aberto",
  closed: "Concluidas",
  expired: "Expiradas",
};

export const StartNode = memo(({ data, selected }: NodeProps) => {
  const highlighted = data?.highlighted;
  const channels: ChannelData[] = data?.channels || [];
  const triggerOnStatuses: string[] = data?.triggerOnStatuses ?? [];

  const getChannelIcon = (type: string): string => {
    const channelType = typeChannelsAvailable.get(type as Channel.Type);
    return channelType?.icon.split(" ")[0] ?? "tabler:message";
  };

  return (
    <Fade in timeout={300}>
      <Box sx={{ position: "relative" }}>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            backgroundColor: "background.paper",
            borderRadius: 2,
            boxShadow: highlighted
              ? `0 0 20px rgba(22, 163, 74, 0.4), 0 4px 12px rgba(0,0,0,0.15)`
              : selected
                ? `0 0 0 2px ${NODE_COLOR}, 0 4px 12px rgba(0,0,0,0.15)`
                : "0 2px 8px rgba(0,0,0,0.1)",
            transition: "all 0.2s ease-in-out",
            animation: highlighted ? "pulse 1.5s ease-in-out infinite" : undefined,
            "@keyframes pulse": {
              "0%, 100%": { transform: "scale(1)" },
              "50%": { transform: "scale(1.02)" },
            },
            minWidth: MIN_CARD_WIDTH,
            overflow: "hidden",
          }}
        >
          {/* Header com ícone e título */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              p: 1.5,
              pb: channels.length > 0 ? 1 : 1.5,
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
                boxShadow: `0 2px 8px ${NODE_COLOR}40`,
                flexShrink: 0,
              }}
            >
              <PlayArrowIcon sx={{ color: "white", fontSize: 44 }} />
            </Box>

          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontSize: "0.8rem",
                fontWeight: 600,
                color: NODE_COLOR,
                whiteSpace: "nowrap",
              }}
            >
              Início
            </Typography>
            <Typography
              variant="caption"
              sx={{
                fontSize: "0.65rem",
                color: "text.secondary",
                whiteSpace: "nowrap",
              }}
            >
              Ponto de entrada
            </Typography>
          </Box>
        </Box>

        {/* Seção de canais */}
        {channels.length > 0 && (
          <Box
            sx={{
              borderTop: "1px solid",
              borderColor: "divider",
              px: 1.5,
              py: 1,
              backgroundColor: "action.hover",
            }}
          >
            <Stack
              direction="column"
              spacing={0.5}
            >
              {channels.map((channel) => (
                <Chip
                  key={channel.id}
                  icon={
                    <Icon
                      icon={getChannelIcon(channel.type)}
                      width={14}
                      height={14}
                    />
                  }
                  label={channel.name}
                  size="small"
                  variant="outlined"
                  sx={{
                    height: 24,
                    fontSize: "0.65rem",
                    opacity: channel.status === "disconnected" ? 0.5 : 1,
                    backgroundColor: "background.paper",
                    "& .MuiChip-icon": {
                      marginLeft: "6px",
                      marginRight: "-2px",
                    },
                    "& .MuiChip-label": {
                      px: 1,
                      maxWidth: 160,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    },
                  }}
                />
              ))}
            </Stack>
          </Box>
        )}

        {/* Mensagem quando não há canais */}
        {channels.length === 0 && (
          <Box
            sx={{
              borderTop: "1px dashed",
              borderColor: "divider",
              px: 1.5,
              py: 1,
            }}
          >
            <Typography
              variant="caption"
              sx={{
                color: "text.disabled",
                fontSize: "0.65rem",
                fontStyle: "italic",
              }}
            >
              Clique para vincular canais
            </Typography>
          </Box>
        )}

        {/* Status de disparo */}
        {triggerOnStatuses.length > 0 && (
          <Box
            sx={{
              borderTop: "1px solid",
              borderColor: "divider",
              px: 1.5,
              py: 0.75,
              backgroundColor: "action.hover",
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontSize: "0.55rem",
                color: "text.secondary",
                display: "block",
                mb: 0.5,
              }}
            >
              Dispara em:
            </Typography>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              {triggerOnStatuses.map((status) => (
                <Chip
                  key={status}
                  label={STATUS_LABELS[status] || status}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: "0.55rem",
                    backgroundColor: "background.paper",
                  }}
                />
              ))}
            </Stack>
          </Box>
        )}
        </Box>

        {/* Handle fora do card */}
        <Handle
          type="source"
          position={Position.Right}
          style={{
            ...createSourceHandleStyle(NODE_COLOR),
            top: "50%",
            right: -8,
          }}
        />
      </Box>
    </Fade>
  );
});

StartNode.displayName = "StartNode";
