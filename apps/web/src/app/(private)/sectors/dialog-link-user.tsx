"use client";
import {
  addUsersToSector,
  listUsersBySector,
  removeUsersFromSector,
} from "@/app/actions/sectors";
import { listUsers } from "@/app/actions/users";
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

export function DialogLinkUser() {
  const { openLinkUser, toggleOpenLinkUser, id, setId } = useSectors();
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
  const queryClient = useQueryClient();

  const { data: usersData, refetch: refetchUsers } = useServerActionQuery(
    listUsers,
    {
      input: undefined,
      enabled: false,
      queryKey: ["list-users"],
    }
  );

  const { data: usersBySector, refetch: refetchUsersBySector } =
    useServerActionQuery(listUsersBySector, {
      input: { sectorId: id },
      enabled: false,
      queryKey: ["list-users-by-sector"],
    });

  useMemo(() => {
    if (!usersData || !usersBySector) return;

    const preSelected = usersData.filter((user) =>
      usersBySector.some((linked: any) => linked.userId === user.id)
    );
    setSelectedUsers(preSelected);
  }, [usersData, usersBySector]);

  useEffect(() => {
    if (openLinkUser && id) {
      refetchUsers();
      refetchUsersBySector();
    }
  }, [openLinkUser, id]);

  const addUsersAction = useServerActionMutation(addUsersToSector, {
    onError() {
      toast.error("Erro ao vincular usuários", { transition: Flip });
    },
  });

  const removeUsersAction = useServerActionMutation(removeUsersFromSector, {
    onError() {
      toast.error("Erro ao desvincular usuários", { transition: Flip });
    },
  });

  const handleSave = async () => {
    if (!id) return;

    const currentUserIds = usersBySector?.map((u: any) => u.userId) || [];
    const selectedUserIds = selectedUsers.map((u) => u.id);

    const addedUserIds = selectedUserIds.filter(
      (id) => !currentUserIds.includes(id)
    );

    const removedUserIds = currentUserIds.filter(
      (id) => !selectedUserIds.includes(id)
    );

    try {
      if (addedUserIds.length > 0) {
        await addUsersAction.mutateAsync({
          userIds: addedUserIds,
          sectorId: id,
        });
      }

      if (removedUserIds.length > 0) {
        await removeUsersAction.mutateAsync({
          userIds: removedUserIds,
          sectorId: id,
        });
      }

      toast.success("Alterações salvas com sucesso!", { transition: Flip });

      toggleOpenLinkUser();
      setSelectedUsers([]);
      setId("");

      queryClient.invalidateQueries({ queryKey: ["list-users-by-sector"] });
    } catch (error) {
      toast.error("Erro ao salvar alterações", { transition: Flip });
    }
  };

  const handleClose = () => {
    toggleOpenLinkUser();
    setSelectedUsers([]);
    setId("");
    queryClient.removeQueries({ queryKey: ["list-users"] });
    queryClient.removeQueries({ queryKey: ["list-users-by-sector"] });
  };

  function arraysAreEqualById(a: any[], b: any[]) {
    if (a.length !== b.length) return false;
    const aIds = a.map((u) => u.id).sort();
    const bIds = b.map((u) => u.userId ?? u.id).sort();
    return JSON.stringify(aIds) === JSON.stringify(bIds);
  }

  const isLoading = useMemo(
    () => addUsersAction.isPending || removeUsersAction.isPending,
    [addUsersAction.isPending, removeUsersAction.isPending]
  );

  const users = useMemo(() => usersData || [], [usersData]);

  return (
    <Dialog
      open={openLinkUser}
      onClose={handleClose}
      fullWidth
      closeAfterTransition={false}
    >
      <div className="flex flex-col">
        <DialogTitle>Vincular Usuários</DialogTitle>
        <DialogContentText
          classes={{
            root: "!pl-7",
          }}
        >
          Selecione os usuários que estão habilitados no setor
        </DialogContentText>
      </div>
      <DialogContent
        classes={{
          root: "!px-2",
        }}
      >
        <List>
          {users.map((user) => {
            return (
              <ListItem
                key={user.id}
                disablePadding
                secondaryAction={
                  <Checkbox
                    edge="end"
                    tabIndex={-1}
                    disableRipple
                    onChange={() =>
                      setSelectedUsers(
                        !selectedUsers.find((u) => u.id === user.id)
                          ? [...selectedUsers, user]
                          : selectedUsers.filter((u) => u.id !== user.id)
                      )
                    }
                    checked={!!selectedUsers.find((u) => u.id === user.id)}
                  />
                }
              >
                <ListItemButton
                  onClick={() => {
                    setSelectedUsers(
                      !selectedUsers.find((u) => u.id === user.id)
                        ? [...selectedUsers, user]
                        : selectedUsers.filter((u) => u.id !== user.id)
                    );
                  }}
                >
                  <ListItemAvatar>
                    <CustomAvatar color="primary" alt={user.name}>
                      {user.name
                        .split(" ")
                        .map((w) => w[0])
                        .join("")}
                    </CustomAvatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={user.name}
                    secondary={user.email}
                    className="mr-2"
                  />
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
            isLoading || arraysAreEqualById(selectedUsers, usersBySector || [])
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
