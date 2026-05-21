import { getUserAuthenticate, getWorkspaceSelected } from "@/app/actions/security";
import { AuthorizationService, PolicyName } from "@omnichannel/core/domain/services/authorization-service";
import { MembershipsDatabaseRepository } from "@omnichannel/core/infra/repositories/membership-repository";
import { redirect } from "next/navigation";
import { ReactNode } from "react";

interface RouteGuardProps {
  permissions: PolicyName[];
  requireAll?: boolean;
  redirectTo?: string;
  children: ReactNode;
}

export async function RouteGuard({
  permissions,
  requireAll = false,
  redirectTo = "/403",
  children,
}: RouteGuardProps) {
  const [user, userError] = await getUserAuthenticate();
  const workspaceId = await getWorkspaceSelected();

  if (userError || !user || !workspaceId) {
    redirect("/signin");
  }

  const membershipRepository = MembershipsDatabaseRepository.instance();
  const membership = await membershipRepository.retrieveByUserIdAndWorkspaceId(
    user.id,
    workspaceId
  );

  if (!membership) {
    redirect("/signin");
  }

  const authorizationService = AuthorizationService.instance();

  const hasPermission = requireAll
    ? permissions.every((permission) => membership.hasPermission(permission))
    : authorizationService.can(permissions, user, membership);

  if (!hasPermission) {
    redirect(redirectTo);
  }

  return <>{children}</>;
}
