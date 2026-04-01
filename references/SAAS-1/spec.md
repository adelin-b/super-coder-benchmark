# SAAS-1: Permission Check (RBAC)

## Spec

Role-based access control system. Users have roles, roles have permissions, resources require permissions. Check if user can access resource. Handle role hierarchy (admin inherits all).

## Interface

```typescript
interface Role {
  name: string;
  permissions: string[];
  inherits?: string[]; // roles this role inherits from
}

interface User {
  id: string;
  roles: string[];
}

interface Resource {
  name: string;
  requiredPermissions: string[];
}

interface RBACSystem {
  addRole(role: Role): void;
  addUser(user: User): void;
  addResource(resource: Resource): void;
  checkAccess(userId: string, resourceName: string): boolean;
  getUserPermissions(userId: string): string[];
}

function createRBAC(): RBACSystem;
```

## Constraints

- Role hierarchy can be multi-level (admin → manager → viewer)
- Circular inheritance must be detected and handled (not infinite loop)
- A user with NO roles has NO permissions
- All required permissions must be satisfied (AND logic)
- Permission names are case-sensitive strings

## Invariants

1. No permission = no access (user with no roles can never access anything)
2. Admin always has access (if admin role has all permissions or inherits all)
3. Adding a permission never removes access (monotonic: more permissions = more access)
4. A role's effective permissions include all inherited permissions transitively

## Known Bugs to Seed

1. **missing_inheritance_chain**: Only check direct role permissions, not inherited — misses transitive permissions
2. **deny_overridden_by_allow**: N/A for this simple model, replaced with: empty role grants access (empty permissions array on role = wildcard)
3. **empty_role_grants_access**: A role with `permissions: []` should grant NO permissions, but bug treats it as "grant all"
4. **circular_hierarchy_infinite_loop**: No cycle detection in inheritance traversal → stack overflow
