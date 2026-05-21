"use client";

import { useState, useEffect } from "react";
import {
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  ToggleButtonGroup,
  ToggleButton,
  Paper,
  Typography,
  Box,
  Divider,
} from "@mui/material";
import { useFormState } from "@/hooks/use-form-state";
import { useServerActionQuery } from "@/hooks/server-action-hooks";
import { listChannels } from "@/app/actions/channels";
import { loadTemplatesApprovedFromChannel } from "@/app/actions/templates";
import { useFlowEditorStore } from "@/stores/flow-editor-store";
import { z } from "zod";

const templateNodeSchema = z.object({
  templateId: z.string().min(1, "Template é obrigatório"),
  channelId: z.string().min(1, "Canal é obrigatório"),
  variableMapping: z.record(
    z.object({
      source: z.enum(["auto", "manual"]),
      value: z.string(),
    })
  ),
});

interface TemplateNodeFormProps {
  nodeId: string;
  initialData?: {
    label?: string;
    templateId?: string;
    channelId?: string;
    variableMapping?: Record<
      string,
      {
        source: "auto" | "manual";
        value: string;
      }
    >;
  };
  onClose: () => void;
}

// Available auto-resolution options
const AUTO_VARIABLE_OPTIONS = [
  { value: "partner.name", label: "Nome do Contato" },
  { value: "user.message", label: "Mensagem do Usuário" },
];

export function TemplateNodeForm({
  nodeId,
  initialData,
  onClose,
}: TemplateNodeFormProps) {
  const updateNodeData = useFlowEditorStore((s) => s.updateNodeData);

  const [selectedChannel, setSelectedChannel] = useState<string>(
    initialData?.channelId || ""
  );
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);

  const { form, setField, errors, validateAll } = useFormState(
    templateNodeSchema,
    {
      templateId: initialData?.templateId || "",
      channelId: initialData?.channelId || "",
      variableMapping: initialData?.variableMapping || {},
    }
  );

  // Load channels
  const { data: channels } = useServerActionQuery(listChannels, {
    input: { type: "whatsapp" },
    queryKey: ["channels", "whatsapp"],
  });

  // Load templates when channel is selected
  const { data: templates } = useServerActionQuery(
    loadTemplatesApprovedFromChannel,
    {
      input: { channelId: selectedChannel },
      queryKey: ["templates", selectedChannel],
      enabled: Boolean(selectedChannel),
    }
  );

  // Find selected template details
  useEffect(() => {
    if (templates && form.templateId) {
      const template = templates.find((t) => t.name === form.templateId);
      setSelectedTemplate(template);

      // Initialize variable mapping with auto defaults if not set
      if (template && (!form.variableMapping || Object.keys(form.variableMapping).length === 0)) {
        const defaultMapping: Record<string, { source: "auto" | "manual"; value: string }> = {};
        (template.variables ?? []).forEach((variable: any) => {
          defaultMapping[variable.name] = {
            source: "auto",
            value: "partner.name", // Default to partner name
          };
        });
        setField("variableMapping", defaultMapping);
      }
    }
  }, [templates, form.templateId]);

  const handleChannelChange = (channelId: string) => {
    setSelectedChannel(channelId);
    setField("channelId", channelId);
    // Reset template when channel changes
    setField("templateId", "");
    setSelectedTemplate(null);
    setField("variableMapping", {});
  };

  const handleTemplateChange = (templateId: string) => {
    setField("templateId", templateId);
  };

  const handleVariableSourceChange = (
    variableName: string,
    source: "auto" | "manual"
  ) => {
    const currentMapping = form.variableMapping || {};
    setField("variableMapping", {
      ...currentMapping,
      [variableName]: {
        source,
        value: source === "auto" ? "partner.name" : "",
      },
    });
  };

  const handleVariableValueChange = (
    variableName: string,
    value: string
  ) => {
    const currentMapping = form.variableMapping || {};
    const currentVar = currentMapping[variableName] || { source: "auto", value: "" };
    setField("variableMapping", {
      ...currentMapping,
      [variableName]: {
        ...currentVar,
        value,
      },
    });
  };

  const handleSave = () => {
    const validation = validateAll();
    if (validation.ok && validation.value) {
      updateNodeData(nodeId, validation.value);
      onClose();
    }
  };

  return (
    <div className="flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
      <FormControl fullWidth error={Boolean(errors.channelId)}>
        <InputLabel id="channel-select-label">Canal</InputLabel>
        <Select
          labelId="channel-select-label"
          value={form.channelId}
          onChange={(e) => handleChannelChange(e.target.value)}
          label="Canal"
        >
          <MenuItem value="">
            <em>Selecione um canal</em>
          </MenuItem>
          {channels?.map((channel) => (
            <MenuItem key={channel.id} value={channel.id}>
              {channel.name}
            </MenuItem>
          ))}
        </Select>
        {errors.channelId && (
          <FormHelperText>{errors.channelId}</FormHelperText>
        )}
      </FormControl>

      {selectedChannel && (
        <FormControl fullWidth error={Boolean(errors.templateId)}>
          <InputLabel id="template-select-label">Template</InputLabel>
          <Select
            labelId="template-select-label"
            value={form.templateId}
            onChange={(e) => handleTemplateChange(e.target.value)}
            label="Template"
          >
            <MenuItem value="">
              <em>Selecione um template</em>
            </MenuItem>
            {templates?.map((template) => (
              <MenuItem key={template.name} value={template.name}>
                {template.name}
              </MenuItem>
            ))}
          </Select>
          {errors.templateId && (
            <FormHelperText>{errors.templateId}</FormHelperText>
          )}
        </FormControl>
      )}

      {selectedTemplate && selectedTemplate.variables?.length > 0 && (
        <>
          <Divider className="!my-2" />
          <Typography variant="subtitle2" className="font-semibold">
            Mapeamento de Variáveis
          </Typography>

          {selectedTemplate.variables.map((variable: any) => {
            const mapping = form.variableMapping?.[variable.name] || {
              source: "auto",
              value: "partner.name",
            };

            return (
              <Paper key={variable.name} className="p-3" variant="outlined">
                <Typography variant="body2" className="font-medium mb-2">
                  {variable.name}
                </Typography>

                <ToggleButtonGroup
                  value={mapping.source}
                  exclusive
                  onChange={(_, value) =>
                    value && handleVariableSourceChange(variable.name, value)
                  }
                  size="small"
                  fullWidth
                  className="mb-2"
                >
                  <ToggleButton value="auto">Automático</ToggleButton>
                  <ToggleButton value="manual">Manual</ToggleButton>
                </ToggleButtonGroup>

                {mapping.source === "auto" ? (
                  <FormControl fullWidth size="small">
                    <InputLabel>Variável do Contexto</InputLabel>
                    <Select
                      value={mapping.value}
                      onChange={(e) =>
                        handleVariableValueChange(variable.name, e.target.value)
                      }
                      label="Variável do Contexto"
                    >
                      {AUTO_VARIABLE_OPTIONS.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                    <FormHelperText>
                      Será resolvido automaticamente do contexto
                    </FormHelperText>
                  </FormControl>
                ) : (
                  <TextField
                    fullWidth
                    size="small"
                    label="Valor Fixo"
                    value={mapping.value}
                    onChange={(e) =>
                      handleVariableValueChange(variable.name, e.target.value)
                    }
                    helperText="Digite um valor fixo para esta variável"
                  />
                )}
              </Paper>
            );
          })}
        </>
      )}

      {selectedTemplate && (
        <>
          <Divider className="!my-2" />
          <Box className="p-3 bg-gray-50 rounded">
            <Typography variant="caption" className="font-semibold block mb-1">
              Preview do Template:
            </Typography>
            <Typography variant="body2" className="whitespace-pre-wrap">
              {selectedTemplate.text}
            </Typography>
          </Box>
        </>
      )}

      <Button onClick={handleSave} variant="contained" fullWidth>
        Salvar Alterações
      </Button>
    </div>
  );
}
