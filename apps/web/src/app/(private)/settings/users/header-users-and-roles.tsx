"use client";

import { TitlePage } from "@/components/title-page";
import { useUsers } from "@/hooks/use-users";
import { useRoles } from "@/hooks/use-roles";
import { useUsersAndRolesTab } from "@/hooks/use-users-and-roles-tab";
import { usePermissionCheck } from "@/hooks/use-permission-check";
import { PermissionTooltip } from "@/components/permission-tooltip";
import { PERMISSION_MAPPINGS } from "@/lib/permissions-map";
import { Button } from "@mui/material";

export function HeaderUsersAndRoles() {
  const { tab } = useUsersAndRolesTab();
  const { toggleOpen: toggleUsers } = useUsers();
  const { toggleOpen: toggleRoles } = useRoles();

  const { hasPermission: canCreateUser, tooltipMessage: userMessage } =
    usePermissionCheck(PERMISSION_MAPPINGS.users.create);
  const { hasPermission: canCreateRole, tooltipMessage: roleMessage } =
    usePermissionCheck(PERMISSION_MAPPINGS.roles.create);

  const isUsersTab = tab === "users";

  return (
    <header className="pt-6 flex justify-between items-center px-6">
      <TitlePage>Usuários e Perfis</TitlePage>
      {isUsersTab ? (
        <PermissionTooltip hasPermission={canCreateUser} message={userMessage}>
          <Button
            variant="contained"
            onClick={() => toggleUsers()}
            disabled={!canCreateUser}
          >
            Novo usuário
          </Button>
        </PermissionTooltip>
      ) : (
        <PermissionTooltip hasPermission={canCreateRole} message={roleMessage}>
          <Button
            variant="contained"
            onClick={() => toggleRoles()}
            disabled={!canCreateRole}
          >
            Novo perfil
          </Button>
        </PermissionTooltip>
      )}
    </header>
  );
}
