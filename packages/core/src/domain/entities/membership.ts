import { InvalidCreation } from "../errors/invalid-creation";
import { PolicyName, permissions } from "../services/permissions";

export namespace Membership {
  export interface Props {
    readonly id: string;
    workspaceId: string;
    userId: string;
    permissions: PolicyName[];
  }

  export interface CreateProps {
    workspaceId: string;
    userId: string;
  }
}

export class Membership {
  public readonly id: string;
  public workspaceId: string;
  public userId: string;
  private _permissions: Set<PolicyName>;

  constructor(props: Membership.Props) {
    this.id = props.id;
    this.workspaceId = props.workspaceId;
    this.userId = props.userId;
    this.permissions = props.permissions;
  }

  set permissions(permissions: PolicyName[]) {
    this._permissions = new Set();

    if (!permissions) return;

    for (const permission of permissions) {
      this._permissions.add(permission);
    }
  }

  get permissions() {
    return Array.from(this._permissions);
  }

  addPermission(permission: PolicyName) {
    this._permissions.add(permission);
  }

  hasPermission(permission: PolicyName): boolean {
    if (this.permissions.includes(permission)) {
      return true;
    }

    for (const userPermission of this.permissions) {
      const permissionDef = permissions.get(userPermission);
      if (permissionDef && permissionDef.linkeds.includes(permission)) {
        return true;
      }
    }

    return false;
  }

  setPermissions(permissions: PolicyName[]) {
    this.permissions = permissions;
  }

  static instance(props: Membership.Props) {
    return new Membership(props);
  }

  static create(workspaceId: string, userId: string) {
    if (!workspaceId || !userId) throw InvalidCreation.instance();

    return new Membership({
      id: crypto.randomUUID().toString(),
      permissions: [],
      userId,
      workspaceId,
    });
  }
}
