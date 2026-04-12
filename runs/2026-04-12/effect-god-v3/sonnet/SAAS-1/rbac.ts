import { Effect, Data } from "effect";

// ─── Internal Tagged Errors ───────────────────────────────────────────────────

class RBACError extends Data.TaggedError("RBACError")<{ reason: string }> {}

// ─── Interfaces (re-exported for consumers) ───────────────────────────────────

export interface Role {
  name: string;
  permissions: string[];
  inherits?: string[];
}

export interface User {
  id: string;
  roles: string[];
}

export interface Resource {
  name: string;
  requiredPermissions: string[];
}

export interface RBACSystem {
  addRole(role: Role): void;
  addUser(user: User): void;
  addResource(resource: Resource): void;
  checkAccess(userId: string, resourceName: string): boolean;
  getUserPermissions(userId: string): string[];
}

// ─── Internal Logic (Effect-based) ───────────────────────────────────────────

/**
 * Collects all effective permissions for a role by traversing the inheritance
 * graph. Uses a `visited` set to prevent infinite loops on circular hierarchies.
 */
function collectRolePermissions(
  roleName: string,
  roles: Map<string, Role>,
  visited: Set<string>
): Set<string> {
  if (visited.has(roleName)) {
    // Cycle detected — stop traversal for this branch
    return new Set<string>();
  }
  visited.add(roleName);

  const role = roles.get(roleName);
  if (!role) {
    return new Set<string>();
  }

  // Start with this role's own permissions (empty array = no permissions, NOT wildcard)
  const perms = new Set<string>(role.permissions);

  // Recursively collect from inherited roles
  if (role.inherits && role.inherits.length > 0) {
    for (const parentName of role.inherits) {
      // Each traversal branch gets its own copy of visited to allow diamond inheritance
      const parentPerms = collectRolePermissions(
        parentName,
        roles,
        new Set(visited)
      );
      for (const p of parentPerms) {
        perms.add(p);
      }
    }
  }

  return perms;
}

const getUserPermissionsEffect = (
  userId: string,
  users: Map<string, User>,
  roles: Map<string, Role>
): Effect.Effect<string[], RBACError> =>
  Effect.gen(function* () {
    const user = users.get(userId);
    if (!user) {
      yield* Effect.fail(new RBACError({ reason: `User not found: ${userId}` }));
    }
    // TypeScript narrowing after fail
    const resolvedUser = user!;

    const allPerms = new Set<string>();

    for (const roleName of resolvedUser.roles) {
      const visited = new Set<string>();
      const rolePerms = collectRolePermissions(roleName, roles, visited);
      for (const p of rolePerms) {
        allPerms.add(p);
      }
    }

    return Array.from(allPerms).sort();
  });

const checkAccessEffect = (
  userId: string,
  resourceName: string,
  users: Map<string, User>,
  roles: Map<string, Role>,
  resources: Map<string, Resource>
): Effect.Effect<boolean, RBACError> =>
  Effect.gen(function* () {
    const resource = resources.get(resourceName);
    if (!resource) {
      yield* Effect.fail(
        new RBACError({ reason: `Resource not found: ${resourceName}` })
      );
    }
    const resolvedResource = resource!;

    // If the resource has no required permissions, everyone can access it
    if (resolvedResource.requiredPermissions.length === 0) {
      return true;
    }

    const userPerms = yield* getUserPermissionsEffect(userId, users, roles);
    const permSet = new Set(userPerms);

    // AND logic: ALL required permissions must be present
    for (const req of resolvedResource.requiredPermissions) {
      if (!permSet.has(req)) {
        return false;
      }
    }

    return true;
  });

// ─── Public Factory ───────────────────────────────────────────────────────────

export function createRBAC(): RBACSystem {
  const roles = new Map<string, Role>();
  const users = new Map<string, User>();
  const resources = new Map<string, Resource>();

  return {
    addRole(role: Role): void {
      if (!role || typeof role.name !== "string") {
        throw new Error("Role must have a valid name");
      }
      roles.set(role.name, {
        name: role.name,
        permissions: Array.isArray(role.permissions) ? [...role.permissions] : [],
        inherits: Array.isArray(role.inherits) ? [...role.inherits] : undefined,
      });
    },

    addUser(user: User): void {
      if (!user || typeof user.id !== "string") {
        throw new Error("User must have a valid id");
      }
      users.set(user.id, {
        id: user.id,
        roles: Array.isArray(user.roles) ? [...user.roles] : [],
      });
    },

    addResource(resource: Resource): void {
      if (!resource || typeof resource.name !== "string") {
        throw new Error("Resource must have a valid name");
      }
      resources.set(resource.name, {
        name: resource.name,
        requiredPermissions: Array.isArray(resource.requiredPermissions)
          ? [...resource.requiredPermissions]
          : [],
      });
    },

    checkAccess(userId: string, resourceName: string): boolean {
      const { Exit, Cause } = require("effect");
      const exit = Effect.runSyncExit(
        checkAccessEffect(userId, resourceName, users, roles, resources)
      );
      if (Exit.isFailure(exit)) {
        // Unknown user or resource → no access
        return false;
      }
      return exit.value;
    },

    getUserPermissions(userId: string): string[] {
      const { Exit } = require("effect");
      const exit = Effect.runSyncExit(
        getUserPermissionsEffect(userId, users, roles)
      );
      if (Exit.isFailure(exit)) {
        return [];
      }
      return exit.value;
    },
  };
}