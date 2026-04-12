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
});
