"use client";

import {
  Button,
  TextField,
  IconButton,
  Box,
  Typography,
  Paper,
  Stack,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tooltip,
  Chip,
  FormControlLabel,
  Checkbox,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SmartButtonIcon from "@mui/icons-material/SmartButton";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import TextFieldsIcon from "@mui/icons-material/TextFields";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import { useState, useEffect, useMemo } from "react";
import { useShallow } from "zustand/shallow";
import { useFlowEditorStore } from "@/stores/flow-editor-store";
import { z } from "zod";

type MenuDisplayMode = "auto" | "text" | "buttons" | "list";

const menuOptionSchema = z.object({
  id: z.string(),
  label: z.string().min(1, "Texto é obrigatório"),
  value: z.string().min(1, "Valor é obrigatório"),
  description: z.string().optional(),
});

const menuNodeSchema = z.object({
  content: z.string().min(1, "Conteúdo é obrigatório"),
  header: z.string().optional(),
  footer: z.string().optional(),
  buttonText: z.string().optional(),
  displayMode: z.enum(["auto", "text", "buttons", "list"]).optional(),
  options: z.array(menuOptionSchema).min(1, "Adicione pelo menos uma opção"),
  errorBranch: z
    .object({
      enabled: z.boolean(),
      maxAttempts: z.number().min(1).max(10),
    })
    .optional(),
});

type MenuOption = z.infer<typeof menuOptionSchema>;
type DisplayMode = MenuDisplayMode;

interface MenuNodeFormProps {
  nodeId: string;
  initialData?: {
    label?: string;
    content?: string;
    header?: string;
    footer?: string;
    buttonText?: string;
    displayMode?: DisplayMode;
    options?: MenuOption[];
    errorBranch?: {
      enabled: boolean;
      maxAttempts: number;
    };
  };
  onClose: () => void;
}

export function MenuNodeForm({
  nodeId,
  initialData,
  onClose,
}: MenuNodeFormProps) {
  const updateNodeDataAndCleanup = useFlowEditorStore((s) => s.updateNodeDataAndCleanup);
  const currentNode = useFlowEditorStore(
    useShallow((s) => s.nodes.find((n) => n.id === nodeId))
  );
  const nodeEdges = useFlowEditorStore(
    useShallow((s) => s.edges.filter((e) => e.source === nodeId))
  );

  const [content, setContent] = useState(() => initialData?.content || "");
  const [header, setHeader] = useState(() => initialData?.header || "");
  const [footer, setFooter] = useState(() => initialData?.footer || "");
  const [buttonText, setButtonText] = useState(() => initialData?.buttonText || "Ver opções");
  const [displayMode, setDisplayMode] = useState<DisplayMode>(
    () => initialData?.displayMode || "auto"
  );
  const [options, setOptions] = useState<MenuOption[]>(
    () => initialData?.options || []
  );
  const [errorBranch, setErrorBranch] = useState<{
    enabled: boolean;
    maxAttempts: number;
  }>({
    enabled: initialData?.errorBranch?.enabled || false,
    maxAttempts: initialData?.errorBranch?.maxAttempts || 3,
  });
  const [errors, setErrors] = useState<{
    content?: string;
    options?: string;
  }>({});
  const [willLoseConnections, setWillLoseConnections] = useState<string[]>([]);

  const effectiveDisplayMode = useMemo((): "text" | "buttons" | "list" => {
    if (displayMode !== "auto") return displayMode;
    const count = options.length;
    if (count <= 3) return "buttons";
    if (count <= 10) return "list";
    return "text";
  }, [displayMode, options.length]);

  const showDescription = true; // Sempre mostrar campo de descrição

  useEffect(() => {
    if (!currentNode) return;

    const currentOptions = (currentNode.data?.options as MenuOption[]) || [];
    const currentOptionIds = new Set(currentOptions.map((o) => o.id));
    const newOptionIds = new Set(options.map((o) => o.id));

    const removedOptionIds = Array.from(currentOptionIds).filter(
      (id) => !newOptionIds.has(id)
    );

    const edgesToLose = nodeEdges
      .filter(
        (e) =>
          e.sourceHandle &&
          removedOptionIds.includes(e.sourceHandle)
      )
      .map((e) => {
        const option = currentOptions.find((o) => o.id === e.sourceHandle);
        return option?.label || e.sourceHandle || "";
      })
      .filter((label): label is string => Boolean(label));

    setWillLoseConnections((prev) => {
      const prevStr = JSON.stringify(prev);
      const nextStr = JSON.stringify(edgesToLose);
      return prevStr === nextStr ? prev : edgesToLose;
    });
  }, [options, currentNode, nodeEdges]);

  const handleAddOption = () => {
    const index = options.length + 1;
    const newOption: MenuOption = {
      id: crypto.randomUUID(),
      label: `Opção ${index}`,
      value: String(index),
      description: "",
    };
    setOptions([...options, newOption]);
  };

  const handleRemoveOption = (optionId: string) => {
    const edgesToLose = nodeEdges.filter(
      (e) => e.sourceHandle === optionId
    );

    if (edgesToLose.length > 0) {
      const confirmMessage = `Remover esta opção irá desconectar ${edgesToLose.length} conexão(ões). Deseja continuar?`;
      if (!window.confirm(confirmMessage)) {
        return;
      }
    }

    setOptions(options.filter((opt) => opt.id !== optionId));
  };

  const handleUpdateOption = (
    optionId: string,
    field: "label" | "value" | "description",
    value: string
  ) => {
    setOptions(
      options.map((opt) =>
        opt.id === optionId ? { ...opt, [field]: value } : opt
      )
    );
  };

  const handleMoveOption = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= options.length) return;

    const newOptions = [...options];
    const [removed] = newOptions.splice(index, 1);
    newOptions.splice(newIndex, 0, removed);
    setOptions(newOptions);
  };

  const handleSave = () => {
    const validation = menuNodeSchema.safeParse({
      content,
      header: header || undefined,
      footer: footer || undefined,
      buttonText: buttonText || undefined,
      displayMode,
      options,
      errorBranch: errorBranch.enabled ? errorBranch : undefined,
    });

    if (validation.success) {
      updateNodeDataAndCleanup(nodeId, validation.data);
      onClose();
    } else {
      const newErrors: typeof errors = {};
      validation.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof typeof errors;
        if (!newErrors[field]) {
          newErrors[field] = issue.message;
        }
      });
      setErrors(newErrors);
    }
  };

  const getDisplayModeIcon = () => {
    switch (effectiveDisplayMode) {
      case "buttons":
        return <SmartButtonIcon fontSize="small" />;
      case "list":
        return <FormatListBulletedIcon fontSize="small" />;
      default:
        return <TextFieldsIcon fontSize="small" />;
    }
  };

  const getDisplayModeLabel = () => {
    switch (effectiveDisplayMode) {
      case "buttons":
        return "Botões";
      case "list":
        return "Lista";
      default:
        return "Texto";
    }
  };

  return (
    <div className="flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
      <Stack direction="row" justifyContent="flex-end" alignItems="center">
        <Tooltip title={`Será exibido como: ${getDisplayModeLabel()}`}>
          <Chip
            icon={getDisplayModeIcon()}
            label={getDisplayModeLabel()}
            size="small"
            variant="outlined"
            color={effectiveDisplayMode === "text" ? "default" : "primary"}
          />
        </Tooltip>
      </Stack>

      <TextField
        label="Mensagem do menu"
        fullWidth
        multiline
        rows={3}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        error={Boolean(errors.content)}
        helperText={errors.content}
      />

      <Box sx={{ mt: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="subtitle2">
            Opções do menu ({options.length})
          </Typography>
          {options.length > 10 && (
            <Typography variant="caption" color="warning.main">
              Máximo de 10 opções para listas interativas
            </Typography>
          )}
        </Stack>

        {willLoseConnections.length > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Ao salvar, {willLoseConnections.length} conexão(ões) será(ão) removida(s):{" "}
            {willLoseConnections.join(", ")}
          </Alert>
        )}

        {options.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Nenhuma opção adicionada
          </Typography>
        )}

        <Stack spacing={2}>
          {options.map((option, index) => {
            const connectedEdges = nodeEdges.filter(
              (e) => e.sourceHandle === option.id
            );
            const hasConnections = connectedEdges.length > 0;

            return (
              <Paper
                key={option.id}
                variant="outlined"
                sx={{
                  p: 2,
                  borderColor: hasConnections ? "warning.main" : "divider",
                  backgroundColor: hasConnections ? "warning.50" : "transparent",
                }}
              >
                <Stack spacing={2}>
                  <Stack direction="row" justifyContent="space-between" alignItems="start">
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Stack direction="column" spacing={0}>
                        <IconButton
                          size="small"
                          onClick={() => handleMoveOption(index, "up")}
                          disabled={index === 0}
                          sx={{ p: 0.25 }}
                        >
                          <ArrowUpwardIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleMoveOption(index, "down")}
                          disabled={index === options.length - 1}
                          sx={{ p: 0.25 }}
                        >
                          <ArrowDownwardIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Stack>
                      <Stack>
                        <Typography variant="body2" fontWeight="medium">
                          Opção {index + 1}
                        </Typography>
                        {hasConnections && (
                          <Typography variant="caption" color="warning.main">
                            {connectedEdges.length} conexão(ões) conectada(s)
                          </Typography>
                        )}
                      </Stack>
                    </Stack>
                    <IconButton
                      color="error"
                      onClick={() => handleRemoveOption(option.id)}
                      size="small"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>

                  <Stack direction="row" spacing={1}>
                    <TextField
                      label="Texto"
                      size="small"
                      value={option.label}
                      onChange={(e) => handleUpdateOption(option.id, "label", e.target.value)}
                      sx={{ flex: 1 }}
                      inputProps={{ maxLength: 20 }}
                      helperText={`${option.label.length}/20`}
                    />
                    <TextField
                      label="Valor"
                      size="small"
                      value={option.value}
                      onChange={(e) => handleUpdateOption(option.id, "value", e.target.value)}
                      sx={{ flex: 1 }}
                    />
                  </Stack>

                  {showDescription && (
                    <TextField
                      label="Descrição (opcional, aparece na lista)"
                      size="small"
                      value={option.description || ""}
                      onChange={(e) => handleUpdateOption(option.id, "description", e.target.value)}
                      fullWidth
                      inputProps={{ maxLength: 72 }}
                      helperText={`${(option.description || "").length}/72`}
                    />
                  )}
                </Stack>
              </Paper>
            );
          })}
        </Stack>

        {errors.options && (
          <Typography variant="caption" color="error" sx={{ mt: 1, display: "block" }}>
            {errors.options}
          </Typography>
        )}
      </Box>

      <Button
        startIcon={<AddIcon />}
        onClick={handleAddOption}
        variant="outlined"
        size="small"
      >
        Adicionar opção
      </Button>

      <Accordion sx={{ mt: 1 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="body2">Configurações Avançadas</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Modo de exibição</InputLabel>
              <Select
                value={displayMode}
                label="Modo de exibição"
                onChange={(e) => setDisplayMode(e.target.value as DisplayMode)}
              >
                <MenuItem value="auto">
                  Automático (botões se 1-3, lista se 4-10, texto se mais de 10)
                </MenuItem>
                <MenuItem value="text">Texto simples</MenuItem>
                <MenuItem value="buttons">Botões interativos (máx 3)</MenuItem>
                <MenuItem value="list">Lista interativa (máx 10)</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Cabeçalho (opcional)"
              size="small"
              value={header}
              onChange={(e) => setHeader(e.target.value)}
              fullWidth
              helperText="Aparece em destaque no topo da mensagem"
            />

            <TextField
              label="Rodapé (opcional)"
              size="small"
              value={footer}
              onChange={(e) => setFooter(e.target.value)}
              fullWidth
              helperText="Texto pequeno no final da mensagem (somente para listas)"
            />

            <TextField
              label="Texto do botão de lista"
              size="small"
              value={buttonText}
              onChange={(e) => setButtonText(e.target.value)}
              fullWidth
              helperText="Texto do botão que abre a lista (padrão: Ver opções)"
            />
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Accordion sx={{ mt: 1 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="body2">Saída de Erro</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={errorBranch.enabled}
                  onChange={(e) => {
                    const enabled = e.target.checked;

                    if (!enabled) {
                      // Verificar se há conexão de erro
                      const errorEdge = nodeEdges.find((e) => e.sourceHandle === "error");
                      if (errorEdge) {
                        if (
                          window.confirm(
                            "Remover esta saída irá desconectar 1 conexão. Deseja continuar?"
                          )
                        ) {
                          setErrorBranch({ enabled, maxAttempts: errorBranch.maxAttempts });
                        }
                      } else {
                        setErrorBranch({ enabled, maxAttempts: errorBranch.maxAttempts });
                      }
                    } else {
                      setErrorBranch({ enabled, maxAttempts: errorBranch.maxAttempts });
                    }
                  }}
                />
              }
              label="Habilitar saída para opções inválidas"
            />

            {errorBranch.enabled && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
                  Número máximo de tentativas
                </Typography>
                <TextField
                  type="number"
                  size="small"
                  fullWidth
                  value={errorBranch.maxAttempts}
                  onChange={(e) => {
                    const value = parseInt(e.target.value, 10);
                    if (value >= 1 && value <= 10) {
                      setErrorBranch({ ...errorBranch, maxAttempts: value });
                    }
                  }}
                  inputProps={{ min: 1, max: 10 }}
                  helperText="Após exceder, segue para o bloco conectado na saída de erro"
                />
              </Box>
            )}
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Button onClick={handleSave} variant="contained" fullWidth>
        Salvar Alterações
      </Button>
    </div>
  );
}
