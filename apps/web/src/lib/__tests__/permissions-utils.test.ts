import { describe, it, expect } from "vitest";
import {
  addPermissionWithLinked,
  getEffectivePermissions,
  getToggleEffectivePermissionImpact,
  toggleEffectivePermissionInSet,
  togglePermissionInSet,
  toggleItemInSet,
} from "../permissions-utils";
import type { PolicyName } from "@omnichannel/core/domain/services/permissions";

describe("permissions-utils", () => {
  describe("addPermissionWithLinked", () => {
    it("should add a permission without linked permissions", () => {
      const targetSet = new Set<PolicyName>();
      addPermissionWithLinked("list:users", targetSet);

      expect(targetSet.has("list:users")).toBe(true);
      expect(targetSet.size).toBe(1);
    });

    it("should add a permission with linked permissions", () => {
      const targetSet = new Set<PolicyName>();
      addPermissionWithLinked("manage:users", targetSet);

      expect(targetSet.has("manage:users")).toBe(true);
      expect(targetSet.has("list:users")).toBe(true);
      expect(targetSet.has("register:users")).toBe(true);
      expect(targetSet.has("remove:users")).toBe(true);
      expect(targetSet.has("register:permissions")).toBe(true);
      expect(targetSet.has("manage:roles")).toBe(true);
    });

    it("should handle nested linked permissions", () => {
      const targetSet = new Set<PolicyName>();
      addPermissionWithLinked("manage:roles", targetSet);

      expect(targetSet.has("manage:roles")).toBe(true);
      expect(targetSet.has("list:roles")).toBe(true);
      expect(targetSet.has("register:roles")).toBe(true);
      expect(targetSet.has("remove:roles")).toBe(true);
    });

    it("should not add duplicate permissions", () => {
      const targetSet = new Set<PolicyName>(["list:users"]);
      addPermissionWithLinked("list:users", targetSet);

      expect(targetSet.size).toBe(1);
    });

    it("should prevent infinite loops with circular references", () => {
      const targetSet = new Set<PolicyName>();
      const visited = new Set<PolicyName>();

      addPermissionWithLinked("manage:users", targetSet, visited);

      expect(visited.has("manage:users")).toBe(true);
      expect(visited.has("list:users")).toBe(true);
    });

    it("should handle non-existent permission gracefully", () => {
      const targetSet = new Set<PolicyName>();

      expect(() => {
        addPermissionWithLinked(
          "non-existent-permission" as PolicyName,
          targetSet
        );
      }).not.toThrow();

      expect(targetSet.size).toBe(0);
    });
  });

  describe("getEffectivePermissions", () => {
    it("should expand direct permissions with linked permissions", () => {
      const direct = new Set<PolicyName>(["manage:users"]);
      const effective = getEffectivePermissions(direct);

      expect(effective.has("manage:users")).toBe(true);
      expect(effective.has("list:users")).toBe(true);
      expect(effective.has("register:users")).toBe(true);
      expect(effective.has("register:permissions")).toBe(true);
    });

    it("should return an empty set for empty input", () => {
      const effective = getEffectivePermissions([]);
      expect(effective.size).toBe(0);
    });
  });

  describe("togglePermissionInSet", () => {
    it("should add permission when not present", () => {
      const currentSet = new Set<PolicyName>();
      const newSet = togglePermissionInSet("list:users", currentSet);

      expect(newSet.has("list:users")).toBe(true);
      expect(currentSet.has("list:users")).toBe(false);
    });

    it("should remove permission when present", () => {
      const currentSet = new Set<PolicyName>(["list:users", "manage:users"]);
      const newSet = togglePermissionInSet("list:users", currentSet);

      expect(newSet.has("list:users")).toBe(false);
      expect(newSet.has("manage:users")).toBe(true);
    });

    it("should not mutate original set", () => {
      const currentSet = new Set<PolicyName>(["list:users"]);
      togglePermissionInSet("manage:users", currentSet);

      expect(currentSet.size).toBe(1);
      expect(currentSet.has("list:users")).toBe(true);
      expect(currentSet.has("manage:users")).toBe(false);
    });

    it("should only toggle the specific permission", () => {
      const currentSet = new Set<PolicyName>(["manage:users"]);
      const newSet = togglePermissionInSet("manage:users", currentSet);

      expect(newSet.has("manage:users")).toBe(false);
    });
  });

  describe("toggleEffectivePermissionInSet", () => {
    it("should add permission directly when it is not effectively granted", () => {
      const direct = new Set<PolicyName>();
      const next = toggleEffectivePermissionInSet("list:users", direct);

      expect(next.has("list:users")).toBe(true);
    });

    it("should remove parent permission when trying to disable an inherited permission", () => {
      const direct = new Set<PolicyName>(["manage:conversations"]);
      const next = toggleEffectivePermissionInSet("list:conversation", direct);

      // manage:conversations grants list:conversation, so it must be removed
      expect(next.has("manage:conversations")).toBe(false);
      expect(getEffectivePermissions(next).has("list:conversation")).toBe(false);
    });

    it("should remove both direct and parent grants when needed", () => {
      const direct = new Set<PolicyName>(["manage:users", "list:users"]);
      const next = toggleEffectivePermissionInSet("list:users", direct);

      expect(next.has("list:users")).toBe(false);
      expect(next.has("manage:users")).toBe(false);
      expect(getEffectivePermissions(next).has("list:users")).toBe(false);
    });
  });

  describe("getToggleEffectivePermissionImpact", () => {
    it("should detect direct additions when enabling a permission", () => {
      const direct = new Set<PolicyName>();
      const impact = getToggleEffectivePermissionImpact("list:users", direct);

      expect(impact.addedDirectPermissions).toEqual(["list:users"]);
      expect(impact.removedDirectPermissions).toEqual([]);
      expect(impact.nextDirectPermissions.has("list:users")).toBe(true);
    });

    it("should detect parent removals when disabling an inherited permission", () => {
      const direct = new Set<PolicyName>(["manage:conversations"]);
      const impact = getToggleEffectivePermissionImpact("list:conversation", direct);

      expect(impact.removedDirectPermissions).toEqual(["manage:conversations"]);
      expect(impact.nextDirectPermissions.has("manage:conversations")).toBe(false);
      expect(impact.nextEffectivePermissions.has("list:conversation")).toBe(false);
    });

    it("should include both direct and parent removals when needed", () => {
      const direct = new Set<PolicyName>(["manage:users", "list:users"]);
      const impact = getToggleEffectivePermissionImpact("list:users", direct);

      expect(impact.removedDirectPermissions).toContain("list:users");
      expect(impact.removedDirectPermissions).toContain("manage:users");
      expect(impact.nextEffectivePermissions.has("list:users")).toBe(false);
    });
  });

  describe("toggleItemInSet", () => {
    it("should add item when not present", () => {
      const currentSet = new Set<string>();
      const newSet = toggleItemInSet("item1", currentSet);

      expect(newSet.has("item1")).toBe(true);
    });

    it("should remove item when present", () => {
      const currentSet = new Set(["item1", "item2"]);
      const newSet = toggleItemInSet("item1", currentSet);

      expect(newSet.has("item1")).toBe(false);
      expect(newSet.has("item2")).toBe(true);
    });

    it("should not mutate original set", () => {
      const currentSet = new Set(["item1"]);
      toggleItemInSet("item2", currentSet);

      expect(currentSet.size).toBe(1);
      expect(currentSet.has("item1")).toBe(true);
      expect(currentSet.has("item2")).toBe(false);
    });

    it("should work with numbers", () => {
      const currentSet = new Set([1, 2, 3]);
      const newSet = toggleItemInSet(2, currentSet);

      expect(newSet.has(2)).toBe(false);
      expect(newSet.has(1)).toBe(true);
      expect(newSet.has(3)).toBe(true);
    });

    it("should work with objects by reference", () => {
      const obj1 = { id: 1 };
      const obj2 = { id: 2 };
      const currentSet = new Set([obj1]);

      const newSet = toggleItemInSet(obj1, currentSet);
      expect(newSet.has(obj1)).toBe(false);

      const newSet2 = toggleItemInSet(obj2, currentSet);
      expect(newSet2.has(obj2)).toBe(true);
    });
  });
});
