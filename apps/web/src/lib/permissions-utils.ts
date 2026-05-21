import {
  permissions,
  type PolicyName,
} from "@omnichannel/core/domain/services/permissions";

export type ToggleEffectivePermissionImpact = {
  nextDirectPermissions: Set<PolicyName>;
  addedDirectPermissions: PolicyName[];
  removedDirectPermissions: PolicyName[];
  prevEffectivePermissions: Set<PolicyName>;
  nextEffectivePermissions: Set<PolicyName>;
  addedEffectivePermissions: PolicyName[];
  removedEffectivePermissions: PolicyName[];
};

export function getEffectivePermissions(
  directPermissions: Iterable<PolicyName>
): Set<PolicyName> {
  const effective = new Set<PolicyName>();

  for (const permissionName of directPermissions) {
    addPermissionWithLinked(permissionName, effective);
  }

  return effective;
}

export function addPermissionWithLinked(
  permissionName: PolicyName,
  targetSet: Set<PolicyName>,
  visited: Set<PolicyName> = new Set()
): void {
  if (visited.has(permissionName)) return;
  visited.add(permissionName);

  const permission = permissions.get(permissionName);
  if (!permission) return;

  targetSet.add(permissionName);

  for (const linkedPermission of permission.linkeds) {
    if (permissions.has(linkedPermission as PolicyName)) {
      addPermissionWithLinked(
        linkedPermission as PolicyName,
        targetSet,
        visited
      );
    }
  }
}

export function togglePermissionInSet(
  permName: PolicyName,
  currentSet: Set<PolicyName>
): Set<PolicyName> {
  const newSet = new Set(currentSet);

  if (newSet.has(permName)) {
    newSet.delete(permName);
  } else {
    newSet.add(permName);
  }

  return newSet;
}

export function toggleEffectivePermissionInSet(
  permName: PolicyName,
  currentDirectSet: Set<PolicyName>
): Set<PolicyName> {
  const effective = getEffectivePermissions(currentDirectSet);
  const newDirectSet = new Set(currentDirectSet);

  if (!effective.has(permName)) {
    newDirectSet.add(permName);
    return newDirectSet;
  }

  // If the permission is directly present, remove it first.
  newDirectSet.delete(permName);

  // If it's still granted via linked permissions, remove the parents that grant it.
  for (const directPermission of Array.from(newDirectSet)) {
    const directEffective = new Set<PolicyName>();
    addPermissionWithLinked(directPermission, directEffective);

    if (directEffective.has(permName)) {
      newDirectSet.delete(directPermission);
    }
  }

  return newDirectSet;
}

export function getToggleEffectivePermissionImpact(
  permName: PolicyName,
  currentDirectSet: Set<PolicyName>
): ToggleEffectivePermissionImpact {
  const prevDirect = new Set(currentDirectSet);
  const prevEffectivePermissions = getEffectivePermissions(prevDirect);

  const nextDirectPermissions = toggleEffectivePermissionInSet(
    permName,
    currentDirectSet
  );
  const nextEffectivePermissions = getEffectivePermissions(nextDirectPermissions);

  const removedDirectPermissions = Array.from(prevDirect).filter(
    (p) => !nextDirectPermissions.has(p)
  );
  const addedDirectPermissions = Array.from(nextDirectPermissions).filter(
    (p) => !prevDirect.has(p)
  );

  const removedEffectivePermissions = Array.from(prevEffectivePermissions).filter(
    (p) => !nextEffectivePermissions.has(p)
  );
  const addedEffectivePermissions = Array.from(nextEffectivePermissions).filter(
    (p) => !prevEffectivePermissions.has(p)
  );

  return {
    nextDirectPermissions,
    addedDirectPermissions,
    removedDirectPermissions,
    prevEffectivePermissions,
    nextEffectivePermissions,
    addedEffectivePermissions,
    removedEffectivePermissions,
  };
}

export function toggleItemInSet<T>(item: T, currentSet: Set<T>): Set<T> {
  const newSet = new Set(currentSet);
  if (newSet.has(item)) {
    newSet.delete(item);
  } else {
    newSet.add(item);
  }
  return newSet;
}
