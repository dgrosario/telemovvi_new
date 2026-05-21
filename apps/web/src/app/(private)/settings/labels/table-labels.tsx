"use client";

import { listLabels, removeLabel } from "@/app/actions/labels";
import { Column, TableDefault } from "@/components/table-default";
import {
  useServerActionMutation,
  useServerActionQuery,
} from "@/hooks/server-action-hooks";
import { useLabelsDialog } from "@/hooks/use-labels";
import { filterLabelsByQuery } from "@/lib/labels-filter";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import { Label } from "@omnichannel/core/domain/entities/label";
import { Box, IconButton, InputAdornment, TextField, Tooltip } from "@mui/material";

type Props = {
  labels: Label.Raw[];
};

export default function TableLabels(props: Props) {
  const { toggleOpen, setId } = useLabelsDialog();
  const [query, setQuery] = useState("");
  const { data: labels = props.labels } = useServerActionQuery(listLabels, {
    input: undefined,
    queryKey: ["labels"],
  });
  const queryClient = useQueryClient();

  const deleteAction = useServerActionMutation(removeLabel, {
    async onSuccess() {
      toast.success("Etiqueta removida com sucesso");
      await queryClient.invalidateQueries({
        queryKey: ["labels"],
      });
    },
    onError(error) {
      toast.error(error.message);
    },
  });

  const columns = useMemo<Column<Label.Raw>[]>(
    () => [
      {
        key: "color",
        label: "Cor",
        width: 80,
        cell(value) {
          return (
            <Box
              sx={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                backgroundColor: value as string,
                border: "2px solid",
                borderColor: "divider",
              }}
            />
          );
        },
      },
      {
        key: "name",
        label: "Nome",
      },
      {
        key: "id",
        label: "Ações",
        width: 100,
        cell: (_, label) => {
          return (
            <Box sx={{ display: "flex", gap: 0.5 }}>
              <Tooltip title="Editar">
                <IconButton
                  size="small"
                  onClick={() => {
                    setId(label.id);
                    toggleOpen();
                  }}
                >
                  <i className="tabler-edit !size-4" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Remover">
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => deleteAction.mutate({ id: label.id })}
                >
                  <i className="tabler-trash !size-4" />
                </IconButton>
              </Tooltip>
            </Box>
          );
        },
      },
    ],
    [deleteAction, setId, toggleOpen]
  );

  const filteredLabels = useMemo(
    () => filterLabelsByQuery(labels, query),
    [labels, query]
  );

  return (
    <div className="p-6">
      <div className="mb-4">
        <TextField
          size="small"
          placeholder="Pesquisar etiqueta..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          fullWidth
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <i className="tabler-search size-5 text-gray-500" />
                </InputAdornment>
              ),
            },
          }}
        />
      </div>
      <TableDefault<Label.Raw>
        columns={columns}
        rows={filteredLabels}
        noPagination
      />
    </div>
  );
}
