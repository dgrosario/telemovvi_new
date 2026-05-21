import { Workspace } from "../../domain/entities/workspace";
import { WorkspacesRepository } from "../../infra/repositories/workspaces-repository";

export class WorkspaceServices {
  constructor(private readonly workspacesRepository: WorkspacesRepository) {}

  async create(name: string) {
    const workspace = Workspace.create(name);
    await this.workspacesRepository.upsert(workspace);
    return workspace.id;
  }

  static instance() {
    return new WorkspaceServices(WorkspacesRepository.instance());
  }
}
