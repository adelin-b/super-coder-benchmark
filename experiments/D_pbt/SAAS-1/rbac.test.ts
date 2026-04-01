import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createRBAC } from './rbac.js';

const arbPermission = fc.string({ minLength: 1, maxLength: 5 }).map(s => s.replace(/[^a-z]/g, 'a') || 'a');
const arbPermissions = fc.uniqueArray(arbPermission, { maxLength: 5 });

describe('SAAS-1: RBAC (Method D — PBT)', () => {
  it('PROPERTY: no roles → no permissions → no access', () => {
    fc.assert(fc.property(arbPermissions, (reqPerms) => {
      if (reqPerms.length === 0) return true; // skip empty requirements
      const rbac = createRBAC();
      rbac.addUser({ id: 'u', roles: [] });
      rbac.addResource({ name: 'r', requiredPermissions: reqPerms });
      return rbac.checkAccess('u', 'r') === false;
    }), { numRuns: 500 });
  });

  it('PROPERTY: user with all required permissions gets access', () => {
    fc.assert(fc.property(arbPermissions, (perms) => {
      if (perms.length === 0) return true;
      const rbac = createRBAC();
      rbac.addRole({ name: 'role', permissions: perms });
      rbac.addUser({ id: 'u', roles: ['role'] });
      rbac.addResource({ name: 'r', requiredPermissions: perms });
      return rbac.checkAccess('u', 'r') === true;
    }), { numRuns: 500 });
  });

  it('PROPERTY: missing any permission → no access', () => {
    fc.assert(fc.property(
      arbPermissions.filter(p => p.length >= 2),
      (perms) => {
        const rbac = createRBAC();
        // Give all permissions except the last one
        rbac.addRole({ name: 'role', permissions: perms.slice(0, -1) });
        rbac.addUser({ id: 'u', roles: ['role'] });
        rbac.addResource({ name: 'r', requiredPermissions: perms });
        return rbac.checkAccess('u', 'r') === false;
      },
    ), { numRuns: 500 });
  });

  it('PROPERTY: inheritance is transitive', () => {
    fc.assert(fc.property(
      arbPermission, arbPermission, arbPermission,
      (p1, p2, p3) => {
        const rbac = createRBAC();
        rbac.addRole({ name: 'base', permissions: [p1] });
        rbac.addRole({ name: 'mid', permissions: [p2], inherits: ['base'] });
        rbac.addRole({ name: 'top', permissions: [p3], inherits: ['mid'] });
        rbac.addUser({ id: 'u', roles: ['top'] });
        const perms = rbac.getUserPermissions('u');
        return perms.includes(p1) && perms.includes(p2) && perms.includes(p3);
      },
    ), { numRuns: 500 });
  });

  it('PROPERTY: empty-permission role grants nothing', () => {
    fc.assert(fc.property(arbPermissions.filter(p => p.length > 0), (reqPerms) => {
      const rbac = createRBAC();
      rbac.addRole({ name: 'empty', permissions: [] });
      rbac.addUser({ id: 'u', roles: ['empty'] });
      rbac.addResource({ name: 'r', requiredPermissions: reqPerms });
      return rbac.checkAccess('u', 'r') === false;
    }), { numRuns: 500 });
  });

  // Specific tests
  it('handles circular inheritance', () => {
    const rbac = createRBAC();
    rbac.addRole({ name: 'a', permissions: ['x'], inherits: ['b'] });
    rbac.addRole({ name: 'b', permissions: ['y'], inherits: ['a'] });
    rbac.addUser({ id: 'u', roles: ['a'] });
    rbac.addResource({ name: 'r', requiredPermissions: ['x', 'y'] });
    expect(rbac.checkAccess('u', 'r')).toBe(true);
  });

  it('case-sensitive', () => {
    const rbac = createRBAC();
    rbac.addRole({ name: 'r', permissions: ['Read'] });
    rbac.addUser({ id: 'u', roles: ['r'] });
    rbac.addResource({ name: 'res', requiredPermissions: ['read'] });
    expect(rbac.checkAccess('u', 'res')).toBe(false);
  });
});
