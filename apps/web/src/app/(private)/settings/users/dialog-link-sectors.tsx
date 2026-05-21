"use client";
import {
  addSectorsToUser,
  listSectors,
  listSectorsByUser,
  removeOneSectorFromUser,
  removeSectorsFromUser,
} from "@/app/actions/sectors";
import CustomAvatar from "@/components/custom-avatar";
import {
  useServerActionMutation,
  useServerActionQuery,
} from "@/hooks/server-action-hooks";
import { useUsers } from "@/hooks/use-users";
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
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Flip, toast } from "react-toastify";

export function DialogLinkSectors() {
  const { openLink, toggleOpenLink, userId, setUserId } = useUsers();
  const [selectedSectors, setSelectedSectors] = useState<Set<string>>(new Set());
  const [initialSectors, setInitialSectors] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const { data: sectorsData, refetch: refetchSectors } = useServerActionQuery(
    listSectors,
    {
      input: undefined,
      enabled: false,
      queryKey: ["list-sectors"],
    }
  );

  const { data: sectorsByUser, refetch: refetchSectorsByUser } =
    useServerActionQuery(listSectorsByUser, {
      input: { userId: userId },
      enabled: false,
      queryKey: ["list-sectors-by-user"],
    });

  useEffect(() => {
    if (sectorsByUser) {
      const sectorIds = sectorsByUser
        .map((s) => s.sectorId)
        .filter(Boolean) as string[];
      setSelectedSectors(new Set(sectorIds));
      setInitialSectors(new Set(sectorIds));
    }
  }, [sectorsByUser]);

  useEffect(() => {
    if (openLink && userId) {
      refetchSectors();
      refetchSectorsByUser();
    }
  }, [openLink, userId]);

  const addSectorsAction = useServerActionMutation(addSectorsToUser, {
    onError() {
      toast.error("Erro ao vincular setores", { transition: Flip });
    },
  });

  const removeSectorAction = useServerActionMutation(removeOneSectorFromUser, {
    onError() {
      toast.error("Erro ao desvincular setor", { transition: Flip });
    },
  });

  const removeAllSectorsAction = useServerActionMutation(removeSectorsFromUser, {
    onError() {
      toast.error("Erro ao desvincular setores", { transition: Flip });
    },
  });

  const handleToggleSector = (sectorId: string) => {
    setSelectedSectors((prev) => {
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
    if (!userId) return;

    try {
      const sectorsToAdd = [...selectedSectors].filter(
        (id) => !initialSectors.has(id)
      );
      const sectorsToRemove = [...initialSectors].filter(
        (id) => !selectedSectors.has(id)
      );

      for (const sectorId of sectorsToAdd) {
        await addSectorsAction.mutateAsync({
          userId: userId,
          sectorId: sectorId,
        });
      }

      for (const sectorId of sectorsToRemove) {
        await removeSectorAction.mutateAsync({
          userId: userId,
          sectorId: sectorId,
        });
      }

      await queryClient.invalidateQueries({
        exact: true,
        queryKey: ["list-users"],
      });
      toast.success("Alteracoes salvas com sucesso!", { transition: Flip });

      toggleOpenLink();
      setSelectedSectors(new Set());
      setInitialSectors(new Set());
      setUserId("");

      queryClient.invalidateQueries({ queryKey: ["list-sectors-by-user"] });
    } catch (error) {
      toast.error("Erro ao salvar alteracoes", { transition: Flip });
    }
  };

  const handleClose = () => {
    toggleOpenLink();
    setSelectedSectors(new Set());
    setInitialSectors(new Set());
    setUserId("");
    queryClient.removeQueries({ queryKey: ["list-sectors"] });
    queryClient.removeQueries({ queryKey: ["list-sectors-by-user"] });
  };

  const isLoading = useMemo(
    () =>
      addSectorsAction.isPending ||
      removeSectorAction.isPending ||
      removeAllSectorsAction.isPending,
    [
      addSectorsAction.isPending,
      removeSectorAction.isPending,
      removeAllSectorsAction.isPending,
    ]
  );

  const sectors = useMemo(() => sectorsData || [], [sectorsData]);

  const hasChanges = useMemo(() => {
    if (selectedSectors.size !== initialSectors.size) return true;
    for (const id of selectedSectors) {
      if (!initialSectors.has(id)) return true;
    }
    return false;
  }, [selectedSectors, initialSectors]);

  return (
    <Dialog
      open={openLink}
      onClose={handleClose}
      fullWidth
      closeAfterTransition={false}
    >
      <div className="flex flex-col">
        <DialogTitle>Vincular Setores</DialogTitle>
        <DialogContentText
          classes={{
            root: "!pl-7",
          }}
        >
          Selecione os setores do usuario (multipla selecao)
        </DialogContentText>
      </div>
      <DialogContent
        classes={{
          root: "!px-2",
        }}
      >
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
                    onChange={() => handleToggleSector(sector.id)}
                    checked={isSelected}
                  />
                }
              >
                <ListItemButton
                  onClick={() => {
                    handleToggleSector(sector.id);
                  }}
                >
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
      <DialogActions
        classes={{
          root: "!pb-6 !px-4",
        }}
      >
        <Button
          onClick={handleSave}
          disabled={isLoading || !hasChanges}
          variant="contained"
          loading={isLoading}
        >
          Salvar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
