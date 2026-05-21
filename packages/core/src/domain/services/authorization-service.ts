import { Membership } from "../entities/membership";
import { User } from "../entities/user";
import { PolicyName } from "./permissions";

export type { PolicyName };

export interface Policy<TResource = any, TName extends string = string> {
  name: TName;
  description: string;
  can(user: User, resource: TResource, context?: any): boolean;
}

export class AuthorizationService {
  can(actions: PolicyName | PolicyName[], user: User, membership: Membership) {
    if (typeof actions !== "object") {
      return membership.hasPermission(actions);
    }

    if (!actions.length) {
      return true;
    }

    return actions
      .map((action) => membership.hasPermission(action))
      .some((allow) => allow);
  }

  static instance() {
    return new AuthorizationService();
  }
}
