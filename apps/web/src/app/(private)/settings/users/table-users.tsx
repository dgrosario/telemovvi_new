"use client";
import { listUsers, removeUser } from "@/app/actions/users";
import CustomChip from "@/components/custom-chip";
import CustomTextField from "@/components/custom-text-field";
import ModalConfirmDelete from "@/components/modal-confirm-delete";
import { PermissionsManager } from "@/components/permissions-manager";
import { BulkAction, Column, TableDefault } from "@/components/table-default";
import {
  useServerActionMutation,
  useServerActionQuery,
} from "@/hooks/server-action-hooks";
import { useUsers } from "@/hooks/use-users";
import { usePermissionCheck } from "@/hooks/use-permission-check";
import { PERMISSION_MAPPINGS } from "@/lib/permissions-map";
import { Button, Chip, InputAdornment, Paper, Tooltip } from "@mui/material";
import { permissions } from "@omnichannel/core/domain/services/permissions";
import { UserListed } from "@omnichannel/core/infra/repositories/users-repository";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import { DialogBulkAssignSector } from "./dialog-bulk-assign-sector";
import { DialogBulkAssignPermissions } from "./dialog-bulk-assign-permissions";
import { Icon } from "@iconify/react";

type Props = {
  users: UserListed[];
};

function normalizeSearchValue(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();
}

export default function TableUsers(props: Props) {
  const { setUserId, toggleOpenDetails } = useUsers();
  const { data: users = props.users } = useServerActionQuery(listUsers, {
    input: undefined,
    queryKey: ["list-users"],
  });
  const queryClient = useQueryClient();
  const [permissionsModalUser, setPermissionsModalUser] = useState<UserListed | null>(null);
  const [bulkSectorOpen, setBulkSectorOpen] = useState(false);
  const [bulkPermissionsOpen, setBulkPermissionsOpen] = useState(false);
  const [selectedUsersForBulk, setSelectedUsersForBulk] = useState<UserListed[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const totalPermissions = useMemo(() => permissions.size, []);

  const {
    hasPermission: canRemove,
    tooltipMessage: removeTooltipMessage,
  } = usePermissionCheck(PERMISSION_MAPPINGS.users.remove);

  const removeUserAction = useServerActionMutation(removeUser, {
    async onSuccess() {
      toast.success("Usuário(s) removido(s) com sucesso");
      await queryClient.invalidateQueries({
        queryKey: ["list-users"],
      });
    },
    onError(error) {
      toast.error(error.data);
    },
  });

  const handleOpenDetails = (user: UserListed) => {
    setUserId(user.id);
    toggleOpenDetails();
  };

  const columns = useMemo<Column<UserListed>[]>(
    () => [
      {
        key: "name",
        label: "Nome",
        cell(value, row) {
          return (
            <div className="flex items-center gap-2">
              <span>{value as string}</span>
              {!row.isActive && (
                <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded">
                  Inativo
                </span>
              )}
            </div>
          );
        },
      },
      {
        key: "email",
        label: "Email",
      },
      {
        key: "sectors",
        label: "Setores",
        cell(value, row) {
          const sectors = value as Array<{ id: string; name: string }>;
          if (!sectors || sectors.length === 0) {
            return <span className="text-muted-foreground text-sm">Sem setor</span>;
          }
          const maxVisible = 2;
          const visibleSectors = sectors.slice(0, maxVisible);
          const remaining = sectors.length - maxVisible;
          return (
            <div className="flex gap-1 overflow-hidden pr-3 flex-wrap">
              {visibleSectors.map((sector) => (
                <CustomChip
                  key={sector.id + row.id}
                  variant="outlined"
                  color="primary"
                  size="small"
                  classes={{
                    root: "!rounded-full",
                  }}
                  label={sector.name}
                />
              ))}
              {remaining > 0 && (
                <Tooltip title={sectors.slice(maxVisible).map((s) => s.name).join(", ")}>
                  <CustomChip
                    variant="outlined"
                    color="default"
                    size="small"
                    classes={{
                      root: "!rounded-full",
                    }}
                    label={`+${remaining}`}
                  />
                </Tooltip>
              )}
            </div>
          );
        },
      },
      {
        key: "permissions",
        label: "Permissões",
        width: 120,
        cell(value, row) {
          const count = (value as string[]).length;
          return (
            <Tooltip title={`${count} de ${totalPermissions} permissões`}>
              <Chip
                label={`${count}/${totalPermissions}`}
                size="small"
                color={
                  count === totalPermissions
                    ? "success"
                    : count === 0
                      ? "error"
                      : "primary"
                }
                variant={count === totalPermissions ? "filled" : "outlined"}
                onClick={(e) => {
                  e.stopPropagation();
                  setPermissionsModalUser(row);
                }}
                className="cursor-pointer hover:opacity-80"
              />
            </Tooltip>
          );
        },
      },
      {
        key: "id",
        label: "",
        width: 120,
        cell: (_, user) => {
          const canDeleteUser = canRemove && user.isDeletable;
          const deleteTooltip = !canRemove
            ? removeTooltipMessage
            : !user.isDeletable
              ? "Este usuário não pode ser removido"
              : "Excluir usuário";

          return (
            <div className="flex items-center justify-end gap-1">
              <Tooltip title="Visualizar detalhes">
                <Button
                  variant="text"
                  className="!min-w-0 !p-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenDetails(user);
                  }}
                >
                  <Icon icon="tabler:eye" className="text-lg text-gray-600" />
                </Button>
              </Tooltip>

              <Tooltip title={deleteTooltip}>
                <ModalConfirmDelete
                  disabled={!canDeleteUser}
                  resourceName={user.name || user.email}
                  dialogTitle="Tem certeza que deseja remover este usuário?"
                  dialogContent="Esta ação não pode ser desfeita. Para confirmar, digite o nome do usuário abaixo."
                  onConfirm={() => {
                    removeUserAction.mutate({
                      ids: [user.id],
                    });
                  }}
                >
                  <Button
                    variant="text"
                    color="error"
                    disabled={!canDeleteUser}
                    className="!min-w-0 !p-2"
                  >
                    <Icon icon="tabler:trash" className="text-lg" />
                  </Button>
                </ModalConfirmDelete>
              </Tooltip>
            </div>
          );
        },
        stopPropagation: true,
      },
    ],
    [canRemove, handleOpenDetails, removeTooltipMessage, totalPermissions]
  );

  const rows = useMemo(() => {
    const normalizedSearch = normalizeSearchValue(searchTerm).trim();
    const sourceRows = [...(users ?? props.users)].sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    if (!normalizedSearch) {
      return sourceRows;
    }

    return sourceRows.filter((user) => {
      const searchTarget = [
        user.name,
        user.email,
        user.displayName,
        user.sectors.map((sector) => sector.name).join(" "),
      ]
        .map((value) => normalizeSearchValue(value))
        .join(" ");

      return searchTarget.includes(normalizedSearch);
    });
  }, [searchTerm, users, props.users]);

  const bulkActions = useMemo<BulkAction<UserListed>[]>(
    () => [
      {
        id: "bulk-sector",
        label: "Vincular Setor",
        icon: <i className="tabler-building !size-4" />,
        onClick: (selectedUsers) => {
          setSelectedUsersForBulk(selectedUsers);
          setBulkSectorOpen(true);
        },
      },
      {
        id: "bulk-permissions",
        label: "Atribuir Permissões",
        icon: <i className="tabler-license !size-4" />,
        onClick: (selectedUsers) => {
          setSelectedUsersForBulk(selectedUsers);
          setBulkPermissionsOpen(true);
        },
      },
    ],
    []
  );

  return (
    <>
      <Paper elevation={0} className="m-6 border rounded overflow-x-auto">
        <div className="px-6 pt-6 pb-4">
          <CustomTextField
            fullWidth
            size="small"
            placeholder="Buscar usuário..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Icon icon="tabler:search" className="text-gray-400" />
                  </InputAdornment>
                ),
              },
            }}
          />
        </div>
        <TableDefault
          canSelect
          columns={columns}
          rows={rows}
          noPagination
          bulkActions={bulkActions}
          onRowClick={handleOpenDetails}
          onRemove={(selecteds) => {
            removeUserAction.mutate({
              ids: selecteds.map((p) => p.id),
            });
          }}
        />
      </Paper>

      {permissionsModalUser && (
        <PermissionsManager
          userId={permissionsModalUser.id}
          userPermissions={permissionsModalUser.permissions}
          open={!!permissionsModalUser}
          onClose={() => setPermissionsModalUser(null)}
          renderTrigger={false}
        />
      )}

      <DialogBulkAssignSector
        open={bulkSectorOpen}
        onClose={() => {
          setBulkSectorOpen(false);
          setSelectedUsersForBulk([]);
        }}
        users={selectedUsersForBulk}
      />

      <DialogBulkAssignPermissions
        open={bulkPermissionsOpen}
        onClose={() => {
          setBulkPermissionsOpen(false);
          setSelectedUsersForBulk([]);
        }}
        users={selectedUsersForBulk}
      />
    </>
  );
}
