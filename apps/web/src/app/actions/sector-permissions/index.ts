"use server";

import { SectorPermissionsDatabaseRepository } from "@omnichannel/core/infra/repositories/sector-permissions-repository";
import { revalidatePath } from "next/cache";
import * as z from "zod";
import { securityProcedure } from "../procedure";

const sectorPermissionsRepository =
  SectorPermissionsDatabaseRepository.instance();

export const listBlockedSectorsForContactDetails = securityProcedure([
  "manage:users",
  "register:permissions",
])
  .input(z.object({ userId: z.string() }))
  .handler(async ({ input }) => {
    return await sectorPermissionsRepository.listBlockedSectorsForContactDetails(
      input.userId
    );
  });

export const setBlockedSectorsForContactDetails = securityProcedure([
  "manage:users",
  "register:permissions",
])
  .input(
    z.object({
      userId: z.string(),
      sectorIds: z.array(z.string()),
    })
  )
  .handler(async ({ input }) => {
    await sectorPermissionsRepository.setBlockedSectorsForContactDetails(
      input.userId,
      input.sectorIds
    );
    revalidatePath("/");
  });
