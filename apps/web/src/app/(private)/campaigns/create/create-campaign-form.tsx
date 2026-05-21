"use client";

import { countRecipients, createCampaign } from "@/app/actions/campaigns";
import { LabelsSelector } from "@/components/labels-selector";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  FormControl,
  FormHelperText,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { VariableSelectorPopover } from "@/components/variable-selector-popover";
import { DateTimePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { ptBR } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { Flip, toast } from "react-toastify";

type Channel = {
  id: string;
  name: string;
  type: string;
};

type MessageVariation = {
  variationLabel: string;
  type: "text" | "template";
  content: string;
  templateName?: string;
  variables?: Array<{ name: string; value: string }>;
};

type CampaignType = "manual" | "birthday";

type FormData = {
  name: string;
  channelId: string;
  type: CampaignType;
  filterLabelIds: string[];
  minIntervalMs: number;
  maxIntervalMs: number;
  scheduledAt: Date | null;
  messages: MessageVariation[];
};

type CreateCampaignFormProps = {
  channels: Channel[];
};

function getVariationLabel(index: number): string {
  return String.fromCharCode(65 + index);
}

export function CreateCampaignForm({
  channels,
}: CreateCampaignFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [isCountingRecipients, setIsCountingRecipients] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      name: "",
      channelId: "",
      type: "manual",
      filterLabelIds: [],
      minIntervalMs: 5000,
      maxIntervalMs: 30000,
      scheduledAt: null,
      messages: [{ variationLabel: "A", type: "text", content: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "messages",
  });

  const filterLabelIds = watch("filterLabelIds");
  const campaignType = watch("type");

  const fetchRecipientCount = useCallback(async (labelIds: string[]) => {
    if (labelIds.length === 0) {
      setRecipientCount(null);
      return;
    }

    setIsCountingRecipients(true);
    try {
      const [result] = await countRecipients({ labelIds });
      setRecipientCount(result?.count ?? 0);
    } catch {
      setRecipientCount(null);
    } finally {
      setIsCountingRecipients(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchRecipientCount(filterLabelIds);
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [filterLabelIds, fetchRecipientCount]);

  const onSubmit = async (data: FormData) => {
    if (data.messages.length === 0) {
      toast.error("Adicione pelo menos uma variação de mensagem", {
        transition: Flip,
      });
      return;
    }

    const hasEmptyMessage = data.messages.some(
      (m) => m.type === "text" && !m.content?.trim()
    );
    if (hasEmptyMessage) {
      toast.error("Preencha o conteúdo de todas as mensagens", {
        transition: Flip,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const [result, error] = await createCampaign({
        name: data.name,
        channelId: data.channelId,
        type: data.type,
        filterLabelIds: data.filterLabelIds,
        minIntervalMs: data.minIntervalMs,
        maxIntervalMs: data.maxIntervalMs,
        scheduledAt: data.scheduledAt ?? undefined,
        messages: data.messages,
      });

      if (error) {
        toast.error(error.message ?? "Erro ao criar campanha", {
          transition: Flip,
        });
        return;
      }

      toast.success(
        `Campanha criada com ${result?.totalRecipients} destinatários!`,
        { transition: Flip }
      );
      router.push("/campaigns");
    } catch {
      toast.error("Erro ao criar campanha", { transition: Flip });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddVariation = () => {
    const nextLabel = getVariationLabel(fields.length);
    append({ variationLabel: nextLabel, type: "text", content: "" });
    setActiveTab(fields.length);
  };

  const handleRemoveVariation = (index: number) => {
    if (fields.length <= 1) return;
    remove(index);
    setActiveTab(Math.max(0, activeTab - 1));
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ptBR}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Linha 1: Nome e Canal */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Controller
            name="name"
            control={control}
            rules={{ required: "Nome é obrigatório" }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Nome da campanha"
                error={!!errors.name}
                helperText={errors.name?.message}
                fullWidth
                size="small"
              />
            )}
          />

          <Controller
            name="channelId"
            control={control}
            rules={{ required: "Canal é obrigatório" }}
            render={({ field }) => (
              <FormControl fullWidth error={!!errors.channelId} size="small">
                <InputLabel>Canal</InputLabel>
                <Select {...field} label="Canal">
                  {channels.map((channel) => (
                    <MenuItem key={channel.id} value={channel.id}>
                      {channel.name}
                    </MenuItem>
                  ))}
                </Select>
                {errors.channelId && (
                  <FormHelperText>{errors.channelId.message}</FormHelperText>
                )}
              </FormControl>
            )}
          />
        </div>

        {/* Linha 2: Tipo + Intervalos (4 colunas) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Controller
            name="type"
            control={control}
            render={({ field }) => (
              <FormControl fullWidth size="small">
                <InputLabel>Tipo</InputLabel>
                <Select {...field} label="Tipo">
                  <MenuItem value="manual">Manual</MenuItem>
                  <MenuItem value="birthday">Aniversário</MenuItem>
                </Select>
              </FormControl>
            )}
          />

          <Controller
            name="minIntervalMs"
            control={control}
            rules={{
              required: "Obrigatório",
              min: { value: 1000, message: "Mín. 1s" },
              max: { value: 300000, message: "Máx. 5min" },
            }}
            render={({ field }) => (
              <TextField
                {...field}
                type="number"
                label="Intervalo mín. (s)"
                value={Math.floor(field.value / 1000)}
                onChange={(e) => field.onChange(Number(e.target.value) * 1000)}
                error={!!errors.minIntervalMs}
                helperText={errors.minIntervalMs?.message}
                inputProps={{ min: 1, max: 300 }}
                fullWidth
                size="small"
              />
            )}
          />

          <Controller
            name="maxIntervalMs"
            control={control}
            rules={{
              required: "Obrigatório",
              min: { value: 1000, message: "Mín. 1s" },
              max: { value: 300000, message: "Máx. 5min" },
            }}
            render={({ field }) => (
              <TextField
                {...field}
                type="number"
                label="Intervalo máx. (s)"
                value={Math.floor(field.value / 1000)}
                onChange={(e) => field.onChange(Number(e.target.value) * 1000)}
                error={!!errors.maxIntervalMs}
                helperText={errors.maxIntervalMs?.message}
                inputProps={{ min: 1, max: 300 }}
                fullWidth
                size="small"
              />
            )}
          />

          <Controller
            name="scheduledAt"
            control={control}
            render={({ field }) => (
              <DateTimePicker
                label="Agendamento"
                value={field.value}
                onChange={field.onChange}
                format="dd/MM/yyyy HH:mm"
                ampm={false}
                minDateTime={new Date()}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    size: "small",
                  },
                }}
              />
            )}
          />
        </div>

        {/* Linha 3: Tags (apenas para tipo manual) */}
        {campaignType === "manual" && (
          <div className="space-y-2">
            <Controller
              name="filterLabelIds"
              control={control}
              render={({ field }) => (
                <LabelsSelector
                  value={field.value}
                  onChange={field.onChange}
                  label="Filtrar por etiquetas"
                  placeholder="Selecione etiquetas..."
                />
              )}
            />

            {filterLabelIds.length === 0 && (
              <FormHelperText error>
                Selecione pelo menos uma etiqueta
              </FormHelperText>
            )}

            {recipientCount !== null && (
              <Typography
                variant="body2"
                className={recipientCount === 0 ? "text-red-500" : "text-green-600"}
              >
                {isCountingRecipients
                  ? "Contando destinatários..."
                  : `${recipientCount} destinatário${recipientCount !== 1 ? "s" : ""} encontrado${recipientCount !== 1 ? "s" : ""}`}
              </Typography>
            )}
          </div>
        )}

        {/* Variações de Mensagem */}
        <Box className="border rounded-lg">
          <Box className="flex items-center justify-between px-4 py-3 border-b bg-gray-50/50">
            <Typography variant="subtitle2" className="font-medium">
              Variações de Mensagem
            </Typography>
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={handleAddVariation}
            >
              Adicionar
            </Button>
          </Box>

          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            className="px-4 border-b"
            variant="scrollable"
            scrollButtons="auto"
          >
            {fields.map((field, index) => (
              <Tab
                key={field.id}
                label={`Variação ${field.variationLabel}`}
                sx={{ minHeight: 40, py: 1 }}
              />
            ))}
          </Tabs>

          <Box className="p-4">
            {fields.map((field, index) => (
              <Box
                key={field.id}
                hidden={activeTab !== index}
                className="space-y-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <Controller
                    name={`messages.${index}.type`}
                    control={control}
                    render={({ field: typeField }) => (
                      <FormControl size="small" className="w-36">
                        <InputLabel>Tipo</InputLabel>
                        <Select {...typeField} label="Tipo">
                          <MenuItem value="text">Texto</MenuItem>
                          <MenuItem value="template">Template</MenuItem>
                        </Select>
                      </FormControl>
                    )}
                  />
                  {fields.length > 1 && (
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleRemoveVariation(index)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </div>

                <Controller
                  name={`messages.${index}.content`}
                  control={control}
                  render={({ field: contentField }) => (
                    <div className="space-y-2">
                      <TextField
                        {...contentField}
                        label="Conteúdo da mensagem"
                        multiline
                        rows={3}
                        fullWidth
                        size="small"
                      />
                      <div className="flex items-center gap-2">
                        <VariableSelectorPopover
                          onSelect={(placeholder) => {
                            const currentValue = getValues(`messages.${index}.content`);
                            setValue(`messages.${index}.content`, currentValue + placeholder);
                          }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          Variáveis dinâmicas
                        </Typography>
                      </div>
                    </div>
                  )}
                />
              </Box>
            ))}
          </Box>

          {fields.length > 1 && (
            <Box className="px-4 pb-3">
              <Typography variant="caption" color="text.secondary">
                Cada cliente receberá apenas UMA variação, escolhida aleatoriamente.
              </Typography>
            </Box>
          )}
        </Box>

        {/* Botões de ação */}
        <div className="flex justify-end gap-3 pt-2">
          <Button
            variant="outlined"
            onClick={() => router.push("/campaigns")}
            disabled={isSubmitting}
            size="medium"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={
              isSubmitting ||
              (campaignType === "manual" && (
                filterLabelIds.length === 0 ||
                recipientCount === 0
              ))
            }
            size="medium"
          >
            {isSubmitting ? "Criando..." : "Criar Campanha"}
          </Button>
        </div>
      </form>
    </LocalizationProvider>
  );
}
