"use client";
import {
  connectChannel,
  updateChannelWithPayload,
  upsertChannel,
} from "@/app/actions/channels";
import { upsertChannelInputSchema } from "@/app/actions/channels/schema";
import { useServerActionMutation } from "@/hooks/server-action-hooks";
import { useChannels } from "@/hooks/use-channels";
import { useFormState } from "@/hooks/use-form-state";
import { useQRCodeConnection } from "@/hooks/use-qrcode-connection";
import { ProxyConnectHandler } from "@/lib/connect-handlers";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Typography,
} from "@mui/material";
import {
  Channel,
  isEvolutionPayload,
  isMetaApiPayload,
  typeChannelsAvailable,
} from "@omnichannel/core/domain/entities/channel";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import CustomTextField from "./custom-text-field";

type MetaApiFormFields = {
  appId: string;
  appSecret: string;
  accessToken: string;
  wabaId: string;
  phoneId: string;
  businessId: string;
  verifyToken: string;
};

const defaultMetaApiFields: MetaApiFormFields = {
  appId: "",
  appSecret: "",
  accessToken: "",
  wabaId: "",
  phoneId: "",
  businessId: "",
  verifyToken: "",
};

export default function ModalRegisterChannels() {
  const queryClient = useQueryClient();
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [metaApiFields, setMetaApiFields] =
    useState<MetaApiFormFields>(defaultMetaApiFields);

  const { form, setField, validateAll, errors, reset } = useFormState(
    upsertChannelInputSchema,
    {
      name: "",
      type: "whatsapp",
    }
  );

  const {
    open,
    channelDescription,
    channelId,
    channelType,
    channelData,
    closeRegisterModal,
  } = useChannels();

  const isEditMode = !!channelId && !!channelData;

  useEffect(() => {
    if (open) {
      if (channelId) {
        setField("id", channelId);
      }
      if (channelDescription) {
        setField("name", channelDescription);
      }
      if (channelType) {
        setField("type", channelType);
      }
      if (channelData && isMetaApiPayload(channelData.payload)) {
        setMetaApiFields({
          appId: channelData.payload.appId || "",
          appSecret: "",
          accessToken: "",
          wabaId: channelData.payload.wabaId || "",
          phoneId: channelData.payload.phoneId || "",
          businessId: channelData.payload.businessId || "",
          verifyToken: "",
        });
      }
    }
  }, [
    open,
    channelId,
    channelDescription,
    channelType,
    channelData,
    setField,
  ]);

  const upsertChannelAction = useServerActionMutation(upsertChannel, {
    onError(error) {
      toast.error(error.message);
    },
    onSuccess() {
      toast.success("Salvo com sucesso!");
      handleClose();
      queryClient.invalidateQueries({
        exact: true,
        queryKey: ["list-channels"],
      });
    },
  });

  const updateChannelAction = useServerActionMutation(updateChannelWithPayload, {
    onError(error) {
      toast.error(error.message);
    },
    onSuccess() {
      toast.success("Salvo com sucesso!");
      handleClose();
      queryClient.invalidateQueries({
        exact: true,
        queryKey: ["list-channels"],
      });
    },
  });

  const connectChannelAction = useServerActionMutation(connectChannel, {
    onSuccess() {
      setIsReconnecting(false);
      toast.success("Canal reconectado com sucesso!");
      handleClose();
      queryClient.invalidateQueries({
        exact: true,
        queryKey: ["list-channels"],
      });
    },
    onError(error) {
      setIsReconnecting(false);
      toast.error(error.message);
    },
  });

  function handleClose() {
    reset();
    setMetaApiFields(defaultMetaApiFields);
    setIsReconnecting(false);
    closeRegisterModal();
  }

  const handleReconnect = useCallback(async () => {
    if (!channelData) return;

    setIsReconnecting(true);

    if (channelData.type === "evolution") {
      await connectChannelAction.mutateAsync({
        id: channelData.id,
        type: channelData.type,
        inputPayload: channelData,
      });
      useQRCodeConnection.setState({
        channelId: channelData.id,
      });
      handleClose();
    } else {
      await ProxyConnectHandler.instance().connect(
        channelData,
        connectChannelAction.mutateAsync
      );
    }
  }, [channelData, connectChannelAction]);

  function handleSubmit() {
    const result = validateAll();
    if (!result.ok) return;

    if (isEditMode && channelType === "meta_api") {
      const hasPayloadChanges = Object.values(metaApiFields).some(
        (v) => v !== ""
      );
      updateChannelAction.mutate({
        id: channelId,
        name: form.name,
        payload: hasPayloadChanges ? metaApiFields : undefined,
      });
    } else if (isEditMode) {
      updateChannelAction.mutate({
        id: channelId,
        name: form.name,
      });
    } else {
      upsertChannelAction.mutate(form);
    }
  }

  const isPending =
    upsertChannelAction.isPending ||
    updateChannelAction.isPending ||
    isReconnecting;

  const renderMetaApiFields = () => (
    <Box className="flex flex-col gap-4 mt-4">
      <Divider>
        <Typography variant="caption" color="text.secondary">
          Credenciais Meta API
        </Typography>
      </Divider>
      <Alert severity="info" className="!mb-2">
        Deixe os campos de senha em branco para manter os valores atuais.
      </Alert>
      <CustomTextField
        label="App ID"
        placeholder="Ex: 579228267872440"
        value={metaApiFields.appId}
        onChange={(e) =>
          setMetaApiFields((prev) => ({ ...prev, appId: e.target.value }))
        }
        helperText="ID do seu Meta App"
      />
      <CustomTextField
        label="App Secret"
        placeholder="Deixe em branco para manter"
        value={metaApiFields.appSecret}
        onChange={(e) =>
          setMetaApiFields((prev) => ({ ...prev, appSecret: e.target.value }))
        }
        helperText="Secret do seu Meta App"
        type="password"
      />
      <CustomTextField
        label="Access Token"
        placeholder="Deixe em branco para manter"
        value={metaApiFields.accessToken}
        onChange={(e) =>
          setMetaApiFields((prev) => ({ ...prev, accessToken: e.target.value }))
        }
        helperText="Token de acesso permanente"
        type="password"
      />
      <CustomTextField
        label="WABA ID"
        placeholder="Ex: 123456789012345"
        value={metaApiFields.wabaId}
        onChange={(e) =>
          setMetaApiFields((prev) => ({ ...prev, wabaId: e.target.value }))
        }
        helperText="ID da sua conta WhatsApp Business"
      />
      <CustomTextField
        label="Phone Number ID"
        placeholder="Ex: 123456789012345"
        value={metaApiFields.phoneId}
        onChange={(e) =>
          setMetaApiFields((prev) => ({ ...prev, phoneId: e.target.value }))
        }
        helperText="ID do número de telefone"
      />
      <CustomTextField
        label="Business ID (Opcional)"
        placeholder="Ex: 123456789012345"
        value={metaApiFields.businessId}
        onChange={(e) =>
          setMetaApiFields((prev) => ({ ...prev, businessId: e.target.value }))
        }
        helperText="ID do Meta Business (opcional)"
      />
    </Box>
  );

  const renderReconnectButton = () => {
    if (!isEditMode || !channelData) return null;

    const buttonConfig: Record<
      Channel.Type,
      { label: string; icon: string } | null
    > = {
      whatsapp: {
        label: "Reconectar com Facebook",
        icon: "tabler-brand-facebook",
      },
      instagram: {
        label: "Reconectar com Facebook",
        icon: "tabler-brand-facebook",
      },
      evolution: {
        label: "Reconectar via QR Code",
        icon: "tabler-qrcode",
      },
      meta_api: null,
    };

    const config = buttonConfig[channelData.type];
    if (!config) return null;

    return (
      <Box className="mt-4">
        <Divider className="!mb-4">
          <Typography variant="caption" color="text.secondary">
            Reconectar Canal
          </Typography>
        </Divider>
        <Button
          variant="outlined"
          fullWidth
          onClick={handleReconnect}
          disabled={isPending}
          startIcon={<i className={config.icon} />}
        >
          {isReconnecting ? "Reconectando..." : config.label}
        </Button>
      </Box>
    );
  };

  const renderEvolutionInfo = () => {
    if (!isEditMode || channelType !== "evolution" || !channelData) return null;

    const instanceName = isEvolutionPayload(channelData.payload)
      ? channelData.payload.instanceName
      : null;

    if (!instanceName) return null;

    return (
      <Box className="mt-4">
        <Divider className="!mb-4">
          <Typography variant="caption" color="text.secondary">
            Informações da Instância
          </Typography>
        </Divider>
        <CustomTextField
          label="Nome da Instância"
          value={instanceName}
          disabled
          helperText="Gerenciado pela Evolution API"
        />
      </Box>
    );
  };

  return (
    <Dialog fullWidth open={open} onClose={handleClose} maxWidth="sm">
      <DialogTitle>
        {isEditMode ? "Editar conexao" : "Nova conexao"}
      </DialogTitle>
      <DialogContent>
        <form
          id="form-channels"
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="flex flex-col gap-5"
        >
          <CustomTextField
            value={form.type}
            data-hidden={isEditMode}
            error={!!errors.type}
            helperText={errors.type}
            slotProps={{
              select: {
                onChange: (e) => setField("type", e.target.value as string),
                renderValue(value) {
                  const type = typeChannelsAvailable.get(value as Channel.Type);
                  return (
                    <div className="flex items-center gap-2 h-full">
                      <i className={type?.icon} />
                      <Typography variant="body1">{type?.name}</Typography>
                    </div>
                  );
                },
              },
            }}
            select
            label="Tipo de conexao"
          >
            {Array.from(typeChannelsAvailable.values()).map((type) => (
              <MenuItem
                key={type.type}
                value={type.type}
                className="flex gap-2 items-center"
              >
                <i className={type.icon} />
                <Typography variant="body1">{type.name}</Typography>
              </MenuItem>
            ))}
          </CustomTextField>
          <CustomTextField
            error={!!errors.name}
            helperText={errors.name}
            label="Nome da conexao"
            id="dialog-subscribe"
            className="w-full"
            placeholder="Canal da Loja 1"
            type="text"
            aria-label="Nome"
            name="name"
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
          />

          {isEditMode && channelType === "meta_api" && renderMetaApiFields()}
          {renderEvolutionInfo()}
          {renderReconnectButton()}
        </form>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={handleClose} disabled={isPending}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          type="submit"
          form="form-channels"
          disabled={isPending}
        >
          {isPending ? "Salvando..." : "Salvar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
