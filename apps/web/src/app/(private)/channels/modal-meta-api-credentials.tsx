"use client";
import { connectChannel } from "@/app/actions/channels";
import CustomTextField from "@/components/custom-text-field";
import { useServerActionMutation } from "@/hooks/server-action-hooks";
import { useChannels } from "@/hooks/use-channels";
import { useFormState } from "@/hooks/use-form-state";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  InputAdornment,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import z from "zod";

const GATEWAY_WEBHOOK_URL = process.env.NEXT_PUBLIC_GATEWAY_URL
  ? `${process.env.NEXT_PUBLIC_GATEWAY_URL}/webhooks/meta`
  : null;

function generateVerifyToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

const metaApiCredentialsSchema = z.object({
  appId: z.string().min(1, "App ID é obrigatório"),
  appSecret: z.string().min(32, "App Secret deve ter pelo menos 32 caracteres"),
  accessToken: z.string().min(1, "Access Token é obrigatório"),
  wabaId: z.string().min(1, "WABA ID é obrigatório"),
  phoneId: z.string().min(1, "Phone Number ID é obrigatório"),
  businessId: z.string().optional(),
});

export function ModalMetaApiCredentials() {
  const {
    openModalMetaApiCredentials,
    channelId,
    closeMetaApiModal,
  } = useChannels();
  const queryClient = useQueryClient();
  const [verifyToken, setVerifyToken] = useState("");
  const { form, validateAll, setField, reset, errors } = useFormState(
    metaApiCredentialsSchema,
    {
      appId: "",
      appSecret: "",
      accessToken: "",
      wabaId: "",
      phoneId: "",
      businessId: "",
    }
  );

  useEffect(() => {
    if (openModalMetaApiCredentials && !verifyToken) {
      setVerifyToken(generateVerifyToken());
    }
  }, [openModalMetaApiCredentials, verifyToken]);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiado!`);
    } catch {
      toast.error("Erro ao copiar");
    }
  };

  const connectChannelAction = useServerActionMutation(connectChannel, {
    onSuccess() {
      toast.success("Canal Meta API conectado com sucesso");
      handleClose();
      queryClient.invalidateQueries({
        exact: true,
        queryKey: ["list-channels"],
      });
    },
    onError(err) {
      toast.error(err.message);
    },
  });

  function handleClose() {
    reset();
    setVerifyToken("");
    closeMetaApiModal();
  }

  function handleSubmit() {
    const results = validateAll();
    if (!results.ok) return;

    if (!channelId) {
      toast.error("Canal não selecionado. Feche o modal e tente novamente.");
      return;
    }

    connectChannelAction.mutate({
      id: channelId,
      type: "meta_api",
      inputPayload: {
        appId: form.appId,
        appSecret: form.appSecret,
        accessToken: form.accessToken,
        wabaId: form.wabaId,
        phoneId: form.phoneId,
        businessId: form.businessId || undefined,
        verifyToken,
      },
    });
  }

  return (
    <Dialog
      open={openModalMetaApiCredentials}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      closeAfterTransition={false}
    >
      <DialogTitle>Conectar via Meta API</DialogTitle>
      <DialogContentText className="!pl-6 !pr-6">
        Insira as credenciais do seu Meta App para conectar diretamente a API do
        WhatsApp Business.
      </DialogContentText>
      <DialogContent>
        {GATEWAY_WEBHOOK_URL && (
          <Box
            sx={{
              mb: 3,
              p: 2,
              bgcolor: "action.hover",
              borderRadius: 1,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Typography variant="subtitle2" gutterBottom fontWeight="bold">
              1. Configure o Webhook no Meta for Developers
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
              <TextField
                fullWidth
                size="small"
                value={GATEWAY_WEBHOOK_URL}
                slotProps={{
                  input: {
                    readOnly: true,
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title="Copiar URL">
                          <IconButton
                            size="small"
                            onClick={() =>
                              copyToClipboard(GATEWAY_WEBHOOK_URL, "URL do Webhook")
                            }
                          >
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ),
                  },
                }}
                label="URL do Webhook"
              />
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <TextField
                fullWidth
                size="small"
                value={verifyToken}
                slotProps={{
                  input: {
                    readOnly: true,
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title="Copiar Token">
                          <IconButton
                            size="small"
                            onClick={() =>
                              copyToClipboard(verifyToken, "Verify Token")
                            }
                          >
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ),
                  },
                }}
                label="Verify Token"
              />
            </Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 1.5, display: "block" }}
            >
              Copie esses valores e configure no painel do Meta antes de preencher
              o formulario abaixo.
            </Typography>
          </Box>
        )}

        <Alert severity="info" className="!mb-4">
          O App Secret sera armazenado de forma segura e usado para validar
          webhooks recebidos do seu Meta App.
        </Alert>
        <form
          id="form-meta-api-credentials"
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="flex flex-col gap-4 mt-2"
        >
          <CustomTextField
            label="App ID"
            placeholder="Ex: 579228267872440"
            value={form.appId}
            onChange={(e) => setField("appId", e.target.value)}
            error={!!errors.appId}
            helperText={errors.appId || "ID do seu Meta App"}
          />
          <CustomTextField
            label="App Secret"
            placeholder="Ex: abc123def456..."
            value={form.appSecret}
            onChange={(e) => setField("appSecret", e.target.value)}
            error={!!errors.appSecret}
            helperText={
              errors.appSecret ||
              "Secret do seu Meta App (para validação de webhooks)"
            }
            type="password"
          />
          <CustomTextField
            label="Access Token"
            placeholder="Token permanente da Meta"
            value={form.accessToken}
            onChange={(e) => setField("accessToken", e.target.value)}
            error={!!errors.accessToken}
            helperText={errors.accessToken || "Token de acesso permanente"}
            type="password"
          />
          <CustomTextField
            label="WABA ID"
            placeholder="Ex: 123456789012345"
            value={form.wabaId}
            onChange={(e) => setField("wabaId", e.target.value)}
            error={!!errors.wabaId}
            helperText={errors.wabaId || "ID da sua conta WhatsApp Business"}
          />
          <CustomTextField
            label="Phone Number ID"
            placeholder="Ex: 123456789012345"
            value={form.phoneId}
            onChange={(e) => setField("phoneId", e.target.value)}
            error={!!errors.phoneId}
            helperText={errors.phoneId || "ID do número de telefone"}
          />
          <CustomTextField
            label="Business ID (Opcional)"
            placeholder="Ex: 123456789012345"
            value={form.businessId}
            onChange={(e) => setField("businessId", e.target.value)}
            helperText="ID do Meta Business (opcional)"
          />
        </form>
      </DialogContent>
      <DialogActions className="!pb-6 !px-4">
        <Button
          variant="outlined"
          onClick={handleClose}
          disabled={connectChannelAction.isPending}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          form="form-meta-api-credentials"
          disabled={connectChannelAction.isPending}
          variant="contained"
          loading={connectChannelAction.isPending}
        >
          Conectar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
