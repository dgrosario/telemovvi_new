"use client";

import React, { ChangeEvent, useEffect, useMemo, useRef } from "react";
import {
  createQuickMessage,
  retrieveQuickMessage,
  updateQuickMessage,
} from "@/app/actions/quick-messages";
import { createQuickMessageSchema } from "@/app/actions/quick-messages/schema";
import CustomTextField from "@/components/custom-text-field";
import MobileDevice from "@/components/mobile-device";
import ModalConfirm from "@/components/modal-confirm";
import { VariableSelectorPopover } from "@/components/variable-selector-popover";
import {
  useServerActionMutation,
  useServerActionQuery,
} from "@/hooks/server-action-hooks";
import { useFormState } from "@/hooks/use-form-state";
import { useQuickMessages } from "@/hooks/use-quick-messages";
import {
  Box,
  Button,
  Card,
  Dialog,
  DialogContent,
  FormControlLabel,
  IconButton,
  Switch,
  Typography,
} from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";

// Função para extrair mensagem de erro amigável
function extractErrorMessage(err: unknown): string {
  if (!err) return "Erro desconhecido";
  
  // Se for um objeto com message
  if (typeof err === "object" && "message" in err) {
    const message = (err as { message: string }).message;
    
    // Tenta parsear como JSON (erros do Zod vêm assim)
    try {
      const parsed = JSON.parse(message);
      if (Array.isArray(parsed)) {
        // Pega a primeira mensagem de erro
        const firstError = parsed[0];
        if (firstError?.message) {
          return firstError.message;
        }
      }
    } catch {
      // Não é JSON, retorna a mensagem diretamente
      return message;
    }
  }
  
  if (typeof err === "string") return err;
  
  return "Erro ao processar a solicitação";
}

type MediaType = "image" | "audio" | "video" | "document";

function getMediaTypeFromMime(mimeType: string): MediaType {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  return "document";
}

function getMediaIcon(type: MediaType | null): string {
  switch (type) {
    case "image":
      return "tabler-photo";
    case "audio":
      return "tabler-music";
    case "video":
      return "tabler-video";
    default:
      return "tabler-file";
  }
}

// Função para formatar texto do WhatsApp
function formatWhatsAppText(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let currentIndex = 0;
  let key = 0;

  // Regex para capturar formatações do WhatsApp
  // Ordem: monoespaçado (```), negrito (*), itálico (_), tachado (~)
  const regex = /```([^`]+)```|\*([^*]+)\*|_([^_]+)_|~([^~]+)~/g;
  
  let match;
  while ((match = regex.exec(text)) !== null) {
    // Adiciona texto antes da formatação
    if (match.index > currentIndex) {
      parts.push(
        <span key={key++}>{text.slice(currentIndex, match.index)}</span>
      );
    }

    // Adiciona texto formatado
    if (match[1]) {
      // Monoespaçado ```texto```
      parts.push(
        <span key={key++} className="font-mono bg-gray-100 px-1 rounded text-sm">
          {match[1]}
        </span>
      );
    } else if (match[2]) {
      // Negrito *texto*
      parts.push(<strong key={key++}>{match[2]}</strong>);
    } else if (match[3]) {
      // Itálico _texto_
      parts.push(<em key={key++}>{match[3]}</em>);
    } else if (match[4]) {
      // Tachado ~texto~
      parts.push(<del key={key++}>{match[4]}</del>);
    }

    currentIndex = match.index + match[0].length;
  }

  // Adiciona texto restante
  if (currentIndex < text.length) {
    parts.push(<span key={key++}>{text.slice(currentIndex)}</span>);
  }

  return parts.length > 0 ? parts : [<span key={0}>{text}</span>];
}

export default function DialogQuickMessage() {
  const { open, setOpen, setId, id } = useQuickMessages();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { form, setField, validateAll, errors, reset } = useFormState(
    createQuickMessageSchema,
    {
      shortcode: "",
      message: "",
      isPublic: false,
      mediaUrl: null,
      mediaType: null,
      mediaName: null,
    }
  );

  const updateAction = useServerActionMutation(updateQuickMessage, {
    onSuccess() {
      setOpen(false);
      toast.success("Mensagem atualizada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["list-quick-messages"] });
    },
    onError(err) {
      const errorMessage = extractErrorMessage(err);
      toast.error(errorMessage);
    },
  });

  const getAction = useServerActionQuery(retrieveQuickMessage, {
    input: { id },
    queryKey: ["get-quick-message", id],
    enabled: !!id && open,
  });

  useEffect(() => {
    if (id && getAction.data) {
      const msg = getAction.data;
      reset({
        shortcode: msg.shortcode,
        message: msg.message,
        isPublic: msg.isPublic,
        mediaUrl: msg.mediaUrl,
        mediaType: msg.mediaType,
        mediaName: msg.mediaName,
      });
    }
  }, [id, getAction.data, reset]);

  const createAction = useServerActionMutation(createQuickMessage, {
    onSuccess() {
      setOpen(false);
      queryClient.invalidateQueries({
        queryKey: ["list-quick-messages"],
      });
      toast.success("Mensagem criada com sucesso!");
    },
    onError(err) {
      // Tenta extrair mensagem de erro amigável
      const errorMessage = extractErrorMessage(err);
      toast.error(errorMessage);
    },
  });

  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open, reset]);

  useEffect(() => {
    return () => {
      queryClient.removeQueries({
        queryKey: ["get-quick-message"],
        exact: false,
      });
    };
  }, [queryClient]);

  const handleSave = async () => {
    const result = validateAll();
    if (!result) {
      // Mostrar erro amigável se a validação falhar
      if (errors.shortcode) {
        toast.error(errors.shortcode);
        return;
      }
      if (errors.message) {
        toast.error(errors.message);
        return;
      }
      return;
    }

    if (id) {
      updateAction.mutate({
        id,
        ...form,
      });
    } else {
      createAction.mutate(form);
    }
  };

  const handleClose = () => {
    setOpen(false);
    queryClient.removeQueries({
      queryKey: ["get-quick-message", id],
    });
    reset();
    setId("");
    queryClient.invalidateQueries({
      exact: true,
      queryKey: ["list-quick-messages"],
    });
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("O arquivo deve ter no maximo 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setField("mediaUrl", dataUrl);
      setField("mediaType", getMediaTypeFromMime(file.type));
      setField("mediaName", file.name);
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveMedia = () => {
    setField("mediaUrl", null);
    setField("mediaType", null);
    setField("mediaName", null);
  };

  const mediaPreview = useMemo(() => {
    if (!form.mediaUrl) return null;

    if (form.mediaType === "image") {
      return (
        <div className="relative">
          <img
            src={form.mediaUrl}
            alt={form.mediaName || "Preview"}
            className="max-w-full max-h-[150px] rounded-lg object-contain"
          />
        </div>
      );
    }

    if (form.mediaType === "audio") {
      return (
        <audio controls className="w-full max-w-[300px]">
          <source src={form.mediaUrl} />
        </audio>
      );
    }

    if (form.mediaType === "video") {
      return (
        <video controls className="max-w-full max-h-[150px] rounded-lg">
          <source src={form.mediaUrl} />
        </video>
      );
    }

    return (
      <Box className="flex items-center gap-2 p-3 bg-gray-100 rounded-lg">
        <i className="tabler-file text-2xl text-gray-600" />
        <Typography variant="body2" className="truncate max-w-[200px]">
          {form.mediaName}
        </Typography>
      </Box>
    );
  }, [form.mediaUrl, form.mediaType, form.mediaName]);

  return (
    <Dialog fullWidth maxWidth="md" open={open} onClose={handleClose}>
      <DialogContent>
        <div className="w-full h-screen max-h-[650px]">
          <div className="flex justify-between pb-5 items-center">
            <Typography variant="h5" className="font-semibold">
              {id ? "Editar mensagem rapida" : "Nova mensagem rapida"}
            </Typography>
            <ModalConfirm title="Salvar a mensagem?" onConfirm={handleSave}>
              <Button
                variant="contained"
                loading={createAction.isPending || updateAction.isPending}
                loadingPosition="start"
              >
                Salvar
              </Button>
            </ModalConfirm>
          </div>

          <div className="flex gap-8 pb-10">
            <div className="flex w-full gap-3 max-w-[500px] flex-col">
              <CustomTextField
                label="Atalho"
                value={form.shortcode}
                required
                fullWidth
                placeholder="ex: ola, preco, horario"
                error={!!errors.shortcode}
                helperText={
                  errors.shortcode ||
                  "Use apenas letras minúsculas, números e underscore"
                }
                slotProps={{
                  input: {
                    startAdornment: (
                      <Typography className="text-gray-500 mr-1">/</Typography>
                    ),
                  },
                }}
                onChange={(e) =>
                  setField(
                    "shortcode",
                    e.target.value
                      .replace(/[^a-z0-9_]/gi, "")
                      .toLowerCase()
                      .slice(0, 50)
                  )
                }
              />

              <div className="flex flex-col gap-2">
                <CustomTextField
                  label="Mensagem"
                  multiline
                  required
                  rows={6}
                  error={!!errors.message}
                  helperText={errors.message}
                  value={form.message}
                  onChange={(e) => {
                    if (e.target.value.length > 4096) {
                      e.target.value = e.target.value.slice(0, 4096);
                    }
                    setField("message", e.target.value);
                  }}
                  slotProps={{
                    input: {
                      endAdornment: (
                        <Typography variant="caption" className="text-xs self-end">
                          {form.message.length}/4096
                        </Typography>
                      ),
                    },
                  }}
                />
                <div className="flex items-center gap-2">
                  <VariableSelectorPopover
                    onSelect={(placeholder) => {
                      setField("message", form.message + placeholder);
                    }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    Insira variaveis dinamicas na mensagem
                  </Typography>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Typography variant="body2" color="text.secondary">
                  Midia (opcional)
                </Typography>

                {form.mediaUrl ? (
                  <Box className="flex flex-col gap-2 p-3 border border-gray-200 rounded-lg">
                    {mediaPreview}
                    <Box className="flex items-center justify-between mt-2">
                      <Typography variant="caption" className="text-gray-500 truncate max-w-[250px]">
                        {form.mediaName}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={handleRemoveMedia}
                        title="Remover midia"
                      >
                        <i className="tabler-trash text-red-500" />
                      </IconButton>
                    </Box>
                  </Box>
                ) : (
                  <Box
                    className="flex items-center gap-3 p-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary hover:bg-gray-50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Box className="flex gap-2">
                      <i className="tabler-photo text-xl text-gray-400" />
                      <i className="tabler-music text-xl text-gray-400" />
                      <i className="tabler-file text-xl text-gray-400" />
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Clique para anexar imagem, áudio ou documento
                    </Typography>
                  </Box>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*,audio/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv"
                  onChange={handleFileSelect}
                />
              </div>

              <FormControlLabel
                control={
                  <Switch
                    checked={form.isPublic}
                    onChange={(e) => setField("isPublic", e.target.checked)}
                  />
                }
                label={
                  <div>
                    <Typography variant="body1">Mensagem publica</Typography>
                    <Typography variant="caption" className="text-gray-500">
                      {form.isPublic
                        ? "Visível para toda a equipe"
                        : "Visível apenas para você"}
                    </Typography>
                  </div>
                }
              />
            </div>

            <div className="min-w-[300px] mt-3">
              <MobileDevice>
                <div className="p-2 flex flex-col gap-2">
                  {form.mediaUrl && form.mediaType === "image" && (
                    <Card className="p-1">
                      <img
                        src={form.mediaUrl}
                        alt="Preview"
                        className="w-full rounded"
                      />
                    </Card>
                  )}
                  {form.mediaUrl && form.mediaType === "audio" && (
                    <Card className="p-2 flex items-center gap-2">
                      <i className="tabler-player-play text-primary" />
                      <Box className="flex-1 h-1 bg-gray-200 rounded" />
                      <Typography variant="caption">0:00</Typography>
                    </Card>
                  )}
                  {form.mediaUrl && form.mediaType === "video" && (
                    <Card className="p-1 relative">
                      <video
                        src={form.mediaUrl}
                        className="w-full rounded"
                        muted
                      />
                      <Box className="absolute inset-0 flex items-center justify-center">
                        <i className="tabler-player-play text-white text-3xl drop-shadow-lg" />
                      </Box>
                    </Card>
                  )}
                  {form.mediaUrl && form.mediaType === "document" && (
                    <Card className="p-2 flex items-center gap-2">
                      <i className="tabler-file text-gray-600" />
                      <Typography variant="caption" className="truncate">
                        {form.mediaName}
                      </Typography>
                    </Card>
                  )}
                  {form.message && (
                    <Card className="p-2 break-all whitespace-pre-wrap text-sm">
                      {formatWhatsAppText(form.message)}
                    </Card>
                  )}
                  {!form.message && !form.mediaUrl && (
                    <Card className="p-2">
                      <span className="text-gray-400">
                        Digite uma mensagem...
                      </span>
                    </Card>
                  )}
                </div>
              </MobileDevice>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
