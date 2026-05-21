import { and, eq, sql } from "drizzle-orm";
import { createDatabaseConnection } from "../database";
import {
  memberships,
  users,
  usersInSector,
  sectors,
} from "../database/schemas";
import { User } from "../../domain/entities/user";
import { PolicyName } from "../../domain/services/authorization-service";
import { Sector } from "../../domain/entities/sector";

export type UserListed = {
  id: string;
  name: string;
  email: string;
  sectors: Array<{
    id: string;
    name: string;
  }>;
  permissions: PolicyName[];
  isDeletable: boolean;
  isActive: boolean;
  displayName: string | null;
  phone: string | null;
  birthDate: string | null;
  address: string | null;
};

export class UsersDatabaseRepository {
  async retrieveUserByEmail(email: string): Promise<User | null> {
    const db = createDatabaseConnection();

    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        thumbnail: users.thumbnail,
        isDeletable: users.isDeletable,
        signatureEnabled: users.signatureEnabled,
        isActive: users.isActive,
        displayName: users.displayName,
        phone: users.phone,
        birthDate: users.birthDate,
        address: users.address,
      })
      .from(users)
      .where(eq(users.email, email));

    if (!user) return null;

    return User.instance({
      id: user.id,
      name: user.name,
      thumbnail: user.thumbnail,
      email: user.email,
      sectors: [],
      signatureEnabled: user.signatureEnabled,
      isDeletable: user.isDeletable,
      isActive: user.isActive,
      displayName: user.displayName,
      phone: user.phone,
      birthDate: user.birthDate,
      address: user.address,
    });
  }

  async retrieve(id: string): Promise<User | null> {
    if (!id) return null;

    const db = createDatabaseConnection();

    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        thumbnail: users.thumbnail,
        isDeletable: users.isDeletable,
        signatureEnabled: users.signatureEnabled,
        isActive: users.isActive,
        displayName: users.displayName,
        phone: users.phone,
        birthDate: users.birthDate,
        address: users.address,
      })
      .from(users)
      .where(eq(users.id, id));

    if (!user) return null;

    return User.instance({
      id: user.id,
      name: user.name,
      thumbnail: user.thumbnail,
      email: user.email,
      sectors: [],
      signatureEnabled: user.signatureEnabled,
      isDeletable: user.isDeletable,
      isActive: user.isActive,
      displayName: user.displayName,
      phone: user.phone,
      birthDate: user.birthDate,
      address: user.address,
    });
  }

  async retrieveFromList(id: string, workspaceId: string) {
    if (!id || !workspaceId) return null;

    const db = createDatabaseConnection();

    const response = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        permissions: memberships.permissions,
        isDeletable: users.isDeletable,
        isActive: users.isActive,
        displayName: users.displayName,
        phone: users.phone,
        birthDate: users.birthDate,
        address: users.address,
        sectorId: sectors.id,
        sectorName: sectors.name,
      })
      .from(memberships)
      .leftJoin(users, eq(users.id, memberships.userId))
      .leftJoin(usersInSector, eq(usersInSector.userId, users.id))
      .leftJoin(sectors, eq(sectors.id, usersInSector.sectorId))
      .where(and(eq(users.id, id), eq(memberships.workspaceId, workspaceId)));

    const firstRow = response[0];
    if (!firstRow) return null;
    const userSectors: Array<{ id: string; name: string }> = [];

    for (const row of response) {
      if (row.sectorId && row.sectorName) {
        const sectorExists = userSectors.some((s) => s.id === row.sectorId);
        if (!sectorExists) {
          userSectors.push({ id: row.sectorId, name: row.sectorName });
        }
      }
    }

    return {
      id: firstRow.id,
      name: firstRow.name,
      email: firstRow.email,
      permissions: firstRow.permissions,
      isDeletable: firstRow.isDeletable,
      isActive: firstRow.isActive,
      displayName: firstRow.displayName,
      phone: firstRow.phone,
      birthDate: firstRow.birthDate,
      address: firstRow.address,
      sectors: userSectors,
    } as UserListed;
  }

  async list(workspaceId: string) {
    if (!workspaceId) return [];

    const db = createDatabaseConnection();

    const response = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        permissions: memberships.permissions,
        isDeletable: users.isDeletable,
        isActive: users.isActive,
        displayName: users.displayName,
        phone: users.phone,
        birthDate: users.birthDate,
        address: users.address,
        sectorId: sectors.id,
        sectorName: sectors.name,
      })
      .from(memberships)
      .leftJoin(users, eq(users.id, memberships.userId))
      .leftJoin(usersInSector, eq(usersInSector.userId, users.id))
      .leftJoin(sectors, eq(sectors.id, usersInSector.sectorId))
      .where(eq(memberships.workspaceId, workspaceId));

    const usersMap = new Map<string, UserListed>();

    for (const row of response) {
      if (!row.id) continue;

      if (!usersMap.has(row.id)) {
        usersMap.set(row.id, {
          id: row.id,
          name: row.name ?? "",
          email: row.email ?? "",
          permissions: row.permissions as PolicyName[],
          isDeletable: row.isDeletable ?? true,
          isActive: row.isActive ?? true,
          displayName: row.displayName,
          phone: row.phone,
          birthDate: row.birthDate,
          address: row.address,
          sectors: [],
        });
      }

      const user = usersMap.get(row.id)!;
      if (row.sectorId && row.sectorName) {
        const sectorExists = user.sectors.some((s) => s.id === row.sectorId);
        if (!sectorExists) {
          user.sectors.push({ id: row.sectorId, name: row.sectorName });
        }
      }
    }

    return Array.from(usersMap.values());
  }

  async listUsersFromUserSectors(
    userId: string,
    workspaceId: string
  ): Promise<UserListed[]> {
    if (!userId || !workspaceId) return [];

    const db = createDatabaseConnection();

    const userSectorIds = await db
      .select({ sectorId: usersInSector.sectorId })
      .from(usersInSector)
      .where(eq(usersInSector.userId, userId));

    if (userSectorIds.length === 0) return [];

    const sectorIds = userSectorIds.map((s) => s.sectorId);

    const response = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        permissions: memberships.permissions,
        isDeletable: users.isDeletable,
        isActive: users.isActive,
        displayName: users.displayName,
        phone: users.phone,
        birthDate: users.birthDate,
        address: users.address,
        sectorId: sectors.id,
        sectorName: sectors.name,
      })
      .from(memberships)
      .leftJoin(users, eq(users.id, memberships.userId))
      .leftJoin(usersInSector, eq(usersInSector.userId, users.id))
      .leftJoin(sectors, eq(sectors.id, usersInSector.sectorId))
      .where(
        and(
          eq(memberships.workspaceId, workspaceId),
          sql`${usersInSector.sectorId} IN (${sql.join(
            sectorIds.map((id) => sql`${id}`),
            sql`, `
          )})`
        )
      );

    const usersMap = new Map<string, UserListed>();

    for (const row of response) {
      if (!row.id) continue;

      if (!usersMap.has(row.id)) {
        usersMap.set(row.id, {
          id: row.id,
          name: row.name ?? "",
          email: row.email ?? "",
          permissions: row.permissions as PolicyName[],
          isDeletable: row.isDeletable ?? true,
          isActive: row.isActive ?? true,
          displayName: row.displayName,
          phone: row.phone,
          birthDate: row.birthDate,
          address: row.address,
          sectors: [],
        });
      }

      const user = usersMap.get(row.id)!;
      if (row.sectorId && row.sectorName) {
        const sectorExists = user.sectors.some((s) => s.id === row.sectorId);
        if (!sectorExists) {
          user.sectors.push({ id: row.sectorId, name: row.sectorName });
        }
      }
    }

    return Array.from(usersMap.values());
  }

  async listUsersBySectorId(
    sectorId: string,
    workspaceId: string
  ): Promise<UserListed[]> {
    if (!sectorId || !workspaceId) return [];

    const db = createDatabaseConnection();

    const response = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        permissions: memberships.permissions,
        isDeletable: users.isDeletable,
        isActive: users.isActive,
        displayName: users.displayName,
        phone: users.phone,
        birthDate: users.birthDate,
        address: users.address,
        sectorId: sectors.id,
        sectorName: sectors.name,
      })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .innerJoin(usersInSector, eq(usersInSector.userId, users.id))
      .innerJoin(sectors, eq(sectors.id, usersInSector.sectorId))
      .where(
        and(
          eq(memberships.workspaceId, workspaceId),
          eq(usersInSector.sectorId, sectorId)
        )
      );

    const usersMap = new Map<string, UserListed>();

    for (const row of response) {
      if (!row.id) continue;

      if (!usersMap.has(row.id)) {
        usersMap.set(row.id, {
          id: row.id,
          name: row.name ?? "",
          email: row.email ?? "",
          permissions: row.permissions as PolicyName[],
          isDeletable: row.isDeletable ?? true,
          isActive: row.isActive ?? true,
          displayName: row.displayName,
          phone: row.phone,
          birthDate: row.birthDate,
          address: row.address,
          sectors: [],
        });
      }

      const user = usersMap.get(row.id)!;
      if (row.sectorId && row.sectorName) {
        const sectorExists = user.sectors.some((s) => s.id === row.sectorId);
        if (!sectorExists) {
          user.sectors.push({ id: row.sectorId, name: row.sectorName });
        }
      }
    }

    return Array.from(usersMap.values());
  }

  async upsert(user: User) {
    const db = createDatabaseConnection();

    await db
      .insert(users)
      .values({
        id: user.id,
        email: user.email,
        name: user.name,
        signatureEnabled: user.signatureEnabled,
        displayName: user.displayName,
        phone: user.phone,
        birthDate: user.birthDate,
        address: user.address,
      })
      .onConflictDoUpdate({
        set: {
          name: user.name,
          signatureEnabled: user.signatureEnabled,
          displayName: user.displayName,
          phone: user.phone,
          birthDate: user.birthDate,
          address: user.address,
        },
        target: users.email,
      });
  }

  async retrievePassword(userId: string) {
    const db = createDatabaseConnection();

    const [user] = await db
      .select({
        password: users.password,
      })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) return null;

    return user.password;
  }

  async remove(userId: string) {
    const db = createDatabaseConnection();
    await db.transaction(async (tx) => {
      await tx.delete(memberships).where(eq(memberships.userId, userId));
      await tx.delete(users).where(eq(users.id, userId));
    });
  }

  async setPassword(userId: string, password: string) {
    const db = createDatabaseConnection();
    await db
      .update(users)
      .set({
        password,
      })
      .where(eq(users.id, userId));
  }

  async retrieveOmnichannelUser(workspaceId: string) {
    const db = createDatabaseConnection();

    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        thumbnail: users.thumbnail,
        isDeletable: users.isDeletable,
        signatureEnabled: users.signatureEnabled,
        isActive: users.isActive,
        displayName: users.displayName,
        phone: users.phone,
        birthDate: users.birthDate,
        address: users.address,
      })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(
        and(
          eq(users.email, "omnichannel@omnichannel.com.br"),
          eq(memberships.workspaceId, workspaceId)
        )
      );

    if (!user) return null;

    return User.instance({
      id: user.id,
      name: user.name,
      thumbnail: user.thumbnail,
      email: user.email,
      sectors: [],
      signatureEnabled: user.signatureEnabled,
      isDeletable: user.isDeletable,
      isActive: user.isActive,
      displayName: user.displayName,
      phone: user.phone,
      birthDate: user.birthDate,
      address: user.address,
    });
  }

  async updateSignaturePreference(userId: string, enabled: boolean) {
    const db = createDatabaseConnection();
    await db
      .update(users)
      .set({ signatureEnabled: enabled })
      .where(eq(users.id, userId));
  }

  async updateActiveStatus(userId: string, isActive: boolean) {
    const db = createDatabaseConnection();
    await db
      .update(users)
      .set({ isActive })
      .where(eq(users.id, userId));
  }

  async updateUserDetails(
    userId: string,
    details: {
      name?: string;
      email?: string;
      displayName?: string | null;
      phone?: string | null;
      birthDate?: string | null;
      address?: string | null;
    }
  ) {
    const db = createDatabaseConnection();
    await db
      .update(users)
      .set({
        ...(details.name !== undefined && { name: details.name }),
        ...(details.email !== undefined && { email: details.email }),
        ...(details.displayName !== undefined && {
          displayName: details.displayName,
        }),
        ...(details.phone !== undefined && { phone: details.phone }),
        ...(details.birthDate !== undefined && { birthDate: details.birthDate }),
        ...(details.address !== undefined && { address: details.address }),
      })
      .where(eq(users.id, userId));
  }

  static instance() {
    return new UsersDatabaseRepository();
  }
}
