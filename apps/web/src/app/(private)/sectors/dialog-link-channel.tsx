"use client";
import {
  addChannelsToSector,
  listChannelsBySector,
  removeChannelsFromSector,
} from "@/app/actions/sectors";
import { listChannels } from "@/app/actions/channels";
import CustomAvatar from "@/components/custom-avatar";
import {
  useServerActionMutation,
  useServerActionQuery,
} from "@/hooks/server-action-hooks";
import { useSectors } from "@/hooks/use-sectors";
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

export function DialogLinkChannel() {
  const { openLinkChannel, toggleOpenLinkChannel, id, setId } = useSectors();
  const [selectedChannels, setSelectedChannels] = useState<any[]>([]);
  const queryClient = useQueryClient();

  const { data: channelsData, refetch: refetchChannels } = useServerActionQuery(
    listChannels,
    {
      input: undefined,
      enabled: false,
      queryKey: ["list-channels"],
    }
  );

  const { data: channelsBySector, refetch: refetchChannelsBySector } =
    useServerActionQuery(listChannelsBySector, {
      input: { sectorId: id },
      enabled: false,
      queryKey: ["list-channels-by-sector"],
    });

  useMemo(() => {
    if (!channelsData || !channelsBySector) return;

    const preSelected = channelsData.filter((channel) =>
      channelsBySector.some((linked: any) => linked.channelId === channel.id)
    );
    setSelectedChannels(preSelected);
  }, [channelsData, channelsBySector]);

  useEffect(() => {
    if (openLinkChannel && id) {
      refetchChannels();
      refetchChannelsBySector();
    }
  }, [openLinkChannel, id]);

  const addChannelsAction = useServerActionMutation(addChannelsToSector, {
    onError() {
      toast.error("Erro ao vincular conexões", { transition: Flip });
    },
  });

  const removeChannelsAction = useServerActionMutation(
    removeChannelsFromSector,
    {
      onError() {
        toast.error("Erro ao desvincular conexões", { transition: Flip });
      },
    }
  );

  const handleSave = async () => {
    if (!id) return;

    const currentChannelsIds =
      channelsBySector?.map((u: any) => u.channelId) || [];
    const selectedChannelIds = selectedChannels.map((u) => u.id);

    const addedChannelIds = selectedChannelIds.filter(
      (id) => !currentChannelsIds.includes(id)
    );

    const removedChannelIds = currentChannelsIds.filter(
      (id) => !selectedChannelIds.includes(id)
    );

    try {
      if (addedChannelIds.length > 0) {
        await addChannelsAction.mutateAsync({
          channelsIds: addedChannelIds,
          sectorId: id,
        });
      }

      if (removedChannelIds.length > 0) {
        await removeChannelsAction.mutateAsync({
          channelsIds: removedChannelIds,
          sectorId: id,
        });
      }

      toast.success("Alterações salvas com sucesso!", { transition: Flip });

      toggleOpenLinkChannel();
      setSelectedChannels([]);
      setId("");

      queryClient.invalidateQueries({ queryKey: ["list-channels-by-sector"] });
    } catch (error) {
      toast.error("Erro ao salvar alterações", { transition: Flip });
    }
  };

  const handleClose = () => {
    toggleOpenLinkChannel();
    setSelectedChannels([]);
    setId("");
    queryClient.removeQueries({ queryKey: ["list-channels"] });
    queryClient.removeQueries({ queryKey: ["list-channels-by-sector"] });
  };

  function arraysAreEqualById(a: any[], b: any[]) {
    if (a.length !== b.length) return false;
    const aIds = a.map((u) => u.id).sort();
    const bIds = b.map((u) => u.channelId ?? u.id).sort();
    return JSON.stringify(aIds) === JSON.stringify(bIds);
  }

  const isLoading = useMemo(
    () => addChannelsAction.isPending || removeChannelsAction.isPending,
    [addChannelsAction.isPending, removeChannelsAction.isPending]
  );

  const channels = useMemo(() => channelsData || [], [channelsData]);

  return (
    <Dialog
      open={openLinkChannel}
      onClose={handleClose}
      fullWidth
      closeAfterTransition={false}
    >
      <div className="flex flex-col">
        <DialogTitle>Vincular Conexões</DialogTitle>
        <DialogContentText
          classes={{
            root: "!pl-7",
          }}
        >
          Selecione as conexões que estão habilitados no setor
        </DialogContentText>
      </div>
      <DialogContent
        classes={{
          root: "!px-2",
        }}
      >
        <List>
          {channels.map((channel) => {
            return (
              <ListItem
                key={channel.id}
                disablePadding
                secondaryAction={
                  <Checkbox
                    edge="end"
                    tabIndex={-1}
                    disableRipple
                    onChange={() =>
                      setSelectedChannels(
                        !selectedChannels.find((u) => u.id === channel.id)
                          ? [...selectedChannels, channel]
                          : selectedChannels.filter((u) => u.id !== channel.id)
                      )
                    }
                    checked={
                      !!selectedChannels.find((u) => u.id === channel.id)
                    }
                  />
                }
              >
                <ListItemButton
                  onClick={() => {
                    setSelectedChannels(
                      !selectedChannels.find((u) => u.id === channel.id)
                        ? [...selectedChannels, channel]
                        : selectedChannels.filter((u) => u.id !== channel.id)
                    );
                  }}
                >
                  <ListItemAvatar>
                    <CustomAvatar color="primary" alt={channel.name}>
                      {channel.name
                        .split(" ")
                        .map((w: string) => w[0])
                        .join("")}
                    </CustomAvatar>
                  </ListItemAvatar>
                  <ListItemText primary={channel.name} className="mr-2" />
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
          disabled={
            isLoading ||
            arraysAreEqualById(selectedChannels, channelsBySector || [])
          }
          variant="contained"
          loading={isLoading}
        >
          Salvar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
