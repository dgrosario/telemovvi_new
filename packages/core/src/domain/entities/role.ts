import { InvalidCreation } from "../errors/invalid-creation";
import { PolicyName } from "../services/permissions";

export namespace Role {
  export interface Props {
    id: string;
    workspaceId: string;
    name: string;
    description?: string | null;
    permissions?: PolicyName[];
    blockedSectorIds?: string[];
    isSystem?: boolean;
    createdAt?: Date;
  }

  export interface Raw {
    id: string;
    workspaceId: string;
    name: string;
    description: string | null;
    permissions: PolicyName[];
    blockedSectorIds: string[];
    isSystem: boolean;
    createdAt: Date;
  }
}

export class Role {
  public readonly id: string;
  public readonly workspaceId: string;
  public name: string;
  public description: string | null;
  private _permissions: Set<PolicyName>;
  private _blockedSectorIds: Set<string>;
  public readonly isSystem: boolean;
  public readonly createdAt: Date;

  constructor(props: Role.Props) {
    this.id = props.id;
    this.workspaceId = props.workspaceId;
    this.name = props.name;
    this.description = props.description ?? null;
    this._permissions = new Set(props.permissions ?? []);
    this._blockedSectorIds = new Set(props.blockedSectorIds ?? []);
    this.isSystem = props.isSystem ?? false;
    this.createdAt = props.createdAt ?? new Date();
  }

  get permissions(): PolicyName[] {
    return Array.from(this._permissions);
  }

  get permissionsCount(): number {
    return this._permissions.size;
  }

  get blockedSectorIds(): string[] {
    return Array.from(this._blockedSectorIds);
  }

  hasPermission(permission: PolicyName): boolean {
    return this._permissions.has(permission);
  }

  addPermission(permission: PolicyName): void {
    if (this.isSystem) return;
    this._permissions.add(permission);
  }

  removePermission(permission: PolicyName): void {
    if (this.isSystem) return;
    this._permissions.delete(permission);
  }

  setPermissions(permissions: PolicyName[]): void {
    if (this.isSystem) return;
    this._permissions = new Set(permissions);
  }

  setBlockedSectorIds(sectorIds: string[]): void {
    if (this.isSystem) return;
    this._blockedSectorIds = new Set(sectorIds);
  }

  raw(): Role.Raw {
    return {
      id: this.id,
      workspaceId: this.workspaceId,
      name: this.name,
      description: this.description,
      permissions: this.permissions,
      blockedSectorIds: this.blockedSectorIds,
      isSystem: this.isSystem,
      createdAt: this.createdAt,
    };
  }

  static instance(props: Role.Props): Role {
    return new Role(props);
  }

  static create(props: Omit<Role.Props, "id" | "createdAt">): Role {
    if (!props.name) throw InvalidCreation.instance();
    if (!props.workspaceId) throw InvalidCreation.instance();

    return new Role({
      id: crypto.randomUUID(),
      workspaceId: props.workspaceId,
      name: props.name,
      description: props.description,
      permissions: props.permissions,
      blockedSectorIds: props.blockedSectorIds,
      isSystem: props.isSystem ?? false,
      createdAt: new Date(),
    });
  }
}
