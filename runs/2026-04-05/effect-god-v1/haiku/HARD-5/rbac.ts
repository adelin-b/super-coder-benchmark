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
  constructor(message: string) {
    super(message);
    this.name = 'RBACError';
  }
}

export function createRBAC() {
  const roles = new Map<string, Role>();
  const grants = new Map<string, PermissionGrant>();
  const userRoleAssignments: UserRoleAssignment[] = [];

  function isGrantActive(grant: PermissionGrant, atTime: number): boolean {
    const startOk = grant.startTime === null || grant.startTime <= atTime;
    const endOk = grant.endTime === null || grant.endTime > atTime;
    return startOk && endOk;
  }

  function isAssignmentActive(assignment: UserRoleAssignment, atTime: number): boolean {
    const startOk = assignment.startTime === null || assignment.startTime <= atTime;
    const endOk = assignment.endTime === null || assignment.endTime > atTime;
    return startOk && endOk;
  }

  function getTransitiveRoles(roleId: string, visited = new Set<string>()): string[] {
    if (visited.has(roleId)) {
      return [];
    }
    visited.add(roleId);
    const result = [roleId];
    const role = roles.get(roleId);
    if (role) {
      for (const inherited of role.inherits) {
        result.push(...getTransitiveRoles(inherited, visited));
      }
    }
    return result;
  }

  function detectCycleFromRole(roleId: string, path: string[]): string[] | null {
    if (path.includes(roleId)) {
      return path.slice(path.indexOf(roleId)).concat(roleId);
    }
    const role = roles.get(roleId);
    if (!role) return null;
    for (const inherited of role.inherits) {
      const cycle = detectCycleFromRole(inherited, path.concat(roleId));
      if (cycle) return cycle;
    }
    return null;
  }

  return {
    createRole(role: Role): void {
      if (!role.id || role.id.trim() === '') {
        throw new RBACError('Role ID must be non-empty');
      }
      if (roles.has(role.id)) {
        throw new RBACError(`Role with ID "${role.id}" already exists`);
      }
      for (const inheritedId of role.inherits) {
        if (!roles.has(inheritedId)) {
          throw new RBACError(`Cannot inherit from non-existent role "${inheritedId}"`);
        }
      }
      roles.set(role.id, role);
    },

    addGrant(grant: PermissionGrant): void {
      if (grants.has(grant.id)) {
        throw new RBACError(`Grant with ID "${grant.id}" already exists`);
      }
      if (!roles.has(grant.roleId)) {
        throw new RBACError(`Role "${grant.roleId}" does not exist`);
      }
      if (grant.startTime !== null && grant.endTime !== null && grant.startTime >= grant.endTime) {
        throw new RBACError('Grant startTime must be less than endTime');
      }
      grants.set(grant.id, grant);
    },

    revokeGrant(grantId: string): void {
      grants.delete(grantId);
    },

    assignRole(assignment: UserRoleAssignment): void {
      if (!roles.has(assignment.roleId)) {
        throw new RBACError(`Role "${assignment.roleId}" does not exist`);
      }
      if (assignment.startTime !== null && assignment.endTime !== null && assignment.startTime >= assignment.endTime) {
        throw new RBACError('Assignment startTime must be less than endTime');
      }
      userRoleAssignments.push(assignment);
    },

    unassignRole(userId: string, roleId: string): void {
      const index = userRoleAssignments.findIndex(
        a => a.userId === userId && a.roleId === roleId
      );
      if (index >= 0) {
        userRoleAssignments.splice(index, 1);
      }
    },

    check(userId: string, resource: string, action: string, checkTime: number): AccessCheckResult {
      const cycle = this.detectInheritanceCycle();
      if (cycle) {
        throw new RBACError(`Circular role inheritance detected: ${cycle.join(' -> ')}`);
      }

      // Find all active roles for this user at checkTime
      const activeRoles = userRoleAssignments
        .filter(a => a.userId === userId && isAssignmentActive(a, checkTime))
        .map(a => a.roleId);

      if (activeRoles.length === 0) {
        return {
          allowed: false,
          reason: 'User has no active role assignments',
          matchedGrants: [],
        };
      }

      // Collect all transitive roles
      const allRoles = new Set<string>();
      for (const roleId of activeRoles) {
        for (const transitiveRoleId of getTransitiveRoles(roleId)) {
          allRoles.add(transitiveRoleId);
        }
      }

      // Collect matching grants
      const matchedGrants: PermissionGrant[] = [];
      for (const [, grant] of grants) {
        if (!allRoles.has(grant.roleId)) continue;
        if (!isGrantActive(grant, checkTime)) continue;

        // Check resource match (exact or wildcard)
        const resourceMatch = grant.resource === '*' || grant.resource === resource;
        // Check action match (exact or wildcard)
        const actionMatch = grant.action === '*' || grant.action === action;

        if (resourceMatch && actionMatch) {
          matchedGrants.push(grant);
        }
      }

      const matchedGrantIds = matchedGrants.map(g => g.id);

      // Deny takes precedence
      const hasDeny = matchedGrants.some(g => g.effect === 'deny');
      if (hasDeny) {
        return {
          allowed: false,
          reason: 'Access denied by a deny grant',
          matchedGrants: matchedGrantIds,
        };
      }

      // Check for allow
      const hasAllow = matchedGrants.some(g => g.effect === 'allow');
      if (hasAllow) {
        return {
          allowed: true,
          reason: 'Access granted by an allow grant',
          matchedGrants: matchedGrantIds,
        };
      }

      // Default deny
      return {
        allowed: false,
        reason: 'No matching grants found',
        matchedGrants: matchedGrantIds,
      };
    },

    getEffectivePermissions(userId: string, atTime: number): {
      resource: string;
      action: string;
      effect: 'allow' | 'deny';
      grantId: string;
      viaRole: string;
    }[] {
      // Find all active roles for this user at atTime
      const activeRoles = userRoleAssignments
        .filter(a => a.userId === userId && isAssignmentActive(a, atTime))
        .map(a => a.roleId);

      // Collect all transitive roles
      const allRoles = new Set<string>();
      for (const roleId of activeRoles) {
        for (const transitiveRoleId of getTransitiveRoles(roleId)) {
          allRoles.add(transitiveRoleId);
        }
      }

      // Collect all active grants from those roles, deduplicated by grant ID
      const seen = new Set<string>();
      const result: {
        resource: string;
        action: string;
        effect: 'allow' | 'deny';
        grantId: string;
        viaRole: string;
      }[] = [];

      for (const [grantId, grant] of grants) {
        if (seen.has(grantId)) continue;
        if (!allRoles.has(grant.roleId)) continue;
        if (!isGrantActive(grant, atTime)) continue;

        seen.add(grantId);
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
      for (const roleId of roles.keys()) {
        const cycle = detectCycleFromRole(roleId, []);
        if (cycle) return cycle;
      }
      return null;
    },

    getUserRoles(userId: string, atTime: number): string[] {
      const activeRoles = userRoleAssignments
        .filter(a => a.userId === userId && isAssignmentActive(a, atTime))
        .map(a => a.roleId);

      const allRoles = new Set<string>();
      for (const roleId of activeRoles) {
        for (const transitiveRoleId of getTransitiveRoles(roleId)) {
          allRoles.add(transitiveRoleId);
        }
      }

      return Array.from(allRoles);
    },
  };
}