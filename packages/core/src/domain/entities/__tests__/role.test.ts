import { describe, it, expect, beforeEach } from "vitest";
import { Role } from "../role";
import { InvalidCreation } from "../../errors/invalid-creation";

describe("Role Entity", () => {
  const validProps: Role.Props = {
    id: "test-role-id",
    workspaceId: "test-workspace-id",
    name: "Test Role",
    description: "A test role",
    permissions: ["list:users", "manage:users"],
    blockedSectorIds: ["sector-1", "sector-2"],
    isSystem: false,
  };

  describe("constructor", () => {
    it("should create a role with all props", () => {
      const role = new Role(validProps);

      expect(role.id).toBe(validProps.id);
      expect(role.workspaceId).toBe(validProps.workspaceId);
      expect(role.name).toBe(validProps.name);
      expect(role.description).toBe(validProps.description);
      expect(role.permissions).toEqual(validProps.permissions);
      expect(role.blockedSectorIds).toEqual(validProps.blockedSectorIds);
      expect(role.isSystem).toBe(false);
    });

    it("should create a role with default values", () => {
      const role = new Role({
        id: "test-id",
        workspaceId: "test-ws",
        name: "Test",
      });

      expect(role.description).toBeNull();
      expect(role.permissions).toEqual([]);
      expect(role.blockedSectorIds).toEqual([]);
      expect(role.isSystem).toBe(false);
      expect(role.createdAt).toBeInstanceOf(Date);
    });
  });

  describe("permissions management", () => {
    let role: Role;

    beforeEach(() => {
      role = new Role(validProps);
    });

    it("should return permissions as array", () => {
      expect(role.permissions).toEqual(["list:users", "manage:users"]);
    });

    it("should return permissions count", () => {
      expect(role.permissionsCount).toBe(2);
    });

    it("should check if role has permission", () => {
      expect(role.hasPermission("list:users")).toBe(true);
      expect(role.hasPermission("list:roles")).toBe(false);
    });

    it("should add permission to non-system role", () => {
      role.addPermission("list:roles");
      expect(role.hasPermission("list:roles")).toBe(true);
      expect(role.permissionsCount).toBe(3);
    });

    it("should not add permission to system role", () => {
      const systemRole = new Role({ ...validProps, isSystem: true });
      systemRole.addPermission("list:roles");
      expect(systemRole.hasPermission("list:roles")).toBe(false);
    });

    it("should remove permission from non-system role", () => {
      role.removePermission("list:users");
      expect(role.hasPermission("list:users")).toBe(false);
      expect(role.permissionsCount).toBe(1);
    });

    it("should not remove permission from system role", () => {
      const systemRole = new Role({ ...validProps, isSystem: true });
      systemRole.removePermission("list:users");
      expect(systemRole.hasPermission("list:users")).toBe(true);
    });

    it("should set permissions on non-system role", () => {
      role.setPermissions(["list:roles", "manage:roles"]);
      expect(role.permissions).toEqual(["list:roles", "manage:roles"]);
    });

    it("should not set permissions on system role", () => {
      const systemRole = new Role({ ...validProps, isSystem: true });
      systemRole.setPermissions(["list:roles"]);
      expect(systemRole.permissions).toEqual(validProps.permissions);
    });
  });

  describe("blockedSectorIds management", () => {
    let role: Role;

    beforeEach(() => {
      role = new Role(validProps);
    });

    it("should return blocked sector ids as array", () => {
      expect(role.blockedSectorIds).toEqual(["sector-1", "sector-2"]);
    });

    it("should set blocked sector ids on non-system role", () => {
      role.setBlockedSectorIds(["sector-3", "sector-4"]);
      expect(role.blockedSectorIds).toEqual(["sector-3", "sector-4"]);
    });

    it("should not set blocked sector ids on system role", () => {
      const systemRole = new Role({ ...validProps, isSystem: true });
      systemRole.setBlockedSectorIds(["sector-3"]);
      expect(systemRole.blockedSectorIds).toEqual(validProps.blockedSectorIds);
    });

    it("should allow setting empty blocked sector ids", () => {
      role.setBlockedSectorIds([]);
      expect(role.blockedSectorIds).toEqual([]);
    });
  });

  describe("raw()", () => {
    it("should return raw representation", () => {
      const role = new Role(validProps);
      const raw = role.raw();

      expect(raw).toEqual({
        id: validProps.id,
        workspaceId: validProps.workspaceId,
        name: validProps.name,
        description: validProps.description,
        permissions: validProps.permissions,
        blockedSectorIds: validProps.blockedSectorIds,
        isSystem: false,
        createdAt: role.createdAt,
      });
    });
  });

  describe("static instance()", () => {
    it("should create role instance from props", () => {
      const role = Role.instance(validProps);
      expect(role).toBeInstanceOf(Role);
      expect(role.id).toBe(validProps.id);
    });
  });

  describe("static create()", () => {
    it("should create role with generated id and timestamp", () => {
      const role = Role.create({
        workspaceId: "test-ws",
        name: "New Role",
        description: "Description",
        permissions: ["list:users"],
        blockedSectorIds: ["sector-1"],
      });

      expect(role.id).toBeDefined();
      expect(role.id.length).toBe(36);
      expect(role.workspaceId).toBe("test-ws");
      expect(role.name).toBe("New Role");
      expect(role.createdAt).toBeInstanceOf(Date);
    });

    it("should throw InvalidCreation when name is empty", () => {
      expect(() =>
        Role.create({
          workspaceId: "test-ws",
          name: "",
        })
      ).toThrow(InvalidCreation);
    });

    it("should throw InvalidCreation when workspaceId is empty", () => {
      expect(() =>
        Role.create({
          workspaceId: "",
          name: "Test",
        })
      ).toThrow(InvalidCreation);
    });

    it("should create role with isSystem flag", () => {
      const role = Role.create({
        workspaceId: "test-ws",
        name: "System Role",
        isSystem: true,
      });

      expect(role.isSystem).toBe(true);
    });

    it("should create role with blocked sector ids", () => {
      const role = Role.create({
        workspaceId: "test-ws",
        name: "Role with blocked sectors",
        blockedSectorIds: ["sector-a", "sector-b"],
      });

      expect(role.blockedSectorIds).toEqual(["sector-a", "sector-b"]);
    });
  });
});
