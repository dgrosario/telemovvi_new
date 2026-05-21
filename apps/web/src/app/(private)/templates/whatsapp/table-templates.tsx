"use client";
import { removeTemplates } from "@/app/actions/templates";
import type { GatewayTemplate } from "@/lib/gateway-client";
import CustomChip from "@/components/custom-chip";
import ModalConfirmDelete from "@/components/modal-confirm-delete";
import { Column, TableDefault } from "@/components/table-default";
import { useServerActionMutation } from "@/hooks/server-action-hooks";
import { useTemplates } from "@/hooks/use-templates";
import { usePermissionCheck } from "@/hooks/use-permission-check";
import { PERMISSION_MAPPINGS } from "@/lib/permissions-map";
import { Button, Paper } from "@mui/material";
import { useEffect, useMemo } from "react";
import { toast } from "react-toastify";

type Props = {
  templates: GatewayTemplate[];
};

export const TableTemplates: React.FC<Props> = (props) => {
  if (!props.templates.length) return <></>;
  const { setOpen } = useTemplates();
  const { hasPermission: canRemove } = usePermissionCheck(PERMISSION_MAPPINGS.templates.remove);

  const removeTemplateAction = useServerActionMutation(removeTemplates, {
    onSuccess() {
      toast.dismiss();
      toast.success("Template removido com sucesso!");
    },
    onError(err) {
      toast.dismiss();
      toast.error(err.message);
    },
  });
  const columns = useMemo<Column<GatewayTemplate>[]>(
    () => [
      {
        key: "name",
        label: "Nome do template",
      },
      {
        key: "text",
        label: "Valor",
      },
      {
        key: "channel",
        label: "Canal",
        cell: (_, row) =>
          [row.channel.name, row.channel.payload?.phoneNumber as string | undefined]
            .filter(Boolean)
            .join(" - "),
      },
      {
        key: "status",
        sortable: true,
        cell(value) {
          const nameMap = new Map<string, string>([
            ["PENDING", "Pendente"],
            ["APPROVED", "Aprovado"],
          ]);
          const colorMap = new Map<string, string>([
            ["PENDING", "info"],
            ["APPROVED", "success"],
          ]);
          const variantMap = new Map<string, "filled" | "outlined">([
            ["PENDING", "outlined"],
            ["APPROVED", "filled"],
          ]);
          return (
            <CustomChip
              color={colorMap.get(value as string)?.toString() as any}
              label={nameMap.get(value as string)?.toString() ?? ""}
              size="small"
              variant={variantMap.get(value as string) ?? "outlined"}
            />
          );
        },
      },
      {
        key: "id",
        cell(_, template) {
          if (!canRemove) return null;

          return (
            <ModalConfirmDelete
              onConfirm={() => {
                removeTemplateAction.mutate({
                  channelId: template.channel.id,
                  name: template.name,
                });
              }}
              resourceName={template.name}
            >
              <Button>
                <i className="tabler-trash !text-red-500 !size-5" />
              </Button>
            </ModalConfirmDelete>
          );
        },
      },
    ],
    [removeTemplateAction, canRemove]
  );

  useEffect(() => {
    if (removeTemplateAction.isPending) {
      toast.loading("Removendo...", {
        delay: 3000,
      });
    }
  }, [removeTemplateAction.isPending]);

  return (
    <Paper className="px-4 pt-10">
      <div className="pb-4 flex items-center justify-end">
        <Button variant="contained" onClick={() => setOpen(true)}>
          Novo template
        </Button>
      </div>
      <TableDefault columns={columns} rows={props.templates} />
    </Paper>
  );
};
