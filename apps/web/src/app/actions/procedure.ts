import { User } from "@omnichannel/core/domain/entities/user";
import { NotAuthorized } from "@omnichannel/core/domain/errors/not-authorized";
import { NotFound } from "@omnichannel/core/domain/errors/not-found";
import { AuthorizationService } from "@omnichannel/core/domain/services/authorization-service";
import { MembershipsDatabaseRepository } from "@omnichannel/core/infra/repositories/membership-repository";
import { createServerActionProcedure } from "zsa";
import { getUserAuthenticate, getWorkspaceSelected } from "./security";
import { PolicyName } from "@omnichannel/core/domain/services/permissions";

const authorizationService = AuthorizationService.instance();
const membershipsRepository = MembershipsDatabaseRepository.instance();

export const securityProcedure = (permissions: PolicyName[] = []) =>
  createServerActionProcedure()
    .handler(async () => {
      let user: User | null;
      let workspaceId: string | null;

      const [userAuth] = await getUserAuthenticate();
      user = userAuth;
      workspaceId = await getWorkspaceSelected();

      if (!user || !workspaceId) throw NotAuthorized.throw(permissions);

      const membership =
        await membershipsRepository.retrieveByUserIdAndWorkspaceId(
          user?.id,
          workspaceId
        );

      if (!membership?.id) throw NotFound.throw("workspace");

      const isAllowed = authorizationService.can(permissions, user, membership);

      if (!isAllowed && !!permissions?.length)
        throw NotAuthorized.throw(permissions);

      return { user, membership };
    })
    .createServerAction();
