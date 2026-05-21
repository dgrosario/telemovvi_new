"use client";

import { upsertPermissions } from "@/app/actions/users";
import { listRoles } from "@/app/actions/roles";
import { listSectors } from "@/app/actions/sectors";
import {
  listBlockedSectorsForContactDetails,
  setBlockedSectorsForContactDetails,
} from "@/app/actions/sector-permissions";
import {
  useServerActionMutation,
  useServerActionQuery,
} from "@/hooks/server-action-hooks";
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputAdornment,
  InputLabel,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import {
  getAllPermissionCategories,
  getPermissionsByCategory,
  permissionCategories,
  permissions,
  type PermissionCategory,
  type PolicyName,
} from "@omnichannel/core/domain/services/permissions";
import { Icon } from "@iconify/react";
import { usePermissionCounts } from "@/hooks/use-permission-counts";
import { SectorBlocker } from "@/components/sector-blocker";
import {
  getEffectivePermissions,
  getToggleEffectivePermissionImpact,
  toggleItemInSet,
  type ToggleEffectivePermissionImpact,
} from "@/lib/permissions-utils";

type Props = {
  userPermissions: PolicyName[];
  userId: string;
  open?: boolean;
  onClose?: () => void;
  renderTrigger?: boolean;
};

export const PermissionsManager: React.FC<Props> = ({
  userPermissions: initialPermissions,
  userId,
  open: controlledOpen,
  onClose,
  renderTrigger = true,
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = (value: boolean) => {
    if (controlledOpen !== undefined) {
      if (!value && onClose) onClose();
    } else {
      setInternalOpen(value);
    }
  };

  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] =
    useState<PermissionCategory>("users");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [userPermissions, setUserPermissions] = useState<Set<PolicyName>>(
    new Set()
  );
  const [selectedSectorIds, setSelectedSectorIds] = useState<Set<string>>(
    new Set()
  );
  const [pendingPermissionToggle, setPendingPermissionToggle] = useState<{
    permName: PolicyName;
    impact: ToggleEffectivePermissionImpact;
  } | null>(null);

  const {
    data: roles = [],
    isLoading: isLoadingRoles,
    error: rolesError,
  } = useServerActionQuery(listRoles, {
    input: undefined,
    queryKey: ["list-roles"],
    enabled: open,
  });

  const { data: sectors = [] } = useServerActionQuery(listSectors, {
    input: undefined,
    queryKey: ["list-sectors"],
    enabled: open,
  });

  const { data: blockedSectors } = useServerActionQuery(
    listBlockedSectorsForContactDetails,
    {
      input: { userId },
      queryKey: ["blocked-sectors-contact-details", userId],
      enabled: open && !!userId,
    }
  );

  const saveSectorPermissionsAction = useServerActionMutation(
    setBlockedSectorsForContactDetails,
    {
      onError(err) {
        toast.error(err.message);
      },
    }
  );

  useEffect(() => {
    if (rolesError) {
      const errorMsg = rolesError instanceof Error ? rolesError.message : "Erro desconhecido";

      toast.error(
        `Erro ao carregar perfis: ${errorMsg}. Você precisa da permissão "list:roles" (incluída em "register:permissions" ou "manage:roles").`,
        { autoClose: 7000 }
      );
    }
  }, [rolesError]);

  const upsertPermissionsAction = useServerActionMutation(upsertPermissions, {
    onSuccess() {
      toast.success("Permissões registradas com sucesso");
      setOpen(false);
      queryClient.invalidateQueries({
        queryKey: ["list-users"],
      });
    },
    onError(err) {
      toast.error(err.message);
    },
  });

  useEffect(() => {
    if (open) {
      setUserPermissions(new Set(initialPermissions));
      setSelectedRoleId("");
      setSearchQuery("");
    }
  }, [initialPermissions, open]);

  useEffect(() => {
    if (blockedSectors) {
      setSelectedSectorIds(new Set(blockedSectors.map((s) => s.sectorId)));
    }
  }, [blockedSectors]);

  const allPermissions = useMemo(() => Array.from(permissions.keys()), []);
  const categories = useMemo(() => getAllPermissionCategories(), []);

  const effectivePermissions = useMemo(() => {
    return getEffectivePermissions(userPermissions);
  }, [userPermissions]);

  const filteredPermissions = useMemo(() => {
    let perms = getPermissionsByCategory(selectedCategory);

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      perms = perms.filter((name) => {
        const permission = permissions.get(name);
        return (
          name.toLowerCase().includes(query) ||
          permission?.description.toLowerCase().includes(query)
        );
      });
    }

    return perms;
  }, [selectedCategory, searchQuery]);

  const permissionCountByCategory = usePermissionCounts(
    categories,
    effectivePermissions
  );

  const applyDirectPermissions = (newDirectPermissions: Set<PolicyName>) => {
    const nextEffective = getEffectivePermissions(newDirectPermissions);

    if (!nextEffective.has("view:contact-details")) {
      setSelectedSectorIds(new Set());
    }

    setUserPermissions(newDirectPermissions);
    setSelectedRoleId("");
  };

  const togglePermission = (name: PolicyName) => {
    const impact = getToggleEffectivePermissionImpact(name, userPermissions);

    const removedOtherThanSelf = impact.removedDirectPermissions.filter(
      (p) => p !== name
    );
    if (removedOtherThanSelf.length > 0) {
      setPendingPermissionToggle({ permName: name, impact });
      return;
    }

    applyDirectPermissions(impact.nextDirectPermissions);
  };

  const toggleSectorForContactDetails = (sectorId: string) => {
    setSelectedSectorIds(toggleItemInSet(sectorId, selectedSectorIds));
  };

  const applyRoleTemplate = (roleId: string) => {
    setSelectedRoleId(roleId);

    const role = roles.find((r) => r.id === roleId);
    if (!role) {
      setUserPermissions(new Set());
      setSelectedSectorIds(new Set());
      return;
    }

    const newPermissions = new Set<PolicyName>();
    for (const perm of role.permissions) {
      if (permissions.has(perm as PolicyName)) {
        newPermissions.add(perm as PolicyName);
      }
    }
    setUserPermissions(newPermissions);

    if (role.blockedSectorIds && role.blockedSectorIds.length > 0) {
      setSelectedSectorIds(new Set(role.blockedSectorIds));
    } else {
      setSelectedSectorIds(new Set());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const hasContactDetailsPermission = userPermissions.has("view:contact-details");
    const sectorsToSave = hasContactDetailsPermission ? Array.from(selectedSectorIds) : [];

    await Promise.all([
      upsertPermissionsAction.mutateAsync({
        userId,
        permissions: Array.from(userPermissions),
      }),
      saveSectorPermissionsAction.mutateAsync({
        userId,
        sectorIds: sectorsToSave,
      }),
    ]);
  };

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
                  (permName) => (
                    <ListItem key={permName}>
                      <ListItemText
                        primary={
                          permissions.get(permName)?.description ?? permName
                        }
                        secondary={permName}
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

      {renderTrigger && (
        <Button
          disableRipple
          variant="text"
          fullWidth
          className="!w-full hover:!bg-transparent !pl-5 !justify-start"
          startIcon={<i className="tabler-license text-gray-800 !size-4" />}
          onClick={() => setOpen(true)}
        >
          <span className="font-light text-gray-800">Permissões</span>
        </Button>
      )}
      <Dialog
        fullWidth
        maxWidth="lg"
        className="p-4"
        open={open}
        onClose={() => setOpen(false)}
        scroll="paper"
      >
        <DialogTitle variant="h5" className="font-semibold flex items-center justify-between">
          <span>Permissões</span>
          <div className="flex items-center gap-2">
            <Label className="text-sm font-normal">Todas</Label>
            <Switch
              checked={effectivePermissions.size === allPermissions.length}
              onCheckedChange={(checked) =>
                setUserPermissions(
                  new Set<PolicyName>(checked ? allPermissions : [])
                )
              }
            />
          </div>
        </DialogTitle>

        <DialogContent className="!pt-0">
          <div className="flex flex-col sm:flex-row gap-4 mb-4 items-stretch sm:items-center">
            <FormControl className="flex-1 min-w-[200px]">
              <InputLabel id="role-select-label">Aplicar perfil</InputLabel>
              <Select
                labelId="role-select-label"
                value={selectedRoleId}
                label="Aplicar perfil"
                onChange={(e) => applyRoleTemplate(e.target.value)}
                disabled={isLoadingRoles}
              >
                <MenuItem value="">
                  <em>Nenhum</em>
                </MenuItem>
                {isLoadingRoles ? (
                  <MenuItem disabled>
                    <em>Carregando...</em>
                  </MenuItem>
                ) : (
                  roles.map((role) => (
                    <MenuItem key={role.id} value={role.id}>
                      {role.name}
                      {role.isSystem && (
                        <Chip
                          size="small"
                          label="Sistema"
                          className="ml-2"
                          color="primary"
                          variant="outlined"
                        />
                      )}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>

            <TextField
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

          <form id="permissions-user" onSubmit={handleSubmit}>
            <List className="max-h-[400px] overflow-auto">
              {filteredPermissions.length === 0 ? (
                <Typography
                  variant="body2"
                  className="text-center py-8 text-gray-500"
                >
                  Nenhuma permissão encontrada
                </Typography>
              ) : (
                filteredPermissions.map((name) => {
                  const permission = permissions.get(name);
                  if (!permission) return null;

                  const isChecked = effectivePermissions.has(name);
                  const isDirect = userPermissions.has(name);
                  const linkedCount = permission.linkeds.length;
                  const isViewContactDetails = name === "view:contact-details";

                  return (
                    <div key={name}>
                      <ListItem
                        disablePadding
                        secondaryAction={
                          <Checkbox
                            edge="end"
                            tabIndex={-1}
                            disableRipple
                            onChange={() => togglePermission(name)}
                            checked={isChecked}
                            indeterminate={isChecked && !isDirect}
                          />
                        }
                      >
                        <ListItemButton onClick={() => togglePermission(name)}>
                          <ListItemText
                            primary={
                              <div className="flex items-center gap-2">
                                <Typography
                                  variant="body1"
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
                          blockedSectorIds={selectedSectorIds}
                          onToggle={toggleSectorForContactDetails}
                          context="user"
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
            selecionadas
          </Typography>
          <div className="flex gap-2">
            <Button variant="outlined" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="permissions-user"
              variant="contained"
              disabled={upsertPermissionsAction.isPending}
            >
              {upsertPermissionsAction.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogActions>
      </Dialog>
    </>
  );
};
