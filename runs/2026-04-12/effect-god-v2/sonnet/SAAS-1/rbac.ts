import { Effect, Data } from "effect";

// ── Domain errors ────────────────────────────────────────────────────────────

class RoleNotFound extends Data.TaggedError("RoleNotFound")<{ name: string }> {}
class UserNotFound extends Data.TaggedError("UserNotFound")<{ id: string }> {}
class ResourceNotFound extends Data.TaggedError("ResourceNotFound")<{ name: string }> {}

// ── Public interfaces ─────────────────────────────────────────────────────────

interface Role {
  name: string;
  permissions: string[];
  inherits?: string[];
}

interface User {
  id: string;
  roles: string[];
}

interface Resource {
  name: string;
  requiredPermissions: string[];
}

interface RBACSystem {
  addRole(role: Role): void;
  addUser(user: User): void;
  addResource(resource: Resource): void;
  checkAccess(userId: string, resourceName: string): boolean;
  getUserPermissions(userId: string): string[];
}

// ── Internal Effect logic ─────────────────────────────────────────────────────

const collectRolePermissions = (
  roleName: string,
  roles: Map<string, Role>,
  visited: Set<string>
): Effect.Effect<Set<string>, RoleNotFound> =>
  Effect.gen(function* () {
    // Cycle detection: if already visited, return empty to break the cycle
    if (visited.has(roleName)) {
      return new Set<string>();
    }

    const role = roles.get(roleName);
    if (!role) {
      yield* Effect.fail(new RoleNotFound({ name: roleName }));
      // unreachable but satisfies type
      return new Set<string>();
    }

    // Mark as visited before recursing
    visited.add(roleName);

    const perms = new Set<string>(role.permissions);

    // Recurse into inherited roles
    if (role.inherits && role.inherits.length > 0) {
      for (const parentName of role.inherits) {
        // Skip unknown inherited roles gracefully (non-fatal)
        if (!roles.has(parentName)) continue;
        const inherited = yield* collectRolePermissions(parentName, roles, visited);
        for (const p of inherited) {
          perms.add(p);
        }
      }
    }

    return perms;
  });

const getUserPermissionsEffect = (
  userId: string,
  users: Map<string, User>,
  roles: Map<string, Role>
): Effect.Effect<string[], UserNotFound> =>
  Effect.gen(function* () {
    const user = users.get(userId);
    if (!user) {
      yield* Effect.fail(new UserNotFound({ id: userId }));
      return [];
    }

    const allPerms = new Set<string>();

    for (const roleName of user.roles) {
      if (!roles.has(roleName)) continue;
      const visited = new Set<string>();
      // collectRolePermissions can only fail with RoleNotFound, but we guard
      // against missing roles above; catch any unexpected failures gracefully
      const rolePerms = yield* collectRolePermissions(roleName, roles, visited).pipe(
        Effect.catchAll(() => Effect.succeed(new Set<string>()))
      );
      for (const p of rolePerms) {
        allPerms.add(p);
      }
    }

    return Array.from(allPerms);
  });

const checkAccessEffect = (
  userId: string,
  resourceName: string,
  users: Map<string, User>,
  roles: Map<string, Role>,
  resources: Map<string, Resource>
): Effect.Effect<boolean, UserNotFound | ResourceNotFound> =>
  Effect.gen(function* () {
    const user = users.get(userId);
    if (!user) {
      yield* Effect.fail(new UserNotFound({ id: userId }));
      return false;
    }

    const resource = resources.get(resourceName);
    if (!resource) {
      yield* Effect.fail(new ResourceNotFound({ name: resourceName }));
      return false;
    }

    // A user with no roles has no permissions → no access
    if (user.roles.length === 0) return false;

    // If resource requires no permissions, anyone can access
    if (resource.requiredPermissions.length === 0) return true;

    const userPerms = yield* getUserPermissionsEffect(userId, users, roles).pipe(
      Effect.catchAll(() => Effect.succeed([] as string[]))
    );

    const permSet = new Set(userPerms);

    // ALL required permissions must be present (AND logic)
    return resource.requiredPermissions.every((p) => permSet.has(p));
  });

// ── Factory ───────────────────────────────────────────────────────────────────

export function createRBAC(): RBACSystem {
  const roles = new Map<string, Role>();
  const users = new Map<string, User>();
  const resources = new Map<string, Resource>();

  return {
    addRole(role: Role): void {
      roles.set(role.name, role);
    },

    addUser(user: User): void {
      users.set(user.id, user);
    },

    addResource(resource: Resource): void {
      resources.set(resource.name, resource);
    },

    getUserPermissions(userId: string): string[] {
      const exit = Effect.runSyncExit(
        getUserPermissionsEffect(userId, users, roles)
      );
      if (exit._tag === "Failure") {
        // User not found → empty permissions
        return [];
      }
      return exit.value;
    },

    checkAccess(userId: string, resourceName: string): boolean {
      const exit = Effect.runSyncExit(
        checkAccessEffect(userId, resourceName, users, roles, resources)
      );
      if (exit._tag === "Failure") {
        // Unknown user or resource → deny access
        return false;
      }
      return exit.value;
    },
  };
}

export type { Role, User, Resource, RBACSystem };