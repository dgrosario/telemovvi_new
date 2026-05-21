"use client";

import CustomTextField from "@/components/custom-text-field";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  MenuItem,
  Select,
  Stack,
} from "@mui/material";
import { Icon } from "@iconify/react";
import { useState } from "react";
import {
  formatPhoneNumber,
  isValidBrazilianPhone,
  MAX_PHONE_INPUT_LENGTH,
} from "@/utils/phone-formatter";
import { PartnerContact } from "@omnichannel/core/domain/entities/partner-contact";
import type { Channel } from "@omnichannel/core/domain/entities/channel";

type ContactType = "whatsapp" | "instagram";

interface Props {
  open: boolean;
  onClose: () => void;
  onAdd: (contact: ReturnType<PartnerContact["raw"]>) => void;
}

export function ModalNewContact({ open, onClose, onAdd }: Props) {
  const [contactType, setContactType] = useState<ContactType>("whatsapp");
  const [contactValue, setContactValue] = useState("");
  const [error, setError] = useState("");

  const handleClose = () => {
    setContactType("whatsapp");
    setContactValue("");
    setError("");
    onClose();
  };

  const validate = (): boolean => {
    const rawValue = contactValue.trim();

    if (!rawValue) {
      setError("Contato é obrigatório");
      return false;
    }

    if (contactType === "whatsapp") {
      const digits = rawValue.replace(/\D/g, "");
      if (!isValidBrazilianPhone(digits)) {
        setError("Apenas números brasileiros são aceitos");
        return false;
      }
    } else if (contactType === "instagram") {
      const username = rawValue.replace(/^@/, "");
      if (!/^[a-zA-Z0-9][a-zA-Z0-9._]{0,29}$/.test(username)) {
        setError("Username inválido (letras, números, . e _)");
        return false;
      }
    }

    return true;
  };

  const handleAdd = () => {
    if (!validate()) return;

    const rawValue = contactValue.trim();
    const value =
      contactType === "whatsapp"
        ? rawValue.replace(/\D/g, "")
        : rawValue.replace(/^@/, "");

    const contact = PartnerContact.create(
      contactType as Channel.Type,
      value
    );

    onAdd(contact.raw());
    handleClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          boxShadow:
            "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
        },
      }}
    >
      <DialogTitle className="!pb-2 !pt-5 !px-5">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10">
            <Icon
              icon="tabler-address-book"
              width={20}
              className="text-primary"
            />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              Novo contato
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Adicione um canal de contato
            </p>
          </div>
        </div>
      </DialogTitle>
      <DialogContent className="!pt-4 !px-5 !pb-3">
        <div className="space-y-3">
          <Select
            fullWidth
            size="small"
            value={contactType}
            onChange={(e) => {
              setContactType(e.target.value as ContactType);
              setContactValue("");
              setError("");
            }}
            sx={{ borderRadius: 2 }}
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
                <span className="font-medium text-sm">WhatsApp</span>
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
                <span className="font-medium text-sm">Instagram</span>
              </Stack>
            </MenuItem>
          </Select>

          <CustomTextField
            fullWidth
            size="small"
            label={contactType === "whatsapp" ? "Telefone" : "Username"}
            autoFocus
            value={
              contactType === "whatsapp"
                ? formatPhoneNumber(contactValue)
                : contactValue
            }
            onChange={(e) => {
              let rawValue = e.target.value;
              if (contactType === "whatsapp") {
                rawValue = rawValue.replace(/\D/g, "");
              } else if (contactType === "instagram") {
                rawValue = rawValue.replace(/^@/, "");
              }
              setContactValue(rawValue);
              if (error) setError("");
            }}
            error={!!error}
            helperText={error}
            placeholder={
              contactType === "whatsapp" ? "55 99 9 9999-9999" : "username"
            }
            inputProps={
              contactType === "whatsapp"
                ? { maxLength: MAX_PHONE_INPUT_LENGTH }
                : undefined
            }
            InputProps={
              contactType === "instagram"
                ? {
                    startAdornment: (
                      <InputAdornment position="start">@</InputAdornment>
                    ),
                  }
                : undefined
            }
          />
        </div>
      </DialogContent>
      <DialogActions className="!px-5 !py-3 !bg-gray-50 !border-t !border-gray-100">
        <Button
          onClick={handleClose}
          size="small"
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
          onClick={handleAdd}
          size="small"
          sx={{
            borderRadius: 2,
            textTransform: "none",
            fontWeight: 500,
            boxShadow: "none",
            "&:hover": { boxShadow: "none" },
          }}
        >
          Adicionar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
