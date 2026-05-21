"use client";

import { getPartnerLabels, upsertPartner } from "@/app/actions/partners";
import { upsertPartnersInputSchema } from "@/app/actions/partners/schema";
import CustomTextField from "@/components/custom-text-field";
import { LabelsSelector } from "@/components/labels-selector";
import {
  useServerActionMutation,
  useServerActionQuery,
} from "@/hooks/server-action-hooks";
import { useFormState } from "@/hooks/use-form-state";
import {
  Button,
  Divider,
  IconButton,
  MenuItem,
  Typography,
  Tabs,
  Tab,
  Box,
  Menu,
} from "@mui/material";
import { Channel } from "@omnichannel/core/domain/entities/channel";
import { Partner } from "@omnichannel/core/domain/entities/partner";
import { PartnerContact } from "@omnichannel/core/domain/entities/partner-contact";
import { ModalNewContact } from "./modal-new-contact";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, useCallback } from "react";
import { Flip, toast } from "react-toastify";
import { withMask } from "use-mask-input";
import {
  getInstagramHandleForDisplay,
  isInstagramScopedId,
} from "@/utils/instagram-contact";

type Props = {
  partner: Partner.Raw;
  onSuccess?: () => void;
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

// Campos de endereço que serão armazenados em metadata
const ADDRESS_FIELDS = ["cep", "endereco"] as const;
type AddressField = (typeof ADDRESS_FIELDS)[number];

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index} className="pt-3">
      {value === index && children}
    </div>
  );
}

export function ContactDetailsForm({ partner, onSuccess }: Props) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(0);
  const [contactTypeMenuAnchor, setContactTypeMenuAnchor] = useState<{
    el: HTMLElement | null;
    idx: number | null;
  }>({ el: null, idx: null });
  const [newContactModalOpen, setNewContactModalOpen] = useState(false);

  const { form, setField, errors, validateAll, setForm } = useFormState(
    upsertPartnersInputSchema,
    {
      id: "",
      name: "",
      tags: [],
      labelIds: [],
      birthday: null,
      contacts: [],
      metadata: [],
    },
  );

  const { data: partnerLabels } = useServerActionQuery(getPartnerLabels, {
    queryKey: ["partner-labels", partner?.id],
    input: { id: partner?.id ?? "" },
    enabled: Boolean(partner?.id),
  });

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

  // Filtrar metadata para não mostrar campos de endereço nos campos personalizados
  const displayMetadata = useMemo(() => {
    return form.metadata.filter(
      (m) => !ADDRESS_FIELDS.includes(m.label as AddressField),
    );
  }, [form.metadata]);

  // Verificar se tem algum campo de endereço preenchido
  const hasAddressData = useMemo(() => {
    return ADDRESS_FIELDS.some((field) => getAddressField(field));
  }, [getAddressField]);

  useEffect(() => {
    if (partner) {
      console.log(
        "[ContactDetailsForm] Setting form with partner contacts:",
        partner.contacts.length,
        partner.contacts.map((c) => ({
          id: c.id,
          type: c.type,
          value: c.value,
        })),
      );
      setForm({
        ...partner,
        labelIds: partnerLabels?.map((l) => l.id) ?? [],
        birthday: partner.birthday || null,
        contacts: partner.contacts.map((c) => ({
          id: c.id,
          type: c.type,
          value:
            c.type === "instagram"
              ? getInstagramHandleForDisplay(c) ||
                (isInstagramScopedId(c.value) ? "" : c.value)
              : c.value,
          channelId: c.channelId ?? null,
        })),
      });
    }
  }, [partner, partnerLabels, setForm]);

  const upsertMutation = useServerActionMutation(upsertPartner, {
    onError(err) {
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
      queryClient.invalidateQueries({ queryKey: ["contact-details-partner"] });
      queryClient.invalidateQueries({ queryKey: ["list-client"] });
      queryClient.invalidateQueries({ queryKey: ["conversations-paginated"] });
      queryClient.invalidateQueries({ queryKey: ["retrieve-conversation"] });
      queryClient.invalidateQueries({ queryKey: ["conversations-by-contact"] });
      queryClient.invalidateQueries({ queryKey: ["grouped-history-messages"] });
      queryClient.invalidateQueries({ queryKey: ["partner-conversation"] });
      onSuccess?.();
    },
  });

  const handleSave = () => {
    const result = validateAll();
    if (!result.ok) {
      if (errors.name) {
        toast.error(errors.name, { transition: Flip });
        return;
      }
      const contactErrors = form.contacts.some((c) => !c.value.trim());
      if (contactErrors) {
        toast.error("Preencha o valor de todos os contatos", {
          transition: Flip,
        });
        return;
      }
      toast.error("Verifique os campos obrigatórios", { transition: Flip });
      return;
    }
    upsertMutation.mutate(form);
  };

  return (
    <div className="flex flex-col gap-2">
      <Tabs
        value={activeTab}
        onChange={(_, newValue) => setActiveTab(newValue)}
        variant="fullWidth"
        sx={{
          minHeight: 36,
          "& .MuiTab-root": {
            minHeight: 36,
            fontSize: "0.8rem",
            textTransform: "none",
            fontWeight: 500,
          },
          "& .MuiTabs-indicator": {
            height: 2,
          },
        }}
      >
        <Tab label="Dados" />
        <Tab
          label={
            <span className="flex items-center gap-1">
              Endereço
              {hasAddressData && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </span>
          }
        />
      </Tabs>

      {/* Aba Dados */}
      <TabPanel value={activeTab} index={0}>
        <div className="flex flex-col gap-3">
          <CustomTextField
            label="Nome"
            value={form.name}
            error={!!errors.name}
            helperText={errors.name}
            required
            onChange={(e) => setField("name", e.target.value)}
            variant="outlined"
            size="small"
            sx={inputSx}
          />

          <CustomTextField
            label="Data de Nascimento"
            type="date"
            value={form.birthday || ""}
            onChange={(e) => setField("birthday", e.target.value || null)}
            variant="outlined"
            size="small"
            InputLabelProps={{ shrink: true }}
            sx={inputSx}
          />

          <Divider className="!my-1" />

          <Typography variant="caption" className="font-medium text-gray-600">
            Contatos
          </Typography>
          {form.contacts.map((c, idx) => (
            <div key={idx} className="flex gap-2 items-center">
                <CustomTextField
                  fullWidth
                  label={c.type === "whatsapp" ? "WhatsApp" : "Instagram"}
                  value={c.value}
                  size="small"
                  onChange={(e) => {
                  const newValue = e.target.value;
                  let detectedType = c.type;

                  if (newValue.startsWith("@") && c.type === "whatsapp") {
                    detectedType = "instagram" as Channel.Type;
                  } else if (
                    /^[\d+]/.test(newValue) &&
                    c.type === "instagram"
                  ) {
                    detectedType = "whatsapp" as Channel.Type;
                  }

                  setField(
                    "contacts",
                    form.contacts.map((contact, i) =>
                      i === idx
                        ? { ...contact, value: newValue, type: detectedType }
                        : contact,
                    ),
                  );
                }}
                ref={withMask(
                  c.type === "whatsapp"
                    ? "55 99 9 9999 9999"
                    : (undefined as unknown as string),
                  { placeholder: " " },
                )}
                variant="outlined"
                sx={inputSx}
                slotProps={{
                  input: {
                    startAdornment: (
                      <IconButton
                        size="small"
                        onClick={(e) =>
                          setContactTypeMenuAnchor({ el: e.currentTarget, idx })
                        }
                        sx={{ mr: 0.5, ml: -0.5, p: 0.5 }}
                      >
                        <i
                          className={
                            c.type === "whatsapp"
                              ? "tabler-brand-whatsapp text-green-600"
                              : "tabler-brand-instagram text-pink-600"
                          }
                        />
                      </IconButton>
                    ),
                  },
                }}
              />
              <IconButton
                size="small"
                color="error"
                onClick={() => {
                  setField(
                    "contacts",
                    form.contacts.filter((_, i) => i !== idx),
                  );
                }}
              >
                <i className="tabler-trash size-4" />
              </IconButton>
            </div>
          ))}

          <Menu
            anchorEl={contactTypeMenuAnchor.el}
            open={Boolean(contactTypeMenuAnchor.el)}
            onClose={() => setContactTypeMenuAnchor({ el: null, idx: null })}
            anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
          >
            <MenuItem
              selected={
                contactTypeMenuAnchor.idx !== null &&
                form.contacts[contactTypeMenuAnchor.idx]?.type === "whatsapp"
              }
              onClick={() => {
                if (contactTypeMenuAnchor.idx !== null) {
                  setField(
                    "contacts",
                    form.contacts.map((contact, i) =>
                      i === contactTypeMenuAnchor.idx
                        ? { ...contact, type: "whatsapp" as Channel.Type }
                        : contact,
                    ),
                  );
                }
                setContactTypeMenuAnchor({ el: null, idx: null });
              }}
            >
              <i className="tabler-brand-whatsapp text-green-600 mr-2" />
              WhatsApp
            </MenuItem>
            <MenuItem
              selected={
                contactTypeMenuAnchor.idx !== null &&
                form.contacts[contactTypeMenuAnchor.idx]?.type === "instagram"
              }
              onClick={() => {
                if (contactTypeMenuAnchor.idx !== null) {
                  setField(
                    "contacts",
                    form.contacts.map((contact, i) =>
                      i === contactTypeMenuAnchor.idx
                        ? { ...contact, type: "instagram" as Channel.Type }
                        : contact,
                    ),
                  );
                }
                setContactTypeMenuAnchor({ el: null, idx: null });
              }}
            >
              <i className="tabler-brand-instagram text-pink-600 mr-2" />
              Instagram
            </MenuItem>
          </Menu>

          <Button
            onClick={() => setNewContactModalOpen(true)}
            variant="text"
            size="small"
            className="!text-primary !justify-start"
            startIcon={<i className="tabler-plus size-4" />}
          >
            Novo Contato
          </Button>

          <ModalNewContact
            open={newContactModalOpen}
            onClose={() => setNewContactModalOpen(false)}
            onAdd={(contact) => {
              setField("contacts", [...form.contacts, contact]);
            }}
          />

          <Divider className="!my-1" />

          <Typography variant="caption" className="font-medium text-gray-600">
            Campos personalizados
          </Typography>
          {displayMetadata.map((m, idx) => {
            const realIndex = form.metadata.findIndex(
              (meta) => meta.label === m.label && meta.value === m.value,
            );
            return (
              <div key={idx} className="flex gap-2 items-center">
                <CustomTextField
                  fullWidth
                  value={m.label}
                  label="Campo"
                  size="small"
                  onChange={(e) =>
                    setField(
                      "metadata",
                      form.metadata.map((metadata, i) =>
                        i === realIndex
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
                        i === realIndex
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
                  onClick={() => {
                    setField(
                      "metadata",
                      form.metadata.filter((_, i) => i !== realIndex),
                    );
                  }}
                >
                  <i className="tabler-trash size-4" />
                </IconButton>
              </div>
            );
          })}
          <Button
            onClick={() => {
              setField("metadata", [
                ...form.metadata,
                { label: "", value: "" },
              ]);
            }}
            variant="text"
            size="small"
            className="!text-primary !justify-start"
            startIcon={<i className="tabler-plus size-4" />}
          >
            Novo Campo
          </Button>

          <Divider className="!my-1" />

          <LabelsSelector
            value={form.labelIds}
            onChange={(labelIds) => setField("labelIds", labelIds)}
            placeholder="Selecione etiquetas..."
          />
        </div>
      </TabPanel>

      {/* Aba Endereço */}
      <TabPanel value={activeTab} index={1}>
        <div className="flex flex-col gap-3">
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
            onChange={(e) => setAddressField("endereco", e.target.value)}
            variant="outlined"
            size="small"
            fullWidth
            sx={inputSx}
          />
        </div>
      </TabPanel>

      <Button
        onClick={handleSave}
        loading={upsertMutation.isPending}
        loadingPosition="start"
        variant="contained"
        size="small"
        className="mt-2"
        sx={{ borderRadius: "8px", textTransform: "none" }}
      >
        {upsertMutation.isPending ? "Salvando..." : "Salvar"}
      </Button>
    </div>
  );
}
