/**
 * SAAS-1: RBAC Permission Check — Reference Implementation
 */

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

export class RBACError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RBACError';
  }
}

export function createRBAC(): RBACSystem {
  const roles = new Map<string, Role>();
  const users = new Map<string, User>();
  const resources = new Map<string, Resource>();

  function getEffectivePermissions(roleName: string, visited: Set<string> = new Set()): Set<string> {
    if (visited.has(roleName)) return new Set(); // cycle detection
    visited.add(roleName);

    const role = roles.get(roleName);
    if (!role) return new Set();

    const perms = new Set(role.permissions);

    if (role.inherits) {
      for (const parentName of role.inherits) {
        const parentPerms = getEffectivePermissions(parentName, visited);
        for (const p of parentPerms) {
          perms.add(p);
        }
      }
    }

    return perms;
  }

  return {
    addRole(role: Role): void {
      if (!role.name) throw new RBACError('Role must have a name');
      roles.set(role.name, { ...role });
    },

    addUser(user: User): void {
      if (!user.id) throw new RBACError('User must have an id');
      users.set(user.id, { ...user });
    },

    addResource(resource: Resource): void {
      if (!resource.name) throw new RBACError('Resource must have a name');
      resources.set(resource.name, { ...resource });
    },

    checkAccess(userId: string, resourceName: string): boolean {
      const user = users.get(userId);
      if (!user) return false;

      const resource = resources.get(resourceName);
      if (!resource) return false;

      if (resource.requiredPermissions.length === 0) return true;

      const userPerms = this.getUserPermissions(userId);
      return resource.requiredPermissions.every((p) => userPerms.includes(p));
    },

    getUserPermissions(userId: string): string[] {
      const user = users.get(userId);
      if (!user) return [];

      const allPerms = new Set<string>();
      for (const roleName of user.roles) {
        const rolePerms = getEffectivePermissions(roleName);
        for (const p of rolePerms) {
          allPerms.add(p);
        }
      }
      return [...allPerms];
    },
  };
}
