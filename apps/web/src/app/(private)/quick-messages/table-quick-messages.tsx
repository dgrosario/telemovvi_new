"use client";

import { deleteQuickMessage } from "@/app/actions/quick-messages";
import { ActionsCell } from "@/components/actions-cell";
import { TableDefault, Column } from "@/components/table-default";
import { useServerActionMutation } from "@/hooks/server-action-hooks";
import { useQuickMessages } from "@/hooks/use-quick-messages";
import { usePermissionCheck } from "@/hooks/use-permission-check";
import { PERMISSION_MAPPINGS } from "@/lib/permissions-map";
import { Chip, Paper, Tooltip } from "@mui/material";
import { QuickMessage } from "@omnichannel/core/domain/entities/quick-message";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "react-toastify";

type Props = {
  messages: QuickMessage.Raw[];
};

export default function TableQuickMessages({ messages }: Props) {
  const queryClient = useQueryClient();
  const { setId, toggleOpen } = useQuickMessages();

  const { hasPermission: canEdit } = usePermissionCheck(PERMISSION_MAPPINGS.quickMessages.edit);
  const { hasPermission: canRemove } = usePermissionCheck(PERMISSION_MAPPINGS.quickMessages.remove);

  const { mutateAsync: remove } = useServerActionMutation(deleteQuickMessage, {
    onSuccess() {
      queryClient.invalidateQueries({
        queryKey: ["list-quick-messages"],
      });
      toast.success("Mensagem removida com sucesso!");
    },
    onError(err) {
      toast.error(err.message);
    },
  });

  const columns: Column<QuickMessage.Raw>[] = useMemo(
    () => [
      {
        key: "shortcode",
        label: "Atalho",
        sortable: true,
        width: 150,
        cell: (value) => (
          <span className="font-mono text-teal-600">/{value}</span>
        ),
      },
      {
        key: "message",
        label: "Mensagem",
        sortable: true,
        width: 350,
        cell: (_, row) => {
          const text = row.message ?? "";
          return (
            <Tooltip title={text} placement="top">
              <span className="truncate block max-w-[350px]">
                {text.length > 80 ? `${text.slice(0, 80)}...` : text}
              </span>
            </Tooltip>
          );
        },
      },
      {
        key: "mediaUrl",
        label: "Midia",
        width: 80,
        cell: (value, row) =>
          value ? (
            <Tooltip title={row.mediaName || "Midia anexada"}>
              <i
                className={`${
                  row.mediaType === "image"
                    ? "tabler-photo"
                    : row.mediaType === "audio"
                      ? "tabler-music"
                      : row.mediaType === "video"
                        ? "tabler-video"
                        : "tabler-file"
                } text-gray-600 !size-5`}
              />
            </Tooltip>
          ) : (
            <span className="text-gray-400">-</span>
          ),
      },
      {
        key: "isPublic",
        label: "Visibilidade",
        sortable: true,
        width: 120,
        cell: (value) => (
          <Chip
            size="small"
            label={value ? "Publica" : "Privada"}
            color={value ? "primary" : "default"}
            variant="outlined"
          />
        ),
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
                disabled: !canEdit,
              },
              {
                id: "remove",
                label: "Remover",
                icon: <i className="tabler-trash text-red-500 !size-4" />,
                confirm: {
                  resourceName: `/${row.shortcode}`,
                  variant: "error",
                },
                action() {
                  remove([row.id]);
                },
                hidden: !canRemove,
              },
            ]}
          />
        ),
      },
    ],
    [setId, toggleOpen, remove, canEdit, canRemove]
  );

  const rows = useMemo(
    () => messages.sort((a, b) => a.shortcode.localeCompare(b.shortcode)),
    [messages]
  );

  return (
    <Paper elevation={0} className="m-6 border rounded overflow-x-auto flex flex-col max-h-[calc(100vh-180px)]">
      <div className="overflow-y-auto flex-1">
        <TableDefault
          canSelect
          columns={columns}
          rows={rows}
          noPagination
          onRemove={async (selecteds) => {
            await remove(selecteds.map((s) => s.id));
          }}
        />
      </div>
    </Paper>
  );
}
