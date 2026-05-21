"use client";

import { listMyChannels } from "@/app/actions/channels";
import { createConversationInputSchema } from "@/app/actions/conversations/schema";
import { searchPartners, upsertPartner } from "@/app/actions/partners";
import { listAvailableSectorsForNewConversation } from "@/app/actions/sectors";
import { loadTemplatesApprovedFromChannel } from "@/app/actions/templates";
import {
  useServerActionMutation,
  useServerActionQuery,
} from "@/hooks/server-action-hooks";
import { useFormState } from "@/hooks/use-form-state";
import { useChat } from "@/hooks/use-chat";
import { useConversationFilters } from "@/hooks/conversation-filters-loader";
import { useQueryClient } from "@tanstack/react-query";
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  debounce,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { Partner } from "@omnichannel/core/domain/entities/partner";
import { Sector } from "@omnichannel/core/domain/entities/sector";
import {
  getPayloadProperty,
  typeChannelsAvailable,
} from "@omnichannel/core/domain/entities/channel";
import { useEffect, useMemo, useState } from "react";
import CustomAutocomplete from "../custom-autocomplete";
import CustomTextField from "../custom-text-field";
import { toast } from "react-toastify";
import { createConversation } from "@/app/actions/conversations";
import type { GatewayTemplate } from "@/lib/gateway-client";
import { Icon } from "@iconify/react";
import {
  formatPhoneNumber,
  isValidBrazilianPhone,
  MAX_PHONE_INPUT_LENGTH,
} from "@/utils/phone-formatter";
import {
  filterPartnersForNewConversation,
  getContactDisplayValueForNewConversation,
  getDialableContactsForNewConversation,
  getPartnerOptionLabelForNewConversation,
  getPrimaryDialableContactForNewConversation,
} from "./modal-new-conversation.utils";

type ContactType = "whatsapp" | "instagram";

interface NewPartnerForm {
  name: string;
  contactType: ContactType;
  contactValue: string;
}

type TemplateVariableInput = {
  name: string;
  value: string;
};

const initialNewPartnerForm: NewPartnerForm = {
  name: "",
  contactType: "whatsapp",
  contactValue: "",
};

type ContactTypeMeta = {
  iconClass: string;
};

const UNKNOWN_CONTACT_TYPE_META: ContactTypeMeta = {
  iconClass: "tabler-message text-gray-400",
};

const getContactTypeMeta = (contactType?: string | null): ContactTypeMeta => {
  if (!contactType) return UNKNOWN_CONTACT_TYPE_META;

  const mapped = typeChannelsAvailable.get(
    contactType as Parameters<typeof typeChannelsAvailable.get>[0],
  );

  if (mapped) {
    return {
      iconClass: mapped.icon,
    };
  }

  return UNKNOWN_CONTACT_TYPE_META;
};

export function ModalNewConversation() {
  const [open, setOpen] = useState<boolean>(false);
  const [isCreatingPartner, setIsCreatingPartner] = useState(false);
  const [newPartnerForm, setNewPartnerForm] = useState<NewPartnerForm>(
    initialNewPartnerForm,
  );
  const [templateVariableValues, setTemplateVariableValues] = useState<
    Record<string, string>
  >({});
  const [templateVariableErrors, setTemplateVariableErrors] = useState<
    Record<string, string>
  >({});
  const [searchInputValue, setSearchInputValue] = useState("");
  const [newPartnerErrors, setNewPartnerErrors] = useState<{
    name?: string;
    contactValue?: string;
  }>({});

  const chatStore = useChat();
  const { setStatusFilters } = useConversationFilters();
  const queryClient = useQueryClient();

  const { form, setField, errors, reset, validateAll } = useFormState(
    createConversationInputSchema,
    {
      channelId: "",
      partnerId: "",
      templateName: undefined,
      templateLanguage: undefined,
      templateVariables: undefined,
      contactId: "",
      sectorId: undefined,
    },
  );
  const [templates, setTemplates] = useState<GatewayTemplate[]>([]);
  const [availableSectors, setAvailableSectors] = useState<Sector.Props[]>([]);

  const loadTemplatesApprovedFromChannelAction = useServerActionMutation(
    loadTemplatesApprovedFromChannel,
    {
      onSuccess(data) {
        setTemplates(data);
      },
    },
  );

  const listAvailableSectorsAction = useServerActionMutation(
    listAvailableSectorsForNewConversation,
    {
      onSuccess(data) {
        setAvailableSectors(data);
        if (data.length === 1) {
          setField("sectorId", data[0].id);
        }
      },
    },
  );

  const [partners, setPartners] = useState<Partner.Raw[]>([]);
  const searchPartnersAction = useServerActionMutation(searchPartners, {
    onSuccess(data) {
      setPartners(filterPartnersForNewConversation(data));
    },
  });

  const upsertPartnerAction = useServerActionMutation(upsertPartner, {
    onSuccess(data) {
      const dialableContacts = getDialableContactsForNewConversation(
        data.contacts,
      );
      const partnerWithDialableContacts = {
        ...data,
        contacts: dialableContacts,
      };

      setPartners((prev) => {
        const withoutUpdatedPartner = prev.filter((p) => p.id !== data.id);
        return dialableContacts.length > 0
          ? [...withoutUpdatedPartner, partnerWithDialableContacts]
          : withoutUpdatedPartner;
      });

      if (dialableContacts.length > 0) {
        setField("partnerId", data.id);
        setField("contactId", dialableContacts[0].id);
      } else {
        setField("partnerId", "");
        setField("contactId", "");
        toast.warn(
          "Cliente criado, mas não possui telefone discável para iniciar conversa.",
        );
      }
      setIsCreatingPartner(false);
      setNewPartnerForm(initialNewPartnerForm);
      setNewPartnerErrors({});
      toast.success("Cliente criado com sucesso");
    },
    onError(err) {
      toast.error(err.message);
    },
  });

  const searchPartnersActionDebounced = debounce(
    (value: string) => searchPartnersAction.mutate({ query: value }),
    100,
  );

  const listChannelsAction = useServerActionQuery(listMyChannels, {
    input: undefined,
    queryKey: ["list-my-channels"],
  });

  const createConversationAction = useServerActionMutation(createConversation, {
    onSuccess(data) {
      toast.success("Atendimento aberto com sucesso");
      setOpen(false);

      // Abrir a conversa criada sem reload
      if (data?.conversationId) {
        // Mudar para a aba "Aberto"
        setStatusFilters(["open"]);

        // Abrir a conversa
        chatStore.setConversationOpenedId(data.conversationId);

        // Forçar atualização da lista de conversas para mostrar a nova conversa
        queryClient.invalidateQueries({
          queryKey: ["conversations-paginated"],
        });
      }
    },
    onError(err) {
      toast.error(err.message);
    },
  });

  const channels = useMemo(
    () => listChannelsAction.data ?? [],
    [listChannelsAction.data],
  );

  const activeChannels = useMemo(
    () =>
      channels.filter(
        (channel) =>
          channel.status === "connected" && channel.type !== "instagram",
      ),
    [channels],
  );

  const channelSelected = useMemo(
    () => activeChannels.find((c) => c.id === form.channelId) ?? null,
    [activeChannels, form.channelId],
  );

  const isOfficialWhatsAppChannel = useMemo(() => {
    if (!channelSelected || channelSelected.type !== "whatsapp") {
      return false;
    }
    return !!getPayloadProperty(channelSelected.payload, "wabaId");
  }, [channelSelected]);

  const handleClickOpen = () => setOpen(true);

  const handleClose = () => setOpen(false);

  useEffect(() => {
    setField("templateName", undefined, false);
    setTemplateVariableValues({});
    setTemplateVariableErrors({});

    if (form.channelId) {
      listAvailableSectorsAction.mutate({
        channelId: form.channelId,
      });
      setField("sectorId", undefined);
    } else {
      setAvailableSectors([]);
      setTemplates([]);
      setField("sectorId", undefined);
    }
  }, [form.channelId]);

  useEffect(() => {
    if (isOfficialWhatsAppChannel && form.channelId) {
      loadTemplatesApprovedFromChannelAction.mutate({
        channelId: form.channelId,
      });
      return;
    }

    setTemplates([]);
  }, [isOfficialWhatsAppChannel, form.channelId]);

  useEffect(() => {
    if (
      form.channelId &&
      !activeChannels.some((channel) => channel.id === form.channelId)
    ) {
      setField("channelId", "");
    }
  }, [activeChannels, form.channelId, setField]);

  useEffect(() => {
    if (!open) {
      reset();
      setPartners([]);
      setTemplates([]);
      setAvailableSectors([]);
      setTemplateVariableValues({});
      setTemplateVariableErrors({});
      setIsCreatingPartner(false);
      setNewPartnerForm(initialNewPartnerForm);
      setNewPartnerErrors({});
      setSearchInputValue("");
    }
  }, [open]);

  const partnerSelected = useMemo(
    () => partners.find((p) => p.id === form.partnerId) ?? null,
    [partners, form.partnerId],
  );

  const partnersOptions = useMemo(
    () => [
      ...partners,
      {
        name: "+ Novo cliente",
      },
    ],
    [partners],
  );

  const contacts = useMemo(
    () =>
      getDialableContactsForNewConversation(
        partners.find((p) => p.id === form.partnerId)?.contacts ?? [],
      ),
    [partners, form.partnerId],
  );

  useEffect(() => {
    if (
      form.contactId &&
      !contacts.some((contact) => contact.id === form.contactId)
    ) {
      setField("contactId", "");
      return;
    }

    if (contacts.length === 1 && !form.contactId) {
      setField("contactId", contacts[0].id);
    }
  }, [contacts, form.contactId, setField]);

  const contactSelected = useMemo(
    () => contacts.find((c) => c.id === form.contactId) ?? null,
    [contacts, form.contactId],
  );

  const templateSelected = useMemo(
    () => templates.find((t) => t.name === form.templateName) ?? null,
    [templates, form.templateName],
  );

  const templateVariableDefinitions = useMemo(
    () => templateSelected?.variables ?? [],
    [templateSelected],
  );

  const sectorSelected = useMemo(
    () => availableSectors.find((s) => s.id === form.sectorId) ?? null,
    [availableSectors, form.sectorId],
  );

  const handleOpenConversation = () => {
    const results = validateAll();
    if (!results.ok) return;

    if (isOfficialWhatsAppChannel && !form.templateName) {
      toast.error("Selecione um template para continuar");
      return;
    }

    let normalizedTemplateVariables: TemplateVariableInput[] | undefined;
    if (isOfficialWhatsAppChannel && templateSelected) {
      const missingNames = templateVariableDefinitions
        .filter((variable) => {
          const value = templateVariableValues[variable.name];
          return !value || value.trim().length === 0;
        })
        .map((variable) => variable.name);

      if (missingNames.length > 0) {
        setTemplateVariableErrors(
          missingNames.reduce<Record<string, string>>((acc, variableName) => {
            acc[variableName] = "Campo obrigatório";
            return acc;
          }, {}),
        );
        toast.error("Preencha todas as variáveis do template");
        return;
      }

      normalizedTemplateVariables = templateVariableDefinitions.map(
        (variable) => ({
          name: variable.name,
          value: (templateVariableValues[variable.name] ?? "").trim(),
        }),
      );
    }

    createConversationAction.mutate({
      ...form,
      templateLanguage:
        isOfficialWhatsAppChannel && templateSelected
          ? templateSelected.language
          : undefined,
      templateVariables: normalizedTemplateVariables,
    });
  };

  const handleCancelCreatePartner = () => {
    setIsCreatingPartner(false);
    setNewPartnerForm(initialNewPartnerForm);
    setNewPartnerErrors({});
  };

  const validateNewPartner = (): boolean => {
    const errors: { name?: string; contactValue?: string } = {};

    if (!newPartnerForm.name.trim()) {
      errors.name = "Nome é obrigatório";
    }

    const rawValue = newPartnerForm.contactValue.trim();

    if (!rawValue) {
      errors.contactValue = "Contato é obrigatório";
    } else if (newPartnerForm.contactType === "whatsapp") {
      const contactNumbers = rawValue.replace(/\D/g, "");
      if (!isValidBrazilianPhone(contactNumbers)) {
        errors.contactValue = "Apenas números brasileiros são aceitos";
      }
    } else if (newPartnerForm.contactType === "instagram") {
      const username = rawValue.replace(/^@/, "");
      if (!/^[a-zA-Z0-9][a-zA-Z0-9._]{0,29}$/.test(username)) {
        errors.contactValue = "Username inválido (letras, números, . e _)";
      }
    }

    setNewPartnerErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreatePartner = () => {
    if (!validateNewPartner()) return;

    const rawValue = newPartnerForm.contactValue.trim();
    const contactValue =
      newPartnerForm.contactType === "whatsapp"
        ? rawValue.replace(/\D/g, "")
        : rawValue.replace(/^@/, "");
    const contactId = crypto.randomUUID();

    upsertPartnerAction.mutate({
      name: newPartnerForm.name.trim(),
      contacts: [
        {
          id: contactId,
          type: newPartnerForm.contactType,
          value: contactValue,
        },
      ],
      metadata: [],
    });
  };

  const updateNewPartnerField = <K extends keyof NewPartnerForm>(
    field: K,
    value: NewPartnerForm[K],
  ) => {
    setNewPartnerForm((prev) => ({ ...prev, [field]: value }));
    if (field in newPartnerErrors) {
      setNewPartnerErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <>
      <Tooltip title="Nova conversa">
        <IconButton onClick={handleClickOpen}>
          <i className="tabler-plus" />
        </IconButton>
      </Tooltip>
      <Dialog
        open={open}
        onClose={handleClose}
        aria-labelledby="form-dialog-title"
        closeAfterTransition={false}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow:
              "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
          },
        }}
      >
        <DialogTitle id="form-dialog-title" className="!pb-2 !pt-6 !px-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
              <Icon
                icon="tabler-message-plus"
                width={22}
                className="text-primary"
              />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Nova conversa
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Inicie um atendimento com um cliente
              </p>
            </div>
          </div>
        </DialogTitle>
        <DialogContent className="!pt-6 !px-6 !pb-4">
          <div className="space-y-4">
            {isCreatingPartner ? (
              <Box
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 3,
                  p: 3,
                  bgcolor: "grey.50",
                }}
              >
                <Stack spacing={3}>
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon
                          icon="tabler-user-plus"
                          width={18}
                          className="text-primary"
                        />
                      </div>
                      <Typography variant="subtitle1" fontWeight={600}>
                        Novo Cliente
                      </Typography>
                    </div>
                    <IconButton
                      size="small"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCancelCreatePartner();
                      }}
                      sx={{
                        "&:hover": {
                          bgcolor: "error.lighter",
                          color: "error.main",
                        },
                      }}
                    >
                      <Icon icon="tabler-x" width={18} />
                    </IconButton>
                  </Stack>

                  <CustomTextField
                    fullWidth
                    size="small"
                    label="Nome"
                    required
                    value={newPartnerForm.name}
                    onChange={(e) =>
                      updateNewPartnerField("name", e.target.value)
                    }
                    error={!!newPartnerErrors.name}
                    helperText={newPartnerErrors.name}
                  />

                  <FormControl size="small" fullWidth>
                    <Select
                      value={newPartnerForm.contactType}
                      onChange={(e) =>
                        updateNewPartnerField(
                          "contactType",
                          e.target.value as ContactType,
                        )
                      }
                      sx={{
                        borderRadius: 2,
                      }}
                    >
                      <MenuItem value="whatsapp">
                        <Stack direction="row" alignItems="center" gap={1.5}>
                          <div className="w-6 h-6 rounded-md bg-green-50 flex items-center justify-center">
                            <Icon
                              icon="tabler-brand-whatsapp"
                              width={16}
                              color="#25D366"
                            />
                          </div>
                          <span className="font-medium">WhatsApp</span>
                        </Stack>
                      </MenuItem>
                      <MenuItem value="instagram">
                        <Stack direction="row" alignItems="center" gap={1.5}>
                          <div className="w-6 h-6 rounded-md bg-pink-50 flex items-center justify-center">
                            <Icon
                              icon="tabler-brand-instagram"
                              width={16}
                              color="#E4405F"
                            />
                          </div>
                          <span className="font-medium">Instagram</span>
                        </Stack>
                      </MenuItem>
                    </Select>
                  </FormControl>

                  <CustomTextField
                    fullWidth
                    size="small"
                    label={
                      newPartnerForm.contactType === "whatsapp"
                        ? "Telefone"
                        : "Username"
                    }
                    required
                    value={
                      newPartnerForm.contactType === "whatsapp"
                        ? formatPhoneNumber(newPartnerForm.contactValue)
                        : newPartnerForm.contactValue
                    }
                    onChange={(e) => {
                      let rawValue = e.target.value;
                      if (newPartnerForm.contactType === "whatsapp") {
                        rawValue = rawValue.replace(/\D/g, "");
                      } else if (newPartnerForm.contactType === "instagram") {
                        rawValue = rawValue.replace(/^@/, "");
                      }
                      updateNewPartnerField("contactValue", rawValue);
                    }}
                    error={!!newPartnerErrors.contactValue}
                    helperText={newPartnerErrors.contactValue}
                    placeholder={
                      newPartnerForm.contactType === "whatsapp"
                        ? "55 99 9 9999-9999"
                        : "username"
                    }
                    inputProps={
                      newPartnerForm.contactType === "whatsapp"
                        ? { maxLength: MAX_PHONE_INPUT_LENGTH }
                        : undefined
                    }
                    InputProps={
                      newPartnerForm.contactType === "instagram"
                        ? {
                            startAdornment: (
                              <InputAdornment position="start">
                                @
                              </InputAdornment>
                            ),
                          }
                        : undefined
                    }
                  />

                  <Divider className="!my-1" />

                  <Stack direction="row" spacing={2} justifyContent="flex-end">
                    <Button
                      variant="outlined"
                      size="medium"
                      onClick={handleCancelCreatePartner}
                      sx={{
                        borderRadius: 2,
                        textTransform: "none",
                        fontWeight: 500,
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      variant="contained"
                      size="medium"
                      onClick={handleCreatePartner}
                      disabled={upsertPartnerAction.isPending}
                      sx={{
                        borderRadius: 2,
                        textTransform: "none",
                        fontWeight: 500,
                        boxShadow: "none",
                        "&:hover": {
                          boxShadow: "none",
                        },
                      }}
                    >
                      {upsertPartnerAction.isPending
                        ? "Criando..."
                        : "Criar e Selecionar"}
                    </Button>
                  </Stack>
                </Stack>
              </Box>
            ) : (
              <CustomAutocomplete
                fullWidth
                value={partnerSelected}
                inputValue={searchInputValue}
                onInputChange={(_, newValue, reason) => {
                  setSearchInputValue(newValue);
                  if (reason === "input") {
                    if (form.partnerId) {
                      setField("partnerId", "");
                      setField("contactId", "");
                    }
                    if (newValue.length > 0) {
                      searchPartnersActionDebounced(newValue);
                    } else {
                      setPartners([]);
                    }
                  }
                  if (reason === "clear") {
                    setPartners([]);
                  }
                }}
                options={partnersOptions}
                filterOptions={(options) => options}
                noOptionsText="Nenhum cliente encontrado"
                getOptionLabel={(option) => {
                  if (!("id" in option)) return option.name || "";
                  return (
                    getPartnerOptionLabelForNewConversation(option) ||
                    option.name ||
                    ""
                  );
                }}
                getOptionKey={(option) =>
                  "id" in option ? option.id : option.name
                }
                renderOption={(props, option) => {
                  if (!("id" in option)) {
                    return (
                      <Box component="li" {...props} key={option.name}>
                        <Stack direction="row" alignItems="center" gap={1}>
                          <Icon
                            icon="tabler-plus"
                            width={16}
                            className="text-primary"
                          />
                          <Typography
                            variant="body2"
                            color="primary"
                            fontWeight={500}
                          >
                            Novo cliente
                          </Typography>
                        </Stack>
                      </Box>
                    );
                  }
                  const primaryContact =
                    getPrimaryDialableContactForNewConversation(option);
                  const contactDisplay = getContactDisplayValueForNewConversation(
                    primaryContact,
                  );
                  const contactTypeMeta = getContactTypeMeta(
                    primaryContact?.type,
                  );
                  return (
                    <Box component="li" {...props} key={option.id}>
                      <Stack direction="column">
                        <Typography variant="body2">{option.name}</Typography>
                        {contactDisplay && (
                          <Stack direction="row" alignItems="center" gap={1}>
                            <i
                              className={`${contactTypeMeta.iconClass} text-sm shrink-0`}
                              aria-hidden="true"
                            />
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {contactDisplay}
                            </Typography>
                          </Stack>
                        )}
                      </Stack>
                    </Box>
                  );
                }}
                onChange={(e, value: Partner.Raw | { name: string } | null) => {
                  if (!value) {
                    setField("partnerId", "");
                    setField("contactId", "");
                    setPartners([]);
                    return;
                  }
                  if (value.name === "+ Novo cliente") {
                    e.preventDefault();
                    const digits = searchInputValue.replace(/\D/g, "");
                    if (digits.length >= 4) {
                      setNewPartnerForm({
                        name: "",
                        contactType: "whatsapp",
                        contactValue: digits,
                      });
                    } else if (searchInputValue.startsWith("@")) {
                      setNewPartnerForm({
                        name: "",
                        contactType: "instagram",
                        contactValue: searchInputValue.replace(/^@/, ""),
                      });
                    }
                    setIsCreatingPartner(true);
                    return;
                  }
                  if ("id" in value) {
                    const dialableContacts =
                      getDialableContactsForNewConversation(value.contacts);
                    setField("partnerId", value.id);
                    setField("contactId", dialableContacts[0]?.id ?? "");
                  }
                }}
                renderInput={(params) => (
                  <CustomTextField
                    {...params}
                    label="Selecione um cliente"
                    error={!!errors.partnerId}
                    helperText={errors.partnerId}
                  />
                )}
              />
            )}

            {form.partnerId && (
              <CustomAutocomplete
                fullWidth
                disabled={!form.partnerId}
                value={contactSelected}
                options={contacts}
                noOptionsText="Nenhum contato encontrado"
                getOptionLabel={(option) =>
                  getContactDisplayValueForNewConversation(option)
                }
                renderOption={(props, option) => {
                  const contactDisplay = getContactDisplayValueForNewConversation(
                    option,
                  );
                  const contactTypeMeta = getContactTypeMeta(option.type);

                  return (
                    <Box component="li" {...props} key={option.id}>
                      <Stack direction="row" alignItems="center" gap={1}>
                        <i
                          className={`${contactTypeMeta.iconClass} text-sm shrink-0`}
                          aria-hidden="true"
                        />
                        <Stack direction="column" sx={{ minWidth: 0 }}>
                          <Typography variant="body2">
                            {contactDisplay ||
                              (option.type === "instagram"
                                ? "Instagram"
                                : option.value)}
                          </Typography>
                        </Stack>
                      </Stack>
                    </Box>
                  );
                }}
                onChange={(_, value: Partner.Raw["contacts"][0] | null) => {
                  if (value) {
                    setField("contactId", value.id);
                  }
                }}
                renderInput={(params) => (
                  <CustomTextField
                    {...params}
                    label="Selecione um contato"
                    error={!!errors.contactId}
                    helperText={errors.contactId}
                  />
                )}
              />
            )}

            <CustomAutocomplete
              fullWidth
              value={channelSelected}
              options={activeChannels}
              noOptionsText="Nenhum canal ativo encontrado"
              getOptionLabel={(option) =>
                [
                  option.name,
                  getPayloadProperty(option.payload, "phoneNumber") || "",
                ]
                  .filter(Boolean)
                  .join(" - ") || ""
              }
              onChange={(_, value: (typeof activeChannels)[0] | null) => {
                setField("channelId", value?.id ?? "");
              }}
              renderInput={(params) => (
                <CustomTextField
                  {...params}
                  label="Selecione um canal"
                  error={!!errors.channelId}
                  helperText={errors.channelId}
                />
              )}
            />

            {form.channelId && availableSectors.length > 0 && (
              <CustomAutocomplete
                fullWidth
                value={sectorSelected}
                options={availableSectors}
                noOptionsText="Nenhum setor disponível"
                getOptionLabel={(option) => option.name || ""}
                onChange={(_, value: Sector.Props | null) => {
                  setField("sectorId", value?.id);
                }}
                renderInput={(params) => (
                  <CustomTextField
                    {...params}
                    label="Setor (opcional)"
                    helperText={
                      availableSectors.length === 1
                        ? "Setor pré-selecionado automaticamente"
                        : "Selecione o setor para este atendimento"
                    }
                  />
                )}
                renderOption={(props, option) => (
                  <li {...props} key={option.id}>
                    <Stack direction="row" alignItems="center" gap={1.5}>
                      {option.color && (
                        <Box
                          sx={{
                            width: 12,
                            height: 12,
                            borderRadius: "50%",
                            backgroundColor: option.color,
                          }}
                        />
                      )}
                      <span>{option.name}</span>
                    </Stack>
                  </li>
                )}
              />
            )}

            {isOfficialWhatsAppChannel && (
              <>
                <CustomAutocomplete
                  fullWidth
                  value={templateSelected}
                  options={templates}
                  noOptionsText="Nenhum template encontrado"
                  getOptionLabel={(option) => option.name || ""}
                  onChange={(_, value: GatewayTemplate | null) => {
                    setField("templateName", value?.name);
                    setTemplateVariableValues({});
                    setTemplateVariableErrors({});
                  }}
                  renderInput={(params) => (
                    <CustomTextField
                      {...params}
                      label="Selecione um template"
                      error={!!errors.templateName}
                      helperText={errors.templateName}
                    />
                  )}
                />

                {templateSelected && templateVariableDefinitions.length > 0 && (
                  <Stack spacing={2}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Variáveis do template
                    </Typography>
                    {templateVariableDefinitions.map((variable) => (
                      <CustomTextField
                        key={variable.name}
                        fullWidth
                        label={variable.name}
                        value={templateVariableValues[variable.name] ?? ""}
                        onChange={(e) => {
                          const value = e.target.value;
                          setTemplateVariableValues((prev) => ({
                            ...prev,
                            [variable.name]: value,
                          }));

                          if (templateVariableErrors[variable.name]) {
                            setTemplateVariableErrors((prev) => ({
                              ...prev,
                              [variable.name]: "",
                            }));
                          }
                        }}
                        error={!!templateVariableErrors[variable.name]}
                        helperText={templateVariableErrors[variable.name]}
                      />
                    ))}
                  </Stack>
                )}
              </>
            )}
          </div>
        </DialogContent>
        <DialogActions className="!px-6 !py-4 !bg-gray-50 !border-t !border-gray-100">
          <Button
            onClick={handleClose}
            size="medium"
            sx={{
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 500,
              color: "text.secondary",
            }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleOpenConversation}
            size="medium"
            disabled={createConversationAction.isPending}
            sx={{
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 500,
              boxShadow: "none",
              "&:hover": {
                boxShadow: "none",
              },
            }}
          >
            Abrir Conversa
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
