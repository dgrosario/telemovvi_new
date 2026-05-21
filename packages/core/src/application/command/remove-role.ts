import { Role } from "../../domain/entities/role";
import { RolesDatabaseRepository } from "../../infra/repositories/roles-repository";

interface RolesRepository {
  retrieve(roleId: string): Promise<Role | null>;
  removeMany(ids: string[]): Promise<void>;
}

export class RemoveRole {
  constructor(private readonly rolesRepository: RolesRepository) {}

  async execute(input: InputDTO): Promise<void> {
    for (const id of input.ids) {
      const role = await this.rolesRepository.retrieve(id);
      if (role?.isSystem) {
        throw new Error(`Cannot remove system role: ${role.name}`);
      }
    }

    await this.rolesRepository.removeMany(input.ids);
  }

  static instance(): RemoveRole {
    return new RemoveRole(RolesDatabaseRepository.instance());
  }
}

type InputDTO = {
  ids: string[];
};
