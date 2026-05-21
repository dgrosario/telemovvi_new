"use client";

import { createInternalConversation } from "@/app/actions/internal-conversations";
import { listUsersForInternalConversation } from "@/app/actions/users";
import {
  useServerActionMutation,
  useServerActionQuery,
} from "@/hooks/server-action-hooks";
import {
  Autocomplete,
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import CustomTextField from "../custom-text-field";
import { toast } from "react-toastify";
import { Icon } from "@iconify/react";
import { useQueryClient } from "@tanstack/react-query";

type User = {
  id: string;
  name: string;
  email: string;
};

interface ModalNewInternalConversationProps {
  currentUserId: string;
  externalOpen?: boolean;
  onExternalClose?: () => void;
}

export function ModalNewInternalConversation({
  currentUserId,
  externalOpen,
  onExternalClose,
}: ModalNewInternalConversationProps) {
  const [internalOpen, setInternalOpen] = useState<boolean>(false);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [groupName, setGroupName] = useState<string>("");
  const [errors, setErrors] = useState<{ users?: string; name?: string }>({});

  // Usa controle externo se fornecido, senão usa interno
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = externalOpen !== undefined 
    ? (value: boolean) => { if (!value && onExternalClose) onExternalClose(); }
    : setInternalOpen;

  const queryClient = useQueryClient();

  const listUsersQuery = useServerActionQuery(listUsersForInternalConversation, {
    input: undefined,
    queryKey: ["list-users-internal-conversation"],
    enabled: open,
  });

  const createConversationMutation = useServerActionMutation(
    createInternalConversation,
    {
      onSuccess() {
        toast.success("Conversa criada com sucesso");
        queryClient.invalidateQueries({ queryKey: ["internal-conversations"] });
        handleClose();
      },
      onError(err) {
        toast.error(err.message || "Erro ao criar conversa");
      },
    }
  );

  const handleClickOpen = () => setOpen(true);

  const handleClose = () => {
    setOpen(false);
    setSelectedUsers([]);
    setGroupName("");
    setErrors({});
  };

  const availableUsers = useMemo((): User[] => {
    if (!listUsersQuery.data) return [];
    return listUsersQuery.data
      .filter((user) => user.id !== currentUserId)
      .map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
      }));
  }, [listUsersQuery.data, currentUserId]);

  const isGroup = selectedUsers.length > 1;

  const validate = (): boolean => {
    const newErrors: { users?: string; name?: string } = {};

    if (selectedUsers.length === 0) {
      newErrors.users = "Selecione pelo menos um participante";
    }

    if (isGroup && !groupName.trim()) {
      newErrors.name = "Nome do grupo é obrigatório";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreate = () => {
    if (!validate()) return;

    createConversationMutation.mutate({
      participantIds: selectedUsers.map((u) => u.id),
      name: isGroup ? groupName.trim() : undefined,
    });
  };

  useEffect(() => {
    if (selectedUsers.length <= 1 && groupName) {
      setGroupName("");
    }
  }, [selectedUsers.length, groupName]);

  return (
    <>
      {externalOpen === undefined && (
        <Tooltip title="Nova conversa interna">
          <IconButton onClick={handleClickOpen}>
            <Icon icon="tabler-message-plus" width={20} />
          </IconButton>
        </Tooltip>
      )}
      <Dialog
        open={open}
        onClose={handleClose}
        aria-labelledby="internal-conversation-dialog"
        closeAfterTransition={false}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle id="internal-conversation-dialog">
          <Stack direction="row" alignItems="center" gap={1}>
            <Icon icon="tabler-users" width={24} />
            Nova conversa interna
          </Stack>
        </DialogTitle>
        <DialogContent className="space-y-4">
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Inicie uma conversa privada com outros atendentes do workspace.
          </Typography>

          <Autocomplete
            multiple
            fullWidth
            loading={listUsersQuery.isLoading}
            options={availableUsers}
            value={selectedUsers}
            onChange={(_, value) => {
              setSelectedUsers(value);
              if (errors.users) setErrors((e) => ({ ...e, users: undefined }));
            }}
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderOption={(props, option) => (
              <Box component="li" {...props} key={option.id}>
                <Stack direction="row" alignItems="center" gap={1.5}>
                  <Avatar sx={{ width: 32, height: 32 }}>
                    {option.name.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box>
                    <Typography variant="body2">{option.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {option.email}
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            )}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  {...getTagProps({ index })}
                  key={option.id}
                  avatar={
                    <Avatar sx={{ width: 24, height: 24 }}>
                      {option.name.charAt(0)}
                    </Avatar>
                  }
                  label={option.name}
                  size="small"
                />
              ))
            }
            renderInput={(params) => (
              <CustomTextField
                {...params}
                label="Participantes"
                placeholder="Selecione os participantes"
                error={!!errors.users}
                helperText={errors.users}
              />
            )}
          />

          {isGroup && (
            <CustomTextField
              fullWidth
              label="Nome do grupo"
              placeholder="Digite o nome do grupo"
              value={groupName}
              onChange={(e) => {
                setGroupName(e.target.value);
                if (errors.name) setErrors((e) => ({ ...e, name: undefined }));
              }}
              error={!!errors.name}
              helperText={errors.name}
              required
            />
          )}

          {selectedUsers.length === 1 && (
            <Box
              sx={{
                p: 2,
                bgcolor: "action.hover",
                borderRadius: 1,
                display: "flex",
                alignItems: "center",
                gap: 1.5,
              }}
            >
              <Avatar sx={{ width: 40, height: 40 }}>
                {selectedUsers[0].name.charAt(0).toUpperCase()}
              </Avatar>
              <Box>
                <Typography variant="body2" fontWeight={500}>
                  Conversa direta com {selectedUsers[0].name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  As mensagens serão visíveis apenas para vocês dois
                </Typography>
              </Box>
            </Box>
          )}

          {isGroup && (
            <Box
              sx={{
                p: 2,
                bgcolor: "action.hover",
                borderRadius: 1,
              }}
            >
              <Typography variant="body2" fontWeight={500} sx={{ mb: 0.5 }}>
                Grupo com {selectedUsers.length + 1} participantes
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Você + {selectedUsers.map((u) => u.name).join(", ")}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions className="dialog-actions-dense">
          <Button onClick={handleClose}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={createConversationMutation.isPending}
            startIcon={
              isGroup ? (
                <Icon icon="tabler-users-group" width={18} />
              ) : (
                <Icon icon="tabler-message" width={18} />
              )
            }
          >
            {createConversationMutation.isPending
              ? "Criando..."
              : isGroup
                ? "Criar grupo"
                : "Iniciar conversa"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
