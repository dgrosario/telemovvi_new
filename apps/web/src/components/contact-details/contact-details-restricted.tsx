"use client";

import { getPartnerLabels, upsertPartner } from "@/app/actions/partners";
import { upsertPartnersInputSchema } from "@/app/actions/partners/schema";
import CustomTextField from "@/components/custom-text-field";
import { LabelsSelector } from "@/components/labels-selector";
import { useServerActionMutation, useServerActionQuery } from "@/hooks/server-action-hooks";
import { useFormState } from "@/hooks/use-form-state";
import { Button, Divider, Typography } from "@mui/material";
import { Partner } from "@omnichannel/core/domain/entities/partner";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Flip, toast } from "react-toastify";

type Props = {
  partner: Partner.Raw;
  onSuccess?: () => void;
};

export function ContactDetailsRestricted({ partner, onSuccess }: Props) {
  const queryClient = useQueryClient();
  const { form, setField, errors, validateAll, setForm } = useFormState(
    upsertPartnersInputSchema,
    {
      id: "",
      name: "",
      tags: [],
      labelIds: [],
      contacts: [],
      metadata: [],
    }
  );

  const { data: partnerLabels } = useServerActionQuery(getPartnerLabels, {
    queryKey: ["partner-labels", partner?.id],
    input: { id: partner?.id ?? "" },
    enabled: Boolean(partner?.id),
  });

  useEffect(() => {
    if (partner) {
      setForm({
        ...partner,
        labelIds: partnerLabels?.map((l) => l.id) ?? [],
        contacts: partner.contacts.map((c) => ({
          id: c.id,
          type: c.type,
          value: c.value,
        })),
      });
    }
  }, [partner, partnerLabels, setForm]);

  const upsertMutation = useServerActionMutation(upsertPartner, {
    onError(err) {
      toast.error(err.message, { transition: Flip });
    },
    onSuccess() {
      toast.success("Salvo com sucesso", { transition: Flip });
      queryClient.invalidateQueries({ queryKey: ["contact-details-partner"] });
      queryClient.invalidateQueries({ queryKey: ["list-client"] });
      queryClient.invalidateQueries({ queryKey: ["conversations-paginated"] });
      queryClient.invalidateQueries({ queryKey: ["retrieve-conversation"] });
      onSuccess?.();
    },
  });

  const handleSave = () => {
    const result = validateAll();
    if (!result.ok) return;
    upsertMutation.mutate(form);
  };

  const channelTypeLabel = (type: string) => {
    switch (type) {
      case "whatsapp":
        return "WhatsApp";
      case "instagram":
        return "Instagram";
      case "evolution":
        return "Evolution";
      default:
        return type;
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <CustomTextField
        label="Nome"
        value={form.name}
        error={!!errors.name}
        helperText={errors.name}
        required
        onChange={(e) => setField("name", e.target.value)}
        variant="outlined"
        size="small"
      />

      <Divider />

      <Typography variant="subtitle2" className="font-medium">
        Canais
      </Typography>
      {form.contacts.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {form.contacts.map((c, idx) => (
            <div
              key={idx}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-full text-sm"
            >
              <i
                className={
                  c.type === "whatsapp"
                    ? "tabler-brand-whatsapp text-green-600"
                    : c.type === "instagram"
                      ? "tabler-brand-instagram text-pink-600"
                      : "tabler-message-circle text-gray-600"
                }
              />
              <span>{channelTypeLabel(c.type)}</span>
            </div>
          ))}
        </div>
      ) : (
        <Typography variant="body2" className="text-muted-foreground">
          Nenhum canal cadastrado
        </Typography>
      )}

      <Divider />

      <LabelsSelector
        value={form.labelIds}
        onChange={(labelIds) => setField("labelIds", labelIds)}
        placeholder="Selecione etiquetas..."
      />

      <Button
        onClick={handleSave}
        loading={upsertMutation.isPending}
        loadingPosition="start"
        variant="contained"
        className="mt-2"
      >
        {upsertMutation.isPending ? "Salvando..." : "Salvar"}
      </Button>
    </div>
  );
}
