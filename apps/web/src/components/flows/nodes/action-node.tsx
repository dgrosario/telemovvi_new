import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Typography, Box, Fade, Chip, Stack } from "@mui/material";
import BoltIcon from "@mui/icons-material/Bolt";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import PersonIcon from "@mui/icons-material/Person";
import SaveIcon from "@mui/icons-material/Save";
import CloseIcon from "@mui/icons-material/Close";
import MessageIcon from "@mui/icons-material/Message";
import DescriptionIcon from "@mui/icons-material/Description";
import CallSplitIcon from "@mui/icons-material/CallSplit";
import PauseCircleIcon from "@mui/icons-material/PauseCircle";
import AudioFileIcon from "@mui/icons-material/AudioFile";
import ImageIcon from "@mui/icons-material/Image";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import InputIcon from "@mui/icons-material/Input";
import LayersIcon from "@mui/icons-material/Layers";
import { NodeDeleteButton, createSourceHandleStyle, createTargetHandleStyle } from "./node-components";

const ICON_BOX_SIZE = 88;
const MIN_CARD_WIDTH = 280;

const DEFAULT_CONFIG = {
  icon: BoltIcon,
  label: "Ação",
  color: "#6b7280",
  description: "Selecione um tipo de ação",
};

const ACTION_TYPE_CONFIG: Record<
  string,
  { icon: typeof BoltIcon; label: string; color: string; description: string }
> = {
  tag_contact: {
    icon: LocalOfferIcon,
    label: "Etiqueta",
    color: "#8b5cf6",
    description: "Adiciona/remove etiquetas",
  },
  assign_conversation: {
    icon: PersonIcon,
    label: "Atribuir",
    color: "#3b82f6",
    description: "Atribui a um atendente",
  },
  set_variable: {
    icon: SaveIcon,
    label: "Variável",
    color: "#10b981",
    description: "Define uma variável",
  },
  close_conversation: {
    icon: CloseIcon,
    label: "Encerrar",
    color: "#ef4444",
    description: "Encerra a conversa",
  },
  send_message: {
    icon: MessageIcon,
    label: "Mensagem",
    color: "#2563eb",
    description: "Envia mensagem de texto",
  },
  send_template: {
    icon: DescriptionIcon,
    label: "Template",
    color: "#059669",
    description: "Envia template WhatsApp",
  },
  transfer: {
    icon: CallSplitIcon,
    label: "Transferir",
    color: "#dc2626",
    description: "Transfere para setor",
  },
  pause_flow: {
    icon: PauseCircleIcon,
    label: "Pausar",
    color: "#f59e0b",
    description: "Pausa o atendimento",
  },
  capture_input: {
    icon: InputIcon,
    label: "Capturar",
    color: "#0891b2",
    description: "Captura entrada do usuário",
  },
};

export const ActionNode = memo(({ id, data, selected }: NodeProps) => {
  const highlighted = data?.highlighted;
  const actions = data.actions as Array<{ id: string; actionType: string; [key: string]: any }> | undefined;
  const hasMultipleActions = actions && actions.length > 1;
  
  // For backward compatibility, use actionType if no actions array
  const actionType = hasMultipleActions ? null : (actions?.[0]?.actionType || data.actionType);
  const config = actionType
    ? (ACTION_TYPE_CONFIG[actionType] || DEFAULT_CONFIG)
    : hasMultipleActions
      ? { icon: LayersIcon, label: "Multi-Ações", color: "#7c3aed", description: `${actions.length} ações configuradas` }
      : DEFAULT_CONFIG;
  const Icon = config.icon;

  const getActionDetails = (): string | null => {
    // If multiple actions, show count
    if (hasMultipleActions) {
      const actionLabels = actions.map((a) => {
        const cfg = ACTION_TYPE_CONFIG[a.actionType];
        return cfg?.label || "Ação";
      });
      return actionLabels.slice(0, 3).join(" → ") + (actions.length > 3 ? " ..." : "");
    }

    // Single action details (use first action from array or legacy format)
    const actionData = actions?.[0] || data;
    const currentActionType = actionData.actionType;

    switch (currentActionType) {
      case "tag_contact":
        if (actionData.labelIds?.length > 0) {
          return `${actionData.tagOperation === "remove" ? "Remove" : "Adiciona"}: ${actionData.labelIds.length} etiqueta(s)`;
        }
        return null;
      case "set_variable":
        if (actionData.variableName) {
          return `${actionData.variableName} = ${actionData.variableValue || ""}`;
        }
        return null;
      case "send_message": {
        const messageType = actionData.messageType || "text";
        if (messageType === "text" && actionData.content) {
          return actionData.content.length > 50 ? actionData.content.substring(0, 50) + "..." : actionData.content;
        }
        if (messageType !== "text" && actionData.mediaName) {
          const typeLabels: Record<string, string> = {
            audio: "Áudio",
            image: "Imagem",
            document: "Documento",
          };
          return `${typeLabels[messageType] || "Arquivo"}: ${actionData.mediaName}`;
        }
        return null;
      }
      case "send_template":
        if (actionData.templateId) {
          return "Template configurado";
        }
        return null;
      case "transfer":
        if (actionData.sectorId && actionData.sectorName) {
          return `Para setor: ${actionData.sectorName}`;
        }
        return null;
      case "assign_conversation":
        if (actionData.attendantId && actionData.attendantName) {
          return `Atendente: ${actionData.attendantName}`;
        }
        return null;
      case "close_conversation":
        return "Encerra a conversa";
      case "pause_flow": {
        const duration = actionData.pauseDuration || 5;
        const unit = actionData.pauseUnit || "minutes";
        const unitLabels: Record<string, string> = {
          minutes: "minutos",
          hours: "horas",
          days: "dias",
        };
        return `Aguarda ${duration} ${unitLabels[unit] || unit}`;
      }
      case "capture_input":
        if (actionData.question) {
          const truncated = actionData.question.length > 40 ? actionData.question.substring(0, 40) + "..." : actionData.question;
          return `Pergunta: ${truncated}`;
        }
        return null;
      default:
        return null;
    }
  };

  const actionDetails = getActionDetails();

  return (
    <Fade in timeout={300}>
      <Box sx={{ position: "relative", "&:hover .node-delete-button": { opacity: 1 } }}>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            backgroundColor: "background.paper",
            borderRadius: 2,
            boxShadow: highlighted
              ? `0 0 20px ${config.color}60, 0 4px 12px rgba(0,0,0,0.15)`
              : selected
                ? `0 0 0 2px ${config.color}, 0 4px 12px rgba(0,0,0,0.15)`
                : "0 2px 8px rgba(0,0,0,0.1)",
            transition: "all 0.2s ease-in-out",
            animation: highlighted ? "pulse 1.5s ease-in-out infinite" : undefined,
            "@keyframes pulse": {
              "0%, 100%": { transform: "scale(1)" },
              "50%": { transform: "scale(1.02)" },
            },
            width: MIN_CARD_WIDTH,
            maxWidth: MIN_CARD_WIDTH,
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              p: 1.5,
              pb: actionDetails ? 1 : 1.5,
            }}
          >
            <Box
              sx={{
                width: ICON_BOX_SIZE,
                height: ICON_BOX_SIZE,
                borderRadius: 2,
                backgroundColor: config.color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `0 2px 8px ${config.color}40`,
                flexShrink: 0,
              }}
            >
              <Icon sx={{ color: "white", fontSize: 44 }} />
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
                  color: config.color,
                  whiteSpace: "nowrap",
                }}
              >
                {config.label}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  fontSize: "0.65rem",
                  color: "text.secondary",
                  whiteSpace: "nowrap",
                }}
              >
                {config.description}
              </Typography>
            </Box>
          </Box>

          {actionDetails && (
            <Box
              sx={{
                borderTop: "1px solid",
                borderColor: "divider",
                px: 1.5,
                py: 1,
                backgroundColor: "action.hover",
                maxWidth: MIN_CARD_WIDTH,
                overflow: "hidden",
              }}
            >
              {hasMultipleActions ? (
                <Stack spacing={0.5}>
                  {actions.slice(0, 4).map((action, index) => {
                    const actionConfig = ACTION_TYPE_CONFIG[action.actionType] || DEFAULT_CONFIG;
                    const ActionIcon = actionConfig.icon;
                    return (
                      <Box
                        key={action.id}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 0.5,
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            fontSize: "0.65rem",
                            color: "text.secondary",
                            minWidth: 14,
                          }}
                        >
                          {index + 1}.
                        </Typography>
                        <ActionIcon sx={{ fontSize: 12, color: actionConfig.color }} />
                        <Typography
                          variant="caption"
                          sx={{
                            fontSize: "0.65rem",
                            color: "text.primary",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {actionConfig.label}
                        </Typography>
                      </Box>
                    );
                  })}
                  {actions.length > 4 && (
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: "0.6rem",
                        color: "text.secondary",
                        fontStyle: "italic",
                      }}
                    >
                      +{actions.length - 4} mais...
                    </Typography>
                  )}
                </Stack>
              ) : (
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: "0.7rem",
                    color: "text.primary",
                    display: "block",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {actionDetails}
                </Typography>
              )}
            </Box>
          )}

          {!actionDetails && (
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
                Clique para configurar
              </Typography>
            </Box>
          )}
        </Box>

        <Handle
          type="target"
          position={Position.Left}
          style={{
            ...createTargetHandleStyle(config.color),
            top: "50%",
            left: -8,
          }}
        />

        <Handle
          type="source"
          position={Position.Right}
          style={{
            ...createSourceHandleStyle(config.color),
            top: "50%",
            right: -8,
          }}
        />

        <NodeDeleteButton nodeId={id} nodeType="action" />
      </Box>
    </Fade>
  );
});

ActionNode.displayName = "ActionNode";
