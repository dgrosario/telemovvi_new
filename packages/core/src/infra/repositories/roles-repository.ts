import { and, eq, inArray } from "drizzle-orm";
import { Role } from "../../domain/entities/role";
import { createDatabaseConnection } from "../database";
import { roles } from "../database/schemas";
import type { PolicyName } from "../../domain/services/permissions";

type RoleRow = typeof roles.$inferSelect;

export class RolesDatabaseRepository {
  private toDomain(row: RoleRow): Role {
    return Role.instance({
      id: row.id,
      workspaceId: row.workspaceId,
      name: row.name,
      description: row.description,
      permissions: row.permissions as PolicyName[],
      blockedSectorIds: row.blockedSectorIds,
      isSystem: row.isSystem,
      createdAt: row.createdAt,
    });
  }

  async retrieve(roleId: string): Promise<Role | null> {
    const db = createDatabaseConnection();
    const [role] = await db.select().from(roles).where(eq(roles.id, roleId));

    if (!role) return null;

    return this.toDomain(role);
  }

  async list(workspaceId: string): Promise<Role.Raw[]> {
    const db = createDatabaseConnection();

    const response = await db
      .select()
      .from(roles)
      .where(eq(roles.workspaceId, workspaceId))
      .orderBy(roles.name);

    return response.map((role) => this.toDomain(role).raw());
  }

  async upsert(role: Role): Promise<void> {
    const db = createDatabaseConnection();
    const roleData = role.raw();

    await db
      .insert(roles)
      .values({
        id: roleData.id,
        workspaceId: roleData.workspaceId,
        name: roleData.name,
        description: roleData.description,
        permissions: roleData.permissions,
        blockedSectorIds: roleData.blockedSectorIds,
        isSystem: roleData.isSystem,
        createdAt: roleData.createdAt,
      })
      .onConflictDoUpdate({
        set: {
          name: roleData.name,
          description: roleData.description,
          permissions: roleData.permissions,
          blockedSectorIds: roleData.blockedSectorIds,
        },
        target: roles.id,
      });
  }

  async remove(roleId: string): Promise<void> {
    const db = createDatabaseConnection();
    await db
      .delete(roles)
      .where(and(eq(roles.id, roleId), eq(roles.isSystem, false)));
  }

  async removeMany(ids: string[]): Promise<void> {
    const db = createDatabaseConnection();
    await db
      .delete(roles)
      .where(and(inArray(roles.id, ids), eq(roles.isSystem, false)));
  }

  async findByName(
    workspaceId: string,
    name: string
  ): Promise<Role | null> {
    const db = createDatabaseConnection();
    const [role] = await db
      .select()
      .from(roles)
      .where(and(eq(roles.workspaceId, workspaceId), eq(roles.name, name)));

    if (!role) return null;

    return this.toDomain(role);
  }

  async createSystemRolesForWorkspace(workspaceId: string): Promise<void> {
    const db = createDatabaseConnection();

    const systemRoles = [
      {
        id: crypto.randomUUID(),
        workspaceId,
        name: "Administrador",
        description: "Acesso completo a todas as funcionalidades",
        permissions: [
          "start:session",
          "manage:users",
          "register:permissions",
          "manage:sectors",
          "list:all-conversations",
          "list:all-sectors",
          "list:all-channels",
          "send:message",
          "assign:conversation",
          "transfer:conversation",
          "create:conversation",
          "close:conversation",
          "delete:conversation",
          "delete:any-message",
          "manage:connections",
          "manage:templates",
          "manage:calculator-settings",
          "manage:partners",
          "view:contact-details",
          "manage:flows",
          "manage:notifications",
          "list:notifications",
          "mark:notifications",
          "access:outside-working-hours",
          "manage:meta-settings",
          "manage:campaigns",
          "view:dashboard",
          "manage:labels",
        ],
        isSystem: true,
        createdAt: new Date(),
      },
      {
        id: crypto.randomUUID(),
        workspaceId,
        name: "Supervisor",
        description: "Gerencia equipe e visualiza todos os atendimentos",
        permissions: [
          "start:session",
          "list:users",
          "list:sectors",
          "list:all-conversations",
          "list:all-sectors",
          "list:all-channels",
          "send:message",
          "assign:conversation",
          "transfer:conversation",
          "create:conversation",
          "close:conversation",
          "list:connections",
          "list:templates",
          "manage:partners",
          "view:contact-details",
          "list:flows",
          "list:notifications",
          "mark:notifications",
          "access:outside-working-hours",
          "manage:labels",
        ],
        isSystem: true,
        createdAt: new Date(),
      },
      {
        id: crypto.randomUUID(),
        workspaceId,
        name: "Atendente",
        description: "Atende conversas do seu setor",
        permissions: [
          "start:session",
          "list:conversation",
          "send:message",
          "assign:conversation",
          "transfer:conversation",
          "create:conversation",
          "close:conversation",
          "list:partners",
          "register:partners",
          "list:notifications",
          "mark:notifications",
          "list:labels",
        ],
        isSystem: true,
        createdAt: new Date(),
      },
    ];

    for (const role of systemRoles) {
      await db
        .insert(roles)
        .values(role)
        .onConflictDoNothing();
    }
  }

  async syncSystemRolesPermissions(workspaceId: string): Promise<void> {
    const db = createDatabaseConnection();

    const systemRolesPermissions: Record<string, string[]> = {
      "Administrador": [
        "start:session",
        "manage:users",
        "register:permissions",
        "manage:sectors",
        "list:all-conversations",
        "list:all-sectors",
        "list:all-channels",
        "send:message",
        "assign:conversation",
        "transfer:conversation",
        "create:conversation",
        "close:conversation",
        "delete:conversation",
        "delete:any-message",
        "manage:connections",
        "manage:templates",
        "manage:calculator-settings",
        "manage:partners",
        "view:contact-details",
        "manage:flows",
        "manage:notifications",
        "list:notifications",
        "mark:notifications",
        "access:outside-working-hours",
        "manage:meta-settings",
        "manage:campaigns",
        "view:dashboard",
        "manage:labels",
      ],
      "Supervisor": [
        "start:session",
        "list:users",
        "list:sectors",
        "list:all-conversations",
        "list:all-sectors",
        "list:all-channels",
        "send:message",
        "assign:conversation",
        "transfer:conversation",
        "create:conversation",
        "close:conversation",
        "list:connections",
        "list:templates",
        "manage:partners",
        "view:contact-details",
        "list:flows",
        "list:notifications",
        "mark:notifications",
        "access:outside-working-hours",
        "manage:labels",
      ],
      "Atendente": [
        "start:session",
        "list:conversation",
        "send:message",
        "assign:conversation",
        "transfer:conversation",
        "create:conversation",
        "close:conversation",
        "list:partners",
        "register:partners",
        "list:notifications",
        "mark:notifications",
        "list:labels",
      ],
    };

    for (const [roleName, permissions] of Object.entries(systemRolesPermissions)) {
      await db
        .update(roles)
        .set({ permissions })
        .where(
          and(
            eq(roles.workspaceId, workspaceId),
            eq(roles.name, roleName),
            eq(roles.isSystem, true)
          )
        );
    }
  }

  static instance(): RolesDatabaseRepository {
    return new RolesDatabaseRepository();
  }
}
