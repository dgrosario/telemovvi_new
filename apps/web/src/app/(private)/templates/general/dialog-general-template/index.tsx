"use client";

import { listChannels } from "@/app/actions/channels";
import {
  addTemplateGeneral,
  retrieveGeneralTemplate,
  updateTemplateGeneral,
} from "@/app/actions/templates";
import { addGeneralTemplateInputSchema } from "@/app/actions/templates/schema";
import CustomTextField from "@/components/custom-text-field";
import MobileDevice from "@/components/mobile-device";
import ModalConfirm from "@/components/modal-confirm";
import { mountExamples, subsVariableOnText } from "@/helpers/variables";
import {
  useServerActionMutation,
  useServerActionQuery,
} from "@/hooks/server-action-hooks";
import { useFormState } from "@/hooks/use-form-state";
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
import React, { useEffect, useMemo } from "react";
import { Flip, toast } from "react-toastify";
import { variablesAvailable } from "@omnichannel/core/domain/value-objects/variable";
import { getPayloadProperty } from "@omnichannel/core/domain/entities/channel";
import { useGeneralTemplates } from "@/hooks/use-general-templates";
import { useQueryClient } from "@tanstack/react-query";

export type Option = {
  title: string;
  description: string;
};

export default function DialogGeneralTemplate() {
  const { open, setOpen, setId, id } = useGeneralTemplates();
  const queryClient = useQueryClient();
  const { form, setField, validateAll, errors, reset } = useFormState(
    addGeneralTemplateInputSchema,
    {
      channelId: "",
      name: `template_${new Date().toLocaleString().split("/").join("_").replace(", ", "_").split(":").join("_")}`,
      text: "",
      lang: "pt_BR",
      variables: [],
    }
  );

  const updateTemplateGeneralAction = useServerActionMutation(
    updateTemplateGeneral,
    {
      onSuccess() {
        setOpen(false);
        toast.success("Modelo atualizado com sucesso!");
        queryClient.invalidateQueries({ queryKey: ["list-general-templates"] });
      },
    }
  );

  const getTemplateAction = useServerActionQuery(retrieveGeneralTemplate, {
    input: { id },
    queryKey: ["get-general-template", id],
    enabled: !!id && open,
  });

  useEffect(() => {
    if (id && getTemplateAction.data) {
      const tpl = getTemplateAction.data;

      reset({
        channelId: tpl.channel.id,
        name: tpl.name,
        text: tpl.text,
        lang: tpl.language,
        variables: [],
      });
    }
  }, [id, getTemplateAction.data]);

  const addTemplateGeneralAction = useServerActionMutation(addTemplateGeneral, {
    onSuccess() {
      setOpen(false);

      queryClient.invalidateQueries({
        queryKey: ["list-general-templates"],
      });

      toast.success("Modelo criado com sucesso!");
    },
    onError(err) {
      toast.error(err.message);
    },
  });

  const listChannelAction = useServerActionQuery(listChannels, {
    input: {},
    queryKey: ["list-channel"],
  });

  useEffect(() => {
    if (form.text.length > 0) {
      setField("variables", mountExamples(form.text, form.variables ?? []));
    }
  }, [form.text]);

  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open]);

  const handleSaveTemplate = async () => {
    const result = validateAll();
    if (!result) return;

    if (id) {
      updateTemplateGeneralAction.mutate({
        id,
        ...form,
        variables: form.variables ?? [],
      });
    } else {
      addTemplateGeneralAction.mutate(form);
    }
  };
  const handleClose = () => {
    setOpen(false);
    queryClient.removeQueries({
      queryKey: ["get-general-template", id],
    });
    reset();
    setId("");
    queryClient.invalidateQueries({
      exact: true,
      queryKey: ["list-general-templates"],
    });
  };

  return (
    <>
      <Dialog fullWidth maxWidth="md" open={open} onClose={handleClose}>
        <DialogContent>
          <div className="w-full h-screen max-h-[800px]">
            <div className="flex justify-between pb-5 items-center">
              <Typography variant="h5" className="font-semibold">
                {id ? "Editar modelo geral" : "Novo modelo geral"}
              </Typography>
              <ModalConfirm
                title="Salvar o modelo?"
                onConfirm={handleSaveTemplate}
              >
                <Button
                  variant="contained"
                  loading={
                    addTemplateGeneralAction.isPending ||
                    updateTemplateGeneralAction.isPending
                  }
                  loadingPosition="start"
                >
                  Salvar
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
                    helperText={errors.channelId}
                  >
                    {(listChannelAction.data || []).map((c) => {
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
                    label="Idioma"
                    required
                    value={form.lang}
                    onChange={(e) => setField("lang", e.target.value as any)}
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
                  Adicione exemplo para cada variável
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
                  {(form.variables ?? []).map((variable, i) => (
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
                            (form.variables ?? []).map((v) =>
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
                        (form.variables ?? []).map((v) => ({
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
