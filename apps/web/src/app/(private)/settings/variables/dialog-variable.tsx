"use client";

import {
  createSystemVariable,
  retrieveSystemVariable,
  updateSystemVariable,
} from "@/app/actions/system-variables";
import { createSystemVariableSchema } from "@/app/actions/system-variables/schema";
import CustomTextField from "@/components/custom-text-field";
import ModalConfirm from "@/components/modal-confirm";
import {
  useServerActionMutation,
  useServerActionQuery,
} from "@/hooks/server-action-hooks";
import { useFormState } from "@/hooks/use-form-state";
import { useSystemVariablesDialog } from "@/hooks/use-system-variables";
import {
  Button,
  Dialog,
  DialogContent,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";
import { SystemVariable } from "@omnichannel/core/domain/entities/system-variable";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "react-toastify";

const resolverTypeOptions: {
  value: SystemVariable.ResolverType;
  label: string;
  description: string;
}[] = [
  {
    value: "contact_field",
    label: "Campo do Contato",
    description: "Exibe um campo do contato (ex: nome)",
  },
  {
    value: "attendant_field",
    label: "Campo do Atendente",
    description: "Exibe um campo do atendente (ex: nome, setor)",
  },
  {
    value: "time_based",
    label: "Saudação",
    description: "Bom dia, Boa tarde ou Boa noite",
  },
  {
    value: "current_time",
    label: "Horário Atual",
    description: "Horário atual no formato HH:mm",
  },
  {
    value: "current_date",
    label: "Data Atual",
    description: "Data atual no formato DD/MM/YYYY",
  },
  {
    value: "day_of_week",
    label: "Dia da Semana",
    description: "Dia da semana por extenso",
  },
  {
    value: "conversation_field",
    label: "Campo da Conversa",
    description: "Exibe um campo da conversa (ex: protocolo)",
  },
  {
    value: "custom",
    label: "Valor Personalizado",
    description: "Um valor fixo definido por você",
  },
];

export default function DialogVariable() {
  const { open, setOpen, setId, id } = useSystemVariablesDialog();
  const queryClient = useQueryClient();

  const { form, setField, validateAll, errors, reset } = useFormState(
    createSystemVariableSchema,
    {
      key: "",
      label: "",
      description: "",
      resolverType: "custom" as SystemVariable.ResolverType,
      resolverConfig: {},
    }
  );

  const updateAction = useServerActionMutation(updateSystemVariable, {
    onSuccess() {
      setOpen(false);
      toast.success("Variável atualizada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["system-variables"] });
    },
    onError(err) {
      toast.error(err.message);
    },
  });

  const getAction = useServerActionQuery(retrieveSystemVariable, {
    input: { id },
    queryKey: ["system-variables", id],
    enabled: !!id && open,
  });

  useEffect(() => {
    if (id && getAction.data) {
      const variable = getAction.data;
      reset({
        key: variable.key,
        label: variable.label,
        description: variable.description ?? "",
        resolverType: variable.resolverType,
        resolverConfig: variable.resolverConfig,
      });
    }
  }, [id, getAction.data, reset]);

  const createAction = useServerActionMutation(createSystemVariable, {
    onSuccess() {
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["system-variables"] });
      toast.success("Variável criada com sucesso!");
    },
    onError(err) {
      toast.error(err.message);
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
        queryKey: ["system-variables"],
        exact: false,
      });
    };
  }, [queryClient]);

  const handleSave = async () => {
    const result = validateAll();
    if (!result) return;

    if (id) {
      updateAction.mutate({
        id,
        label: form.label,
        description: form.description,
        resolverConfig: form.resolverConfig,
      });
    } else {
      createAction.mutate(form);
    }
  };

  const handleClose = () => {
    setOpen(false);
    queryClient.removeQueries({
      queryKey: ["system-variables", id],
    });
    reset();
    setId("");
    queryClient.invalidateQueries({
      exact: true,
      queryKey: ["system-variables"],
    });
  };

  const renderResolverConfigFields = () => {
    switch (form.resolverType) {
      case "contact_field":
        return (
          <FormControl fullWidth>
            <InputLabel>Campo do Contato</InputLabel>
            <Select
              label="Campo do Contato"
              value={form.resolverConfig.field ?? "name"}
              onChange={(e) =>
                setField("resolverConfig", {
                  ...form.resolverConfig,
                  field: e.target.value,
                })
              }
            >
              <MenuItem value="name">Nome</MenuItem>
              <MenuItem value="value">Telefone/Identificador</MenuItem>
            </Select>
          </FormControl>
        );
      case "attendant_field":
        return (
          <FormControl fullWidth>
            <InputLabel>Campo do Atendente</InputLabel>
            <Select
              label="Campo do Atendente"
              value={form.resolverConfig.field ?? "name"}
              onChange={(e) =>
                setField("resolverConfig", {
                  ...form.resolverConfig,
                  field: e.target.value,
                })
              }
            >
              <MenuItem value="name">Nome</MenuItem>
              <MenuItem value="sectorName">Nome do Setor</MenuItem>
            </Select>
          </FormControl>
        );
      case "conversation_field":
        return (
          <FormControl fullWidth>
            <InputLabel>Campo da Conversa</InputLabel>
            <Select
              label="Campo da Conversa"
              value={form.resolverConfig.field ?? "id"}
              onChange={(e) =>
                setField("resolverConfig", {
                  ...form.resolverConfig,
                  field: e.target.value,
                })
              }
            >
              <MenuItem value="id">ID/Protocolo</MenuItem>
            </Select>
          </FormControl>
        );
      case "custom":
        return (
          <CustomTextField
            label="Valor"
            fullWidth
            value={form.resolverConfig.value ?? ""}
            onChange={(e) =>
              setField("resolverConfig", {
                ...form.resolverConfig,
                value: e.target.value,
              })
            }
            helperText="Valor fixo que será exibido"
          />
        );
      default:
        return null;
    }
  };

  return (
    <Dialog fullWidth maxWidth="sm" open={open} onClose={handleClose}>
      <DialogContent>
        <div className="w-full">
          <div className="flex justify-between pb-5 items-center">
            <Typography variant="h5" className="font-semibold">
              {id ? "Editar variável" : "Nova variável"}
            </Typography>
            <ModalConfirm title="Salvar a variável?" onConfirm={handleSave}>
              <Button
                variant="contained"
                loading={createAction.isPending || updateAction.isPending}
                loadingPosition="start"
              >
                Salvar
              </Button>
            </ModalConfirm>
          </div>

          <div className="flex flex-col gap-4">
            <CustomTextField
              label="Nome"
              value={form.label}
              required
              fullWidth
              placeholder="ex: Nome do Cliente"
              error={!!errors.label}
              helperText={errors.label || "Nome amigável da variável"}
              onChange={(e) => setField("label", e.target.value)}
            />

            <CustomTextField
              label="Chave"
              value={form.key}
              required
              fullWidth
              disabled={!!id}
              placeholder="ex: nome_cliente"
              error={!!errors.key}
              helperText={
                errors.key ||
                (id
                  ? "A chave não pode ser alterada"
                  : "Use apenas letras minúsculas, números e _")
              }
              slotProps={{
                input: {
                  startAdornment: (
                    <Typography className="text-gray-500 mr-1">{"{{"}</Typography>
                  ),
                  endAdornment: (
                    <Typography className="text-gray-500 ml-1">{"}}"}</Typography>
                  ),
                },
              }}
              onChange={(e) =>
                setField(
                  "key",
                  e.target.value
                    .replace(/[^a-z0-9_]/gi, "")
                    .toLowerCase()
                    .slice(0, 100)
                )
              }
            />

            <FormControl fullWidth>
              <InputLabel>Tipo</InputLabel>
              <Select
                label="Tipo"
                disabled={!!id}
                value={form.resolverType}
                onChange={(e) => {
                  setField(
                    "resolverType",
                    e.target.value as SystemVariable.ResolverType
                  );
                  setField("resolverConfig", {});
                }}
              >
                {resolverTypeOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    <div>
                      <Typography variant="body2">{option.label}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {option.description}
                      </Typography>
                    </div>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {renderResolverConfigFields()}

            <CustomTextField
              label="Descrição"
              value={form.description ?? ""}
              fullWidth
              multiline
              rows={2}
              placeholder="Descrição opcional da variável"
              error={!!errors.description}
              helperText={errors.description}
              onChange={(e) => setField("description", e.target.value)}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
