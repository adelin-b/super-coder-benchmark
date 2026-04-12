import { Effect, Data, Exit, Cause } from "effect";

// ── Public interfaces ──────────────────────────────────────────────────────────

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

// ── Internal tagged errors ─────────────────────────────────────────────────────

class UserNotFound extends Data.TaggedError("UserNotFound")<{ userId: string }> {}
class ResourceNotFound extends Data.TaggedError("ResourceNotFound")<{ resourceName: string }> {}

// ── Core logic (Effect-based internals) ───────────────────────────────────────

/**
 * Collect all permissions for a single role, following inheritance transitively.
 * Cycle detection: maintain a `visited` set per traversal path; if a role name
 * is already in `visited`, return an empty set (skip it — do NOT recurse).
 */
function collectRolePermissions(
  roleName: string,
  roleMap: Map<string, Role>,
  visited: Set<string>
): Set<string> {
  // Cycle guard — prevents infinite loops
  if (visited.has(roleName)) return new Set<string>();

  const role = roleMap.get(roleName);
  if (!role) return new Set<string>();

  // Mark BEFORE recursing to detect back-edges
  const nextVisited = new Set(visited);
  nextVisited.add(roleName);

  // Start with this role's direct permissions (never treat [] as wildcard)
  const perms = new Set<string>(role.permissions);

  // Recursively add inherited permissions
  if (role.inherits && role.inherits.length > 0) {
    for (const parent of role.inherits) {
      const parentPerms = collectRolePermissions(parent, roleMap, nextVisited);
      for (const p of parentPerms) {
        perms.add(p);
      }
    }
  }

  return perms;
}

/**
 * Effect that resolves all permissions for a user across all their roles.
 * Returns an empty array for an unknown user (not an error — callers rely on []).
 */
function buildUserPermissionsEffect(
  userId: string,
  userMap: Map<string, User>,
  roleMap: Map<string, Role>
): Effect.Effect<string[], UserNotFound> {
  return Effect.gen(function* () {
    const user = userMap.get(userId);
    if (!user) yield* Effect.fail(new UserNotFound({ userId }));
    const u = user!;

    if (u.roles.length === 0) return [];

    const allPerms = new Set<string>();
    for (const roleName of u.roles) {
      const rolePerms = collectRolePermissions(roleName, roleMap, new Set());
      for (const p of rolePerms) {
        allPerms.add(p);
      }
    }
    return Array.from(allPerms);
  });
}

/**
 * Effect that checks whether a user can access a resource.
 * AND logic: every required permission must be present.
 */
function checkAccessEffect(
  userId: string,
  resourceName: string,
  userMap: Map<string, User>,
  roleMap: Map<string, Role>,
  resourceMap: Map<string, Resource>
): Effect.Effect<boolean, UserNotFound | ResourceNotFound> {
  return Effect.gen(function* () {
    const resource = resourceMap.get(resourceName);
    if (!resource) yield* Effect.fail(new ResourceNotFound({ resourceName }));
    const res = resource!;

    // Resource with no required permissions is universally accessible
    if (res.requiredPermissions.length === 0) return true;

    const user = userMap.get(userId);
    if (!user) yield* Effect.fail(new UserNotFound({ userId }));

    const perms = yield* buildUserPermissionsEffect(userId, userMap, roleMap);
    const permSet = new Set(perms);

    return res.requiredPermissions.every((p) => permSet.has(p));
  });
}

// ── Factory ────────────────────────────────────────────────────────────────────

export function createRBAC(): RBACSystem {
  const roleMap = new Map<string, Role>();
  const userMap = new Map<string, User>();
  const resourceMap = new Map<string, Resource>();

  return {
    addRole(role: Role): void {
      roleMap.set(role.name, role);
    },

    addUser(user: User): void {
      userMap.set(user.id, user);
    },

    addResource(resource: Resource): void {
      resourceMap.set(resource.name, resource);
    },

    getUserPermissions(userId: string): string[] {
      const exit = Effect.runSyncExit(
        buildUserPermissionsEffect(userId, userMap, roleMap)
      );
      if (Exit.isFailure(exit)) {
        // Unknown user → no permissions (invariant: no roles = no permissions)
        return [];
      }
      return exit.value;
    },

    checkAccess(userId: string, resourceName: string): boolean {
      const exit = Effect.runSyncExit(
        checkAccessEffect(userId, resourceName, userMap, roleMap, resourceMap)
      );
      if (Exit.isFailure(exit)) {
        // Unknown user or resource → deny access
        return false;
      }
      return exit.value;
    },
  };
}