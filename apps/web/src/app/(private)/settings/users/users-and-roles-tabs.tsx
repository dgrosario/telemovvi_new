"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useUsersAndRolesTab,
  type TabValue,
} from "@/hooks/use-users-and-roles-tab";
import { usePermissionCheck } from "@/hooks/use-permission-check";
import { PERMISSION_MAPPINGS } from "@/lib/permissions-map";
import { Tooltip } from "@mui/material";
import TableUsers from "./table-users";
import { TableRoles } from "./table-roles";
import { type UserListed } from "@omnichannel/core/infra/repositories/users-repository";
import { type Role } from "@omnichannel/core/domain/entities/role";

type Props = {
  users: UserListed[];
  roles: Role.Raw[];
};

export function UsersAndRolesTabs({ users, roles }: Props) {
  const { tab, setTab } = useUsersAndRolesTab();
  const { hasPermission: canViewRoles, tooltipMessage: rolesMessage } =
    usePermissionCheck(PERMISSION_MAPPINGS.roles.viewAll);

  const handleTabChange = (value: string) => {
    if (value === "roles" && !canViewRoles) return;
    setTab(value as TabValue);
  };

  return (
    <Tabs
      value={tab}
      onValueChange={handleTabChange}
      className="flex-1 flex flex-col"
    >
      <TabsList variant="line" className="px-6 shrink-0">
        <TabsTrigger value="users">Usuários</TabsTrigger>
        {canViewRoles ? (
          <TabsTrigger value="roles">Perfis</TabsTrigger>
        ) : (
          <Tooltip title={rolesMessage}>
            <span>
              <TabsTrigger value="roles" disabled>
                Perfis
              </TabsTrigger>
            </span>
          </Tooltip>
        )}
      </TabsList>

      <TabsContent value="users" className="flex-1 mt-0">
        <TableUsers users={users} />
      </TabsContent>

      <TabsContent value="roles" className="flex-1 mt-0">
        <TableRoles roles={roles} />
      </TabsContent>
    </Tabs>
  );
}
