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
  effect: 'allow' | 'deny';
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
    this.name = 'RBACError';
  }
}

function isActiveAt(startTime: number | null, endTime: number | null, checkTime: number): boolean {
  const start = startTime ?? 0;
  const end = endTime ?? Infinity;
  return start <= checkTime && checkTime < end;
}

export function createRBAC() {
  const roles = new Map<string, Role>();
  const grants = new Map<string, PermissionGrant>();
  const assignments: UserRoleAssignment[] = [];

  function getAllInheritedRoles(roleId: string, visited = new Set<string>()): string[] {
    if (visited.has(roleId)) return [];
    visited.add(roleId);
    const role = roles.get(roleId);
    if (!role) return [roleId];
    const result = [roleId];
    for (const parentId of role.inherits) {
      result.push(...getAllInheritedRoles(parentId, visited));
    }
    return result;
  }

  function matchesResource(grantResource: string, requestedResource: string): boolean {
    if (grantResource === '*') return true;
    return grantResource === requestedResource;
  }

  function matchesAction(grantAction: string, requestedAction: string): boolean {
    if (grantAction === '*') return true;
    return grantAction === requestedAction;
  }

  return {
    createRole(role: Role): void {
      if (!role.id) throw new RBACError('Role id must be non-empty');
      if (roles.has(role.id)) throw new RBACError(`Role ${role.id} already exists`);
      for (const parentId of role.inherits) {
        if (!roles.has(parentId)) throw new RBACError(`Inherited role ${parentId} does not exist`);
      }
      roles.set(role.id, { ...role, inherits: [...role.inherits] });
    },

    addGrant(grant: PermissionGrant): void {
      if (!grant.id) throw new RBACError('Grant id must be non-empty');
      if (grants.has(grant.id)) throw new RBACError(`Grant ${grant.id} already exists`);
      if (!roles.has(grant.roleId)) throw new RBACError(`Role ${grant.roleId} does not exist`);
      if (grant.startTime !== null && grant.endTime !== null && grant.startTime >= grant.endTime) {
        throw new RBACError('startTime must be < endTime');
      }
      grants.set(grant.id, { ...grant });
    },

    revokeGrant(grantId: string): void {
      if (!grants.has(grantId)) throw new RBACError(`Grant ${grantId} does not exist`);
      grants.delete(grantId);
    },

    assignRole(assignment: UserRoleAssignment): void {
      if (!roles.has(assignment.roleId)) throw new RBACError(`Role ${assignment.roleId} does not exist`);
      assignments.push({ ...assignment });
    },

    unassignRole(userId: string, roleId: string): void {
      const idx = assignments.findIndex(a => a.userId === userId && a.roleId === roleId);
      if (idx >= 0) assignments.splice(idx, 1);
    },

    check(userId: string, resource: string, action: string, checkTime: number): AccessCheckResult {
      // Check for cycles first
      const cycle = this.detectInheritanceCycle();
      if (cycle) throw new RBACError(`Inheritance cycle detected: ${cycle.join(' -> ')}`);

      // Find active role assignments for user
      const activeAssignments = assignments.filter(
        a => a.userId === userId && isActiveAt(a.startTime, a.endTime, checkTime)
      );

      if (activeAssignments.length === 0) {
        return { allowed: false, reason: 'No active role assignments', matchedGrants: [] };
      }

      // Collect all role IDs (direct + inherited)
      const allRoleIds = new Set<string>();
      for (const assignment of activeAssignments) {
        for (const roleId of getAllInheritedRoles(assignment.roleId)) {
          allRoleIds.add(roleId);
        }
      }

      // Find matching grants
      const matchingGrants: PermissionGrant[] = [];
      for (const grant of grants.values()) {
        if (!allRoleIds.has(grant.roleId)) continue;
        if (!isActiveAt(grant.startTime, grant.endTime, checkTime)) continue;
        if (!matchesResource(grant.resource, resource)) continue;
        if (!matchesAction(grant.action, action)) continue;
        matchingGrants.push(grant);
      }

      if (matchingGrants.length === 0) {
        return { allowed: false, reason: 'No matching grants found', matchedGrants: [] };
      }

      // Deny takes precedence
      const denyGrants = matchingGrants.filter(g => g.effect === 'deny');
      if (denyGrants.length > 0) {
        return {
          allowed: false,
          reason: `Denied by grant(s): ${denyGrants.map(g => g.id).join(', ')}`,
          matchedGrants: matchingGrants.map(g => g.id),
        };
      }

      const allowGrants = matchingGrants.filter(g => g.effect === 'allow');
      if (allowGrants.length > 0) {
        return {
          allowed: true,
          reason: `Allowed by grant(s): ${allowGrants.map(g => g.id).join(', ')}`,
          matchedGrants: matchingGrants.map(g => g.id),
        };
      }

      return { allowed: false, reason: 'No allow grants found', matchedGrants: [] };
    },

    getEffectivePermissions(userId: string, atTime: number) {
      // Collect all active roles
      const activeAssignments = assignments.filter(
        a => a.userId === userId && isActiveAt(a.startTime, a.endTime, atTime)
      );

      const allRoleIds = new Set<string>();
      const roleIdToSource = new Map<string, string>(); // roleId -> via which direct role
      for (const assignment of activeAssignments) {
        const inherited = getAllInheritedRoles(assignment.roleId);
        for (const rId of inherited) {
          allRoleIds.add(rId);
          if (!roleIdToSource.has(rId)) roleIdToSource.set(rId, assignment.roleId);
        }
      }

      const result: {
        resource: string;
        action: string;
        effect: 'allow' | 'deny';
        grantId: string;
        viaRole: string;
      }[] = [];

      const seenGrantIds = new Set<string>();

      for (const grant of grants.values()) {
        if (!allRoleIds.has(grant.roleId)) continue;
        if (!isActiveAt(grant.startTime, grant.endTime, atTime)) continue;
        if (seenGrantIds.has(grant.id)) continue;
        seenGrantIds.add(grant.id);

        result.push({
          resource: grant.resource,
          action: grant.action,
          effect: grant.effect,
          grantId: grant.id,
          viaRole: grant.roleId,
        });
      }

      return result;
    },

    detectInheritanceCycle(): string[] | null {
      const WHITE = 0, GRAY = 1, BLACK = 2;
      const color = new Map<string, number>();
      const parent = new Map<string, string | null>();

      for (const id of roles.keys()) color.set(id, WHITE);

      for (const startId of roles.keys()) {
        if (color.get(startId) !== WHITE) continue;

        const stack: { id: string; idx: number }[] = [{ id: startId, idx: 0 }];
        color.set(startId, GRAY);
        parent.set(startId, null);

        while (stack.length > 0) {
          const frame = stack[stack.length - 1];
          const role = roles.get(frame.id)!;

          if (frame.idx < role.inherits.length) {
            const parentRoleId = role.inherits[frame.idx];
            frame.idx++;

            if (!roles.has(parentRoleId)) continue;

            const c = color.get(parentRoleId)!;
            if (c === GRAY) {
              // Found cycle
              const cycle: string[] = [parentRoleId];
              let cur = frame.id;
              while (cur !== parentRoleId) {
                cycle.push(cur);
                cur = parent.get(cur)!;
              }
              cycle.push(parentRoleId);
              cycle.reverse();
              return cycle;
            } else if (c === WHITE) {
              color.set(parentRoleId, GRAY);
              parent.set(parentRoleId, frame.id);
              stack.push({ id: parentRoleId, idx: 0 });
            }
          } else {
            color.set(frame.id, BLACK);
            stack.pop();
          }
        }
      }

      return null;
    },

    getUserRoles(userId: string, atTime: number): string[] {
      const activeAssignments = assignments.filter(
        a => a.userId === userId && isActiveAt(a.startTime, a.endTime, atTime)
      );

      const allRoles = new Set<string>();
      for (const assignment of activeAssignments) {
        for (const roleId of getAllInheritedRoles(assignment.roleId)) {
          allRoles.add(roleId);
        }
      }

      return [...allRoles];
    },
  };
}
