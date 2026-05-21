import { upsertPermissions } from "@/app/actions/users";
import { useServerActionMutation } from "@/hooks/server-action-hooks";
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
  ListItemButton,
  ListItemText,
  Typography,
} from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import {
  PermissionDefinition,
  permissions,
  PolicyName,
} from "@omnichannel/core/domain/services/permissions";

type Props = {
  userPermissions: PolicyName[];
  userId: string;
};

export const RegisterPermissions: React.FC<Props> = (props) => {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const upsertPermissionsAction = useServerActionMutation(upsertPermissions, {
    onSuccess() {
      toast.success("Permissões registradas com sucesso");
      setOpen(false);
      setUserPermissions(new Set());
      queryClient.invalidateQueries({
        queryKey: ["list-users"],
      });
    },
    onError(err) {
      toast.error(err.message);
    },
  });
  const [userPermissions, setUserPermissions] = useState<Set<PolicyName>>(
    new Set()
  );

  useEffect(() => {
    setUserPermissions(new Set(props.userPermissions));
  }, [props.userPermissions]);

  const allPermissions = useMemo(() => Array.from(permissions.keys()), []);

  const addPermissionOnUserPermissions = (
    permissionName: PolicyName,
    visited: Set<PolicyName> = new Set()
  ) => {
    if (visited.has(permissionName)) return;
    visited.add(permissionName);

    const permission = permissions.get(permissionName);
    if (!permission) return;

    userPermissions.add(permissionName);

    for (const linkedPermission of permission.linkeds) {
      if (permissions.has(linkedPermission as PolicyName)) {
        addPermissionOnUserPermissions(linkedPermission as PolicyName, visited);
      }
    }
  };

  const togglePermission = (name: PolicyName) => {
    const isChecked = userPermissions.has(name);

    if (!isChecked) {
      addPermissionOnUserPermissions(name);
    } else {
      userPermissions.delete(name);
    }

    setUserPermissions(new Set(userPermissions));
  };

  return (
    <>
      <Button
        disableRipple
        variant="text"
        fullWidth
        className="!w-full hover:!bg-transparent !pl-5 !justify-start"
        startIcon={<i className="tabler-license text-gray-800 !size-4" />}
        onClick={() => setOpen(true)}
      >
        <span className="font-light text-gray-800">Permissões</span>
      </Button>
      <Dialog
        fullWidth
        maxWidth="lg"
        className="p-4"
        open={open}
        onClose={() => setOpen(false)}
        scroll="paper"
      >
        <DialogTitle variant="h5" className="font-semibold">
          Permissões
        </DialogTitle>
        <DialogContentText className="pl-6">
          As permissões de usuário definem o que cada membro pode visualizar,
          editar ou gerenciar dentro dos Workspaces.
        </DialogContentText>

        <div className="flex items-center justify-end gap-2 px-6 pt-4">
          <Label>Todas as permissões</Label>
          <Switch
            checked={userPermissions.size === allPermissions.length}
            onCheckedChange={(checked) =>
              setUserPermissions(
                new Set<PolicyName>(checked ? allPermissions : [])
              )
            }
          />
        </div>
        <DialogContent classes={{ root: "!pb-0 !mt-4" }}>
          <form
            id="permissions-user"
            onSubmit={(e) => {
              e.preventDefault();
              upsertPermissionsAction.mutate({
                userId: props.userId,
                permissions: Array.from(userPermissions),
              });
            }}
          >
            <List>
              {allPermissions.map((name) => {
                const permission = permissions.get(name);
                if (!permission) return <></>;
                return (
                  <ListItem
                    key={permission?.description}
                    disablePadding
                    secondaryAction={
                      <Checkbox
                        edge="end"
                        tabIndex={-1}
                        disableRipple
                        onChange={() => {
                          togglePermission(name);
                        }}
                        checked={userPermissions.has(name)}
                      />
                    }
                  >
                    <ListItemButton
                      onClick={() => {
                        togglePermission(name);
                      }}
                    >
                      <ListItemText
                        id="checkbox-list-label-0"
                        primary={
                          <Typography variant="h6" className="font-semibold">
                            {permission?.description}
                          </Typography>
                        }
                        secondary={name}
                      />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          </form>
          <DialogActions className="sticky !px-0 gap-4 !flex !items-center !justify-between bottom-0 bg-white !border-t">
            <Typography variant="caption" className="!text-primary">
              {userPermissions.size === 0
                ? "Nenhuma permissão selecionada"
                : userPermissions.size === 1
                  ? "1 permissão selecionada"
                  : `${userPermissions.size} permissões selecionadas`}
            </Typography>
            <Button type="submit" form="permissions-user" variant="contained">
              Salvar
            </Button>
          </DialogActions>
        </DialogContent>
      </Dialog>
    </>
  );
};
