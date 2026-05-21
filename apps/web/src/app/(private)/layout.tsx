import { MembershipsDatabaseRepository } from "@omnichannel/core/infra/repositories/membership-repository";
import { SectorPermissionsDatabaseRepository } from "@omnichannel/core/infra/repositories/sector-permissions-repository";
import { redirect } from "next/navigation";
import { getUserAuthenticate } from "../actions/security";
import { listWorkspaces } from "../actions/users";
import { PrivateLayoutClient } from "./private-layout-client";

const membershipsRepository = MembershipsDatabaseRepository.instance();
const sectorPermissionsRepository =
  SectorPermissionsDatabaseRepository.instance();

export default async function PrivateRootLayout(
  props: React.PropsWithChildren
) {
  const [user] = await getUserAuthenticate();
  const [workspaces] = await listWorkspaces();
  
  if (!user) redirect("/signin");
  
  const membership = await membershipsRepository.retrieveByUserIdAndWorkspaceId(
    user?.id!,
    workspaces?.workspace?.id!
  );

  // Carrega os setores bloqueados para visualização de dados de contato
  const blockedSectors = user?.id
    ? await sectorPermissionsRepository.listBlockedSectorsForContactDetails(
        user.id
      )
    : [];

  return (
    <PrivateLayoutClient
      workspaceId={workspaces?.workspace?.id!}
      user={user?.raw?.()!}
      permissions={membership?.permissions ?? []}
      blockedSectorsForContactDetails={blockedSectors.map((s) => s.sectorId)}
      workspaceSelected={workspaces!}
    >
      {props.children}
    </PrivateLayoutClient>
  );
}
