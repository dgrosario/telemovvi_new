import { Role } from "../../domain/entities/role";
import { RolesDatabaseRepository } from "../../infra/repositories/roles-repository";

interface RolesRepository {
  list(workspaceId: string): Promise<Role.Raw[]>;
}

export class ListRoles {
  constructor(private readonly rolesRepository: RolesRepository) {}

  async execute(workspaceId: string): Promise<Role.Raw[]> {
    return this.rolesRepository.list(workspaceId);
  }

  static instance(): ListRoles {
    return new ListRoles(RolesDatabaseRepository.instance());
  }
}
