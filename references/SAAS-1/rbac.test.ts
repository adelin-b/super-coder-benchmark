import { describe, it, expect } from 'vitest';
import { createRBAC } from './rbac.js';

function setupBasicRBAC() {
  const rbac = createRBAC();
  rbac.addRole({ name: 'viewer', permissions: ['read'] });
  rbac.addRole({ name: 'editor', permissions: ['write'], inherits: ['viewer'] });
  rbac.addRole({ name: 'admin', permissions: ['delete', 'manage'], inherits: ['editor'] });
  rbac.addRole({ name: 'norole', permissions: [] });
  rbac.addUser({ id: 'alice', roles: ['admin'] });
  rbac.addUser({ id: 'bob', roles: ['editor'] });
  rbac.addUser({ id: 'carol', roles: ['viewer'] });
  rbac.addUser({ id: 'dave', roles: [] });
  rbac.addUser({ id: 'eve', roles: ['norole'] });
  rbac.addResource({ name: 'document', requiredPermissions: ['read'] });
  rbac.addResource({ name: 'editor-panel', requiredPermissions: ['read', 'write'] });
  rbac.addResource({ name: 'admin-panel', requiredPermissions: ['read', 'write', 'delete'] });
  rbac.addResource({ name: 'public', requiredPermissions: [] });
  return rbac;
}

describe('SAAS-1: RBAC Permission Check Reference', () => {
  it('admin can access everything', () => {
    const rbac = setupBasicRBAC();
    expect(rbac.checkAccess('alice', 'document')).toBe(true);
    expect(rbac.checkAccess('alice', 'editor-panel')).toBe(true);
    expect(rbac.checkAccess('alice', 'admin-panel')).toBe(true);
  });

  it('editor can read and write but not delete', () => {
    const rbac = setupBasicRBAC();
    expect(rbac.checkAccess('bob', 'document')).toBe(true);
    expect(rbac.checkAccess('bob', 'editor-panel')).toBe(true);
    expect(rbac.checkAccess('bob', 'admin-panel')).toBe(false);
  });

  it('viewer can only read', () => {
    const rbac = setupBasicRBAC();
    expect(rbac.checkAccess('carol', 'document')).toBe(true);
    expect(rbac.checkAccess('carol', 'editor-panel')).toBe(false);
    expect(rbac.checkAccess('carol', 'admin-panel')).toBe(false);
  });

  it('user with no roles has no access', () => {
    const rbac = setupBasicRBAC();
    expect(rbac.checkAccess('dave', 'document')).toBe(false);
    expect(rbac.checkAccess('dave', 'editor-panel')).toBe(false);
  });

  it('user with empty-permission role has no access', () => {
    const rbac = setupBasicRBAC();
    expect(rbac.checkAccess('eve', 'document')).toBe(false);
  });

  it('public resource accessible to all', () => {
    const rbac = setupBasicRBAC();
    expect(rbac.checkAccess('dave', 'public')).toBe(true);
    expect(rbac.checkAccess('carol', 'public')).toBe(true);
  });

  it('unknown user has no access', () => {
    const rbac = setupBasicRBAC();
    expect(rbac.checkAccess('unknown', 'document')).toBe(false);
  });

  it('unknown resource has no access', () => {
    const rbac = setupBasicRBAC();
    expect(rbac.checkAccess('alice', 'unknown')).toBe(false);
  });

  it('getUserPermissions returns inherited permissions', () => {
    const rbac = setupBasicRBAC();
    const adminPerms = rbac.getUserPermissions('alice');
    expect(adminPerms).toContain('read');
    expect(adminPerms).toContain('write');
    expect(adminPerms).toContain('delete');
    expect(adminPerms).toContain('manage');
  });

  it('handles circular inheritance without infinite loop', () => {
    const rbac = createRBAC();
    rbac.addRole({ name: 'a', permissions: ['p1'], inherits: ['b'] });
    rbac.addRole({ name: 'b', permissions: ['p2'], inherits: ['a'] });
    rbac.addUser({ id: 'user1', roles: ['a'] });
    rbac.addResource({ name: 'res', requiredPermissions: ['p1', 'p2'] });
    // Should not throw/hang
    expect(rbac.checkAccess('user1', 'res')).toBe(true);
  });

  // Invariant tests
  it('INV1: no permission = no access', () => {
    const rbac = setupBasicRBAC();
    expect(rbac.getUserPermissions('dave')).toEqual([]);
    expect(rbac.checkAccess('dave', 'document')).toBe(false);
  });

  it('INV3: adding a permission never removes access', () => {
    const rbac = setupBasicRBAC();
    expect(rbac.checkAccess('carol', 'document')).toBe(true);
    // Add more permissions to viewer
    rbac.addRole({ name: 'viewer', permissions: ['read', 'extra'] });
    expect(rbac.checkAccess('carol', 'document')).toBe(true); // still has access
  });

  it('INV4: effective permissions include transitive inheritance', () => {
    const rbac = setupBasicRBAC();
    const editorPerms = rbac.getUserPermissions('bob');
    expect(editorPerms).toContain('read');  // inherited from viewer
    expect(editorPerms).toContain('write'); // direct
  });

  // --- Hard edge cases ---

  it('deep transitive inheritance across 4 levels', () => {
    // level0 -> level1 -> level2 -> level3
    // Each level adds one permission. User at level3 should have all 4.
    const rbac = createRBAC();
    rbac.addRole({ name: 'level0', permissions: ['p0'] });
    rbac.addRole({ name: 'level1', permissions: ['p1'], inherits: ['level0'] });
    rbac.addRole({ name: 'level2', permissions: ['p2'], inherits: ['level1'] });
    rbac.addRole({ name: 'level3', permissions: ['p3'], inherits: ['level2'] });
    rbac.addUser({ id: 'u', roles: ['level3'] });
    rbac.addResource({ name: 'r', requiredPermissions: ['p0', 'p1', 'p2', 'p3'] });
    expect(rbac.checkAccess('u', 'r')).toBe(true);
    const perms = rbac.getUserPermissions('u');
    expect(perms).toContain('p0');
    expect(perms).toContain('p1');
    expect(perms).toContain('p2');
    expect(perms).toContain('p3');
  });

  it('user with multiple roles gets union of all permissions', () => {
    const rbac = createRBAC();
    rbac.addRole({ name: 'roleA', permissions: ['read'] });
    rbac.addRole({ name: 'roleB', permissions: ['write'] });
    rbac.addUser({ id: 'u', roles: ['roleA', 'roleB'] });
    rbac.addResource({ name: 'r', requiredPermissions: ['read', 'write'] });
    expect(rbac.checkAccess('u', 'r')).toBe(true);
  });

  it('permissions are case-sensitive', () => {
    const rbac = createRBAC();
    rbac.addRole({ name: 'r', permissions: ['Read'] }); // uppercase R
    rbac.addUser({ id: 'u', roles: ['r'] });
    rbac.addResource({ name: 'res', requiredPermissions: ['read'] }); // lowercase r
    // "Read" !== "read" -> no access
    expect(rbac.checkAccess('u', 'res')).toBe(false);
  });

  it('circular inheritance with 3 nodes collects all permissions', () => {
    // a -> b -> c -> a (triangle cycle)
    const rbac = createRBAC();
    rbac.addRole({ name: 'a', permissions: ['p1'], inherits: ['b'] });
    rbac.addRole({ name: 'b', permissions: ['p2'], inherits: ['c'] });
    rbac.addRole({ name: 'c', permissions: ['p3'], inherits: ['a'] });
    rbac.addUser({ id: 'u', roles: ['a'] });
    rbac.addResource({ name: 'r', requiredPermissions: ['p1', 'p2', 'p3'] });
    // Should not hang AND should collect all 3 permissions
    expect(rbac.checkAccess('u', 'r')).toBe(true);
  });

  it('role inheriting from non-existent role does not crash', () => {
    // A role references an inherits target that was never added.
    // Should not throw or hang — just ignore the missing parent.
    const rbac = createRBAC();
    rbac.addRole({ name: 'child', permissions: ['read'], inherits: ['ghost'] });
    rbac.addUser({ id: 'u', roles: ['child'] });
    rbac.addResource({ name: 'r', requiredPermissions: ['read'] });
    expect(rbac.checkAccess('u', 'r')).toBe(true);
    // Should only have 'read', not crash looking for 'ghost'
    const perms = rbac.getUserPermissions('u');
    expect(perms).toContain('read');
  });

  it('getUserPermissions returns no duplicates when same permission inherited multiple ways', () => {
    // Diamond inheritance: admin inherits from both managerA and managerB,
    // which both inherit from viewer (which has 'read').
    const rbac = createRBAC();
    rbac.addRole({ name: 'viewer', permissions: ['read'] });
    rbac.addRole({ name: 'managerA', permissions: ['write'], inherits: ['viewer'] });
    rbac.addRole({ name: 'managerB', permissions: ['delete'], inherits: ['viewer'] });
    rbac.addRole({ name: 'admin', permissions: ['manage'], inherits: ['managerA', 'managerB'] });
    rbac.addUser({ id: 'u', roles: ['admin'] });

    const perms = rbac.getUserPermissions('u');
    // 'read' should appear exactly once despite being reachable via two paths
    const readCount = perms.filter(p => p === 'read').length;
    expect(readCount).toBe(1);
    // All permissions present
    expect(perms).toContain('read');
    expect(perms).toContain('write');
    expect(perms).toContain('delete');
    expect(perms).toContain('manage');
  });

  it('user with empty-permission role accessing public resource succeeds', () => {
    // A user with a role that grants zero permissions should still access
    // a resource requiring zero permissions.
    const rbac = createRBAC();
    rbac.addRole({ name: 'noperms', permissions: [] });
    rbac.addUser({ id: 'u', roles: ['noperms'] });
    rbac.addResource({ name: 'public', requiredPermissions: [] });
    expect(rbac.checkAccess('u', 'public')).toBe(true);
    // But this user should NOT access anything requiring actual permissions
    rbac.addResource({ name: 'secret', requiredPermissions: ['read'] });
    expect(rbac.checkAccess('u', 'secret')).toBe(false);
  });

  it('re-adding a role updates permissions for existing users', () => {
    // addRole with same name should replace (or augment) the role definition.
    const rbac = createRBAC();
    rbac.addRole({ name: 'basic', permissions: ['read'] });
    rbac.addUser({ id: 'u', roles: ['basic'] });
    rbac.addResource({ name: 'r', requiredPermissions: ['read', 'write'] });
    expect(rbac.checkAccess('u', 'r')).toBe(false); // no 'write'

    // Re-add role with additional permission
    rbac.addRole({ name: 'basic', permissions: ['read', 'write'] });
    expect(rbac.checkAccess('u', 'r')).toBe(true); // now has 'write'
  });
});
