"use client";
import {
  getPartnerLabels,
  removePartners,
  retrievePartner,
  upsertPartner,
} from "@/app/actions/partners";
import { LabelsSelector } from "@/components/labels-selector";
import { listMyChannels } from "@/app/actions/channels";
import { getConversationByPartnerId } from "@/app/actions/conversations";
import { upsertPartnersInputSchema } from "@/app/actions/partners/schema";

import CustomTextField from "@/components/custom-text-field";
import CustomAvatar from "@/components/custom-avatar";
import {
  useServerActionMutation,
  useServerActionQuery,
} from "@/hooks/server-action-hooks";
import { useClients } from "@/hooks/use-clients";
import { useFormState } from "@/hooks/use-form-state";
import { useValidateWhatsApp } from "@/hooks/use-validate-whatsapp";
import { usePermissionCheck } from "@/hooks/use-permission-check";
import {
  Button,
  CircularProgress,
  Divider,
  IconButton,
  MenuItem,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Typography,
} from "@mui/material";
import { Channel } from "@omnichannel/core/domain/entities/channel";
import { PartnerContact } from "@omnichannel/core/domain/entities/partner-contact";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useMemo } from "react";
import { Flip, toast } from "react-toastify";
import { withMask } from "use-mask-input";
import {
  getInstagramHandleForDisplay,
  isInstagramScopedId,
} from "@/utils/instagram-contact";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Campos de endereço que serão armazenados em metadata
const ADDRESS_FIELDS = ["cep", "endereco"] as const;
type AddressField = (typeof ADDRESS_FIELDS)[number];

const CHANNEL_TYPE_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  evolution: "Evolution",
  meta_api: "Meta API",
};

const inputSx = {
  "& .MuiOutlinedInput-root": {
    borderRadius: "8px",
    fontSize: "0.875rem",
  },
  "& .MuiInputLabel-root": {
    fontSize: "0.875rem",
  },
};

function getAcronym(name: string): string {
  if (!name) return "?";
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function getContactDisplayValue(contact?: {
  type: string;
  value: string;
  username?: string | null;
}): string {
  if (!contact) return "";
  if (contact.type === "instagram") {
    return getInstagramHandleForDisplay(contact);
  }
  return contact.value;
}

export default function ModalRegisterClients() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { form, setField, reset, errors, validateAll, setForm } = useFormState(
    upsertPartnersInputSchema,
    {
      id: "",
      name: "",
      tags: [],
      labelIds: [],
      birthday: null as string | null,
      contacts: [],
      metadata: [],
    },
  );

  const { open, toggleOpen, clientId, clearClientId } = useClients();
  const { validateSingle, isValidating } = useValidateWhatsApp();
  const { hasPermission: canViewContactDetails } = usePermissionCheck([
    "view:contact-details",
  ]);
  const [validatedNumbers, setValidatedNumbers] = useState<
    Record<string, boolean | null>
  >({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Helper para obter valor de um campo de endereço
  const getAddressField = useCallback(
    (field: AddressField) => {
      return form.metadata.find((m) => m.label === field)?.value || "";
    },
    [form.metadata],
  );

  // Helper para definir valor de um campo de endereço
  const setAddressField = useCallback(
    (field: AddressField, value: string) => {
      const existingIndex = form.metadata.findIndex((m) => m.label === field);
      if (existingIndex >= 0) {
        if (value) {
          setField(
            "metadata",
            form.metadata.map((m, i) =>
              i === existingIndex ? { ...m, value } : m,
            ),
          );
        } else {
          setField(
            "metadata",
            form.metadata.filter((_, i) => i !== existingIndex),
          );
        }
      } else if (value) {
        setField("metadata", [...form.metadata, { label: field, value }]);
      }
    },
    [form.metadata, setField],
  );

  // Verificar se tem algum campo de endereço preenchido
  const hasAddressData = useMemo(() => {
    return ADDRESS_FIELDS.some((field) => getAddressField(field));
  }, [getAddressField]);

  const retrievePartnerAction = useServerActionQuery(retrievePartner, {
    input: { id: clientId ?? "" },
    enabled: Boolean(clientId),
    queryKey: ["retrieve-partner", clientId],
  });

  const { data: partnerLabels } = useServerActionQuery(getPartnerLabels, {
    queryKey: ["partner-labels", clientId],
    input: { id: clientId ?? "" },
    enabled: Boolean(clientId),
  });

  const { data: channels } = useServerActionQuery(listMyChannels, {
    queryKey: ["my-channels"],
    input: undefined,
  });

  const { data: partnerConversation, isLoading: isLoadingConversation } =
    useServerActionQuery(getConversationByPartnerId, {
      input: { partnerId: clientId ?? "" },
      enabled: Boolean(clientId),
      queryKey: ["partner-conversation", clientId],
    });

  useEffect(() => {
    if (retrievePartnerAction.data) {
      setForm({
        ...retrievePartnerAction.data,
        labelIds: partnerLabels?.map((l) => l.id) ?? [],
        birthday: retrievePartnerAction.data.birthday ?? null,
        contacts: retrievePartnerAction.data.contacts.map((c) => ({
          id: c.id,
          type: c.type,
          value: c.value,
          channelId: c.channelId,
        })),
      });
    }
  }, [retrievePartnerAction.data, partnerLabels]);

  useEffect(() => {
    if (clientId) {
      retrievePartnerAction.refetch();
    }
  }, [clientId]);

  useEffect(() => {
    if (!open) {
      reset();
      clearClientId();
      setValidatedNumbers({});
    }
  }, [open]);

  const upsertClientAction = useServerActionMutation(upsertPartner, {
    onError(err) {
      // Tenta extrair mensagem de erro amigável
      let errorMessage = "Erro ao salvar";
      if (err?.message) {
        try {
          const parsed = JSON.parse(err.message);
          if (Array.isArray(parsed) && parsed[0]?.message) {
            errorMessage = parsed[0].message;
          }
        } catch {
          errorMessage = err.message;
        }
      }
      toast.error(errorMessage, { transition: Flip });
    },
    onSuccess() {
      toast.success("Salvo com sucesso", { transition: Flip });
      toggleOpen();
      reset();
      queryClient.invalidateQueries({ exact: true, queryKey: ["list-client"] });
      queryClient.invalidateQueries({ queryKey: ["conversations-by-contact"] });
      queryClient.invalidateQueries({ queryKey: ["grouped-history-messages"] });
      queryClient.invalidateQueries({ queryKey: ["partner-conversation"] });
    },
  });

  const deletePartnerAction = useServerActionMutation(removePartners, {
    onError(err) {
      toast.error(err.message, { transition: Flip });
    },
    onSuccess() {
      toast.success("Cliente excluído com sucesso", { transition: Flip });
      setDeleteDialogOpen(false);
      toggleOpen();
      reset();
      queryClient.invalidateQueries({ exact: true, queryKey: ["list-client"] });
    },
  });

  const handleValidateNumber = async (contactId: string, value: string) => {
    const cleanedNumber = value.replace(/\D/g, "");
    if (cleanedNumber.length < 10) {
      toast.warning("Número inválido. Digite um número completo.", {
        transition: Flip,
      });
      return;
    }

    try {
      const exists = await validateSingle(cleanedNumber);
      setValidatedNumbers((prev) => ({ ...prev, [contactId]: exists }));

      if (exists) {
        toast.success("Número válido!", { transition: Flip });
      } else {
        toast.error("Este número não possui WhatsApp.", { transition: Flip });
      }
    } catch {
      toast.error("Erro ao validar número.", { transition: Flip });
    }
  };

  const getValidationIcon = (contactId: string, contactType: string) => {
    if (contactType !== "whatsapp") return null;
    const status = validatedNumbers[contactId];
    if (status === true) {
      return (
        <Tooltip title="Número verificado">
          <i className="tabler-circle-check text-green-500 size-4" />
        </Tooltip>
      );
    }
    if (status === false) {
      return (
        <Tooltip title="Número sem WhatsApp">
          <i className="tabler-circle-x text-red-500 size-4" />
        </Tooltip>
      );
    }
    return null;
  };

  const handleGoToConversation = () => {
    if (partnerConversation) {
      toggleOpen();
      router.push(`/conversations?id=${partnerConversation.id}`);
    }
  };

  const handleDeleteConfirm = () => {
    if (clientId) {
      deletePartnerAction.mutate({ ids: [clientId] });
    }
  };

  const isLoading = retrievePartnerAction.isPending && Boolean(clientId);
  const primaryContact = form.contacts[0];

  return (
    <>
      <Sheet open={open} onOpenChange={toggleOpen}>
        <SheetContent
          side="right"
          className="w-[400px] sm:max-w-[400px] p-0 flex flex-col"
        >
          <SheetTitle className="sr-only">
            {clientId ? "Editar Cliente" : "Novo Cliente"}
          </SheetTitle>

          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <CircularProgress size={28} />
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {/* Header */}
              <SheetHeader className="bg-gray-50 border-b px-4 py-3 shrink-0">
                <div className="flex items-center gap-3">
                  <IconButton
                    onClick={() => toggleOpen()}
                    size="small"
                    className="!text-gray-500"
                  >
                    <i className="tabler-x size-5" />
                  </IconButton>
                  <span className="text-gray-800 font-medium text-sm">
                    {clientId ? "Dados do cliente" : "Novo cliente"}
                  </span>
                </div>
              </SheetHeader>

              {/* Profile Section */}
              <div className="bg-gray-50 flex flex-col items-center py-6 px-4 border-b">
                <Avatar className="size-20 bg-white border mb-3">
                  <AvatarFallback className="border text-xl">
                    <CustomAvatar
                      skin="light-static"
                      color="primary"
                      className="size-20 text-xl"
                    >
                      {getAcronym(form.name)}
                    </CustomAvatar>
                  </AvatarFallback>
                </Avatar>

                <h2 className="text-gray-900 text-lg font-semibold text-center">
                  {form.name || "Novo Cliente"}
                </h2>
                {canViewContactDetails && primaryContact && (
                  <p className="text-gray-500 text-sm mt-0.5">
                    {getContactDisplayValue(primaryContact)}
                  </p>
                )}
              </div>

              {/* Tabs Content */}
              <div className="flex-1 overflow-y-auto">
                <Tabs defaultValue="data" className="flex flex-col">
                  <TabsList
                    variant="line"
                    className="px-4 pt-4 shrink-0 border-b gap-4"
                  >
                    <TabsTrigger value="data">Dados</TabsTrigger>
                    <TabsTrigger
                      value="address"
                      className="flex items-center gap-1"
                    >
                      Endereço
                      {hasAddressData && (
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="contacts">Contatos</TabsTrigger>
                    <TabsTrigger value="tags">Etiquetas</TabsTrigger>
                    {clientId && (
                      <TabsTrigger value="actions">Ações</TabsTrigger>
                    )}
                  </TabsList>

                  {/* Tab: Dados */}
                  <TabsContent value="data" className="p-4 space-y-3">
                    <CustomTextField
                      label="Nome"
                      value={form.name}
                      error={!!errors.name}
                      helperText={errors.name}
                      required
                      onChange={(e) => setField("name", e.target.value)}
                      variant="outlined"
                      size="small"
                      fullWidth
                      sx={inputSx}
                    />

                    <CustomTextField
                      label="Data de Nascimento"
                      type="date"
                      value={form.birthday ?? ""}
                      onChange={(e) =>
                        setField("birthday", e.target.value || null)
                      }
                      variant="outlined"
                      size="small"
                      fullWidth
                      slotProps={{ inputLabel: { shrink: true } }}
                      sx={inputSx}
                    />

                    {canViewContactDetails && (
                      <>
                        <Divider className="!my-2" />
                        <Typography
                          variant="caption"
                          className="font-medium text-gray-600"
                        >
                          Campos personalizados
                        </Typography>
                        {form.metadata
                          .filter(
                            (m) =>
                              !ADDRESS_FIELDS.includes(m.label as AddressField),
                          )
                          .map((m, idx) => {
                            const realIdx = form.metadata.findIndex(
                              (meta) =>
                                meta.label === m.label &&
                                meta.value === m.value,
                            );
                            return (
                              <div
                                key={idx}
                                className="flex gap-2 items-center"
                              >
                                <CustomTextField
                                  fullWidth
                                  value={m.label}
                                  label="Campo"
                                  size="small"
                                  onChange={(e) =>
                                    setField(
                                      "metadata",
                                      form.metadata.map((metadata, i) =>
                                        i === realIdx
                                          ? { ...m, label: e.target.value }
                                          : metadata,
                                      ),
                                    )
                                  }
                                  variant="outlined"
                                  sx={inputSx}
                                />
                                <CustomTextField
                                  fullWidth
                                  value={m.value}
                                  label="Valor"
                                  size="small"
                                  onChange={(e) =>
                                    setField(
                                      "metadata",
                                      form.metadata.map((metadata, i) =>
                                        i === realIdx
                                          ? { ...m, value: e.target.value }
                                          : metadata,
                                      ),
                                    )
                                  }
                                  variant="outlined"
                                  sx={inputSx}
                                />
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() =>
                                    setField(
                                      "metadata",
                                      form.metadata.filter(
                                        (_, i) => i !== realIdx,
                                      ),
                                    )
                                  }
                                >
                                  <i className="tabler-trash size-4" />
                                </IconButton>
                              </div>
                            );
                          })}
                        <Button
                          onClick={() =>
                            setField("metadata", [
                              ...form.metadata,
                              { label: "", value: "" },
                            ])
                          }
                          variant="text"
                          size="small"
                          className="!text-primary !justify-start"
                          startIcon={<i className="tabler-plus size-4" />}
                        >
                          Novo Campo
                        </Button>
                      </>
                    )}
                  </TabsContent>

                  {/* Tab: Endereço */}
                  <TabsContent value="address" className="p-4 space-y-3">
                    <CustomTextField
                      label="CEP"
                      value={getAddressField("cep")}
                      onChange={(e) => setAddressField("cep", e.target.value)}
                      variant="outlined"
                      size="small"
                      fullWidth
                      ref={withMask("99999-999", { placeholder: " " })}
                      sx={inputSx}
                    />
                    <CustomTextField
                      label="Endereço"
                      value={getAddressField("endereco")}
                      onChange={(e) =>
                        setAddressField("endereco", e.target.value)
                      }
                      variant="outlined"
                      size="small"
                      fullWidth
                      sx={inputSx}
                    />
                  </TabsContent>

                  {/* Tab: Contatos */}
                  <TabsContent value="contacts" className="p-4 space-y-3">
                    {!canViewContactDetails ? (
                      <div className="space-y-3">
                        {form.contacts.length === 0 ? (
                          <div className="text-center py-6 text-muted-foreground">
                            <i className="tabler-address-book size-10 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">Nenhum contato cadastrado</p>
                          </div>
                        ) : (
                          <>
                            <Typography
                              variant="caption"
                              className="font-medium text-gray-600"
                            >
                              Canais vinculados
                            </Typography>
                            <div className="flex flex-wrap gap-2">
                              {[
                                ...new Set(form.contacts.map((c) => c.type)),
                              ].map((type) => (
                                <div
                                  key={type}
                                  className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded-full text-xs"
                                >
                                  <i
                                    className={
                                      type === "whatsapp"
                                        ? "tabler-brand-whatsapp text-green-600"
                                        : type === "instagram"
                                          ? "tabler-brand-instagram text-pink-600"
                                          : "tabler-message-circle text-gray-600"
                                    }
                                  />
                                  <span>
                                    {CHANNEL_TYPE_LABELS[type] ?? type}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <>
                        {form.contacts.length === 0 ? (
                          <div className="text-center py-6 text-muted-foreground">
                            <i className="tabler-address-book size-10 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">Nenhum contato cadastrado</p>
                          </div>
                        ) : (
                          form.contacts.map((c, idx) => {
                            const compatibleChannels = (channels ?? []).filter(
                              (ch) =>
                                (c.type === "whatsapp" &&
                                  (ch.type === "whatsapp" ||
                                    ch.type === "evolution" ||
                                    ch.type === "meta_api")) ||
                                (c.type === "instagram" &&
                                  ch.type === "instagram"),
                            );

                            return (
                              <div
                                key={idx}
                                className="border rounded-lg p-3 space-y-2"
                              >
                                <div className="flex gap-2 items-center">
                                  <CustomTextField
                                    select
                                    label="Tipo"
                                    value={c.type}
                                    size="small"
                                    className="w-28"
                                    slotProps={{
                                      select: {
                                        MenuProps: {
                                          disablePortal: true,
                                          disableScrollLock: true,
                                          sx: { zIndex: 1500 },
                                          PaperProps: {
                                            sx: { maxHeight: 200 },
                                          },
                                        },
                                      },
                                    }}
                                    onChange={(e) => {
                                      setField(
                                        "contacts",
                                        form.contacts.map((contact, i) =>
                                          i === idx
                                            ? {
                                                ...c,
                                                type: e.target
                                                  .value as Channel.Type,
                                                channelId: null,
                                              }
                                            : contact,
                                        ),
                                      );
                                      if (c.id) {
                                        setValidatedNumbers((prev) => {
                                          const newState = { ...prev };
                                          delete newState[c.id];
                                          return newState;
                                        });
                                      }
                                    }}
                                    variant="outlined"
                                    sx={inputSx}
                                  >
                                    <MenuItem value="whatsapp">
                                      WhatsApp
                                    </MenuItem>
                                    <MenuItem value="instagram">
                                      Instagram
                                    </MenuItem>
                                  </CustomTextField>
                                  <div className="flex items-center gap-1 flex-1">
                                    <CustomTextField
                                      fullWidth
                                      label={
                                        c.type === "instagram"
                                          ? "Username"
                                          : "Número"
                                      }
                                      value={
                                        c.type === "instagram" &&
                                        isInstagramScopedId(c.value)
                                          ? ""
                                          : c.value
                                      }
                                      size="small"
                                      onChange={(e) => {
                                        setField(
                                          "contacts",
                                          form.contacts.map((contact, i) =>
                                            i === idx
                                              ? { ...c, value: e.target.value }
                                              : contact,
                                          ),
                                        );
                                        if (c.id) {
                                          setValidatedNumbers((prev) => {
                                            const newState = { ...prev };
                                            delete newState[c.id];
                                            return newState;
                                          });
                                        }
                                      }}
                                      ref={
                                        c.type === "whatsapp"
                                          ? withMask("55 99 9 9999 9999", {
                                              placeholder: " ",
                                            })
                                          : undefined
                                      }
                                      variant="outlined"
                                      sx={inputSx}
                                    />
                                    {c.type === "whatsapp" && (
                                      <Tooltip title="Verificar WhatsApp">
                                        <IconButton
                                          size="small"
                                          onClick={() =>
                                            c.id &&
                                            handleValidateNumber(c.id, c.value)
                                          }
                                          disabled={isValidating || !c.value}
                                        >
                                          {isValidating ? (
                                            <CircularProgress size={14} />
                                          ) : (
                                            <i className="tabler-search size-4" />
                                          )}
                                        </IconButton>
                                      </Tooltip>
                                    )}
                                    {c.id && getValidationIcon(c.id, c.type)}
                                  </div>
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() =>
                                      setField(
                                        "contacts",
                                        form.contacts.filter(
                                          (_, i) => i !== idx,
                                        ),
                                      )
                                    }
                                  >
                                    <i className="tabler-trash size-4" />
                                  </IconButton>
                                </div>
                                {compatibleChannels.length > 0 && (
                                  <CustomTextField
                                    select
                                    label="Canal (opcional)"
                                    value={c.channelId ?? ""}
                                    size="small"
                                    fullWidth
                                    slotProps={{
                                      select: {
                                        MenuProps: {
                                          disablePortal: true,
                                          disableScrollLock: true,
                                          sx: { zIndex: 1500 },
                                          PaperProps: {
                                            sx: { maxHeight: 200 },
                                          },
                                        },
                                      },
                                    }}
                                    onChange={(e) => {
                                      setField(
                                        "contacts",
                                        form.contacts.map((contact, i) =>
                                          i === idx
                                            ? {
                                                ...c,
                                                channelId:
                                                  e.target.value || null,
                                              }
                                            : contact,
                                        ),
                                      );
                                    }}
                                    variant="outlined"
                                    sx={inputSx}
                                  >
                                    <MenuItem value="">
                                      <em>Nenhum canal específico</em>
                                    </MenuItem>
                                    {compatibleChannels.map((ch) => (
                                      <MenuItem key={ch.id} value={ch.id}>
                                        {ch.name}
                                      </MenuItem>
                                    ))}
                                  </CustomTextField>
                                )}
                              </div>
                            );
                          })
                        )}
                        <Button
                          onClick={() =>
                            setField("contacts", [
                              ...form.contacts,
                              PartnerContact.create("whatsapp", "").raw(),
                            ])
                          }
                          variant="text"
                          size="small"
                          className="!text-primary !justify-start"
                          startIcon={<i className="tabler-plus size-4" />}
                        >
                          Novo Contato
                        </Button>
                      </>
                    )}
                  </TabsContent>

                  {/* Tab: Etiquetas */}
                  <TabsContent value="tags" className="p-4 space-y-3">
                    <Typography variant="caption" className="text-gray-500">
                      Adicione etiquetas para organizar seus clientes.
                    </Typography>
                    <LabelsSelector
                      value={form.labelIds}
                      onChange={(labelIds) => setField("labelIds", labelIds)}
                      placeholder="Selecione etiquetas..."
                    />
                  </TabsContent>

                  {/* Tab: Ações */}
                  {clientId && (
                    <TabsContent value="actions" className="p-4 space-y-3">
                      <div className="border rounded-lg p-3">
                        <Typography
                          variant="caption"
                          className="font-medium text-gray-700"
                        >
                          Conversa
                        </Typography>
                        <p className="text-xs text-gray-500 mt-1 mb-2">
                          {partnerConversation
                            ? "Cliente possui conversa ativa."
                            : "Sem conversas."}
                        </p>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={handleGoToConversation}
                          disabled={
                            !partnerConversation || isLoadingConversation
                          }
                          fullWidth
                          sx={{ borderRadius: "8px", textTransform: "none" }}
                        >
                          {isLoadingConversation ? (
                            <CircularProgress size={16} className="mr-2" />
                          ) : (
                            <i className="tabler-message size-4 mr-2" />
                          )}
                          {partnerConversation
                            ? "Ir para Conversa"
                            : "Nenhuma conversa"}
                        </Button>
                      </div>

                      <div className="border border-red-200 rounded-lg p-3 bg-red-50">
                        <Typography
                          variant="caption"
                          className="font-medium text-red-700"
                        >
                          Zona de Perigo
                        </Typography>
                        <p className="text-xs text-red-600 mt-1 mb-2">
                          Ao excluir, todos os dados serão removidos.
                        </p>
                        <Button
                          variant="outlined"
                          color="error"
                          size="small"
                          onClick={() => setDeleteDialogOpen(true)}
                          fullWidth
                          sx={{ borderRadius: "8px", textTransform: "none" }}
                        >
                          <i className="tabler-trash size-4 mr-2" />
                          Excluir Cliente
                        </Button>
                      </div>
                    </TabsContent>
                  )}
                </Tabs>
              </div>

              {/* Footer */}
              <div className="border-t p-4 shrink-0">
                <Button
                  onClick={() => {
                    const result = validateAll();
                    if (!result.ok) {
                      // Mostrar erro amigável
                      if (errors.name) {
                        toast.error(errors.name, { transition: Flip });
                        return;
                      }
                      // Verificar erros em contatos
                      const contactErrors = form.contacts.some(
                        (c) => !c.value.trim(),
                      );
                      if (contactErrors) {
                        toast.error("Preencha o valor de todos os contatos", {
                          transition: Flip,
                        });
                        return;
                      }
                      toast.error("Verifique os campos obrigatórios", {
                        transition: Flip,
                      });
                      return;
                    }
                    upsertClientAction.mutate(form);
                  }}
                  loading={upsertClientAction.isPending}
                  loadingPosition="start"
                  variant="contained"
                  size="small"
                  fullWidth
                  sx={{ borderRadius: "8px", textTransform: "none" }}
                >
                  {upsertClientAction.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Dialog de confirmação de exclusão */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle sx={{ fontSize: "1rem" }}>Excluir Cliente</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: "0.875rem" }}>
            Tem certeza que deseja excluir <strong>{form.name}</strong>? Esta
            ação não pode ser desfeita.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} size="small">
            Cancelar
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            size="small"
            loading={deletePartnerAction.isPending}
          >
            Excluir
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
