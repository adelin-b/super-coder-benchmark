# HARD-5: RBAC with Temporal Permissions

## Overview
Implement a role-based access control system where permissions are time-bounded. Roles can inherit from other roles, and individual permission grants can have start/end times. The system must handle deny rules, temporal overlaps, retroactive revocations, and the interaction between inherited and direct permissions.

## Exported API

```ts
export interface Role {
  id: string;
  name: string;
  inherits: string[];        // role IDs this role inherits from
}

export interface PermissionGrant {
  id: string;
  roleId: string;
  resource: string;          // e.g., 'document:123', 'api:/users'
  action: string;            // e.g., 'read', 'write', 'delete'
  effect: 'allow' | 'deny';
  startTime: number | null;  // null = effective immediately (epoch 0)
  endTime: number | null;    // null = never expires
}

export interface UserRoleAssignment {
  userId: string;
  roleId: string;
  startTime: number | null;
  endTime: number | null;
}

export interface AccessCheckResult {
  allowed: boolean;
  reason: string;            // human-readable explanation
  matchedGrants: string[];   // IDs of grants that contributed to the decision
}

export class RBACError extends Error {}

export function createRBAC(): {
  /** Create a role. Throws if ID already exists. */
  createRole(role: Role): void;

  /** Add a permission grant to a role. */
  addGrant(grant: PermissionGrant): void;

  /** Revoke (remove) a grant by ID. */
  revokeGrant(grantId: string): void;

  /** Assign a user to a role with optional time bounds. */
  assignRole(assignment: UserRoleAssignment): void;

  /** Remove a user from a role. */
  unassignRole(userId: string, roleId: string): void;

  /**
   * Check if a user can perform an action on a resource at a given time.
   * Resolution order:
   * 1. Collect all applicable grants (from direct roles + inherited roles).
   * 2. Filter to grants that are temporally active at checkTime.
   * 3. Filter to grants matching resource and action.
   * 4. If any DENY grant matches -> denied.
   * 5. If any ALLOW grant matches -> allowed.
   * 6. Default: denied.
   */
  check(userId: string, resource: string, action: string, checkTime: number): AccessCheckResult;

  /** Get all effective permissions for a user at a given time. */
  getEffectivePermissions(userId: string, atTime: number): {
    resource: string;
    action: string;
    effect: 'allow' | 'deny';
    grantId: string;
    viaRole: string;
  }[];

  /** Detect circular inheritance. Returns the cycle or null. */
  detectInheritanceCycle(): string[] | null;

  /** Get all roles a user has (direct + inherited) at a given time. */
  getUserRoles(userId: string, atTime: number): string[];
};
```

## Detailed Requirements

### Role Inheritance
- Roles can inherit from other roles, forming a DAG.
- Inheritance is transitive: if A inherits B, and B inherits C, then A has all of C's grants.
- Circular inheritance is an error. `createRole` should NOT throw on circular inheritance (it might be created incrementally). Instead, `detectInheritanceCycle` checks, and `check` must call it and throw `RBACError` if cycles exist.

### Temporal Rules
A grant is "active" at time T if:
- `startTime` is null or `startTime <= T`, AND
- `endTime` is null or `endTime > T` (exclusive end).

A user-role assignment is "active" at time T using the same rules.

### Access Check Resolution
1. Find all roles the user is assigned to that are active at `checkTime`.
2. For each role, collect that role's grants AND all inherited roles' grants (recursively).
3. Filter grants to those that:
   - Match the requested `resource` (exact string match), AND
   - Match the requested `action` (exact string match), AND
   - Are active at `checkTime`.
4. **Deny takes precedence**: if ANY matching grant has `effect: 'deny'`, access is denied.
5. If no deny and at least one `effect: 'allow'`, access is allowed.
6. If no matching grants at all, access is denied (default deny).

### Wildcard Resource Matching
In addition to exact matching, the resource `'*'` in a grant matches ANY resource. Similarly, action `'*'` matches any action.

Specificity rule: if there's a deny on `'*'` and an allow on `'document:123'`, the specific allow does NOT override the wildcard deny. **Deny always wins regardless of specificity.**

### Retroactive Revocation
`revokeGrant(grantId)` removes the grant entirely. Any future `check` calls (even for times in the past) will not see this grant. This models "we discovered the grant was issued in error."

### Grant ID Uniqueness
Grant IDs must be unique. Attempting to add a grant with a duplicate ID throws `RBACError`.

### Validation
- Role IDs must be non-empty and unique.
- Role `inherits` must reference existing role IDs at the time of creation.
- Grant `roleId` must reference an existing role.
- Grant `startTime` must be < `endTime` if both are non-null.
- User-role assignment `roleId` must reference an existing role.
- Throw `RBACError` on validation failures.

### Edge Cases
- A user with no role assignments: always denied.
- A user whose role assignment has expired: denied (no active roles).
- A grant that starts in the future: not active now, but will be later.
- Multiple grants for the same resource/action from different roles: merge them.
- An inherited deny overrides a direct allow.
- Revoking a grant that's the only allow: next check returns denied.
- `getEffectivePermissions` returns all active grants, both allow and deny, with deduplication by grant ID.

## Invariants
1. Deny always beats allow for the same resource/action/time.
2. A user with no active role assignments has no permissions.
3. Revoking a grant removes it from all future checks (including retroactive).
4. Role inheritance is transitive: if A inherits B inherits C, A has C's grants.
5. `getUserRoles` returns the transitive closure of active role assignments.
6. `getEffectivePermissions` is consistent with `check` (if a resource/action appears as 'allow' with no 'deny', check returns allowed).
