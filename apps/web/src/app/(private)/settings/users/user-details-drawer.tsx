"use client";

import { retrieveUser, resetPassword, updateUserActiveStatus } from "@/app/actions/users";
import {
  listSectors,
  listSectorsByUser,
  addSectorsToUser,
  removeOneSectorFromUser,
  removeSectorsFromUser,
} from "@/app/actions/sectors";
import {
  useServerActionMutation,
  useServerActionQuery,
} from "@/hooks/server-action-hooks";
import { useUsers } from "@/hooks/use-users";
import { useEffect, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Button,
  Checkbox,
  CircularProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  TextField,
} from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { toast, Flip } from "react-toastify";
import CustomAvatar from "@/components/custom-avatar";
import { Icon } from "@iconify/react";
import { PermissionsManager } from "@/components/permissions-manager";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useUserPermissions } from "@/providers/user-permissions-provider";
import { PERMISSION_MAPPINGS } from "@/lib/permissions-map";
import {
  permissions,
  permissionCategories,
  type PolicyName,
} from "@omnichannel/core/domain/services/permissions";
import type { UserListed } from "@omnichannel/core/infra/repositories/users-repository";
import type { Sector } from "@omnichannel/core/domain/entities/sector";

export function UserDetailsDrawer() {
  const { openDetails, toggleOpenDetails, userId, setUserId, toggleOpen } = useUsers();
  const queryClient = useQueryClient();
  const { hasPermission } = useUserPermissions();
  const canManagePermissions = hasPermission(PERMISSION_MAPPINGS.users.managePermissions);

  const [selectedSectors, setSelectedSectors] = useState<Set<string>>(new Set());
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [permissionsOpen, setPermissionsOpen] = useState(false);

  const userQuery = useServerActionQuery(retrieveUser, {
    input: { id: userId },
    enabled: Boolean(userId) && openDetails,
    queryKey: ["user-details", userId],
  });

  const sectorsQuery = useServerActionQuery(listSectors, {
    input: undefined,
    enabled: openDetails,
    queryKey: ["list-sectors-for-user-details"],
  });

  const userSectorsQuery = useServerActionQuery(listSectorsByUser, {
    input: { userId },
    enabled: Boolean(userId) && openDetails,
    queryKey: ["user-sectors", userId],
  });

  useEffect(() => {
    if (userSectorsQuery.data) {
      const sectorIds = userSectorsQuery.data.map((s) => s.sectorId).filter(Boolean) as string[];
      setSelectedSectors(new Set(sectorIds));
    }
  }, [userSectorsQuery.data]);

  const addSectorAction = useServerActionMutation(addSectorsToUser, {
    onError() {
      toast.error("Erro ao vincular setor", { transition: Flip });
    },
  });

  const removeSectorAction = useServerActionMutation(removeOneSectorFromUser, {
    onError() {
      toast.error("Erro ao desvincular setor", { transition: Flip });
    },
  });

  const resetPasswordAction = useServerActionMutation(resetPassword, {
    onSuccess() {
      toast.success("Senha redefinida com sucesso!", { transition: Flip });
      setNewPassword("");
      setConfirmPassword("");
    },
    onError() {
      toast.error("Erro ao redefinir senha", { transition: Flip });
    },
  });

  const updateActiveAction = useServerActionMutation(updateUserActiveStatus, {
    onSuccess() {
      toast.success("Status atualizado com sucesso!", { transition: Flip });
      queryClient.invalidateQueries({ queryKey: ["list-users"] });
      userQuery.refetch();
    },
    onError() {
      toast.error("Erro ao atualizar status", { transition: Flip });
    },
  });

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      toggleOpenDetails();
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const handleSectorToggle = async (sectorId: string) => {
    if (!userId) return;

    const isSelected = selectedSectors.has(sectorId);

    if (isSelected) {
      await removeSectorAction.mutateAsync({ userId, sectorId });
      setSelectedSectors((prev) => {
        const next = new Set(prev);
        next.delete(sectorId);
        return next;
      });
    } else {
      await addSectorAction.mutateAsync({ userId, sectorId });
      setSelectedSectors((prev) => new Set(prev).add(sectorId));
    }

    queryClient.invalidateQueries({ queryKey: ["list-users"] });
    queryClient.invalidateQueries({ queryKey: ["user-sectors", userId] });
  };

  const handleResetPassword = async () => {
    if (!userId || !newPassword) return;
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem", { transition: Flip });
      return;
    }
    if (newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres", { transition: Flip });
      return;
    }
    await resetPasswordAction.mutateAsync({ userId, newPassword });
  };

  const handleToggleActive = async () => {
    if (!userId || !userQuery.data) return;
    await updateActiveAction.mutateAsync({
      userId,
      isActive: !userQuery.data.isActive,
    });
  };

  const user = userQuery.data;
  const sectors = sectorsQuery.data ?? [];

  const uniqueUserSectors = useMemo(() => {
    if (!user?.sectors) return [];
    const seen = new Set<string>();
    return user.sectors.filter((sector) => {
      if (seen.has(sector.id)) return false;
      seen.add(sector.id);
      return true;
    });
  }, [user?.sectors]);

  const groupedPermissions = useMemo(() => {
    if (!user?.permissions) return [];
    const groups: Array<{
      category: string;
      label: string;
      icon: string;
      permissions: Array<{ name: string; description: string }>;
    }> = [];

    for (const [category, info] of Object.entries(permissionCategories)) {
      const categoryPerms = user.permissions
        .filter((p) => {
          const perm = permissions.get(p as PolicyName);
          return perm?.category === category;
        })
        .map((p) => {
          const perm = permissions.get(p as PolicyName);
          return { name: p, description: perm?.description ?? p };
        });

      if (categoryPerms.length > 0) {
        groups.push({
          category,
          label: info.label,
          icon: info.icon,
          permissions: categoryPerms,
        });
      }
    }
    return groups;
  }, [user?.permissions]);

  return (
    <>
      <Sheet open={openDetails} onOpenChange={handleOpenChange}>
        <SheetContent side="right" className="w-[480px] sm:max-w-[480px] p-0 flex flex-col">
          <SheetHeader className="sr-only">
            <SheetTitle>Detalhes do Usuário</SheetTitle>
          </SheetHeader>

          {userQuery.isPending ? (
            <div className="flex-1 flex items-center justify-center">
              <CircularProgress />
            </div>
          ) : user ? (
            <>
              <div className="p-4 border-b flex items-center gap-4">
                <CustomAvatar color="primary" alt={user.name} className="!w-16 !h-16 !text-xl">
                  {user.name
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </CustomAvatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold truncate">{user.name}</h2>
                    {!user.isActive && (
                      <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded">
                        Inativo
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                </div>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Icon icon="tabler:edit" />}
                  onClick={() => {
                    toggleOpenDetails();
                    toggleOpen();
                  }}
                >
                  Editar
                </Button>
                <Button
                  variant="text"
                  className="!min-w-0 !p-2"
                  onClick={() => handleOpenChange(false)}
                >
                  <Icon icon="tabler:x" className="text-xl" />
                </Button>
              </div>

              <Tabs defaultValue="details" className="flex-1 flex flex-col overflow-hidden">
                <TabsList variant="line" className="px-4 shrink-0">
                  <TabsTrigger value="details">Detalhes</TabsTrigger>
                  {canManagePermissions && (
                    <TabsTrigger value="permissions">Permissões</TabsTrigger>
                  )}
                  <TabsTrigger value="sectors">Setores</TabsTrigger>
                  <TabsTrigger value="actions">Ações</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="flex-1 overflow-y-auto p-4 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Nome</Label>
                    <p className="text-sm">{user.name}</p>
                  </div>
                  {user.displayName && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Nome de exibição</Label>
                      <p className="text-sm">{user.displayName}</p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Email</Label>
                    <p className="text-sm">{user.email}</p>
                  </div>
                  {user.phone && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Telefone</Label>
                      <p className="text-sm">{user.phone}</p>
                    </div>
                  )}
                  {user.birthDate && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Data de nascimento</Label>
                      <p className="text-sm">
                        {new Date(user.birthDate).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  )}
                  {user.address && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Endereço</Label>
                      <p className="text-sm">{user.address}</p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Status</Label>
                    <p className="text-sm">{user.isActive ? "Ativo" : "Inativo"}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Setores Vinculados</Label>
                    {uniqueUserSectors.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {uniqueUserSectors.map((sector) => (
                          <span
                            key={sector.id}
                            className="px-2 py-1 text-xs bg-primary/10 text-primary rounded"
                          >
                            {sector.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Nenhum setor vinculado</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Permissões</Label>
                    <p className="text-sm">{user.permissions.length} permissões atribuídas</p>
                  </div>
                </TabsContent>

                {canManagePermissions && (
                  <TabsContent value="permissions" className="flex-1 overflow-y-auto p-4">
                    <div className="space-y-4">
                      <Button
                        variant="contained"
                        fullWidth
                        onClick={() => {
                          toggleOpenDetails();
                          setPermissionsOpen(true);
                        }}
                        startIcon={<Icon icon="tabler:license" />}
                      >
                        Gerenciar Permissões ({user.permissions.length})
                      </Button>

                      {groupedPermissions.length > 0 ? (
                        <div className="space-y-4 mt-4">
                          {groupedPermissions.map((group) => (
                            <div key={group.category} className="space-y-2">
                              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                <Icon icon={group.icon} className="text-base" />
                                <span>{group.label}</span>
                                <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                  {group.permissions.length}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {group.permissions.map((perm) => (
                                  <span
                                    key={perm.name}
                                    className="text-xs px-2 py-1 bg-muted rounded text-muted-foreground"
                                    title={perm.name}
                                  >
                                    {perm.description}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Nenhuma permissão atribuída
                        </p>
                      )}
                    </div>
                  </TabsContent>
                )}

                <TabsContent value="sectors" className="flex-1 overflow-y-auto p-4">
                  <div className="space-y-2 mb-4">
                    <p className="text-sm text-muted-foreground">
                      Selecione os setores que este usuário deve ter acesso.
                    </p>
                  </div>
                  <List>
                    {sectors.map((sector) => {
                      const isSelected = selectedSectors.has(sector.id);
                      return (
                        <ListItem
                          key={sector.id}
                          disablePadding
                          secondaryAction={
                            <Checkbox
                              edge="end"
                              tabIndex={-1}
                              disableRipple
                              checked={isSelected}
                              onChange={() => handleSectorToggle(sector.id)}
                              disabled={addSectorAction.isPending || removeSectorAction.isPending}
                            />
                          }
                        >
                          <ListItemButton onClick={() => handleSectorToggle(sector.id)}>
                            <ListItemText primary={sector.name} />
                          </ListItemButton>
                        </ListItem>
                      );
                    })}
                    {sectors.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhum setor cadastrado
                      </p>
                    )}
                  </List>
                </TabsContent>

                <TabsContent value="actions" className="flex-1 overflow-y-auto p-4 space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium">Usuário Ativo</Label>
                        <p className="text-xs text-muted-foreground">
                          Usuários inativos não podem acessar o sistema
                        </p>
                      </div>
                      <Switch
                        checked={user.isActive}
                        onCheckedChange={handleToggleActive}
                        disabled={updateActiveAction.isPending || !user.isDeletable}
                      />
                    </div>
                  </div>

                  <div className="border-t pt-6 space-y-4">
                    <Label className="text-sm font-medium block">Redefinir Senha</Label>
                    <TextField
                      type="password"
                      label="Nova Senha"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      fullWidth
                      size="small"
                      className="!mb-3"
                    />
                    <TextField
                      type="password"
                      label="Confirmar Senha"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      fullWidth
                      size="small"
                      className="!mb-3"
                    />
                    <Button
                      variant="contained"
                      fullWidth
                      onClick={handleResetPassword}
                      disabled={
                        resetPasswordAction.isPending ||
                        !newPassword ||
                        !confirmPassword
                      }
                    >
                      {resetPasswordAction.isPending ? "Redefinindo..." : "Redefinir Senha"}
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Usuário não encontrado
            </div>
          )}
        </SheetContent>
      </Sheet>

      {user && canManagePermissions && (
        <PermissionsManager
          userId={userId}
          userPermissions={user.permissions}
          open={permissionsOpen}
          onClose={() => {
            setPermissionsOpen(false);
            toggleOpenDetails();
            userQuery.refetch();
          }}
          renderTrigger={false}
        />
      )}
    </>
  );
}
