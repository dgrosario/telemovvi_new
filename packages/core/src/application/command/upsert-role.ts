import { Role } from "../../domain/entities/role";
import { RolesDatabaseRepository } from "../../infra/repositories/roles-repository";
import { SectorsDatabaseRepository } from "../../infra/repositories/sectors-respository";
import type { PolicyName } from "../../domain/services/permissions";

interface RolesRepository {
  upsert(role: Role): Promise<void>;
  retrieve(roleId: string): Promise<Role | null>;
}

interface SectorsRepository {
  validateSectorIds(
    sectorIds: string[],
    workspaceId: string
  ): Promise<{ valid: boolean; invalidIds: string[] }>;
}

export class UpsertRole {
  constructor(
    private readonly rolesRepository: RolesRepository,
    private readonly sectorsRepository: SectorsRepository
  ) {}

  async execute(input: InputDTO): Promise<Role> {
    if (input.blockedSectorIds && input.blockedSectorIds.length > 0) {
      const validation = await this.sectorsRepository.validateSectorIds(
        input.blockedSectorIds,
        input.workspaceId
      );

      if (!validation.valid) {
        throw new Error(
          `Setores inválidos: ${validation.invalidIds.join(", ")}`
        );
      }
    }

    let role: Role;

    if (input.id) {
      const existingRole = await this.rolesRepository.retrieve(input.id);

      if (existingRole?.isSystem) {
        role = Role.instance({
          id: input.id,
          workspaceId: input.workspaceId,
          name: existingRole.name,
          description: existingRole.description,
          permissions: input.permissions,
          blockedSectorIds: input.blockedSectorIds,
          isSystem: true,
        });
      } else {
        role = Role.instance({
          id: input.id,
          workspaceId: input.workspaceId,
          name: input.name,
          description: input.description,
          permissions: input.permissions,
          blockedSectorIds: input.blockedSectorIds,
          isSystem: false,
        });
      }
    } else {
      role = Role.create({
        workspaceId: input.workspaceId,
        name: input.name,
        description: input.description,
        permissions: input.permissions,
        blockedSectorIds: input.blockedSectorIds,
        isSystem: false,
      });
    }

    await this.rolesRepository.upsert(role);

    return role;
  }

  static instance(): UpsertRole {
    return new UpsertRole(
      RolesDatabaseRepository.instance(),
      SectorsDatabaseRepository.instance()
    );
  }
}

type InputDTO = {
  id?: string;
  name: string;
  workspaceId: string;
  description?: string;
  permissions?: PolicyName[];
  blockedSectorIds?: string[];
};
