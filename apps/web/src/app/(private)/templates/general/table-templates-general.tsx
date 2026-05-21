"use client";

import { listSectors, removeSectors } from "@/app/actions/sectors";
import {
  deleteTemplateGeneral,
  listGeneralTemplates,
} from "@/app/actions/templates";
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
import { useGeneralTemplates } from "@/hooks/use-general-templates";
import { useSectors } from "@/hooks/use-sectors";
import { Button, IconButton, Paper } from "@mui/material";
import { Template } from "@omnichannel/core/domain/entities/template";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "react-toastify";

type Props = {
  templates: Template.Raw[];
};

export default function TableTemplatesGeneral({ templates }: Props) {
  const queryClient = useQueryClient();
  const { data } = useServerActionQuery(listGeneralTemplates, {
    input: undefined,
    queryKey: ["list-general-templates"],
  });

  const { setId, toggleOpen } = useGeneralTemplates();

  const { mutateAsync: remove } = useServerActionMutation(
    deleteTemplateGeneral,
    {
      onSuccess() {
        queryClient.invalidateQueries({
          queryKey: ["list-general-templates"],
        });

        toast.success("Modelo removido com sucesso!");
      },
      onError(err) {
        toast.error(err.message);
      },
    }
  );

  const columns: Column<Template.Raw>[] = useMemo(
    () => [
      {
        key: "name",
        label: "Nome",
        sortable: true,
        width: 250,
      },
      {
        key: "status",
        label: "Status",
        sortable: true,
        width: 120,
        cell: (value) => (
          <span
            className={
              value === "approved"
                ? "text-green-600 font-medium"
                : "text-orange-600 font-medium"
            }
          >
            {value === "approved" ? "Aprovado" : "Pendente"}
          </span>
        ),
      },
      {
        key: "language",
        label: "Idioma",
        sortable: true,
        width: 120,
        cell: (value) => (value === "pt_BR" ? "Português" : "Inglês"),
      },
      {
        key: "channel",
        label: "Canal",
        width: 200,
        cell: (_, row) => row.channel?.name ?? "—",
      },

      {
        key: "id",
        stopPropagation: true,
        width: 80,
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
                  remove([row.id]);
                },
              },
            ]}
          />
        ),
      },
    ],
    []
  );

  const rows = useMemo(
    () => (data ?? templates).sort((a, b) => a.name.localeCompare(b.name)),
    [data, templates]
  );

  return (
    <Paper elevation={0} className="m-6 border rounded overflow-x-auto">
      <TableDefault
        canSelect
        columns={columns}
        rows={rows}
        noPagination
        onRemove={async (selecteds) => {
          await remove(selecteds.map((s) => s.id));
        }}
      />
    </Paper>
  );
}
