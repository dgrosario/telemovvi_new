import { useMemo } from "react";
import {
  getPermissionsByCategory,
  type PermissionCategory,
  type PolicyName,
} from "@omnichannel/core/domain/services/permissions";

export function usePermissionCounts(
  categories: PermissionCategory[],
  selectedPermissions: Set<PolicyName>
): Record<PermissionCategory, { selected: number; total: number }> {
  return useMemo(() => {
    const counts = {} as Record<
      PermissionCategory,
      { selected: number; total: number }
    >;
    for (const category of categories) {
      const categoryPerms = getPermissionsByCategory(category);
      counts[category] = {
        total: categoryPerms.length,
        selected: categoryPerms.filter((p) => selectedPermissions.has(p))
          .length,
      };
    }
    return counts;
  }, [categories, selectedPermissions]);
}
