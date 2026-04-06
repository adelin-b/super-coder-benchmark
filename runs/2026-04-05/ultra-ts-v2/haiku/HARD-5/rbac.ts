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

export class RBACError extends Error {}

export function createRBAC() {
  const roles = new Map<string, Role>();
  const grants = new Map<string, PermissionGrant>();
  const userRoles = new Map<string, UserRoleAssignment[]>();

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

  function resourceMatches(grantResource: string, requestedResource: string): boolean {
    return grantResource === '*' || grantResource === requestedResource;
  }

  function actionMatches(grantAction: string, requestedAction: string): boolean {
    return grantAction === '*' || grantAction === requestedAction;
  }

  function getInheritedRoles(roleId: string, visited: Set<string> = new Set()): string[] {
    if (visited.has(roleId)) return [];
    visited.add(roleId);

    const role = roles.get(roleId);
    if (!role) return [];

    let result = [roleId];
    for (const inherited of role.inherits) {
      result = result.concat(getInheritedRoles(inherited, visited));
    }
    return result;
  }

  function detectCycleHelper(roleId: string, visited: Set<string>, rec: Set<string>): string[] | null {
    if (rec.has(roleId)) {
      return [roleId];
    }
    if (visited.has(roleId)) {
      return null;
    }

    visited.add(roleId);
    rec.add(roleId);

    const role = roles.get(roleId);
    if (role) {
      for (const inherited of role.inherits) {
        const cycle = detectCycleHelper(inherited, visited, rec);
        if (cycle) {
          cycle.push(roleId);
          return cycle;
        }
      }
    }

    rec.delete(roleId);
    return null;
  }

  return {
    createRole(role: Role): void {
      if (!role.id || role.id.trim() === '') {
        throw new RBACError('Role ID cannot be empty');
      }
      if (roles.has(role.id)) {
        throw new RBACError(`Role ${role.id} already exists`);
      }
      for (const inheritId of role.inherits) {
        if (!roles.has(inheritId)) {
          throw new RBACError(`Cannot inherit from non-existent role ${inheritId}`);
        }
      }
      roles.set(role.id, role);
    },

    addGrant(grant: PermissionGrant): void {
      if (grants.has(grant.id)) {
        throw new RBACError(`Grant ${grant.id} already exists`);
      }
      if (!roles.has(grant.roleId)) {
        throw new RBACError(`Role ${grant.roleId} does not exist`);
      }
      if (grant.startTime !== null && grant.endTime !== null && grant.startTime >= grant.endTime) {
        throw new RBACError('Grant startTime must be < endTime');
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
        throw new RBACError('Assignment startTime must be < endTime');
      }
      if (!userRoles.has(assignment.userId)) {
        userRoles.set(assignment.userId, []);
      }
      userRoles.get(assignment.userId)!.push(assignment);
    },

    unassignRole(userId: string, roleId: string): void {
      const assignments = userRoles.get(userId);
      if (assignments) {
        const idx = assignments.findIndex(a => a.roleId === roleId);
        if (idx >= 0) {
          assignments.splice(idx, 1);
        }
      }
    },

    check(userId: string, resource: string, action: string, checkTime: number): AccessCheckResult {
      const cycle = this.detectInheritanceCycle();
      if (cycle) {
        throw new RBACError(`Circular role inheritance detected: ${cycle.join(' -> ')}`);
      }

      const assignments = userRoles.get(userId) || [];
      const activeRoles = new Set<string>();
      for (const assignment of assignments) {
        if (isAssignmentActive(assignment, checkTime)) {
          activeRoles.add(assignment.roleId);
        }
      }

      if (activeRoles.size === 0) {
        return {
          allowed: false,
          reason: 'User has no active role assignments',
          matchedGrants: []
        };
      }

      const allRoles = new Set<string>();
      for (const roleId of activeRoles) {
        const inherited = getInheritedRoles(roleId);
        for (const role of inherited) {
          allRoles.add(role);
        }
      }

      const allows: string[] = [];
      const denies: string[] = [];

      for (const grant of grants.values()) {
        if (allRoles.has(grant.roleId) &&
            isGrantActive(grant, checkTime) &&
            resourceMatches(grant.resource, resource) &&
            actionMatches(grant.action, action)) {
          if (grant.effect === 'allow') {
            allows.push(grant.id);
          } else {
            denies.push(grant.id);
          }
        }
      }

      if (denies.length > 0) {
        return {
          allowed: false,
          reason: 'Access denied by deny grant',
          matchedGrants: denies
        };
      }

      if (allows.length > 0) {
        return {
          allowed: true,
          reason: 'Access allowed by grant',
          matchedGrants: allows
        };
      }

      return {
        allowed: false,
        reason: 'No matching grants',
        matchedGrants: []
      };
    },

    getEffectivePermissions(userId: string, atTime: number) {
      const assignments = userRoles.get(userId) || [];
      const activeRoles = new Set<string>();
      for (const assignment of assignments) {
        if (isAssignmentActive(assignment, atTime)) {
          activeRoles.add(assignment.roleId);
        }
      }

      const allRoles = new Set<string>();
      for (const roleId of activeRoles) {
        const inherited = getInheritedRoles(roleId);
        for (const role of inherited) {
          allRoles.add(role);
        }
      }

      const result: {
        resource: string;
        action: string;
        effect: 'allow' | 'deny';
        grantId: string;
        viaRole: string;
      }[] = [];

      const seen = new Set<string>();
      for (const grant of grants.values()) {
        if (!seen.has(grant.id) &&
            allRoles.has(grant.roleId) &&
            isGrantActive(grant, atTime)) {
          seen.add(grant.id);
          result.push({
            resource: grant.resource,
            action: grant.action,
            effect: grant.effect,
            grantId: grant.id,
            viaRole: grant.roleId
          });
        }
      }

      return result;
    },

    detectInheritanceCycle(): string[] | null {
      const visited = new Set<string>();
      const rec = new Set<string>();

      for (const roleId of roles.keys()) {
        if (!visited.has(roleId)) {
          const cycle = detectCycleHelper(roleId, visited, rec);
          if (cycle) {
            return cycle;
          }
        }
      }
      return null;
    },

    getUserRoles(userId: string, atTime: number): string[] {
      const assignments = userRoles.get(userId) || [];
      const activeRoles = new Set<string>();
      for (const assignment of assignments) {
        if (isAssignmentActive(assignment, atTime)) {
          activeRoles.add(assignment.roleId);
        }
      }

      const result = new Set<string>();
      for (const roleId of activeRoles) {
        const inherited = getInheritedRoles(roleId);
        for (const role of inherited) {
          result.add(role);
        }
      }

      return Array.from(result);
    }
  };
}