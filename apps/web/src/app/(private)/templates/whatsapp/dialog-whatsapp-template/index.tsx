"use client";

import { listChannels } from "@/app/actions/channels";
import { upsertTemplate } from "@/app/actions/templates";
import { upsertTemplateInputSchema } from "@/app/actions/templates/schema";
import CustomTextField from "@/components/custom-text-field";
import MobileDevice from "@/components/mobile-device";
import ModalConfirm from "@/components/modal-confirm";
import { mountExamples, subsVariableOnText } from "@/helpers/variables";
import {
  useServerActionMutation,
  useServerActionQuery,
} from "@/hooks/server-action-hooks";
import { useFormState } from "@/hooks/use-form-state";
import { useTemplates } from "@/hooks/use-templates";
import {
  Button,
  Card,
  Dialog,
  DialogContent,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Typography,
} from "@mui/material";
import { variablesAvailable } from "@omnichannel/core/domain/value-objects/variable";
import { getPayloadProperty, isWhatsAppPayload } from "@omnichannel/core/domain/entities/channel";
import React, { useEffect, useMemo } from "react";
import { toast } from "react-toastify";
import { CardButton } from "./card-button";
import { CategorySteps } from "./category-steps";

export type Type =
  | "custom"
  | "custom-utility"
  | "flows"
  | "flow-utility"
  | "carrousel";
export type Step = "category" | "register";
export type Tab = "marketing" | "utility";

export type Option = {
  value: Type;
  title: string;
  description: string;
};

export default function DialogWhatsappTemplate() {
  const { open, setOpen } = useTemplates();
  const [tab, setTab] = React.useState<Tab>("utility");
  const [type, setType] = React.useState<Type>("custom-utility");
  const [activeStep, setActiveStep] = React.useState<Step>("register");
  const { form, setField, validateAll, errors, reset } = useFormState(
    upsertTemplateInputSchema,
    {
      channelId: "",
      name: `template_${new Date().toLocaleString().split("/").join("_").replace(", ", "_").split(":").join("_")}`,
      lang: "pt_BR",
      text: "",
      variables: [],
      type: "whatsapp",
      category: "UTILITY",
    }
  );
  const upsertTemplateAction = useServerActionMutation(upsertTemplate, {
    onSuccess() {
      setOpen(false);
    },
    onError(err) {
      toast.error(err.message);
    },
  });
  const listChannelAction = useServerActionQuery(listChannels, {
    input: {
      // Não filtrar por tipo para pegar todos os canais WhatsApp (whatsapp, evolution, meta_api)
    },
    queryKey: ["list-channel-whatsapp"],
  });

  // Debug: verificar canais carregados
  useEffect(() => {
    if (listChannelAction.data) {
      console.log("[DEBUG] Canais carregados:", listChannelAction.data);
      
      const officialApiChannels = listChannelAction.data.filter(c => {
        const payload = c.payload;
        const isValidType = c.type === "whatsapp" || c.type === "meta_api";
        const hasWabaId = payload && typeof payload === "object" && "wabaId" in payload && !!payload.wabaId;
        return isValidType && hasWabaId;
      });
      
      console.log("[DEBUG] Canais da API Oficial (whatsapp/meta_api com wabaId):", officialApiChannels);
      
      if (officialApiChannels.length === 0) {
        console.warn("[AVISO] Nenhum canal da API Oficial encontrado. Certifique-se de ter canais do tipo 'whatsapp' ou 'meta_api' com wabaId configurado.");
      }
    }
  }, [listChannelAction.data]);

  const options = useMemo<Option[]>(
    () => [
      {
        value: "custom",
        title: "Personalizado",
        description: "Compartilhe ofertas com texto, imagens e botões.",
      },
      {
        value: "carrousel",
        title: "Carrossel",
        description: "Exiba seus produtos em cartões interativos que deslizam.",
      },
      {
        value: "flows",
        title: "Flows",
        description:
          "Colete detalhes do cliente com formulários passo a passo.",
      },
    ],
    []
  );

  const optionsUtility = useMemo<Option[]>(
    () => [
      {
        value: "custom-utility",
        title: "Personalizado",
        description:
          "Envie informações de pedidos/contas usando texto e mídia.",
      },
      {
        value: "flow-utility",
        title: "Flows",
        description: "Colete detalhes ou feedback com formulários.",
      },
    ],
    []
  );

  useEffect(() => {
    setType(tab === "marketing" ? options[0].value : optionsUtility[0].value);
    setField("category", tab === "marketing" ? "MARKETING" : "UTILITY");
  }, [tab]);

  useEffect(() => {
    if (form.text.length > 0) {
      setField("variables", mountExamples(form.text, form.variables));
    }
  }, [form.text]);

  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open]);

  const handleSaveTemplate = async () => {
    const result = validateAll();
    if (!result.ok) return;
    upsertTemplateAction.mutate(form);
  };

  return (
    <>
      <CardButton onOpen={() => setOpen(true)} />
      <Dialog
        fullWidth
        maxWidth="md"
        open={open}
        onClose={() => setOpen(false)}
      >
        <DialogContent>
          <CategorySteps
            activeStep={activeStep}
            closeDialog={() => setOpen(false)}
            options={options}
            optionsUtility={optionsUtility}
            setActiveStep={setActiveStep}
            setTab={setTab}
            setType={setType}
            tab={tab}
            type={type}
          />
          <div
            className="w-full h-screen max-h-[800px]"
            data-hidden={activeStep !== "register"}
          >
            <div className="flex justify-between pb-5 items-center">
              <Typography variant="h5" className="font-semibold">
                Novo modelo do WhatsApp
              </Typography>
              <ModalConfirm
                title="Enviar o modelo para moderação?"
                content="Depois disso você não poderá mais editá-lo"
                onConfirm={handleSaveTemplate}
              >
                <Button
                  variant="contained"
                  loading={upsertTemplateAction.isPending}
                  loadingPosition="start"
                >
                  Enviar para análise
                </Button>
              </ModalConfirm>
            </div>

            <div className="flex gap-8 pb-10">
              <div className="flex w-full gap-3 max-w-[500px] flex-col">
                <CustomTextField
                  label="Nome do template"
                  value={form.name}
                  required
                  fullWidth
                  onChange={(e) =>
                    setField(
                      "name",
                      e.target.value.replace(/[^A-Za-z0-9_]/g, "").toLowerCase()
                    )
                  }
                />
                <div className="flex gap-3">
                  <CustomTextField
                    value={form.channelId}
                    slotProps={{
                      select: {
                        onChange: (e) =>
                          setField("channelId", e.target.value as string),
                      },
                    }}
                    required
                    select
                    fullWidth
                    label="Canal"
                    error={!!errors.channelId}
                    helperText={errors.channelId || (
                      (listChannelAction.data || []).filter(c => {
                        const isValidType = c.type === "whatsapp" || c.type === "meta_api";
                        const hasWabaId = c.payload && typeof c.payload === "object" && "wabaId" in c.payload && !!c.payload.wabaId;
                        return isValidType && hasWabaId;
                      }).length === 0 
                        ? "Nenhum canal da API Oficial disponível. Configure um canal WhatsApp Cloud ou Meta API com wabaId."
                        : undefined
                    )}
                  >
                    {(listChannelAction.data || [])
                      .filter((c) => {
                        // Filtrar APENAS canais da API oficial (whatsapp ou meta_api com wabaId)
                        const payload = c.payload;
                        
                        // Debug detalhado
                        console.log(`[DEBUG] Canal: ${c.name} (${c.type})`, {
                          payload,
                          hasPayload: !!payload,
                          isObject: typeof payload === "object",
                          hasWabaId: payload && typeof payload === "object" && "wabaId" in payload,
                          wabaIdValue: payload && typeof payload === "object" && "wabaId" in payload ? (payload as any).wabaId : "N/A"
                        });
                        
                        // IMPORTANTE: Evolution NÃO é aceito, apenas whatsapp e meta_api
                        const isValidType = c.type === "whatsapp" || c.type === "meta_api";
                        
                        if (!isValidType) {
                          console.log(`[DEBUG] Canal ${c.name} rejeitado: tipo ${c.type} não é whatsapp ou meta_api`);
                          return false;
                        }
                        
                        // Verificar se o payload tem wabaId (indicador de API oficial)
                        const hasWabaId = payload && 
                                         typeof payload === "object" && 
                                         "wabaId" in payload && 
                                         !!payload.wabaId;
                        
                        if (!hasWabaId) {
                          console.log(`[DEBUG] Canal ${c.name} rejeitado: não tem wabaId`);
                          return false;
                        }
                        
                        console.log(`[DEBUG] Canal ${c.name}: ACEITO ✓`);
                        return true;
                      })
                      .map((c) => {
                        return (
                          <MenuItem value={c.id} key={c.id}>
                            {[c.name, getPayloadProperty(c.payload, "phoneNumber")]
                              .filter(Boolean)
                              .join(" - ")}
                          </MenuItem>
                        );
                      })}
                  </CustomTextField>

                  <CustomTextField
                    select
                    fullWidth
                    defaultValue="pt_BR"
                    label="Idioma"
                    required
                    error={!!errors.lang}
                    helperText={errors.lang}
                  >
                    <MenuItem value="pt_BR">Português (Português BR)</MenuItem>
                    <MenuItem value="en_US">Inglês (US)</MenuItem>
                  </CustomTextField>
                </div>
                <CustomTextField
                  label="Texto"
                  multiline
                  required
                  rows={6}
                  error={!!errors.text}
                  helperText={errors.text}
                  value={form.text}
                  onChange={(e) => {
                    if (e.target.value.length > 1024) {
                      e.target.value = e.target.value.slice(0, 1024);
                    }
                    setField("text", e.target.value);
                  }}
                  slotProps={{
                    input: {
                      endAdornment: (
                        <Typography
                          variant="caption"
                          className="text-xs self-end"
                        >
                          {form.text.length}/1024
                        </Typography>
                      ),
                    },
                  }}
                />
                <Typography variant="h5" className="!mt-4">
                  Variáveis
                </Typography>
                <Typography variant="body2" mb={2}>
                  A meta pede um exemplo para cada variável
                </Typography>
                <CustomTextField select value="" label="Adicionar uma variável">
                  {variablesAvailable.map((variable) => (
                    <MenuItem
                      onClick={() => {
                        setField("text", form.text + variable.value);
                      }}
                    >
                      {variable.name}
                    </MenuItem>
                  ))}
                </CustomTextField>
                <List>
                  {form.variables.map((variable, i) => (
                    <ListItem key={i} sx={{ paddingX: 0 }}>
                      <ListItemText
                        primary={`${i + 1} - ${variable.name}`}
                        className="!text-gray-600"
                      />
                      <CustomTextField
                        helperText={errors.variables}
                        error={!!errors.variables}
                        value={variable.example}
                        placeholder="Exemplo"
                        onChange={(e) =>
                          setField(
                            "variables",
                            form.variables.map((v) =>
                              v.name === variable.name
                                ? { ...v, example: e.target.value }
                                : v
                            )
                          )
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </div>

              <div className="min-w-[300px] mt-3">
                <MobileDevice>
                  <div className="p-2">
                    <Card data-hidden={!form.text} className="p-2 break-all">
                      {subsVariableOnText(
                        form.text,
                        form.variables.map((v) => ({
                          name: v.name,
                          value: v.example,
                        }))
                      )}
                    </Card>
                  </div>
                </MobileDevice>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
