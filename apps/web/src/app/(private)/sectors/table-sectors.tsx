"use client";

import { listSectors, removeSectors } from "@/app/actions/sectors";
import { ActionsCell } from "@/components/actions-cell";
import { TableDefault, Column } from "@/components/table-default"; // ✅ importa o tipo certo
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useServerActionMutation,
  useServerActionQuery,
} from "@/hooks/server-action-hooks";
import { useSectors } from "@/hooks/use-sectors";
import { usePermissionCheck } from "@/hooks/use-permission-check";
import { PERMISSION_MAPPINGS } from "@/lib/permissions-map";
import { Button, IconButton, Paper, Box, Chip } from "@mui/material";
import { Sector } from "@omnichannel/core/domain/entities/sector";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useMemo } from "react";
import { toast } from "react-toastify";

type Props = {
  sectors: Sector.Props[];
};

export default function TableSectors({ sectors }: Props) {
  const { toggleOpen, setId, toggleOpenLinkUser, toggleOpenLinkChannel } =
    useSectors();
  const queryClient = useQueryClient();

  const { hasPermission: canEdit } = usePermissionCheck(PERMISSION_MAPPINGS.sectors.edit);
  const { hasPermission: canRemove } = usePermissionCheck(PERMISSION_MAPPINGS.sectors.remove);

  const { data } = useServerActionQuery(listSectors, {
    input: undefined,
    queryKey: ["list-sectors"],
  });
  const { mutateAsync: remove } = useServerActionMutation(removeSectors);

  const columns: Column<Sector.Props>[] = useMemo(
    () => [
      {
        key: "name",
        label: "Nome",
        sortable: true,
        width: 250,
        cell: (_, row) => (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box
              sx={{
                width: 16,
                height: 16,
                backgroundColor: row.color || "#3B82F6",
                borderRadius: 1,
                border: "1px solid #ddd",
              }}
            />
            <span>{row.name}</span>
            {row.isDefault && (
              <Chip
                label="Padrão"
                size="small"
                color="primary"
                sx={{ height: 20, fontSize: 11 }}
              />
            )}
          </Box>
        ),
      },
      {
        key: "workingHoursStart",
        label: "Horário de Funcionamento",
        sortable: false,
        width: 200,
        cell: (_, row) => {
          const start = row.workingHoursStart?.slice(0, 5) || "08:00";
          const end = row.workingHoursEnd?.slice(0, 5) || "19:00";
          return <span>{start} - {end}</span>;
        },
      },
      {
        key: "id",
        stopPropagation: true,
        width: 100,
        cell: (_, row) => (
          <ActionsCell
            options={[
              {
                id: "edit",
                label: "Editar",
                action: () => {
                  setId(row.id);
                  toggleOpen();
                },
                icon: <i className="tabler-edit !size-4" />,
                disabled: !canEdit,
              },
              {
                id: "link-user",
                label: "Vincular Usuários",
                action: () => {
                  setId(row.id);
                  toggleOpenLinkUser();
                },
                icon: <i className="tabler-user-plus !size-4" />,
                disabled: !canEdit,
              },
              {
                id: "link-channel",
                label: "Vincular Conexões",
                action: () => {
                  setId(row.id);
                  toggleOpenLinkChannel();
                },
                icon: <i className="tabler-link-plus !size-4" />,
                disabled: !canEdit,
              },
              {
                id: "remove",
                label: "Remover",
                icon: <i className="tabler-trash text-red-500 !size-4" />,
                confirm: {
                  resourceName: row.name,
                  variant: "error",
                },
                action() {
                  remove({ ids: [row.id] });
                },
                hidden: !canRemove,
              },
            ]}
          />
        ),
      },
    ],
    [setId, toggleOpen, toggleOpenLinkUser, toggleOpenLinkChannel, remove, canEdit, canRemove]
  );

  const rows = useMemo(
    () => (data ?? sectors).sort((a, b) => a.name.localeCompare(b.name)),
    [data, sectors]
  );

  return (
    <Paper elevation={0} className="m-6 border rounded overflow-x-auto">
      <TableDefault
        canSelect
        columns={columns}
        rows={rows}
        noPagination
        onRemove={async (selecteds) => {
          try {
            await remove({ ids: selecteds.map((s) => s.id) });
            toast.success("Setor(es) removido(s) com sucesso!");
            queryClient.invalidateQueries({
              exact: true,
              queryKey: ["list-sectors"],
            });
          } catch {
            toast.error("Erro ao remover setor(es).");
          }
        }}
      />
    </Paper>
  );
}
