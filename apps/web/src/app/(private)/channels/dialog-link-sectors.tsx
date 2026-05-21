"use client";
import {
  addSectorsToChannel,
  listSectors,
  listSectorsByChannel,
  removeSectorsFromChannel,
} from "@/app/actions/sectors";
import CustomAvatar from "@/components/custom-avatar";
import {
  useServerActionMutation,
  useServerActionQuery,
} from "@/hooks/server-action-hooks";
import { useChannels } from "@/hooks/use-channels";
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
  const { openLink, toggleOpenLink, channelId, setChannelValues } =
    useChannels();
  const [selectedSectors, setSelectedSectors] = useState<any[]>([]);
  const queryClient = useQueryClient();

  const { data: sectorsData, refetch: refetchSectors } = useServerActionQuery(
    listSectors,
    {
      input: undefined,
      enabled: false,
      queryKey: ["list-sectors"],
    }
  );

  const { data: sectorsByChannel, refetch: refetchSectorsByChannel } =
    useServerActionQuery(listSectorsByChannel, {
      input: { channelId: channelId },
      enabled: false,
      queryKey: ["list-sectors-by-channel"],
    });

  useMemo(() => {
    if (!sectorsData || !sectorsByChannel) return;

    const preSelected = sectorsData.filter((sector) =>
      sectorsByChannel.some((linked: any) => linked.sectorId === sector.id)
    );
    setSelectedSectors(preSelected);
  }, [sectorsData, sectorsByChannel]);

  useEffect(() => {
    if (openLink && channelId) {
      refetchSectors();
      refetchSectorsByChannel();
    }
  }, [openLink, channelId]);

  const addSectorsAction = useServerActionMutation(addSectorsToChannel, {
    onError() {
      toast.error("Erro ao vincular setores", { transition: Flip });
    },
  });

  const removeSectorsAction = useServerActionMutation(
    removeSectorsFromChannel,
    {
      onError() {
        toast.error("Erro ao desvincular setores", { transition: Flip });
      },
    }
  );

  const handleSave = async () => {
    if (!channelId) return;
    const currentSectorsIds =
      sectorsByChannel?.map((u: any) => u.sectorId) || [];
    const selectedSectorsIds = selectedSectors.map((u) => u.id);
    const addedSectorsIds = selectedSectorsIds.filter(
      (id) => !currentSectorsIds.includes(id)
    );
    const removedSectorsIds = currentSectorsIds.filter(
      (id) => !selectedSectorsIds.includes(id)
    );
    try {
      if (addedSectorsIds.length > 0) {
        await addSectorsAction.mutateAsync({
          channelId: channelId,
          sectorsIds: addedSectorsIds,
        });
      }
      if (removedSectorsIds.length > 0) {
        await removeSectorsAction.mutateAsync({
          channelId: channelId,
          sectorsIds: removedSectorsIds,
        });
      }
      await queryClient.invalidateQueries({
        exact: true,
        queryKey: ["list-users"],
      });
      toast.success("Alterações salvas com sucesso!", { transition: Flip });
      toggleOpenLink();
      setSelectedSectors([]);
      setChannelValues("", "");
      queryClient.invalidateQueries({ queryKey: ["list-sectors-by-channel"] });
    } catch (error) {
      toast.error("Erro ao salvar alterações", { transition: Flip });
    }
  };

  const handleClose = () => {
    toggleOpenLink();
    setSelectedSectors([]);
    setChannelValues("", "");
  };

  const sectors = useMemo(() => sectorsData || [], [sectorsData]);

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
          Selecione os setores que estão habilitados para essa conexão
        </DialogContentText>
      </div>
      <DialogContent
        classes={{
          root: "!px-2",
        }}
      >
        <List>
          {sectors.map((sector) => {
            return (
              <ListItem
                key={sector.id}
                disablePadding
                secondaryAction={
                  <Checkbox
                    edge="end"
                    tabIndex={-1}
                    disableRipple
                    onChange={() =>
                      setSelectedSectors(
                        !selectedSectors.find((u) => u.id === sector.id)
                          ? [...selectedSectors, sector]
                          : selectedSectors.filter((u) => u.id !== sector.id)
                      )
                    }
                    checked={!!selectedSectors.find((u) => u.id === sector.id)}
                  />
                }
              >
                <ListItemButton
                  onClick={() => {
                    setSelectedSectors(
                      !selectedSectors.find((u) => u.id === sector.id)
                        ? [...selectedSectors, sector]
                        : selectedSectors.filter((u) => u.id !== sector.id)
                    );
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
          // disabled={
          //   isLoading ||
          //   arraysAreEqualById(selectedSectors, sectorsByChannel || [])
          // }
          variant="contained"
          // loading={isLoading}
        >
          Salvar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
