import { Workspace } from "../../domain/entities/workspace";
import { createDatabaseConnection } from "../database";
import { memberships, workspaces } from "../database/schemas";
import { eq } from "drizzle-orm";

export class WorkspacesRepository {
  async retrieveFirstWorkspaceByUserId(userId: string) {
    const db = createDatabaseConnection();

    const [workspace] = await db
      .select({ id: workspaces.id, name: workspaces.name })
      .from(memberships)
      .leftJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
      .where(eq(memberships.userId, userId));

    if (!workspace) return null;

    return { id: workspace.id, name: workspace.name };
  }

  async list(userId: string) {
    if (!userId) return [];

    const db = createDatabaseConnection();

    const response = await db
      .select({ id: workspaces.id, name: workspaces.name })
      .from(memberships)
      .leftJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
      .where(eq(memberships.userId, userId));

    return response.map((workspace) => ({
      id: workspace.id!,
      name: workspace.name!,
    }));
  }

  async upsert(workspace: Workspace) {
    const db = createDatabaseConnection();
    await db
      .insert(workspaces)
      .values({
        id: workspace.id,
        name: workspace.name,
      })
      .onConflictDoUpdate({
        set: {
          name: workspace.name,
        },
        target: workspaces.id,
      });
  }

  static instance() {
    return new WorkspacesRepository();
  }
}
