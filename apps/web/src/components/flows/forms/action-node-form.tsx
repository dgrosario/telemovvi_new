"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Stack,
  Divider,
  Typography,
  Autocomplete,
  Chip,
  RadioGroup,
  FormControlLabel,
  Radio,
  Paper,
  Box,
  ToggleButtonGroup,
  ToggleButton,
  IconButton,
  CircularProgress,
  Checkbox,
  Collapse,
  Tooltip,
} from "@mui/material";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import PersonIcon from "@mui/icons-material/Person";
import SaveIcon from "@mui/icons-material/Save";
import CloseIcon from "@mui/icons-material/Close";
import MessageIcon from "@mui/icons-material/Message";
import DescriptionIcon from "@mui/icons-material/Description";
import CallSplitIcon from "@mui/icons-material/CallSplit";
import PauseCircleIcon from "@mui/icons-material/PauseCircle";
import TextFieldsIcon from "@mui/icons-material/TextFields";
import AudioFileIcon from "@mui/icons-material/AudioFile";
import ImageIcon from "@mui/icons-material/Image";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DeleteIcon from "@mui/icons-material/Delete";
import InputIcon from "@mui/icons-material/Input";
import AddIcon from "@mui/icons-material/Add";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { useServerActionQuery } from "@/hooks/server-action-hooks";
import { listUsers } from "@/app/actions/users";
import { listChannels } from "@/app/actions/channels";
import { loadTemplatesApprovedFromChannel } from "@/app/actions/templates";
import { listSectors } from "@/app/actions/sectors";
import { LabelsSelector } from "@/components/labels-selector";
import { useFlowEditorStore } from "@/stores/flow-editor-store";
import { FlowVariableInserter } from "./flow-variable-inserter";
import { extractFlowVariables, type FlowVariable } from "@/lib/flow-variables";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const actionTypes = [
  "send_message",
  "send_template",
  "transfer",
  "tag_contact",
  "assign_conversation",
  "set_variable",
  "close_conversation",
  "pause_flow",
  "capture_input",
] as const;
type ActionType = (typeof actionTypes)[number];

const tagOperations = ["add", "remove"] as const;
type TagOperation = (typeof tagOperations)[number];

const messageTypes = ["text", "audio", "image", "document"] as const;
type MessageType = (typeof messageTypes)[number];

const pauseUnits = ["minutes", "hours", "days"] as const;
type PauseUnit = (typeof pauseUnits)[number];

const inputValidationTypes = [
  "text",
  "number",
  "email",
  "phone",
  "cpf",
  "cnpj",
  "cep",
  "date",
  "time",
  "options",
] as const;
type InputValidationType = (typeof inputValidationTypes)[number];

const contactFields = [
  "name",
  "email",
  "phone",
  "document",
  "address",
  "city",
  "state",
  "zipCode",
] as const;
type ContactField = (typeof contactFields)[number];

function isActionType(value: string): value is ActionType {
  return actionTypes.includes(value as ActionType);
}

function isTagOperation(value: string): value is TagOperation {
  return tagOperations.includes(value as TagOperation);
}

function isMessageType(value: string): value is MessageType {
  return messageTypes.includes(value as MessageType);
}

function isPauseUnit(value: string): value is PauseUnit {
  return pauseUnits.includes(value as PauseUnit);
}

function isInputValidationType(value: string): value is InputValidationType {
  return inputValidationTypes.includes(value as InputValidationType);
}

function isContactField(value: string): value is ContactField {
  return contactFields.includes(value as ContactField);
}

// Types for single action
interface SingleAction {
  id: string;
  actionType: ActionType;
  content?: string;
  messageType?: MessageType;
  mediaUrl?: string;
  mediaName?: string;
  mediaMimeType?: string;
  templateId?: string;
  channelId?: string;
  variableMapping?: Record<string, { source: "auto" | "manual"; value: string }>;
  sectorId?: string | null;
  sectorName?: string | null;
  tagOperation?: TagOperation;
  labelIds?: string[];
  attendantId?: string | null;
  attendantName?: string | null;
  variableName?: string;
  variableValue?: string;
  pauseDuration?: number;
  pauseUnit?: PauseUnit;
  question?: string;
  inputValidationType?: InputValidationType;
  inputOptions?: string[];
  errorMessage?: string;
  maxAttempts?: number;
  saveToContact?: boolean;
  contactField?: ContactField;
}

function sanitizeActionByContract(action: SingleAction): SingleAction {
  if (action.actionType === "transfer") {
    const { attendantId, attendantName, ...sanitizedAction } = action;
    return sanitizedAction;
  }

  if (action.actionType === "assign_conversation") {
    const { sectorId, sectorName, ...sanitizedAction } = action;
    return sanitizedAction;
  }

  return action;
}

const ACTION_TYPES = [
  { value: "send_message", label: "Enviar Mensagem", icon: MessageIcon, color: "#2563eb" },
  { value: "send_template", label: "Enviar Template", icon: DescriptionIcon, color: "#059669" },
  { value: "transfer", label: "Transferir Conversa", icon: CallSplitIcon, color: "#dc2626" },
  { value: "tag_contact", label: "Etiqueta no Contato", icon: LocalOfferIcon, color: "#8b5cf6" },
  { value: "assign_conversation", label: "Atribuir Conversa", icon: PersonIcon, color: "#3b82f6" },
  { value: "set_variable", label: "Definir Variável", icon: SaveIcon, color: "#10b981" },
  { value: "close_conversation", label: "Encerrar Conversa", icon: CloseIcon, color: "#ef4444" },
  { value: "pause_flow", label: "Pausar Atendimento", icon: PauseCircleIcon, color: "#f59e0b" },
  { value: "capture_input", label: "Capturar Entrada", icon: InputIcon, color: "#0891b2" },
];

const MESSAGE_TYPES = [
  { value: "text", label: "Texto", icon: TextFieldsIcon },
  { value: "audio", label: "Áudio", icon: AudioFileIcon },
  { value: "image", label: "Imagem", icon: ImageIcon },
  { value: "document", label: "Documento", icon: InsertDriveFileIcon },
];

const PAUSE_UNITS = [
  { value: "minutes", label: "Minutos" },
  { value: "hours", label: "Horas" },
  { value: "days", label: "Dias" },
];

const AUTO_VARIABLE_OPTIONS = [
  { value: "partner.name", label: "Nome do Contato" },
  { value: "user.message", label: "Mensagem do Usuário" },
];

const INPUT_VALIDATION_TYPES = [
  { value: "text", label: "Texto Livre" },
  { value: "number", label: "Número" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone" },
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "cep", label: "CEP" },
  { value: "date", label: "Data (DD/MM/AAAA)" },
  { value: "time", label: "Horário (HH:MM)" },
  { value: "options", label: "Opções Predefinidas" },
];

const CONTACT_FIELD_LABELS: Record<ContactField, string> = {
  name: "Nome",
  email: "E-mail",
  phone: "Telefone",
  document: "Documento (CPF/CNPJ)",
  address: "Endereço",
  city: "Cidade",
  state: "Estado",
  zipCode: "CEP",
};

function createDefaultAction(): SingleAction {
  return {
    id: crypto.randomUUID(),
    actionType: "send_message",
    messageType: "text",
    content: "",
    tagOperation: "add",
    labelIds: [],
    pauseDuration: 5,
    pauseUnit: "minutes",
    inputValidationType: "text",
    inputOptions: [],
    maxAttempts: 3,
    saveToContact: false,
  };
}

interface ActionNodeFormProps {
  nodeId: string;
  initialData?: {
    label?: string;
    actionType?: string;
    actions?: SingleAction[];
    content?: string;
    messageType?: string;
    mediaUrl?: string;
    mediaName?: string;
    mediaMimeType?: string;
    templateId?: string;
    channelId?: string;
    variableMapping?: Record<string, { source: "auto" | "manual"; value: string }>;
    sectorId?: string | null;
    sectorName?: string | null;
    tagOperation?: string;
    labelIds?: string[];
    attendantId?: string | null;
    attendantName?: string | null;
    variableName?: string;
    variableValue?: string;
    pauseDuration?: number;
    pauseUnit?: string;
    question?: string;
    inputValidationType?: string;
    inputOptions?: string[];
    errorMessage?: string;
    maxAttempts?: number;
    saveToContact?: boolean;
    contactField?: string;
  };
  onClose: () => void;
}


// Sortable Action Item Component
interface SortableActionItemProps {
  action: SingleAction;
  index: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (updates: Partial<SingleAction>) => void;
  onDelete: () => void;
  canDelete: boolean;
  users: any[];
  channels: any[];
  sectors: any[];
  flowVariables: FlowVariable[];
}

function SortableActionItem({
  action,
  index,
  isExpanded,
  onToggleExpand,
  onUpdate,
  onDelete,
  canDelete,
  users,
  channels,
  sectors,
  flowVariables,
}: SortableActionItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: action.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contentTextFieldRef = useRef<HTMLTextAreaElement>(null);
  const questionTextFieldRef = useRef<HTMLTextAreaElement>(null);

  const { data: channelTemplates } = useServerActionQuery(
    loadTemplatesApprovedFromChannel,
    {
      input: { channelId: action.channelId || "" },
      queryKey: ["templates", action.channelId],
      enabled: Boolean(action.channelId),
    }
  );

  useEffect(() => {
    if (channelTemplates) {
      setTemplates(channelTemplates);
      if (action.templateId) {
        const template = channelTemplates.find((t: any) => t.name === action.templateId);
        setSelectedTemplate(template);
      }
    }
  }, [channelTemplates, action.templateId]);

  const config = ACTION_TYPES.find((t) => t.value === action.actionType) || ACTION_TYPES[0];
  const Icon = config.icon;

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/flows/media", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Falha no upload");

      const data = await response.json();
      onUpdate({
        mediaUrl: data.url,
        mediaName: data.filename,
        mediaMimeType: data.mimeType,
      });
    } catch (error) {
      console.error("Upload error:", error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveMedia = () => {
    onUpdate({ mediaUrl: "", mediaName: "", mediaMimeType: "" });
  };

  const getAcceptedFileTypes = () => {
    switch (action.messageType) {
      case "audio": return "audio/*";
      case "image": return "image/*";
      case "document": return ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt";
      default: return "*/*";
    }
  };

  const handleInsertContentVariable = (variable: string) => {
    const textarea = contentTextFieldRef.current;
    if (!textarea) {
      onUpdate({ content: (action.content || "") + variable });
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentContent = action.content || "";
    const newContent = currentContent.substring(0, start) + variable + currentContent.substring(end);
    onUpdate({ content: newContent });
  };

  const handleInsertQuestionVariable = (variable: string) => {
    const textarea = questionTextFieldRef.current;
    if (!textarea) {
      onUpdate({ question: (action.question || "") + variable });
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentQuestion = action.question || "";
    const newQuestion = currentQuestion.substring(0, start) + variable + currentQuestion.substring(end);
    onUpdate({ question: newQuestion });
  };

  const handleChannelChange = (channelId: string) => {
    onUpdate({
      channelId,
      templateId: "",
      variableMapping: {},
    });
    setSelectedTemplate(null);
  };

  const handleVariableSourceChange = (variableName: string, source: "auto" | "manual") => {
    const currentMapping = action.variableMapping || {};
    onUpdate({
      variableMapping: {
        ...currentMapping,
        [variableName]: { source, value: source === "auto" ? "partner.name" : "" },
      },
    });
  };

  const handleVariableValueChange = (variableName: string, value: string) => {
    const currentMapping = action.variableMapping || {};
    const currentVar = currentMapping[variableName] || { source: "auto", value: "" };
    onUpdate({
      variableMapping: {
        ...currentMapping,
        [variableName]: { ...currentVar, value },
      },
    });
  };

  return (
    <Paper
      ref={setNodeRef}
      style={style}
      variant="outlined"
      sx={{
        mb: 1.5,
        overflow: "hidden",
        borderColor: isDragging ? "primary.main" : "divider",
        borderWidth: isDragging ? 2 : 1,
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: { xs: 0.5, sm: 1 },
          p: { xs: 1, sm: 1.5 },
          bgcolor: "grey.50",
          borderBottom: isExpanded ? "1px solid" : "none",
          borderColor: "divider",
          cursor: "pointer",
        }}
        onClick={onToggleExpand}
      >
        <Box
          {...attributes}
          {...listeners}
          sx={{
            cursor: "grab",
            display: "flex",
            alignItems: "center",
            color: "text.secondary",
            "&:hover": { color: "text.primary" },
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <DragIndicatorIcon fontSize="small" />
        </Box>

        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: 1,
            backgroundColor: config.color,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon sx={{ color: "white", fontSize: 16 }} />
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={500} noWrap>
            {index + 1}. {config.label}
          </Typography>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          {canDelete && (
            <Tooltip title="Remover ação">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                sx={{ color: "error.main" }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </Box>
      </Box>

      {/* Content */}
      <Collapse in={isExpanded}>
        <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
          <Stack spacing={2}>
            {/* Action Type Selector */}
            <FormControl fullWidth size="small">
              <InputLabel>Tipo de Ação</InputLabel>
              <Select
                value={action.actionType}
                onChange={(e) => {
                  const value = e.target.value;
                  if (isActionType(value)) {
                    onUpdate({ actionType: value });
                  }
                }}
                label="Tipo de Ação"
                renderValue={(value) => {
                  const cfg = ACTION_TYPES.find((t) => t.value === value);
                  if (!cfg) return value;
                  const TypeIcon = cfg.icon;
                  return (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <TypeIcon sx={{ color: cfg.color, fontSize: 18 }} />
                      {cfg.label}
                    </Box>
                  );
                }}
              >
                {ACTION_TYPES.map((type) => {
                  const TypeIcon = type.icon;
                  return (
                    <MenuItem key={type.value} value={type.value}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Box
                          sx={{
                            width: 28,
                            height: 28,
                            borderRadius: 1,
                            backgroundColor: type.color,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <TypeIcon sx={{ color: "white", fontSize: 16 }} />
                        </Box>
                        {type.label}
                      </Box>
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>

            <Divider />

            {/* Send Message */}
            {action.actionType === "send_message" && (
              <Stack spacing={2}>
                <ToggleButtonGroup
                  value={action.messageType}
                  exclusive
                  onChange={(_, value) => {
                    if (value && isMessageType(value)) {
                      onUpdate({ messageType: value });
                      if (value !== "text") handleRemoveMedia();
                    }
                  }}
                  size="small"
                  fullWidth
                >
                  {MESSAGE_TYPES.map((type) => {
                    const MsgIcon = type.icon;
                    return (
                      <ToggleButton key={type.value} value={type.value}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                          <MsgIcon fontSize="small" />
                          {type.label}
                        </Box>
                      </ToggleButton>
                    );
                  })}
                </ToggleButtonGroup>

                {action.messageType === "text" && (
                  <Box>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">Conteúdo</Typography>
                      <FlowVariableInserter flowVariables={flowVariables} onInsert={handleInsertContentVariable} />
                    </Box>
                    <TextField
                      fullWidth
                      multiline
                      rows={4}
                      size="small"
                      value={action.content}
                      onChange={(e) => onUpdate({ content: e.target.value })}
                      inputRef={contentTextFieldRef}
                      placeholder="Digite sua mensagem..."
                    />
                  </Box>
                )}

                {action.messageType !== "text" && (
                  <Box>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept={getAcceptedFileTypes()}
                      style={{ display: "none" }}
                    />
                    {!action.mediaUrl ? (
                      <Paper
                        variant="outlined"
                        sx={{
                          p: 2,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 1,
                          cursor: isUploading ? "default" : "pointer",
                          "&:hover": { backgroundColor: isUploading ? "inherit" : "action.hover" },
                        }}
                        onClick={() => !isUploading && fileInputRef.current?.click()}
                      >
                        {isUploading ? (
                          <CircularProgress size={24} />
                        ) : (
                          <>
                            <CloudUploadIcon sx={{ fontSize: 32, color: "text.secondary" }} />
                            <Typography variant="caption" color="text.secondary">
                              Clique para selecionar
                            </Typography>
                          </>
                        )}
                      </Paper>
                    ) : (
                      <Paper variant="outlined" sx={{ p: 1.5 }}>
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            {action.messageType === "audio" && <AudioFileIcon color="primary" fontSize="small" />}
                            {action.messageType === "image" && <ImageIcon color="primary" fontSize="small" />}
                            {action.messageType === "document" && <InsertDriveFileIcon color="primary" fontSize="small" />}
                            <Typography variant="caption">{action.mediaName}</Typography>
                          </Box>
                          <IconButton size="small" onClick={handleRemoveMedia} color="error">
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </Paper>
                    )}
                  </Box>
                )}
              </Stack>
            )}

            {/* Send Template */}
            {action.actionType === "send_template" && (
              <Stack spacing={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Canal</InputLabel>
                  <Select
                    value={action.channelId || ""}
                    onChange={(e) => handleChannelChange(e.target.value)}
                    label="Canal"
                  >
                    <MenuItem value=""><em>Selecione</em></MenuItem>
                    {channels?.map((channel: any) => (
                      <MenuItem key={channel.id} value={channel.id}>{channel.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {action.channelId && (
                  <FormControl fullWidth size="small">
                    <InputLabel>Template</InputLabel>
                    <Select
                      value={action.templateId || ""}
                      onChange={(e) => {
                        onUpdate({ templateId: e.target.value });
                        const template = templates.find((t) => t.name === e.target.value);
                        setSelectedTemplate(template);
                      }}
                      label="Template"
                    >
                      <MenuItem value=""><em>Selecione</em></MenuItem>
                      {templates?.map((template: any) => (
                        <MenuItem key={template.name} value={template.name}>{template.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}

                {selectedTemplate?.variables?.length > 0 && (
                  <>
                    <Typography variant="caption" fontWeight={500}>Variáveis do Template</Typography>
                    {selectedTemplate.variables.map((variable: any) => {
                      const mapping = action.variableMapping?.[variable.name] || { source: "auto", value: "partner.name" };
                      return (
                        <Paper key={variable.name} sx={{ p: 1.5 }} variant="outlined">
                          <Typography variant="caption" fontWeight={500}>{variable.name}</Typography>
                          <ToggleButtonGroup
                            value={mapping.source}
                            exclusive
                            onChange={(_, value) => value && handleVariableSourceChange(variable.name, value)}
                            size="small"
                            fullWidth
                            sx={{ my: 1 }}
                          >
                            <ToggleButton value="auto">Auto</ToggleButton>
                            <ToggleButton value="manual">Manual</ToggleButton>
                          </ToggleButtonGroup>
                          {mapping.source === "auto" ? (
                            <FormControl fullWidth size="small">
                              <Select
                                value={mapping.value}
                                onChange={(e) => handleVariableValueChange(variable.name, e.target.value)}
                              >
                                {AUTO_VARIABLE_OPTIONS.map((opt) => (
                                  <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          ) : (
                            <TextField
                              fullWidth
                              size="small"
                              value={mapping.value}
                              onChange={(e) => handleVariableValueChange(variable.name, e.target.value)}
                            />
                          )}
                        </Paper>
                      );
                    })}
                  </>
                )}
              </Stack>
            )}

            {/* Transfer */}
            {action.actionType === "transfer" && (
              <FormControl fullWidth size="small">
                <InputLabel>Setor</InputLabel>
                <Select
                  value={action.sectorId || ""}
                  onChange={(e) => {
                    const selectedId = e.target.value || null;
                    const selectedSector = sectors?.find((s: any) => s.id === selectedId);
                    onUpdate({ sectorId: selectedId, sectorName: selectedSector?.name || null });
                  }}
                  label="Setor"
                >
                  <MenuItem value=""><em>Qualquer setor</em></MenuItem>
                  {sectors?.map((sector: any) => (
                    <MenuItem key={sector.id} value={sector.id}>{sector.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {/* Tag Contact */}
            {action.actionType === "tag_contact" && (
              <Stack spacing={2}>
                <RadioGroup
                  row
                  value={action.tagOperation}
                  onChange={(e) => {
                    if (isTagOperation(e.target.value)) {
                      onUpdate({ tagOperation: e.target.value as TagOperation });
                    }
                  }}
                >
                  <FormControlLabel value="add" control={<Radio size="small" />} label="Adicionar" />
                  <FormControlLabel value="remove" control={<Radio size="small" />} label="Remover" />
                </RadioGroup>
                <LabelsSelector
                  value={action.labelIds || []}
                  onChange={(labelIds) => onUpdate({ labelIds })}
                  label="Etiquetas"
                  placeholder="Selecione as etiquetas"
                />
              </Stack>
            )}

            {/* Assign Conversation */}
            {action.actionType === "assign_conversation" && (
              <FormControl fullWidth size="small">
                <InputLabel>Atendente</InputLabel>
                <Select
                  value={action.attendantId || ""}
                  onChange={(e) => {
                    const selectedId = e.target.value || null;
                    const selectedUser = users?.find((u: any) => u.id === selectedId);
                    onUpdate({ attendantId: selectedId, attendantName: selectedUser?.name || null });
                  }}
                  label="Atendente"
                >
                  <MenuItem value=""><em>Selecione</em></MenuItem>
                  {users?.map((user: any) => (
                    <MenuItem key={user.id} value={user.id}>{user.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {/* Set Variable */}
            {action.actionType === "set_variable" && (
              <Stack spacing={2}>
                <TextField
                  label="Nome da Variável"
                  fullWidth
                  size="small"
                  value={action.variableName || ""}
                  onChange={(e) => onUpdate({ variableName: e.target.value })}
                  placeholder="Ex: cliente_tipo"
                />
                <TextField
                  label="Valor"
                  fullWidth
                  size="small"
                  value={action.variableValue || ""}
                  onChange={(e) => onUpdate({ variableValue: e.target.value })}
                  placeholder="Ex: premium"
                />
              </Stack>
            )}

            {/* Close Conversation */}
            {action.actionType === "close_conversation" && (
              <Paper sx={{ p: 1.5, bgcolor: "warning.lighter" }}>
                <Typography variant="caption" color="text.secondary">
                  Esta ação encerra a conversa automaticamente.
                </Typography>
              </Paper>
            )}

            {/* Pause Flow */}
            {action.actionType === "pause_flow" && (
              <Stack direction="row" spacing={2}>
                <TextField
                  type="number"
                  label="Duração"
                  size="small"
                  value={action.pauseDuration || 5}
                  onChange={(e) => onUpdate({ pauseDuration: Math.max(1, parseInt(e.target.value) || 1) })}
                  slotProps={{ htmlInput: { min: 1 } }}
                  sx={{ flex: 1 }}
                />
                <FormControl sx={{ flex: 1 }} size="small">
                  <InputLabel>Unidade</InputLabel>
                  <Select
                    value={action.pauseUnit || "minutes"}
                    onChange={(e) => {
                      if (isPauseUnit(e.target.value)) {
                        onUpdate({ pauseUnit: e.target.value as PauseUnit });
                      }
                    }}
                    label="Unidade"
                  >
                    {PAUSE_UNITS.map((unit) => (
                      <MenuItem key={unit.value} value={unit.value}>{unit.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
            )}

            {/* Capture Input */}
            {action.actionType === "capture_input" && (
              <Stack spacing={2}>
                <Box sx={{ position: "relative" }}>
                  <TextField
                    label="Pergunta"
                    fullWidth
                    multiline
                    rows={2}
                    size="small"
                    value={action.question || ""}
                    onChange={(e) => onUpdate({ question: e.target.value })}
                    placeholder="Ex: Qual é seu nome?"
                    inputRef={questionTextFieldRef}
                    required
                  />
                  <Box sx={{ position: "absolute", right: 8, top: 8 }}>
                    <FlowVariableInserter flowVariables={flowVariables} onInsert={handleInsertQuestionVariable} />
                  </Box>
                </Box>

                <TextField
                  label="Nome da Variável"
                  fullWidth
                  size="small"
                  value={action.variableName || ""}
                  onChange={(e) => onUpdate({ variableName: e.target.value.replace(/\s/g, "_").toLowerCase() })}
                  placeholder="Ex: nome_cliente"
                  required
                />

                <FormControl fullWidth size="small">
                  <InputLabel>Validação</InputLabel>
                  <Select
                    value={action.inputValidationType || "text"}
                    onChange={(e) => {
                      if (isInputValidationType(e.target.value)) {
                        onUpdate({
                          inputValidationType: e.target.value as InputValidationType,
                          inputOptions: e.target.value !== "options" ? [] : action.inputOptions,
                        });
                      }
                    }}
                    label="Validação"
                  >
                    {INPUT_VALIDATION_TYPES.map((type) => (
                      <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {action.inputValidationType === "options" && (
                  <Autocomplete
                    multiple
                    freeSolo
                    size="small"
                    options={[]}
                    value={action.inputOptions || []}
                    onChange={(_, newValue) => onUpdate({ inputOptions: newValue })}
                    renderTags={(value, getTagProps) =>
                      value.map((option, idx) => {
                        const { key, ...tagProps } = getTagProps({ index: idx });
                        return <Chip variant="outlined" label={option} size="small" key={key} {...tagProps} />;
                      })
                    }
                    renderInput={(params) => (
                      <TextField {...params} label="Opções" placeholder="Digite e Enter" />
                    )}
                  />
                )}

                <TextField
                  label="Mensagem de Erro"
                  fullWidth
                  size="small"
                  value={action.errorMessage || ""}
                  onChange={(e) => onUpdate({ errorMessage: e.target.value })}
                  placeholder="Formato inválido..."
                />

                <TextField
                  type="number"
                  label="Tentativas Máximas"
                  fullWidth
                  size="small"
                  value={action.maxAttempts || 3}
                  onChange={(e) => onUpdate({ maxAttempts: Math.min(10, Math.max(1, parseInt(e.target.value) || 1)) })}
                  slotProps={{ htmlInput: { min: 1, max: 10 } }}
                />

                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={action.saveToContact || false}
                      onChange={(e) => onUpdate({ saveToContact: e.target.checked })}
                    />
                  }
                  label={<Typography variant="body2">Salvar no perfil do contato</Typography>}
                />

                {action.saveToContact && (
                  <FormControl fullWidth size="small">
                    <InputLabel>Salvar em</InputLabel>
                    <Select
                      value={action.contactField || ""}
                      onChange={(e) => {
                        if (isContactField(e.target.value)) {
                          onUpdate({ contactField: e.target.value as ContactField });
                        }
                      }}
                      label="Salvar em"
                    >
                      {contactFields.map((field) => (
                        <MenuItem key={field} value={field}>{CONTACT_FIELD_LABELS[field]}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </Stack>
            )}
          </Stack>
        </Box>
      </Collapse>
    </Paper>
  );
}


// Main Form Component
export function ActionNodeForm({
  nodeId,
  initialData,
  onClose,
}: ActionNodeFormProps) {
  const updateNodeData = useFlowEditorStore((s) => s.updateNodeData);
  const nodes = useFlowEditorStore((s) => s.nodes);
  const flowVariables = extractFlowVariables(nodes);

  // Convert legacy single action to array format
  const getInitialActions = useCallback((): SingleAction[] => {
    // If already has actions array, use it
    if (initialData?.actions && initialData.actions.length > 0) {
      return initialData.actions.map(sanitizeActionByContract);
    }

    // Convert legacy single action format
    if (initialData?.actionType) {
      return [sanitizeActionByContract({
        id: crypto.randomUUID(),
        actionType: (initialData.actionType as ActionType) || "send_message",
        content: initialData.content,
        messageType: (initialData.messageType as MessageType) || "text",
        mediaUrl: initialData.mediaUrl,
        mediaName: initialData.mediaName,
        mediaMimeType: initialData.mediaMimeType,
        templateId: initialData.templateId,
        channelId: initialData.channelId,
        variableMapping: initialData.variableMapping,
        sectorId: initialData.sectorId,
        sectorName: initialData.sectorName,
        tagOperation: (initialData.tagOperation as TagOperation) || "add",
        labelIds: initialData.labelIds,
        attendantId: initialData.attendantId,
        attendantName: initialData.attendantName,
        variableName: initialData.variableName,
        variableValue: initialData.variableValue,
        pauseDuration: initialData.pauseDuration,
        pauseUnit: (initialData.pauseUnit as PauseUnit) || "minutes",
        question: initialData.question,
        inputValidationType: (initialData.inputValidationType as InputValidationType) || "text",
        inputOptions: initialData.inputOptions,
        errorMessage: initialData.errorMessage,
        maxAttempts: initialData.maxAttempts,
        saveToContact: initialData.saveToContact,
        contactField: initialData.contactField as ContactField | undefined,
      })];
    }

    // Default: create one empty action
    return [createDefaultAction()];
  }, [initialData]);

  const [actions, setActions] = useState<SingleAction[]>(getInitialActions);
  const [expandedActionId, setExpandedActionId] = useState<string | null>(
    actions[0]?.id || null
  );

  const { data: users = [] } = useServerActionQuery(listUsers, {
    input: undefined,
    queryKey: ["users-list"],
  });

  const { data: channels = [] } = useServerActionQuery(listChannels, {
    input: { type: "whatsapp" },
    queryKey: ["channels", "whatsapp"],
  });

  const { data: sectors = [] } = useServerActionQuery(listSectors, {
    input: undefined,
    queryKey: ["sectors"],
  });

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setActions((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleAddAction = () => {
    const newAction = createDefaultAction();
    setActions((prev) => [...prev, newAction]);
    setExpandedActionId(newAction.id);
  };

  const handleUpdateAction = (actionId: string, updates: Partial<SingleAction>) => {
    setActions((prev) =>
      prev.map((action) =>
        action.id === actionId ? sanitizeActionByContract({ ...action, ...updates }) : action
      )
    );
  };

  const handleDeleteAction = (actionId: string) => {
    setActions((prev) => {
      const newActions = prev.filter((action) => action.id !== actionId);
      // If we deleted the expanded action, expand the first one
      if (expandedActionId === actionId && newActions.length > 0) {
        setExpandedActionId(newActions[0].id);
      }
      return newActions;
    });
  };

  const handleSave = () => {
    const sanitizedActions = actions.map(sanitizeActionByContract);

    // For backward compatibility, if there's only one action, save in legacy format too
    const firstAction = sanitizedActions[0];
    
    const nodeData = {
      // New format: array of actions
      actions: sanitizedActions,
      // Legacy format for backward compatibility (uses first action)
      actionType: firstAction?.actionType,
      content: firstAction?.content,
      messageType: firstAction?.messageType,
      mediaUrl: firstAction?.mediaUrl,
      mediaName: firstAction?.mediaName,
      mediaMimeType: firstAction?.mediaMimeType,
      templateId: firstAction?.templateId,
      channelId: firstAction?.channelId,
      variableMapping: firstAction?.variableMapping,
      sectorId: firstAction?.sectorId,
      sectorName: firstAction?.sectorName,
      tagOperation: firstAction?.tagOperation,
      labelIds: firstAction?.labelIds,
      attendantId: firstAction?.attendantId,
      attendantName: firstAction?.attendantName,
      variableName: firstAction?.variableName,
      variableValue: firstAction?.variableValue,
      pauseDuration: firstAction?.pauseDuration,
      pauseUnit: firstAction?.pauseUnit,
      question: firstAction?.question,
      inputValidationType: firstAction?.inputValidationType,
      inputOptions: firstAction?.inputOptions,
      errorMessage: firstAction?.errorMessage,
      maxAttempts: firstAction?.maxAttempts,
      saveToContact: firstAction?.saveToContact,
      contactField: firstAction?.contactField,
    };

    updateNodeData(nodeId, nodeData);
    onClose();
  };

  return (
    <Stack spacing={2} onClick={(e) => e.stopPropagation()}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="subtitle2" color="text.secondary">
          {actions.length} {actions.length === 1 ? "ação" : "ações"} configurada{actions.length !== 1 ? "s" : ""}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Arraste para reordenar
        </Typography>
      </Box>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={actions.map((a) => a.id)}
          strategy={verticalListSortingStrategy}
        >
          {actions.map((action, index) => (
            <SortableActionItem
              key={action.id}
              action={action}
              index={index}
              isExpanded={expandedActionId === action.id}
              onToggleExpand={() =>
                setExpandedActionId(expandedActionId === action.id ? null : action.id)
              }
              onUpdate={(updates) => handleUpdateAction(action.id, updates)}
              onDelete={() => handleDeleteAction(action.id)}
              canDelete={actions.length > 1}
              users={users}
              channels={channels}
              sectors={sectors}
              flowVariables={flowVariables}
            />
          ))}
        </SortableContext>
      </DndContext>

      <Button
        variant="outlined"
        startIcon={<AddIcon />}
        onClick={handleAddAction}
        fullWidth
        sx={{ borderStyle: "dashed" }}
      >
        Adicionar Ação
      </Button>

      <Divider />

      <Button onClick={handleSave} variant="contained" fullWidth>
        Salvar Alterações
      </Button>
    </Stack>
  );
}
