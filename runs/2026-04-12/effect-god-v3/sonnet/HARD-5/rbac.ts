import { Effect, Data, Exit, Cause } from "effect";

// ── Public error class ────────────────────────────────────────────────────────

export class RBACError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "RBACError";
    Object.setPrototypeOf(this, RBACError.prototype);
  }
}

// ── Exported interfaces ───────────────────────────────────────────────────────

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

// ── Internal tagged errors ────────────────────────────────────────────────────

class InternalRBACError extends Data.TaggedError("InternalRBACError")<{
  reason: string;
}> {}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isActiveAtTime(
  startTime: number | null,
  endTime: number | null,
  t: number
): boolean {
  const start = startTime ?? 0;
  if (start > t) return false;
  if (endTime !== null && endTime <= t) return false;
  return true;
}

function matchesResource(grantResource: string, requested: string): boolean {
  return grantResource === "*" || grantResource === requested;
}

function matchesAction(grantAction: string, requested: string): boolean {
  return grantAction === "*" || grantAction === requested;
}

// ── Factory ───────────────────────────────────────────────────────────────────

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

  // ── Internal Effect helpers ─────────────────────────────────────────────────

  function getTransitiveRoles(roleId: string, visited = new Set<string>()): string[] {
    if (visited.has(roleId)) return [];
    visited.add(roleId);
    const role = roles.get(roleId);
    if (!role) return [];
    const result: string[] = [roleId];
    for (const parentId of role.inherits) {
      result.push(...getTransitiveRoles(parentId, visited));
    }
    return result;
  }

  function detectCycleInternal(): string[] | null {
    // DFS cycle detection
    const WHITE = 0, GRAY = 1, BLACK = 2;
    const color = new Map<string, number>();
    const parent = new Map<string, string | null>();

    for (const id of roles.keys()) {
      color.set(id, WHITE);
      parent.set(id, null);
    }

    let cycleFound: string[] | null = null;

    function dfs(u: string): boolean {
      color.set(u, GRAY);
      const role = roles.get(u);
      if (role) {
        for (const v of role.inherits) {
          if (!color.has(v)) continue; // unknown role, skip
          if (color.get(v) === GRAY) {
            // Found cycle — reconstruct it
            const cycle: string[] = [v, u];
            let cur = u;
            while (parent.get(cur) !== null && parent.get(cur) !== v) {
              cur = parent.get(cur)!;
              cycle.push(cur);
            }
            cycle.push(v);
            cycleFound = cycle.reverse();
            return true;
          }
          if (color.get(v) === WHITE) {
            parent.set(v, u);
            if (dfs(v)) return true;
          }
        }
      }
      color.set(u, BLACK);
      return false;
    }

    for (const id of roles.keys()) {
      if (color.get(id) === WHITE) {
        if (dfs(id)) return cycleFound;
      }
    }
    return null;
  }

  // ── Public methods ──────────────────────────────────────────────────────────

  function createRole(role: Role): void {
    const eff = Effect.gen(function* () {
      if (!role.id || role.id.trim() === "") {
        yield* Effect.fail(new InternalRBACError({ reason: "Role ID must be non-empty" }));
      }
      if (roles.has(role.id)) {
        yield* Effect.fail(new InternalRBACError({ reason: `Role '${role.id}' already exists` }));
      }
      for (const parentId of role.inherits) {
        if (!roles.has(parentId)) {
          yield* Effect.fail(
            new InternalRBACError({ reason: `Inherited role '${parentId}' does not exist` })
          );
        }
      }
      roles.set(role.id, { ...role, inherits: [...role.inherits] });
      roleGrants.set(role.id, new Set());
    });

    const exit = Effect.runSyncExit(eff);
    if (Exit.isFailure(exit)) {
      const raw = Cause.squash(exit.cause);
      const msg = raw instanceof Error ? raw.message : (raw as any).reason ?? String(raw);
      throw new RBACError(msg);
    }
  }

  function addGrant(grant: PermissionGrant): void {
    const eff = Effect.gen(function* () {
      if (grants.has(grant.id)) {
        yield* Effect.fail(new InternalRBACError({ reason: `Grant ID '${grant.id}' already exists` }));
      }
      if (!roles.has(grant.roleId)) {
        yield* Effect.fail(new InternalRBACError({ reason: `Role '${grant.roleId}' does not exist` }));
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
      roleGrants.get(grant.roleId)!.add(grant.id);
    });

    const exit = Effect.runSyncExit(eff);
    if (Exit.isFailure(exit)) {
      const raw = Cause.squash(exit.cause);
      const msg = raw instanceof Error ? raw.message : (raw as any).reason ?? String(raw);
      throw new RBACError(msg);
    }
  }

  function revokeGrant(grantId: string): void {
    const grant = grants.get(grantId);
    if (grant) {
      roleGrants.get(grant.roleId)?.delete(grantId);
      grants.delete(grantId);
    }
  }

  function assignRole(assignment: UserRoleAssignment): void {
    const eff = Effect.gen(function* () {
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
      if (!userAssignments.has(assignment.userId)) {
        userAssignments.set(assignment.userId, []);
      }
      userAssignments.get(assignment.userId)!.push({ ...assignment });
    });

    const exit = Effect.runSyncExit(eff);
    if (Exit.isFailure(exit)) {
      const raw = Cause.squash(exit.cause);
      const msg = raw instanceof Error ? raw.message : (raw as any).reason ?? String(raw);
      throw new RBACError(msg);
    }
  }

  function unassignRole(userId: string, roleId: string): void {
    const assignments = userAssignments.get(userId);
    if (assignments) {
      const idx = assignments.findIndex((a) => a.roleId === roleId);
      if (idx !== -1) {
        assignments.splice(idx, 1);
      }
    }
  }

  function getActiveRoleIds(userId: string, atTime: number): string[] {
    const assignments = userAssignments.get(userId) ?? [];
    return assignments
      .filter((a) => isActiveAtTime(a.startTime, a.endTime, atTime))
      .map((a) => a.roleId);
  }

  function getUserRoles(userId: string, atTime: number): string[] {
    const directRoles = getActiveRoleIds(userId, atTime);
    const allRoles = new Set<string>();
    for (const roleId of directRoles) {
      for (const r of getTransitiveRoles(roleId)) {
        allRoles.add(r);
      }
    }
    return Array.from(allRoles);
  }

  function detectInheritanceCycle(): string[] | null {
    return detectCycleInternal();
  }

  function check(
    userId: string,
    resource: string,
    action: string,
    checkTime: number
  ): AccessCheckResult {
    // Check for cycles first
    const cycle = detectCycleInternal();
    if (cycle) {
      throw new RBACError(`Circular inheritance detected: ${cycle.join(" -> ")}`);
    }

    const allRoleIds = getUserRoles(userId, checkTime);

    // Collect all grants from all roles (transitive) that were active
    const matchedDeny: string[] = [];
    const matchedAllow: string[] = [];

    for (const roleId of allRoleIds) {
      const grantIds = roleGrants.get(roleId) ?? new Set<string>();
      for (const grantId of grantIds) {
        const grant = grants.get(grantId);
        if (!grant) continue;
        if (!isActiveAtTime(grant.startTime, grant.endTime, checkTime)) continue;
        if (!matchesResource(grant.resource, resource)) continue;
        if (!matchesAction(grant.action, action)) continue;

        if (grant.effect === "deny") {
          matchedDeny.push(grantId);
        } else {
          matchedAllow.push(grantId);
        }
      }
    }

    if (matchedDeny.length > 0) {
      return {
        allowed: false,
        reason: `Access denied by deny grant(s): ${matchedDeny.join(", ")}`,
        matchedGrants: [...matchedDeny, ...matchedAllow],
      };
    }

    if (matchedAllow.length > 0) {
      return {
        allowed: true,
        reason: `Access allowed by grant(s): ${matchedAllow.join(", ")}`,
        matchedGrants: matchedAllow,
      };
    }

    return {
      allowed: false,
      reason: "No matching grants found (default deny)",
      matchedGrants: [],
    };
  }

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
    const allRoleIds = getUserRoles(userId, atTime);
    const seen = new Set<string>();
    const result: {
      resource: string;
      action: string;
      effect: "allow" | "deny";
      grantId: string;
      viaRole: string;
    }[] = [];

    for (const roleId of allRoleIds) {
      const grantIds = roleGrants.get(roleId) ?? new Set<string>();
      for (const grantId of grantIds) {
        if (seen.has(grantId)) continue;
        const grant = grants.get(grantId);
        if (!grant) continue;
        if (!isActiveAtTime(grant.startTime, grant.endTime, atTime)) continue;
        seen.add(grantId);
        result.push({
          resource: grant.resource,
          action: grant.action,
          effect: grant.effect,
          grantId: grant.id,
          viaRole: roleId,
        });
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