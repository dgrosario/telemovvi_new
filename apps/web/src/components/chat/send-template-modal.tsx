"use client";

import { loadTemplatesApprovedFromChannel } from "@/app/actions/templates";
import { sendMessage } from "@/app/actions/messages";
import { listChannels } from "@/app/actions/channels";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useServerActionMutation,
  useServerActionQuery,
} from "@/hooks/server-action-hooks";
import { Button, TextField, Typography, Card } from "@mui/material";
import { Conversation } from "@omnichannel/core/domain/entities/conversation";
import { useState, useMemo } from "react";
import { toast } from "react-toastify";
import MobileDevice from "@/components/mobile-device";
import { SelectNative } from "@/components/ui/select-native";
import { Label } from "@/components/ui/label";

type Props = {
  open: boolean;
  onClose: () => void;
  conversation?: Conversation.Raw;
};

export const SendTemplateModal: React.FC<Props> = ({
  open,
  onClose,
  conversation,
}) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [variables, setVariables] = useState<Record<string, string>>({});

  const channelId = conversation?.channel?.id ?? "";
  
  // Buscar informações completas do canal para validar se é API oficial
  const { data: channels = [] } = useServerActionQuery(listChannels, {
    input: {},
    queryKey: ["list-channels-for-template"],
    enabled: open && !!channelId,
  });
  
  // Validar se é canal da API oficial
  const isOfficialApiChannel = useMemo(() => {
    if (!conversation?.channel || !channelId) return false;
    
    const channel = channels.find((c) => c.id === channelId);
    if (!channel) return false;
    
    const channelType = channel.type;
    const payload = channel.payload;
    
    // Apenas canais com wabaId são da API oficial
    if (channelType === "meta_api") {
      return payload && typeof payload === "object" && "wabaId" in payload && !!payload.wabaId;
    }
    
    if (channelType === "whatsapp") {
      return payload && typeof payload === "object" && "wabaId" in payload && !!payload.wabaId;
    }
    
    return false;
  }, [conversation?.channel, channelId, channels]);

  const { data: templates = [], isLoading } = useServerActionQuery(
    loadTemplatesApprovedFromChannel,
    {
      input: { channelId },
      queryKey: ["approved-templates", channelId],
      enabled: open && !!channelId && isOfficialApiChannel,
    }
  );

  const sendMessageAction = useServerActionMutation(sendMessage, {
    onSuccess: () => {
      toast.success("Template enviado com sucesso!");
      onClose();
      setSelectedTemplateId("");
      setVariables({});
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao enviar template");
    },
  });

  const selectedTemplate = useMemo(() => {
    return templates.find((t) => t.id === selectedTemplateId);
  }, [templates, selectedTemplateId]);

  const templateVariables = useMemo(() => {
    if (!selectedTemplate) return [];
    return selectedTemplate.variables || [];
  }, [selectedTemplate]);

  const previewText = useMemo(() => {
    if (!selectedTemplate) return "";
    
    let text = selectedTemplate.text;
    
    // Substituir variáveis no formato {{variable_name}}
    templateVariables.forEach((variable) => {
      const value = variables[variable.name] || `{{${variable.name}}}`;
      text = text.replace(new RegExp(`{{${variable.name}}}`, "g"), value);
    });
    
    return text;
  }, [selectedTemplate, templateVariables, variables]);

  const handleSend = () => {
    if (!isOfficialApiChannel) {
      toast.error("Este recurso está disponível apenas para canais da API Oficial do WhatsApp");
      return;
    }
    
    if (!selectedTemplate) {
      toast.error("Selecione um template");
      return;
    }

    // Validar se todas as variáveis foram preenchidas
    const missingVariables = templateVariables.filter(
      (v) => !variables[v.name] || variables[v.name].trim() === ""
    );

    if (missingVariables.length > 0) {
      toast.error("Preencha todas as variáveis do template");
      return;
    }

    if (!conversation?.id || !channelId) {
      toast.error("Conversa ou canal inválido");
      return;
    }

    const renderedContent = previewText.trim();
    if (!renderedContent) {
      toast.error("Não foi possível montar o corpo do template");
      return;
    }

    sendMessageAction.mutate({
      conversationId: conversation.id,
      channelId,
      content: renderedContent,
      templateName: selectedTemplate.name,
      language: selectedTemplate.language,
      variables: templateVariables.map((v) => ({
        name: v.name,
        value: variables[v.name],
      })),
    });
  };

  const handleClose = () => {
    if (!sendMessageAction.isPending) {
      onClose();
      setSelectedTemplateId("");
      setVariables({});
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enviar Template (API Oficial)</DialogTitle>
          <DialogDescription>
            Selecione um template aprovado para reabrir a conversa expirada
          </DialogDescription>
        </DialogHeader>
        
        {!isOfficialApiChannel && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <Typography variant="body2" className="text-red-800">
              Este recurso está disponível apenas para canais da API Oficial do WhatsApp (com wabaId configurado).
            </Typography>
          </div>
        )}

        <div className="flex gap-6 py-4">
          <div className="flex-1 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template-select">Template</Label>
              <SelectNative
                id="template-select"
                value={selectedTemplateId}
                onChange={(e) => {
                  setSelectedTemplateId(e.target.value);
                  setVariables({});
                }}
                disabled={!isOfficialApiChannel || isLoading || sendMessageAction.isPending}
              >
                <option value="" disabled>
                  {!isOfficialApiChannel
                    ? "Canal não é da API Oficial"
                    : isLoading
                      ? "Carregando templates..."
                      : templates.length === 0
                        ? "Nenhum template aprovado disponível"
                        : "Selecione um template"}
                </option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} ({template.language})
                  </option>
                ))}
              </SelectNative>
              {!isOfficialApiChannel && (
                <p className="text-sm text-muted-foreground">
                  Canal não é da API Oficial
                </p>
              )}
              {isLoading && (
                <p className="text-sm text-muted-foreground">
                  Carregando templates...
                </p>
              )}
              {!isLoading && templates.length === 0 && isOfficialApiChannel && (
                <p className="text-sm text-muted-foreground">
                  Nenhum template aprovado disponível
                </p>
              )}
            </div>

            {selectedTemplate && (
              <>
                <div>
                  <Typography variant="subtitle2" className="mb-2">
                    Texto do Template
                  </Typography>
                  <Typography
                    variant="body2"
                    className="text-gray-600 whitespace-pre-wrap"
                  >
                    {selectedTemplate.text}
                  </Typography>
                </div>

                {templateVariables.length > 0 && (
                  <div>
                    <Typography variant="subtitle2" className="mb-2">
                      Variáveis
                    </Typography>
                    <div className="space-y-3">
                      {templateVariables.map((variable) => (
                        <TextField
                          key={variable.name}
                          fullWidth
                          label={variable.name}
                          value={variables[variable.name] || ""}
                          onChange={(e) =>
                            setVariables((prev) => ({
                              ...prev,
                              [variable.name]: e.target.value,
                            }))
                          }
                          disabled={sendMessageAction.isPending}
                          placeholder={`Digite o valor para ${variable.name}`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {selectedTemplate && (
            <div className="min-w-[300px]">
              <Typography variant="subtitle2" className="mb-2">
                Preview
              </Typography>
              <MobileDevice>
                <div className="p-2">
                  <Card className="p-2 break-all whitespace-pre-wrap">
                    {previewText}
                  </Card>
                </div>
              </MobileDevice>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outlined"
            onClick={handleClose}
            disabled={sendMessageAction.isPending}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleSend}
            disabled={
              !isOfficialApiChannel ||
              !selectedTemplate ||
              sendMessageAction.isPending ||
              templateVariables.some((v) => !variables[v.name])
            }
          >
            {sendMessageAction.isPending ? "Enviando..." : "Enviar Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
