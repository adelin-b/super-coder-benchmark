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
    this.name = "RBACError";
  }
}

export function createRBAC() {
  const roles = new Map<string, Role>();
  const grants = new Map<string, PermissionGrant>();
  const userRoles = new Map<string, Map<string, UserRoleAssignment>>();

  function isGrantActive(grant: PermissionGrant, checkTime: number): boolean {
    const startOk = grant.startTime === null || grant.startTime <= checkTime;
    const endOk = grant.endTime === null || grant.endTime > checkTime;
    return startOk && endOk;
  }

  function isAssignmentActive(assignment: UserRoleAssignment, checkTime: number): boolean {
    const startOk = assignment.startTime === null || assignment.startTime <= checkTime;
    const endOk = assignment.endTime === null || assignment.endTime > checkTime;
    return startOk && endOk;
  }

  function resourceMatches(grantResource: string, requestedResource: string): boolean {
    return grantResource === '*' || grantResource === requestedResource;
  }

  function actionMatches(grantAction: string, requestedAction: string): boolean {
    return grantAction === '*' || grantAction === requestedAction;
  }

  function getInheritedGrants(roleId: string, visitedRoles = new Set<string>()): PermissionGrant[] {
    if (visitedRoles.has(roleId)) {
      return [];
    }
    visitedRoles.add(roleId);

    const role = roles.get(roleId);
    if (!role) {
      return [];
    }

    let result: PermissionGrant[] = [];

    // Add this role's direct grants
    for (const grant of grants.values()) {
      if (grant.roleId === roleId) {
        result.push(grant);
      }
    }

    // Add inherited grants
    for (const inheritedRoleId of role.inherits) {
      result = result.concat(getInheritedGrants(inheritedRoleId, visitedRoles));
    }

    return result;
  }

  function detectInheritanceCycleInternal(): string[] | null {
    const visited = new Set<string>();
    const rec = new Set<string>();

    function dfs(roleId: string, path: string[]): string[] | null {
      if (rec.has(roleId)) {
        const cycleStart = path.indexOf(roleId);
        return path.slice(cycleStart).concat([roleId]);
      }
      if (visited.has(roleId)) {
        return null;
      }

      visited.add(roleId);
      rec.add(roleId);
      path.push(roleId);

      const role = roles.get(roleId);
      if (role) {
        for (const inheritedId of role.inherits) {
          const cycle = dfs(inheritedId, path);
          if (cycle) {
            return cycle;
          }
        }
      }

      path.pop();
      rec.delete(roleId);
      return null;
    }

    for (const roleId of roles.keys()) {
      if (!visited.has(roleId)) {
        const cycle = dfs(roleId, []);
        if (cycle) {
          return cycle;
        }
      }
    }

    return null;
  }

  return {
    createRole(role: Role): void {
      if (!role.id || role.id.trim() === '') {
        throw new RBACError('Role ID must be non-empty');
      }
      if (roles.has(role.id)) {
        throw new RBACError(`Role with ID ${role.id} already exists`);
      }
      for (const inheritedId of role.inherits) {
        if (!roles.has(inheritedId)) {
          throw new RBACError(`Inherited role ${inheritedId} does not exist`);
        }
      }
      roles.set(role.id, role);
    },

    addGrant(grant: PermissionGrant): void {
      if (grants.has(grant.id)) {
        throw new RBACError(`Grant with ID ${grant.id} already exists`);
      }
      if (!roles.has(grant.roleId)) {
        throw new RBACError(`Role ${grant.roleId} does not exist`);
      }
      if (grant.startTime !== null && grant.endTime !== null && grant.startTime >= grant.endTime) {
        throw new RBACError('startTime must be < endTime');
      }
      grants.set(grant.id, grant);
    },

    revokeGrant(grantId: string): void {
      grants.delete(grantId);
    },

    assignRole(assignment: UserRoleAssignment): void {
      if (!roles.has(assignment.roleId)) {
        throw new RBACError(`Role ${assignment.roleId} does not exist`);
      }
      if (assignment.startTime !== null && assignment.endTime !== null && assignment.startTime >= assignment.endTime) {
        throw new RBACError('startTime must be < endTime');
      }
      if (!userRoles.has(assignment.userId)) {
        userRoles.set(assignment.userId, new Map());
      }
      userRoles.get(assignment.userId)!.set(assignment.roleId, assignment);
    },

    unassignRole(userId: string, roleId: string): void {
      const userMap = userRoles.get(userId);
      if (userMap) {
        userMap.delete(roleId);
      }
    },

    check(userId: string, resource: string, action: string, checkTime: number): AccessCheckResult {
      const cycle = detectInheritanceCycleInternal();
      if (cycle) {
        throw new RBACError(`Circular inheritance detected: ${cycle.join(' -> ')}`);
      }

      const userAssignments = userRoles.get(userId);
      if (!userAssignments) {
        return {
          allowed: false,
          reason: 'User has no role assignments',
          matchedGrants: []
        };
      }

      const activeRoleIds: string[] = [];
      for (const [roleId, assignment] of userAssignments) {
        if (isAssignmentActive(assignment, checkTime)) {
          activeRoleIds.push(roleId);
        }
      }

      if (activeRoleIds.length === 0) {
        return {
          allowed: false,
          reason: 'User has no active role assignments at this time',
          matchedGrants: []
        };
      }

      const applicableGrants: PermissionGrant[] = [];
      for (const roleId of activeRoleIds) {
        const roleGrants = getInheritedGrants(roleId);
        applicableGrants.push(...roleGrants);
      }

      const matchingGrants = applicableGrants.filter(grant => {
        return isGrantActive(grant, checkTime) &&
               resourceMatches(grant.resource, resource) &&
               actionMatches(grant.action, action);
      });

      if (matchingGrants.length === 0) {
        return {
          allowed: false,
          reason: 'No matching permission grants',
          matchedGrants: []
        };
      }

      const hasDeny = matchingGrants.some(g => g.effect === 'deny');
      if (hasDeny) {
        return {
          allowed: false,
          reason: 'Access denied by matching deny rule',
          matchedGrants: matchingGrants.map(g => g.id)
        };
      }

      const hasAllow = matchingGrants.some(g => g.effect === 'allow');
      if (hasAllow) {
        return {
          allowed: true,
          reason: 'Access allowed by matching grant',
          matchedGrants: matchingGrants.map(g => g.id)
        };
      }

      return {
        allowed: false,
        reason: 'No matching allow grants',
        matchedGrants: matchingGrants.map(g => g.id)
      };
    },

    getEffectivePermissions(userId: string, atTime: number): {
      resource: string;
      action: string;
      effect: 'allow' | 'deny';
      grantId: string;
      viaRole: string;
    }[] {
      const userAssignments = userRoles.get(userId);
      if (!userAssignments) {
        return [];
      }

      const