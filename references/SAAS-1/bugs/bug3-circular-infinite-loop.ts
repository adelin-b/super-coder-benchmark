/**
 * BUG 3: circular_hierarchy_infinite_loop
 * No cycle detection — circular inheritance causes stack overflow.
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

  // BUG: no visited set for cycle detection
  function getEffectivePermissions(roleName: string): Set<string> {
    const role = roles.get(roleName);
    if (!role) return new Set();
    const perms = new Set(role.permissions);
    if (role.inherits) {
      for (const p of role.inherits) {
        for (const perm of getEffectivePermissions(p)) perms.add(perm); // BUG: infinite recursion on cycles
      }
    }
    return perms;
  }

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
        for (const p of getEffectivePermissions(roleName)) allPerms.add(p);
      }
      return [...allPerms];
    },
  };
}
