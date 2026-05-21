"use client";
import {
  deleteSystemVariable,
  listAllSystemVariables,
} from "@/app/actions/system-variables";
import { ActionsCell } from "@/components/actions-cell";
import CustomChip from "@/components/custom-chip";
import { Column, TableDefault } from "@/components/table-default";
import {
  useServerActionMutation,
  useServerActionQuery,
} from "@/hooks/server-action-hooks";
import { useSystemVariablesDialog } from "@/hooks/use-system-variables";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "react-toastify";
import { SystemVariable } from "@omnichannel/core/domain/entities/system-variable";

type Props = {
  variables: SystemVariable.Raw[];
};

const resolverTypeLabels: Record<SystemVariable.ResolverType, string> = {
  contact_field: "Campo do Contato",
  attendant_field: "Campo do Atendente",
  time_based: "Saudação",
  current_time: "Horário",
  current_date: "Data",
  day_of_week: "Dia da Semana",
  conversation_field: "Campo da Conversa",
  custom: "Personalizado",
};

export default function TableVariables(props: Props) {
  const { toggleOpen, setId } = useSystemVariablesDialog();
  const { data: variables = props.variables } = useServerActionQuery(
    listAllSystemVariables,
    {
      input: undefined,
      queryKey: ["system-variables", "all"],
    }
  );
  const queryClient = useQueryClient();

  const deleteAction = useServerActionMutation(deleteSystemVariable, {
    async onSuccess() {
      toast.success("Variável removida com sucesso");
      await queryClient.invalidateQueries({
        queryKey: ["system-variables"],
      });
    },
    onError(error) {
      toast.error(error.message);
    },
  });

  const columns = useMemo<Column<SystemVariable.Raw>[]>(
    () => [
      {
        key: "label",
        label: "Nome",
      },
      {
        key: "key",
        label: "Chave",
        cell(value) {
          return (
            <code className="text-sm bg-gray-100 px-2 py-1 rounded font-mono">
              {`{{${value}}}`}
            </code>
          );
        },
      },
      {
        key: "resolverType",
        label: "Tipo",
        cell(value) {
          return resolverTypeLabels[value as SystemVariable.ResolverType] ?? value;
        },
      },
      {
        key: "isSystem",
        label: "Origem",
        cell(value) {
          return (
            <CustomChip
              variant={value ? "filled" : "outlined"}
              color={value ? "default" : "primary"}
              size="small"
              label={value ? "Sistema" : "Customizada"}
            />
          );
        },
      },
      {
        key: "isActive",
        label: "Status",
        cell(value) {
          return (
            <CustomChip
              variant="filled"
              color={value ? "success" : "default"}
              size="small"
              label={value ? "Ativa" : "Inativa"}
            />
          );
        },
      },
      {
        key: "id",
        label: "Ações",
        width: 120,
        cell: (_, variable) => {
          if (variable.isSystem) {
            return null;
          }
          return (
            <ActionsCell
              options={[
                {
                  icon: <i className="tabler-edit !size-4" />,
                  id: "edit",
                  label: "Editar",
                  action: () => {
                    setId(variable.id);
                    toggleOpen();
                  },
                },
                {
                  icon: <i className="tabler-trash !size-4" />,
                  id: "delete",
                  label: "Remover",
                  confirm: {
                    resourceName: variable.label,
                    title: "Remover variável?",
                    description: `Tem certeza que deseja remover a variável?`,
                    variant: "error",
                  },
                  action: () => deleteAction.mutate({ id: variable.id }),
                },
              ]}
            />
          );
        },
      },
    ],
    [deleteAction, setId, toggleOpen]
  );

  return (
    <div className="p-6">
      <TableDefault<SystemVariable.Raw>
        columns={columns}
        rows={variables}
        noPagination
      />
    </div>
  );
}
