import { listUsers } from "@/app/actions/users";
import { listRoles } from "@/app/actions/roles";
import { RouteGuard } from "@/components/route-guard";
import { HeaderUsersAndRoles } from "./header-users-and-roles";
import { UsersAndRolesTabs } from "./users-and-roles-tabs";
import { ModalRegisterUser } from "./modal-register-user";
import { ModalRegisterRole } from "./modal-register-role";
import { DialogLinkSectors } from "./dialog-link-sectors";
import { UserDetailsDrawer } from "./user-details-drawer";
import { type Role } from "@omnichannel/core/domain/entities/role";

export default async function UsersPage() {
  const [users] = await listUsers();
  const rolesResult = await listRoles();
  const roles: Role.Raw[] =
    rolesResult && "data" in rolesResult
      ? ((rolesResult.data as Role.Raw[]) ?? [])
      : [];

  return (
    <RouteGuard permissions={["manage:users", "list:users"]}>
      <HeaderUsersAndRoles />
      <UsersAndRolesTabs users={users ?? []} roles={roles} />
      <ModalRegisterUser />
      <ModalRegisterRole />
      <DialogLinkSectors />
      <UserDetailsDrawer />
    </RouteGuard>
  );
}
