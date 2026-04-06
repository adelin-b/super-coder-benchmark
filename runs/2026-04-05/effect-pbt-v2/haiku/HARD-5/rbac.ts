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
  const userRoles = new Map<string, UserRoleAssignment[]>();

  const isActive = (startTime: number | null, endTime: number | null, checkTime: number): boolean => {
    const start = startTime === null ? 0 : startTime;
    const end = endTime === null ? Infinity : endTime;
    return start <= checkTime && checkTime < end;
  };

  const matchesResourceAction = (grantResource: string, grantAction: string, resource: string, action: string): boolean => {
    const resourceMatch = grantResource === '*' || grantResource === resource;
    const actionMatch = grantAction === '*' || grantAction === action;
    return resourceMatch && actionMatch;
  };

  const getTransitiveClosure = (roleId: string, visited: Set<string> = new Set()): string[] => {
    if (visited.has(roleId)) {
      return [];
    }
    visited.add(roleId);
    const role = roles.get(roleId);
    if (!role) return [];
    
    const closure = [roleId];
    for (const inherited of role.inherits) {
      closure.push(...getTransitiveClosure(inherited, visited));
    }
    return closure;
  };

  const findCyclePath = (): string[] | null => {
    const visited = new Set<string>();
    
    const dfs = (roleId: string, path: string[]): string[] | null => {
      const pathIndex = path.indexOf(roleId);
      if (pathIndex !== -1) {
        return path.slice(pathIndex).concat([roleId]);
      }
      if (visited.has(roleId)) {
        return null;
      }
      
      visited.add(roleId);
      path.push(roleId);
      
      const role = roles.get(roleId);
      if (role) {
        for (const inherited of role.inherits) {
          const result = dfs(inherited, path);
          if (result) return result;
        }
      }
      
      path.pop();
      return null;
    };
    
    for (const roleId of roles.keys()) {
      const result = dfs(roleId, []);
      if (result) return result;
    }
    return null;
  };

  return {
    createRole(role: Role): void {
      if (!role.id || role.id.trim() === '') {
        throw new RBACError('Role ID must be non-empty');
      }
      if (roles.has(role.id)) {
        throw new RBACError(`Role with ID '${role.id}' already exists`);
      }
      
      for (const inheritedId of role.inherits) {
        if (!roles.has(inheritedId)) {
          throw new RBACError(`Inherited role '${inheritedId}' does not exist`);
        }
      }
      
      roles.set(role.id, role);
    },

    addGrant(grant: PermissionGrant): void {
      if (grants.has(grant.id)) {
        throw new RBACError(`Grant with ID '${grant.id}' already exists`);
      }
      
      if (!roles.has(grant.roleId)) {
        throw new RBACError(`Role '${grant.roleId}' does not exist`);
      }
      
      if (grant.startTime !== null && grant.endTime !== null && grant.startTime >= grant.endTime) {
        throw new RBACError('startTime must be less than endTime');
      }
      
      grants.set(grant.id, grant);
    },

    revokeGrant(grantId: string): void {
      grants.delete(grantId);
    },

    assignRole(assignment: UserRoleAssignment): void {
      if (!roles.has(assignment.roleId)) {
        throw new RBACError(`Role '${assignment.roleId}' does not exist`);
      }
      
      if (assignment.startTime !== null && assignment.endTime !== null && assignment.startTime >= assignment.endTime) {
        throw new RBACError('startTime must be less than endTime');
      }
      
      if (!userRoles.has(assignment.userId)) {
        userRoles.set(assignment.userId, []);
      }
      userRoles.get(assignment.userId)!.push(assignment);
    },

    unassignRole(userId: string, roleId: string): void {
      const assignments = userRoles.get(userId);
      if (!assignments) return;
      
      const filtered = assignments.filter(a => a.roleId !== roleId);
      if (filtered.length === 0) {
        userRoles.delete(userId);
      } else {
        userRoles.set(userId, filtered);
      }
    },

    check(userId: string, resource: string, action: string, checkTime: number): AccessCheckResult {
      const cycle = findCyclePath();
      if (cycle) {
        throw new RBACError(`Circular role inheritance detected: ${cycle.join(' -> ')}`);
      }
      
      const assignments = userRoles.get(userId) || [];
      const activeRoles = assignments
        .filter(a => isActive(a.startTime, a.endTime, checkTime))
        .map(a => a.roleId);
      
      if (activeRoles.length === 0) {
        return {
          allowed: false,
          reason: 'User has no active role assignments',
          matchedGrants: []
        };
      }
      
      const applicableGrants: PermissionGrant[] = [];
      const matchedGrantIds: string[] = [];
      
      for (const roleId of activeRoles) {
        const transitiveRoles = getTransitiveClosure(roleId);
        
        for (const role of transitiveRoles) {
          for (const [grantId, grant] of grants.entries()) {
            if (grant.roleId === role &&
                isActive(grant.startTime, grant.endTime, checkTime) &&
                matchesResourceAction(grant.resource, grant.action, resource, action)) {
              applicableGrants.push(grant);
              matchedGrantIds.push(grantId);
            }
          }
        }
      }
      
      if (applicableGrants.length === 0) {
        return {
          allowed: false,
          reason: 'No applicable grants found',
          matchedGrants: []
        };
      }
      
      const denyGrants = applicableGrants.filter(g => g.effect === 'deny');
      if (denyGrants.length > 0) {
        return {
          allowed: false,
          reason: 'Access denied by one or more deny grants',
          matchedGrants: matchedGrantIds
        };
      }
      
      const allowGrants = applicableGrants.filter(g => g.effect === 'allow');
      if (allowGrants.length > 0) {
        return {
          allowed: true,
          reason: 'Access allowed by one or more allow grants',
          matchedGrants: matchedGrantIds
        };
      }
      
      return {
        allowed: false,
        reason: 'No matching allow grants found',
        matchedGrants: []
      };
    },

    getEffectivePermissions(userId: string, atTime: number): any[] {
      const assignments = userRoles.get(userId) || [];
      const activeRoles = assignments
        .filter(a => isActive(a.startTime, a.endTime, atTime))
        .map(a => a.roleId);
      
      const seenGrantIds = new Set<string>();
      const permissions: any[] = [];
      
      for (const roleId of activeRoles) {
        const transitiveRoles = getTransitiveClosure(roleId);
        
        for (const role of transitiveRoles) {
          for (const