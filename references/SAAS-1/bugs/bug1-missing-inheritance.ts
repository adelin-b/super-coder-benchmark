/**
 * BUG 1: missing_inheritance_chain
 * Only checks direct permissions, doesn't traverse inherits.
 */
export interface Role { name: string; permissions: string[]; inherits?: string[]; }
export interface User { id: string; roles: string[]; }
export interface Resource { name: string; requiredPermissions: string[]; }
export interface RBACSystem { addRole(r: Role): void; addUser(u: User): void; addResource(r: Resource): void; checkAccess(uid: string, res: string): boolean; getUserPermissions(uid: string): string[]; }
export class RBACError extends Error { constructor(m: string) { super(m); this.name = 'RBACError'; } }

export function createRBAC(): RBACSystem {
  const roles = new Map<string, Role>();
  const users = new Map<string, User>();
  const resources = new Map<string, Resource>();

  return {
    addRole(role) { roles.set(role.name, { ...role }); },
    addUser(user) { users.set(user.id, { ...user }); },
    addResource(resource) { resources.set(resource.name, { ...resource }); },
    checkAccess(userId, resourceName) {
      const user = users.get(userId);
      if (!user) return false;
      const resource = resources.get(resourceName);
      if (!resource) return false;
      if (resource.requiredPermissions.length === 0) return true;
      const perms = this.getUserPermissions(userId);
      return resource.requiredPermissions.every(p => perms.includes(p));
    },
    getUserPermissions(userId) {
      const user = users.get(userId);
      if (!user) return [];
      const allPerms = new Set<string>();
      for (const roleName of user.roles) {
        const role = roles.get(roleName);
        if (!role) continue;
        // BUG: only direct permissions, no inheritance traversal
        for (const p of role.permissions) allPerms.add(p);
      }
      return [...allPerms];
    },
  };
}
