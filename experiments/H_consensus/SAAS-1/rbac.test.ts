import { describe, it, expect } from 'vitest';
import { createRBAC } from './rbac.js';

function setup() {
  const rbac = createRBAC();
  rbac.addRole({ name: 'viewer', permissions: ['read'] });
  rbac.addRole({ name: 'editor', permissions: ['write'], inherits: ['viewer'] });
  rbac.addRole({ name: 'admin', permissions: ['delete', 'manage'], inherits: ['editor'] });
  rbac.addRole({ name: 'empty', permissions: [] });
  rbac.addUser({ id: 'alice', roles: ['admin'] });
  rbac.addUser({ id: 'bob', roles: ['editor'] });
  rbac.addUser({ id: 'carol', roles: ['viewer'] });
  rbac.addUser({ id: 'dave', roles: [] });
  rbac.addUser({ id: 'eve', roles: ['empty'] });
  rbac.addResource({ name: 'doc', requiredPermissions: ['read'] });
  rbac.addResource({ name: 'edit', requiredPermissions: ['read', 'write'] });
  rbac.addResource({ name: 'admin-panel', requiredPermissions: ['read', 'write', 'delete'] });
  rbac.addResource({ name: 'public', requiredPermissions: [] });
  return rbac;
}

describe('SAAS-1: RBAC (Method A)', () => {
  it('admin accesses everything via inheritance', () => {
    const r = setup();
    expect(r.checkAccess('alice', 'doc')).toBe(true);
    expect(r.checkAccess('alice', 'edit')).toBe(true);
    expect(r.checkAccess('alice', 'admin-panel')).toBe(true);
  });
  it('editor inherits viewer read', () => {
    const r = setup();
    expect(r.checkAccess('bob', 'doc')).toBe(true);
    expect(r.checkAccess('bob', 'edit')).toBe(true);
    expect(r.checkAccess('bob', 'admin-panel')).toBe(false);
  });
  it('viewer can only read', () => {
    const r = setup();
    expect(r.checkAccess('carol', 'doc')).toBe(true);
    expect(r.checkAccess('carol', 'edit')).toBe(false);
  });
  it('no roles = no access', () => {
    const r = setup();
    expect(r.checkAccess('dave', 'doc')).toBe(false);
  });
  it('empty permission role = no access', () => {
    const r = setup();
    expect(r.checkAccess('eve', 'doc')).toBe(false);
  });
  it('public resource accessible to all', () => {
    const r = setup();
    expect(r.checkAccess('dave', 'public')).toBe(true);
  });
  it('unknown user/resource = no access', () => {
    const r = setup();
    expect(r.checkAccess('unknown', 'doc')).toBe(false);
    expect(r.checkAccess('alice', 'unknown')).toBe(false);
  });
  it('circular inheritance handled', () => {
    const r = createRBAC();
    r.addRole({ name: 'a', permissions: ['p1'], inherits: ['b'] });
    r.addRole({ name: 'b', permissions: ['p2'], inherits: ['a'] });
    r.addUser({ id: 'u', roles: ['a'] });
    r.addResource({ name: 'r', requiredPermissions: ['p1', 'p2'] });
    expect(r.checkAccess('u', 'r')).toBe(true);
  });
  it('getUserPermissions includes inherited', () => {
    const r = setup();
    const p = r.getUserPermissions('alice');
    expect(p).toContain('read');
    expect(p).toContain('write');
    expect(p).toContain('delete');
    expect(p).toContain('manage');
  });
  it('case-sensitive permissions', () => {
    const r = createRBAC();
    r.addRole({ name: 'r', permissions: ['Read'] });
    r.addUser({ id: 'u', roles: ['r'] });
    r.addResource({ name: 'res', requiredPermissions: ['read'] });
    expect(r.checkAccess('u', 'res')).toBe(false); // Read !== read
  });
});
