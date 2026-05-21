"use client";

import { bulkUpsertPermissions } from "@/app/actions/users";
import { listRoles } from "@/app/actions/roles";
import {
  useServerActionQuery,
  useServerActionMutation,
} from "@/hooks/server-action-hooks";
import {
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";
import {
  permissions,
  type PolicyName,
} from "@omnichannel/core/domain/services/permissions";
import { type Role } from "@omnichannel/core/domain/entities/role";
import { UserListed } from "@omnichannel/core/infra/repositories/users-repository";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Flip, toast } from "react-toastify";

type Props = {
  open: boolean;
  onClose: () => void;
  users: UserListed[];
};

export function DialogBulkAssignPermissions({ open, onClose, users }: Props) {
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const {
    data: roles = [],
    isLoading: isLoadingRoles,
    error: rolesError,
  } = useServerActionQuery(listRoles, {
    queryKey: ["list-roles"],
    input: undefined,
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setSelectedRoleId(null);
    }
  }, [open]);

  useEffect(() => {
    if (!rolesError) return;

    toast.error(
      `Erro ao carregar perfis: ${rolesError.message}. Você precisa da permissão "list:roles" (incluída em "register:permissions" ou "manage:users").`,
      { autoClose: 7000, transition: Flip }
    );
  }, [rolesError]);

  const selectedPermissions = useMemo(() => {
    if (!selectedRoleId) {
      return new Set<PolicyName>();
    }

    const role = roles.find((r) => r.id === selectedRoleId);
    if (!role) {
      return new Set<PolicyName>();
    }

    const nextPermissions = new Set<PolicyName>();
    for (const perm of role.permissions) {
      if (permissions.has(perm as PolicyName)) {
        nextPermissions.add(perm as PolicyName);
      }
    }

    return nextPermissions;
  }, [selectedRoleId, roles]);

  const bulkPermissionsAction = useServerActionMutation(bulkUpsertPermissions, {
    async onSuccess() {
      await queryClient.invalidateQueries({
        queryKey: ["list-users"],
      });
      toast.success(
        `Permissões atribuídas a ${users.length} usuário(s) com sucesso!`,
        { transition: Flip }
      );
      onClose();
    },
    onError(error) {
      toast.error(error.message, { transition: Flip });
    },
  });

  const handleSave = async () => {
    if (users.length === 0 || selectedRoleId === null) return;

    await bulkPermissionsAction.mutateAsync({
      userIds: users.map((u) => u.id),
      permissions: Array.from(selectedPermissions),
    });
  };

  const totalPermissions = useMemo(() => permissions.size, []);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" closeAfterTransition={false}>
      <div className="flex flex-col">
        <DialogTitle>Atribuir Permissões em Lote</DialogTitle>
        <DialogContentText classes={{ root: "!pl-7" }}>
          Selecione um perfil para aplicar a {users.length} usuário(s) selecionado(s)
        </DialogContentText>
      </div>
      <DialogContent>
        <FormControl fullWidth className="!mb-4">
          <InputLabel id="bulk-role-select-label">Perfil</InputLabel>
          <Select
            labelId="bulk-role-select-label"
            value={selectedRoleId ?? ""}
            label="Perfil"
            onChange={(e) => setSelectedRoleId(e.target.value || null)}
            disabled={isLoadingRoles}
          >
            <MenuItem value="">
              <em>Selecione um perfil</em>
            </MenuItem>
            {isLoadingRoles ? (
              <MenuItem disabled>
                <em>Carregando...</em>
              </MenuItem>
            ) : roles.length === 0 ? (
              <MenuItem disabled>
                <em>Nenhum perfil disponível</em>
              </MenuItem>
            ) : (
              roles.map((role) => (
                <MenuItem key={role.id} value={role.id}>
                  <div className="flex items-center gap-2 w-full justify-between">
                    <span>{role.name}</span>
                    <div className="flex items-center gap-2">
                      {role.isSystem && (
                        <Chip
                          size="small"
                          label="Sistema"
                          color="primary"
                          variant="outlined"
                        />
                      )}
                      <Chip
                        size="small"
                        label={`${role.permissions.length}/${totalPermissions}`}
                        color={
                          role.permissions.length === totalPermissions
                            ? "success"
                            : role.permissions.length === 0
                              ? "error"
                              : "primary"
                        }
                        variant="outlined"
                      />
                    </div>
                  </div>
                </MenuItem>
              ))
            )}
          </Select>
        </FormControl>

        {selectedRoleId && (
          <div className="mt-4">
            <Typography variant="body2" className="text-gray-600 mb-2">
              Este perfil inclui {selectedPermissions.size} de {totalPermissions} permissões
            </Typography>
            <List dense className="max-h-[200px] overflow-auto border rounded">
              {Array.from(selectedPermissions).slice(0, 10).map((name) => {
                const permission = permissions.get(name);
                return (
                  <ListItem key={name} disablePadding>
                    <ListItemButton disabled>
                      <ListItemText
                        primary={permission?.description ?? name}
                        secondary={name}
                        secondaryTypographyProps={{ className: "font-mono text-xs" }}
                      />
                    </ListItemButton>
                  </ListItem>
                );
              })}
              {selectedPermissions.size > 10 && (
                <ListItem>
                  <ListItemText
                    primary={`... e mais ${selectedPermissions.size - 10} permissões`}
                    className="text-center text-gray-500"
                  />
                </ListItem>
              )}
            </List>
          </div>
        )}
      </DialogContent>
      <DialogActions classes={{ root: "!pb-6 !px-4" }}>
        <Button onClick={onClose} variant="outlined" color="inherit">
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          disabled={isLoadingRoles || bulkPermissionsAction.isPending || !selectedRoleId}
          variant="contained"
          loading={bulkPermissionsAction.isPending}
        >
          Aplicar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
