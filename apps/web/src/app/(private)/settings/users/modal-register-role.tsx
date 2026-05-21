"use client";

import { retrieveRole, upsertRole } from "@/app/actions/roles";
import {
  useServerActionMutation,
  useServerActionQuery,
} from "@/hooks/server-action-hooks";
import { useRoles } from "@/hooks/use-roles";
import { usePermissionCounts } from "@/hooks/use-permission-counts";
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { listSectors } from "@/app/actions/sectors";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  getAllPermissionCategories,
  getPermissionsByCategory,
  permissionCategories,
  permissions,
  type PermissionCategory,
  type PolicyName,
} from "@omnichannel/core/domain/services/permissions";
import { Icon } from "@iconify/react";
import { SectorBlocker } from "@/components/sector-blocker";
import {
  getEffectivePermissions,
  getToggleEffectivePermissionImpact,
  toggleItemInSet,
  type ToggleEffectivePermissionImpact,
} from "@/lib/permissions-utils";

export function ModalRegisterRole() {
  const { open, toggleOpen, roleId, setRoleId } = useRoles();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState<PermissionCategory>("users");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<
    Set<PolicyName>
  >(new Set());
  const [blockedSectorIds, setBlockedSectorIds] = useState<Set<string>>(
    new Set()
  );
  const [pendingPermissionToggle, setPendingPermissionToggle] = useState<{
    permName: PolicyName;
    impact: ToggleEffectivePermissionImpact;
  } | null>(null);

  const { data: sectors = [] } = useServerActionQuery(listSectors, {
    input: undefined,
    queryKey: ["list-sectors"],
  });

  const { data: existingRole } = useServerActionQuery(retrieveRole, {
    input: { id: roleId || "" },
    queryKey: ["retrieve-role", roleId],
    enabled: open && !!roleId,
  });

  useEffect(() => {
    if (existingRole) {
      setName(existingRole.name);
      setDescription(existingRole.description ?? "");
      setSelectedPermissions(new Set(existingRole.permissions as PolicyName[]));
      setBlockedSectorIds(new Set(existingRole.blockedSectorIds ?? []));
    } else if (!roleId) {
      setName("");
      setDescription("");
      setSelectedPermissions(new Set());
      setBlockedSectorIds(new Set());
    }
  }, [existingRole, roleId]);

  const upsertRoleAction = useServerActionMutation(upsertRole, {
    onSuccess() {
      toast.success(
        roleId ? "Perfil atualizado com sucesso" : "Perfil criado com sucesso"
      );
      handleClose();
      queryClient.invalidateQueries({
        queryKey: ["list-roles"],
      });
    },
    onError(err) {
      toast.error(err.message);
    },
  });

  const handleClose = () => {
    toggleOpen();
    setRoleId("");
    setName("");
    setDescription("");
    setSelectedPermissions(new Set());
    setBlockedSectorIds(new Set());
    setSearchQuery("");
    setSelectedCategory("users");
  };

  const allPermissions = useMemo(() => Array.from(permissions.keys()), []);
  const categories = useMemo(() => getAllPermissionCategories(), []);
  const effectivePermissions = useMemo(() => {
    return getEffectivePermissions(selectedPermissions);
  }, [selectedPermissions]);
  const permissionCountByCategory = usePermissionCounts(
    categories,
    effectivePermissions
  );

  const filteredPermissions = useMemo(() => {
    let perms = getPermissionsByCategory(selectedCategory);

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      perms = perms.filter((permName) => {
        const permission = permissions.get(permName);
        return (
          permName.toLowerCase().includes(query) ||
          permission?.description.toLowerCase().includes(query)
        );
      });
    }

    return perms;
  }, [selectedCategory, searchQuery]);

  const applyDirectPermissions = (newDirectPermissions: Set<PolicyName>) => {
    const nextEffective = getEffectivePermissions(newDirectPermissions);

    if (!nextEffective.has("view:contact-details")) {
      setBlockedSectorIds(new Set());
    }

    setSelectedPermissions(newDirectPermissions);
  };

  const togglePermission = (permName: PolicyName) => {
    const impact = getToggleEffectivePermissionImpact(
      permName,
      selectedPermissions
    );

    const removedOtherThanSelf = impact.removedDirectPermissions.filter(
      (p) => p !== permName
    );
    if (removedOtherThanSelf.length > 0) {
      setPendingPermissionToggle({ permName, impact });
      return;
    }

    applyDirectPermissions(impact.nextDirectPermissions);
  };

  const handleToggleSector = (sectorId: string) => {
    setBlockedSectorIds(toggleItemInSet(sectorId, blockedSectorIds));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    upsertRoleAction.mutate({
      id: roleId || undefined,
      name,
      description: description || undefined,
      permissions: Array.from(selectedPermissions),
      blockedSectorIds: Array.from(blockedSectorIds),
    });
  };

  const isEditing = !!roleId;
  const isSystemRole = existingRole?.isSystem ?? false;

  return (
    <>
      <Dialog
        open={!!pendingPermissionToggle}
        onClose={() => setPendingPermissionToggle(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Atenção: remoção em cascata</DialogTitle>
        <DialogContent>
          {pendingPermissionToggle && (
            <div className="flex flex-col gap-3">
              <Typography variant="body2">
                Ao desmarcar{" "}
                <strong>
                  {permissions.get(pendingPermissionToggle.permName)?.description ??
                    pendingPermissionToggle.permName}
                </strong>
                , outras permissões também serão removidas porque concedem esse
                acesso por herança.
              </Typography>

              <List dense>
                {pendingPermissionToggle.impact.removedDirectPermissions.map(
                  (name) => (
                    <ListItem key={name}>
                      <ListItemText
                        primary={permissions.get(name)?.description ?? name}
                        secondary={name}
                      />
                    </ListItem>
                  )
                )}
              </List>

              <Typography variant="caption" className="text-gray-600">
                Isso pode afetar outras permissões derivadas automaticamente.
              </Typography>
            </div>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setPendingPermissionToggle(null)}
            variant="outlined"
          >
            Cancelar
          </Button>
          <Button
            onClick={() => {
              if (!pendingPermissionToggle) return;
              applyDirectPermissions(
                pendingPermissionToggle.impact.nextDirectPermissions
              );
              setPendingPermissionToggle(null);
            }}
            variant="contained"
            color="warning"
          >
            Continuar
          </Button>
        </DialogActions>
      </Dialog>

    <Dialog
      fullWidth
      maxWidth="lg"
      open={open}
      onClose={handleClose}
      scroll="paper"
    >
      <DialogTitle variant="h5" className="font-semibold">
        {isEditing ? "Editar Perfil" : "Novo Perfil"}
      </DialogTitle>

      <DialogContent className="!pt-4">
        <form id="role-form" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <TextField
              label="Nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              fullWidth
              disabled={isSystemRole}
            />
            <TextField
              label="Descrição"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              disabled={isSystemRole}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mb-4 items-stretch sm:items-center">
            <TextField
              size="small"
              placeholder="Buscar permissão..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Icon icon="tabler:search" className="text-gray-400" />
                  </InputAdornment>
                ),
              }}
            />
            <div className="flex items-center gap-2">
              <Typography variant="caption">Todas:</Typography>
              <Checkbox
                size="small"
                checked={effectivePermissions.size === allPermissions.length}
                indeterminate={
                  effectivePermissions.size > 0 &&
                  effectivePermissions.size < allPermissions.length
                }
                onChange={(e) => {
                  setSelectedPermissions(
                    e.target.checked ? new Set(allPermissions) : new Set()
                  );
                }}
              />
            </div>
          </div>

          <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
            <Tabs
              value={selectedCategory}
              onChange={(_, value) => setSelectedCategory(value)}
              variant="scrollable"
              scrollButtons="auto"
            >
              {categories.map((category) => {
                const categoryInfo = permissionCategories[category];
                const counts = permissionCountByCategory[category];
                return (
                  <Tab
                    key={category}
                    value={category}
                    label={
                      <div className="flex items-center gap-2">
                        <Icon icon={categoryInfo.icon} className="text-lg" />
                        <span>{categoryInfo.label}</span>
                        <Chip
                          size="small"
                          label={`${counts.selected}/${counts.total}`}
                          color={
                            counts.selected === counts.total
                              ? "success"
                              : counts.selected === 0
                                ? "default"
                                : "primary"
                          }
                          variant={counts.selected > 0 ? "filled" : "outlined"}
                        />
                      </div>
                    }
                  />
                );
              })}
            </Tabs>
          </Box>

          <List className="max-h-[300px] overflow-auto border rounded">
            {filteredPermissions.length === 0 ? (
              <Typography
                variant="body2"
                className="text-center py-8 text-gray-500"
              >
                Nenhuma permissão encontrada
              </Typography>
            ) : (
              filteredPermissions.map((permName) => {
                const permission = permissions.get(permName);
                if (!permission) return null;

                const isChecked = effectivePermissions.has(permName);
                const isDirect = selectedPermissions.has(permName);
                const linkedCount = permission.linkeds.length;
                const isViewContactDetails =
                  permName === "view:contact-details";

                return (
                  <div key={permName}>
                    <ListItem
                      disablePadding
                      secondaryAction={
                        <Checkbox
                          edge="end"
                          tabIndex={-1}
                          disableRipple
                          onChange={() => togglePermission(permName)}
                          checked={isChecked}
                          indeterminate={isChecked && !isDirect}
                        />
                      }
                    >
                      <ListItemButton
                        onClick={() => togglePermission(permName)}
                      >
                        <ListItemText
                          primary={
                            <div className="flex items-center gap-2">
                              <Typography
                                variant="body2"
                                className="font-medium"
                              >
                                {permission.description}
                              </Typography>
                              {isChecked && !isDirect && (
                                <Chip
                                  size="small"
                                  variant="outlined"
                                  color="info"
                                  label="Herdada"
                                  className="text-xs"
                                />
                              )}
                              {isDirect && (
                                <Chip
                                  size="small"
                                  variant="outlined"
                                  color="primary"
                                  label="Direta"
                                  className="text-xs"
                                />
                              )}
                              {linkedCount > 0 && (
                                <Chip
                                  size="small"
                                  variant="outlined"
                                  label={`+${linkedCount} inclusa${linkedCount > 1 ? "s" : ""}`}
                                  className="text-xs"
                                />
                              )}
                            </div>
                          }
                        />
                      </ListItemButton>
                    </ListItem>

                    {isViewContactDetails && (
                      <SectorBlocker
                        isVisible={isChecked}
                        sectors={sectors}
                        blockedSectorIds={blockedSectorIds}
                        onToggle={handleToggleSector}
                        context="role"
                      />
                    )}
                  </div>
                );
              })
            )}
          </List>
        </form>
      </DialogContent>

      <DialogActions className="!px-6 !py-4 gap-4 !flex !items-center !justify-between border-t">
        <Typography variant="caption" className="!text-primary">
          {effectivePermissions.size} de {allPermissions.length} permissões
        </Typography>
        <div className="flex gap-2">
          <Button variant="outlined" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="role-form"
            variant="contained"
            disabled={upsertRoleAction.isPending || !name.trim()}
          >
            {upsertRoleAction.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogActions>
    </Dialog>
    </>
  );
}
