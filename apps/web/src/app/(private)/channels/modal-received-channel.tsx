"use client";
import {
  countConversationsToMigrate,
  listChannels,
  registerReceivedChannel,
  unregisterReceivedChannel,
} from "@/app/actions/channels";
import { registerReceivedChannelInputSchema } from "@/app/actions/channels/schema";
import CustomAvatar from "@/components/custom-avatar";
import CustomTextField from "@/components/custom-text-field";
import {
  useServerActionMutation,
  useServerActionQuery,
} from "@/hooks/server-action-hooks";
import { useChannels } from "@/hooks/use-channels";
import { useFormState } from "@/hooks/use-form-state";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Radio,
} from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";

export function ModalReceivedChannel() {
  const {
    openModalReceived,
    channelId,
    closeReceivedModal,
    hasResponseChannel,
  } = useChannels();
  const queryClient = useQueryClient();
  const { form, validateAll, setField, reset } = useFormState(
    registerReceivedChannelInputSchema,
    {
      receivedChannelId: "",
      responseChannelId: "",
      migrateConversations: false,
    }
  );

  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [migrationConfirmText, setMigrationConfirmText] = useState("");
  const [conversationsCount, setConversationsCount] = useState(0);

  const registerReceivedChannelAction = useServerActionMutation(
    registerReceivedChannel,
    {
      onSuccess() {
        toast.success("Canal registrado com sucesso");
        handleClose();
        queryClient.invalidateQueries({
          exact: true,
          queryKey: ["list-channels"],
        });
      },
      onError(err) {
        toast.error(err.message);
      },
    }
  );

  const unregisterReceivedChannelAction = useServerActionMutation(
    unregisterReceivedChannel,
    {
      onSuccess() {
        toast.success("Canal de recebimento removido");
        handleClose();
        queryClient.invalidateQueries({
          exact: true,
          queryKey: ["list-channels"],
        });
      },
      onError(err) {
        toast.error(err.message);
      },
    }
  );

  const countConversationsAction = useServerActionMutation(
    countConversationsToMigrate,
    {
      onSuccess(data) {
        if (data.count > 0) {
          setConversationsCount(data.count);
          setShowMigrationModal(true);
        } else {
          registerReceivedChannelAction.mutate({
            ...form,
            migrateConversations: false,
          });
        }
      },
      onError(err) {
        toast.error(err.message);
      },
    }
  );

  const listChannelsAction = useServerActionQuery(listChannels, {
    input: { type: "evolution" },
    enabled: false,
    queryKey: ["list-channels-to-received"],
  });

  useEffect(() => {
    if (openModalReceived) {
      listChannelsAction.refetch();
      setField("receivedChannelId", channelId);
    }
  }, [openModalReceived, channelId, setField]);

  function handleClose() {
    reset();
    setShowMigrationModal(false);
    setMigrationConfirmText("");
    setConversationsCount(0);
    closeReceivedModal();
  }

  function handleSaveClick() {
    const results = validateAll();
    if (!results.ok) return;

    countConversationsAction.mutate({ channelId });
  }

  function handleMigrationConfirm() {
    registerReceivedChannelAction.mutate({
      ...form,
      migrateConversations: true,
    });
    setShowMigrationModal(false);
  }

  function handleSkipMigration() {
    registerReceivedChannelAction.mutate({
      ...form,
      migrateConversations: false,
    });
    setShowMigrationModal(false);
  }

  const channels = useMemo(
    () => (listChannelsAction.data || []).filter((c) => c.id !== channelId),
    [listChannelsAction.data, channelId]
  );

  const isPending =
    registerReceivedChannelAction.isPending ||
    countConversationsAction.isPending;

  return (
    <>
      <Dialog
        open={openModalReceived && !showMigrationModal}
        onClose={handleClose}
        fullWidth
        closeAfterTransition={false}
      >
        <div className="flex flex-col">
          <DialogTitle>Registrar canal de recebimento</DialogTitle>
          <DialogContentText
            classes={{
              root: "!pl-7",
            }}
          >
            Selecione o canal por onde será respondido os atendimentos
          </DialogContentText>
        </div>
        <DialogContent
          classes={{
            root: "!px-2",
          }}
        >
          <List>
            {channels.map((channel) => {
              return (
                <ListItem
                  key={channel.id}
                  disablePadding
                  secondaryAction={
                    <FormControlLabel
                      tabIndex={-1}
                      label=""
                      control={
                        <Radio checked={form.responseChannelId === channel.id} />
                      }
                      onChange={() => setField("responseChannelId", channel.id)}
                    />
                  }
                >
                  <ListItemButton
                    onClick={() => {
                      setField("responseChannelId", channel.id);
                    }}
                  >
                    <ListItemAvatar>
                      <CustomAvatar color="primary" alt={channel.name}>
                        {channel.name
                          .split(" ")
                          .map((w: string) => w[0])
                          .join("")}
                      </CustomAvatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={channel.name}
                      secondary={channel.type}
                      className="mr-2"
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        </DialogContent>
        <DialogActions
          classes={{
            root: "!pb-6 !px-4 !justify-between",
          }}
        >
          {hasResponseChannel ? (
            <Button
              onClick={() => {
                unregisterReceivedChannelAction.mutate({ channelId });
              }}
              disabled={unregisterReceivedChannelAction.isPending}
              variant="outlined"
              color="error"
              loading={unregisterReceivedChannelAction.isPending}
            >
              Remover
            </Button>
          ) : (
            <div />
          )}
          <Button
            onClick={handleSaveClick}
            disabled={isPending || !form.responseChannelId || !channels.length}
            variant="contained"
            loading={isPending}
          >
            Salvar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={showMigrationModal}
        onClose={() => setShowMigrationModal(false)}
        fullWidth
      >
        <DialogTitle
          variant="h5"
          className="flex items-center gap-2 !text-amber-600"
        >
          <i className="tabler-alert-triangle" />
          Migrar conversas existentes?
        </DialogTitle>
        <DialogContent>
          <DialogContentText className="!mb-4">
            Existem <strong>{conversationsCount}</strong> conversa(s) associadas
            a este canal que ainda não possuem canal de recebimento definido.
            Deseja migrá-las para o canal de resposta selecionado?
          </DialogContentText>
          <DialogContentText className="!mb-4 !text-sm text-gray-600">
            As conversas serão movidas para o canal de resposta e este canal
            será marcado como a origem das mensagens.
          </DialogContentText>

          <CustomTextField
            fullWidth
            label="Digite MIGRAR para confirmar a migração"
            value={migrationConfirmText}
            onChange={(e) => setMigrationConfirmText(e.target.value)}
            placeholder="MIGRAR"
          />
        </DialogContent>
        <DialogActions className="!pb-6 !px-4 !justify-between">
          <Button
            onClick={handleSkipMigration}
            variant="outlined"
            color="inherit"
            disabled={registerReceivedChannelAction.isPending}
          >
            Pular migração
          </Button>
          <Button
            onClick={handleMigrationConfirm}
            variant="contained"
            color="warning"
            disabled={
              migrationConfirmText !== "MIGRAR" ||
              registerReceivedChannelAction.isPending
            }
            loading={registerReceivedChannelAction.isPending}
          >
            Migrar conversas
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
