import { Effect, Data, Exit, Cause } from "effect";

// ── Exported types ─────────────────────────────────────────────────────────

export interface Role {
  id: string;
  name: string;
  inherits: string[];
}

export interface PermissionGrant {
  id: string;
  roleId: string;
  resource: string;
  action: string;
  effect: "allow" | "deny";
  startTime: number | null;
  endTime: number | null;
}

export interface UserRoleAssignment {
  userId: string;
  roleId: string;
  startTime: number | null;
  endTime: number | null;
}

export interface AccessCheckResult {
  allowed: boolean;
  reason: string;
  matchedGrants: string[];
}

export class RBACError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "RBACError";
  }
}

// ── Internal tagged errors ──────────────────────────────────────────────────

class InternalRBACError extends Data.TaggedError("InternalRBACError")<{
  reason: string;
}> {}

// ── Helpers ─────────────────────────────────────────────────────────────────

function isTemporallyActive(
  startTime: number | null,
  endTime: number | null,
  t: number
): boolean {
  const start = startTime ?? 0;
  if (t < start) return false;
  if (endTime !== null && t >= endTime) return false;
  return true;
}

function matchesResource(grantResource: string, requested: string): boolean {
  return grantResource === "*" || grantResource === requested;
}

function matchesAction(grantAction: string, requested: string): boolean {
  return grantAction === "*" || grantAction === requested;
}

// ── Factory ──────────────────────────────────────────────────────────────────

export function createRBAC(): {
  createRole(role: Role): void;
  addGrant(grant: PermissionGrant): void;
  revokeGrant(grantId: string): void;
  assignRole(assignment: UserRoleAssignment): void;
  unassignRole(userId: string, roleId: string): void;
  check(
    userId: string,
    resource: string,
    action: string,
    checkTime: number
  ): AccessCheckResult;
  getEffectivePermissions(
    userId: string,
    atTime: number
  ): {
    resource: string;
    action: string;
    effect: "allow" | "deny";
    grantId: string;
    viaRole: string;
  }[];
  detectInheritanceCycle(): string[] | null;
  getUserRoles(userId: string, atTime: number): string[];
} {
  const roles = new Map<string, Role>();
  const grants = new Map<string, PermissionGrant>();
  // roleId -> grant IDs
  const roleGrants = new Map<string, Set<string>>();
  // userId -> assignments
  const userAssignments = new Map<string, UserRoleAssignment[]>();

  // ── detectInheritanceCycle ─────────────────────────────────────────────

  function detectInheritanceCycle(): string[] | null {
    // DFS with coloring: 0=white, 1=gray, 2=black
    const color = new Map<string, number>();
    const parent = new Map<string, string>();

    for (const id of roles.keys()) color.set(id, 0);

    function dfs(node: string): string[] | null {
      color.set(node, 1);
      const role = roles.get(node);
      if (!role) return null;
      for (const neighbor of role.inherits) {
        if (!roles.has(neighbor)) continue;
        const c = color.get(neighbor) ?? 0;
        if (c === 1) {
          // found cycle — reconstruct
          const cycle: string[] = [neighbor, node];
          let cur = node;
          while (parent.get(cur) !== undefined && parent.get(cur) !== neighbor) {
            cur = parent.get(cur)!;
            cycle.push(cur);
          }
          cycle.reverse();
          return cycle;
        }
        if (c === 0) {
          parent.set(neighbor, node);
          const result = dfs(neighbor);
          if (result) return result;
        }
      }
      color.set(node, 2);
      return null;
    }

    for (const id of roles.keys()) {
      if ((color.get(id) ?? 0) === 0) {
        const result = dfs(id);
        if (result) return result;
      }
    }
    return null;
  }

  // ── getTransitiveRoleIds ───────────────────────────────────────────────

  function getTransitiveRoleIds(roleId: string, visited = new Set<string>()): Set<string> {
    if (visited.has(roleId)) return visited;
    visited.add(roleId);
    const role = roles.get(roleId);
    if (!role) return visited;
    for (const parentId of role.inherits) {
      getTransitiveRoleIds(parentId, visited);
    }
    return visited;
  }

  // ── createRole ─────────────────────────────────────────────────────────

  function createRole(role: Role): void {
    const exit = Effect.runSyncExit(
      Effect.gen(function* () {
        if (!role.id || role.id.trim() === "") {
          yield* Effect.fail(new InternalRBACError({ reason: "Role ID must be non-empty" }));
        }
        if (roles.has(role.id)) {
          yield* Effect.fail(new InternalRBACError({ reason: `Role ID '${role.id}' already exists` }));
        }
        for (const inheritedId of role.inherits) {
          if (!roles.has(inheritedId)) {
            yield* Effect.fail(
              new InternalRBACError({ reason: `Inherited role '${inheritedId}' does not exist` })
            );
          }
        }
        roles.set(role.id, { ...role, inherits: [...role.inherits] });
        roleGrants.set(role.id, new Set());
      })
    );
    if (Exit.isFailure(exit)) {
      const err = Cause.squash(exit.cause);
      throw new RBACError(err instanceof Error ? err.message : String(err));
    }
  }

  // ── addGrant ───────────────────────────────────────────────────────────

  function addGrant(grant: PermissionGrant): void {
    const exit = Effect.runSyncExit(
      Effect.gen(function* () {
        if (grants.has(grant.id)) {
          yield* Effect.fail(new InternalRBACError({ reason: `Grant ID '${grant.id}' already exists` }));
        }
        if (!roles.has(grant.roleId)) {
          yield* Effect.fail(
            new InternalRBACError({ reason: `Role '${grant.roleId}' does not exist` })
          );
        }
        if (
          grant.startTime !== null &&
          grant.endTime !== null &&
          grant.startTime >= grant.endTime
        ) {
          yield* Effect.fail(
            new InternalRBACError({ reason: "Grant startTime must be < endTime" })
          );
        }
        grants.set(grant.id, { ...grant });
        const set = roleGrants.get(grant.roleId) ?? new Set<string>();
        set.add(grant.id);
        roleGrants.set(grant.roleId, set);
      })
    );
    if (Exit.isFailure(exit)) {
      const err = Cause.squash(exit.cause);
      throw new RBACError(err instanceof Error ? err.message : String(err));
    }
  }

  // ── revokeGrant ────────────────────────────────────────────────────────

  function revokeGrant(grantId: string): void {
    const grant = grants.get(grantId);
    if (grant) {
      grants.delete(grantId);
      const set = roleGrants.get(grant.roleId);
      if (set) set.delete(grantId);
    }
  }

  // ── assignRole ─────────────────────────────────────────────────────────

  function assignRole(assignment: UserRoleAssignment): void {
    const exit = Effect.runSyncExit(
      Effect.gen(function* () {
        if (!roles.has(assignment.roleId)) {
          yield* Effect.fail(
            new InternalRBACError({ reason: `Role '${assignment.roleId}' does not exist` })
          );
        }
        if (
          assignment.startTime !== null &&
          assignment.endTime !== null &&
          assignment.startTime >= assignment.endTime
        ) {
          yield* Effect.fail(
            new InternalRBACError({ reason: "Assignment startTime must be < endTime" })
          );
        }
        const list = userAssignments.get(assignment.userId) ?? [];
        list.push({ ...assignment });
        userAssignments.set(assignment.userId, list);
      })
    );
    if (Exit.isFailure(exit)) {
      const err = Cause.squash(exit.cause);
      throw new RBACError(err instanceof Error ? err.message : String(err));
    }
  }

  // ── unassignRole ───────────────────────────────────────────────────────

  function unassignRole(userId: string, roleId: string): void {
    const list = userAssignments.get(userId);
    if (!list) return;
    const updated = list.filter((a) => a.roleId !== roleId);
    userAssignments.set(userId, updated);
  }

  // ── getUserRoles ───────────────────────────────────────────────────────

  function getUserRoles(userId: string, atTime: number): string[] {
    const assignments = userAssignments.get(userId) ?? [];
    const directActive = assignments
      .filter((a) => isTemporallyActive(a.startTime, a.endTime, atTime))
      .map((a) => a.roleId);

    const allRoles = new Set<string>();
    for (const roleId of directActive) {
      getTransitiveRoleIds(roleId, allRoles);
    }
    return Array.from(allRoles);
  }

  // ── collectGrantsForRoles ──────────────────────────────────────────────

  function collectGrantsForRoles(roleIds: string[]): PermissionGrant[] {
    const seen = new Set<string>();
    const result: PermissionGrant[] = [];
    for (const roleId of roleIds) {
      const grantIds = roleGrants.get(roleId) ?? new Set();
      for (const gid of grantIds) {
        if (!seen.has(gid)) {
          seen.add(gid);
          const g = grants.get(gid);
          if (g) result.push(g);
        }
      }
    }
    return result;
  }

  // ── check ──────────────────────────────────────────────────────────────

  function check(
    userId: string,
    resource: string,
    action: string,
    checkTime: number
  ): AccessCheckResult {
    const cycle = detectInheritanceCycle();
    if (cycle) {
      throw new RBACError(`Circular inheritance detected: ${cycle.join(" -> ")}`);
    }

    const activeRoleIds = getUserRoles(userId, checkTime);

    if (activeRoleIds.length === 0) {
      return {
        allowed: false,
        reason: "User has no active role assignments",
        matchedGrants: [],
      };
    }

    const allGrants = collectGrantsForRoles(activeRoleIds);

    // Filter temporally active + matching resource/action
    const matching = allGrants.filter(
      (g) =>
        isTemporallyActive(g.startTime, g.endTime, checkTime) &&
        matchesResource(g.resource, resource) &&
        matchesAction(g.action, action)
    );

    if (matching.length === 0) {
      return {
        allowed: false,
        reason: "No matching grants found",
        matchedGrants: [],
      };
    }

    const denyGrants = matching.filter((g) => g.effect === "deny");
    if (denyGrants.length > 0) {
      return {
        allowed: false,
        reason: `Access denied by deny grant(s): ${denyGrants.map((g) => g.id).join(", ")}`,
        matchedGrants: denyGrants.map((g) => g.id),
      };
    }

    const allowGrants = matching.filter((g) => g.effect === "allow");
    if (allowGrants.length > 0) {
      return {
        allowed: true,
        reason: `Access allowed by grant(s): ${allowGrants.map((g) => g.id).join(", ")}`,
        matchedGrants: allowGrants.map((g) => g.id),
      };
    }

    return {
      allowed: false,
      reason: "No allow grants found",
      matchedGrants: [],
    };
  }

  // ── getEffectivePermissions ────────────────────────────────────────────

  function getEffectivePermissions(
    userId: string,
    atTime: number
  ): {
    resource: string;
    action: string;
    effect: "allow" | "deny";
    grantId: string;
    viaRole: string;
  }[] {
    const assignments = userAssignments.get(userId) ?? [];
    const activeAssignments = assignments.filter((a) =>
      isTemporallyActive(a.startTime, a.endTime, atTime)
    );

    const seenGrantIds = new Set<string>();
    const result: {
      resource: string;
      action: string;
      effect: "allow" | "deny";
      grantId: string;
      viaRole: string;
    }[] = [];

    for (const assignment of activeAssignments) {
      const transitiveRoles = getTransitiveRoleIds(assignment.roleId);
      for (const roleId of transitiveRoles) {
        const grantIds = roleGrants.get(roleId) ?? new Set();
        for (const gid of grantIds) {
          if (seenGrantIds.has(gid)) continue;
          const g = grants.get(gid);
          if (!g) continue;
          if (!isTemporallyActive(g.startTime, g.endTime, atTime)) continue;
          seenGrantIds.add(gid);
          result.push({
            resource: g.resource,
            action: g.action,
            effect: g.effect,
            grantId: g.id,
            viaRole: roleId,
          });
        }
      }
    }

    return result;
  }

  return {
    createRole,
    addGrant,
    revokeGrant,
    assignRole,
    unassignRole,
    check,
    getEffectivePermissions,
    detectInheritanceCycle,
    getUserRoles,
  };
}