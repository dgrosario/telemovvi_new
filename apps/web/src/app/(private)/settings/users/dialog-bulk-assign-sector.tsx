"use client";
import { bulkAssignSector, listSectors } from "@/app/actions/sectors";
import CustomAvatar from "@/components/custom-avatar";
import {
  useServerActionMutation,
  useServerActionQuery,
} from "@/hooks/server-action-hooks";
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
} from "@mui/material";
import { UserListed } from "@omnichannel/core/infra/repositories/users-repository";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Flip, toast } from "react-toastify";

type Props = {
  open: boolean;
  onClose: () => void;
  users: UserListed[];
};

export function DialogBulkAssignSector({ open, onClose, users }: Props) {
  const [selectedSectorIds, setSelectedSectorIds] = useState<Set<string>>(
    new Set()
  );
  const queryClient = useQueryClient();

  const { data: sectorsData, refetch: refetchSectors } = useServerActionQuery(
    listSectors,
    {
      input: undefined,
      enabled: false,
      queryKey: ["list-sectors"],
    }
  );

  useEffect(() => {
    if (open) {
      refetchSectors();
      setSelectedSectorIds(new Set());
    }
  }, [open, refetchSectors]);

  const bulkAssignAction = useServerActionMutation(bulkAssignSector, {
    async onSuccess() {
      await queryClient.invalidateQueries({
        queryKey: ["list-users"],
      });
      const sectorCount = selectedSectorIds.size;
      toast.success(
        `${sectorCount} setor(es) vinculado(s) a ${users.length} usuario(s) com sucesso!`,
        { transition: Flip }
      );
      onClose();
    },
    onError() {
      toast.error("Erro ao vincular setores", { transition: Flip });
    },
  });

  const handleToggleSector = (sectorId: string) => {
    setSelectedSectorIds((prev) => {
      const next = new Set(prev);
      if (next.has(sectorId)) {
        next.delete(sectorId);
      } else {
        next.add(sectorId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (users.length === 0 || selectedSectorIds.size === 0) return;

    await bulkAssignAction.mutateAsync({
      userIds: users.map((u) => u.id),
      sectorIds: Array.from(selectedSectorIds),
    });
  };

  const sectors = sectorsData ?? [];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      closeAfterTransition={false}
    >
      <div className="flex flex-col">
        <DialogTitle>Vincular Setores em Lote</DialogTitle>
        <DialogContentText classes={{ root: "!pl-7" }}>
          Selecione os setores para {users.length} usuario(s) selecionado(s)
          (multipla selecao)
        </DialogContentText>
      </div>
      <DialogContent classes={{ root: "!px-2" }}>
        <List>
          {sectors.map((sector) => {
            const isSelected = selectedSectorIds.has(sector.id);
            return (
              <ListItem
                key={sector.id}
                disablePadding
                secondaryAction={
                  <Checkbox
                    edge="end"
                    tabIndex={-1}
                    disableRipple
                    onChange={() => handleToggleSector(sector.id)}
                    checked={isSelected}
                  />
                }
              >
                <ListItemButton onClick={() => handleToggleSector(sector.id)}>
                  <ListItemAvatar>
                    <CustomAvatar color="primary" alt={sector.name}>
                      {sector.name
                        .split(" ")
                        .map((w) => w[0])
                        .join("")}
                    </CustomAvatar>
                  </ListItemAvatar>
                  <ListItemText primary={sector.name} className="mr-2" />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </DialogContent>
      <DialogActions classes={{ root: "!pb-6 !px-4" }}>
        <Button onClick={onClose} variant="outlined" color="inherit">
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          disabled={bulkAssignAction.isPending || selectedSectorIds.size === 0}
          variant="contained"
          loading={bulkAssignAction.isPending}
        >
          Salvar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
