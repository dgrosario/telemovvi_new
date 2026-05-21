"use client";

import { listRoles, removeRoles } from "@/app/actions/roles";
import { ActionsCell } from "@/components/actions-cell";
import { Column, TableDefault } from "@/components/table-default";
import {
  useServerActionMutation,
  useServerActionQuery,
} from "@/hooks/server-action-hooks";
import { useRoles } from "@/hooks/use-roles";
import { Chip, Paper, Tooltip } from "@mui/material";
import { Role } from "@omnichannel/core/domain/entities/role";
import { permissions } from "@omnichannel/core/domain/services/permissions";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "react-toastify";

type Props = {
  roles: Role.Raw[];
};

export function TableRoles(props: Props) {
  const { toggleOpen, setRoleId } = useRoles();
  const { data: roles = props.roles } = useServerActionQuery(listRoles, {
    input: undefined,
    queryKey: ["list-roles"],
  });
  const queryClient = useQueryClient();
  const totalPermissions = useMemo(() => permissions.size, []);

  const removeRolesAction = useServerActionMutation(removeRoles, {
    async onSuccess() {
      toast.success("Perfil(is) removido(s) com sucesso");
      await queryClient.invalidateQueries({
        queryKey: ["list-roles"],
      });
    },
    onError(error) {
      toast.error(error.message);
    },
  });

  const columns = useMemo<Column<Role.Raw>[]>(
    () => [
      {
        key: "name",
        label: "Nome",
        cell(value, row) {
          return (
            <div className="flex items-center gap-2">
              <span>{value as string}</span>
              {row.isSystem && (
                <Chip
                  size="small"
                  label="Sistema"
                  color="primary"
                  variant="outlined"
                />
              )}
            </div>
          );
        },
      },
      {
        key: "description",
        label: "Descrição",
        cell(value) {
          return value ? (value as string) : "-";
        },
      },
      {
        key: "permissions",
        label: "Permissões",
        width: 120,
        cell(value) {
          const perms = value as string[];
          const count = perms.length;
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
              />
            </Tooltip>
          );
        },
      },
      {
        key: "id",
        label: "Ações",
        width: 150,
        cell: (_, role) => (
          <ActionsCell
            options={[
              {
                icon: <i className="tabler-edit !size-4" />,
                id: "edit",
                action: () => {
                  setRoleId(role.id);
                  toggleOpen();
                },
                label: "Editar",
              },
              {
                id: "remove",
                label: "Remover",
                action: () =>
                  removeRolesAction.mutate({
                    ids: [role.id],
                  }),
                confirm: {
                  resourceName: role.name,
                  description: "Tem certeza de que deseja remover este perfil?",
                  title: "Remover Perfil",
                  variant: "error",
                },
                icon: <i className="tabler-trash text-red-500 !size-4" />,
                disabled: role.isSystem,
              },
            ]}
          />
        ),
        stopPropagation: true,
      },
    ],
    [totalPermissions, toggleOpen, setRoleId, removeRolesAction]
  );

  const rows = useMemo(
    () =>
      (roles ?? props.roles).sort((a, b) => {
        if (a.isSystem && !b.isSystem) return -1;
        if (!a.isSystem && b.isSystem) return 1;
        return a.name.localeCompare(b.name);
      }),
    [roles, props.roles]
  );

  return (
    <Paper elevation={0} className="m-6 border rounded overflow-x-auto">
      <TableDefault
        canSelect
        columns={columns}
        rows={rows}
        noPagination
        onRemove={(selecteds) => {
          const nonSystemRoles = selecteds.filter((r) => !r.isSystem);
          if (nonSystemRoles.length === 0) {
            toast.warning("Perfis de sistema não podem ser removidos");
            return;
          }
          removeRolesAction.mutate({
            ids: nonSystemRoles.map((r) => r.id),
          });
        }}
      />
    </Paper>
  );
}
