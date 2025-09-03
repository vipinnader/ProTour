import { Request, Response, NextFunction } from 'express';

export type Permission = string;
export type Role = string;

export interface AuthorizationContext {
  userId: string;
  role: Role;
  permissions: Permission[];
  organizationId?: string;
  tournamentId?: string;
  resourceId?: string;
  action: string;
}

export interface RoleDefinition {
  name: Role;
  description: string;
  permissions: Permission[];
  inherits?: Role[];
  isSystem: boolean;
  organizationScoped: boolean;
  tournamentScoped: boolean;
}

export interface ResourcePermission {
  resource: string;
  actions: string[];
  conditions?: {
    field: string;
    operator:
      | 'eq'
      | 'ne'
      | 'in'
      | 'nin'
      | 'gt'
      | 'gte'
      | 'lt'
      | 'lte'
      | 'exists';
    value: any;
  }[];
}

export interface PolicyRule {
  id: string;
  name: string;
  description: string;
  effect: 'allow' | 'deny';
  subjects: {
    users?: string[];
    roles?: Role[];
    groups?: string[];
  };
  resources: string[];
  actions: string[];
  conditions?: {
    field: string;
    operator: string;
    value: any;
  }[];
  priority: number;
  isActive: boolean;
}

export class RoleManager {
  private roles = new Map<Role, RoleDefinition>();
  private userRoles = new Map<string, Role[]>();
  private roleHierarchy = new Map<Role, Set<Role>>();

  constructor() {
    this.initializeSystemRoles();
  }

  private initializeSystemRoles(): void {
    const systemRoles: RoleDefinition[] = [
      {
        name: 'super_admin',
        description: 'System super administrator with full access',
        permissions: ['*'],
        isSystem: true,
        organizationScoped: false,
        tournamentScoped: false,
      },
      {
        name: 'org_admin',
        description: 'Organization administrator',
        permissions: [
          'org:read',
          'org:write',
          'org:delete',
          'tournament:create',
          'tournament:read',
          'tournament:write',
          'tournament:delete',
          'user:read',
          'user:write',
          'user:invite',
          'role:assign',
          'billing:read',
          'billing:write',
        ],
        isSystem: true,
        organizationScoped: true,
        tournamentScoped: false,
      },
      {
        name: 'tournament_admin',
        description: 'Tournament administrator',
        permissions: [
          'tournament:read',
          'tournament:write',
          'tournament:settings',
          'participant:read',
          'participant:write',
          'participant:delete',
          'match:create',
          'match:read',
          'match:write',
          'match:delete',
          'bracket:manage',
          'scoring:read',
          'scoring:write',
          'report:generate',
        ],
        isSystem: true,
        organizationScoped: true,
        tournamentScoped: true,
      },
      {
        name: 'tournament_organizer',
        description: 'Tournament organizer with limited admin rights',
        permissions: [
          'tournament:read',
          'tournament:settings:basic',
          'participant:read',
          'participant:write',
          'match:read',
          'match:write',
          'scoring:read',
          'scoring:write',
          'report:generate',
        ],
        inherits: [],
        isSystem: true,
        organizationScoped: true,
        tournamentScoped: true,
      },
      {
        name: 'referee',
        description: 'Match referee',
        permissions: [
          'match:read',
          'match:officiate',
          'scoring:read',
          'scoring:write',
          'participant:read',
        ],
        isSystem: true,
        organizationScoped: true,
        tournamentScoped: true,
      },
      {
        name: 'participant',
        description: 'Tournament participant',
        permissions: [
          'tournament:read',
          'participant:read:own',
          'match:read:own',
          'scoring:read:own',
          'profile:read',
          'profile:write',
        ],
        isSystem: true,
        organizationScoped: true,
        tournamentScoped: true,
      },
      {
        name: 'viewer',
        description: 'Read-only access to public tournament data',
        permissions: [
          'tournament:read:public',
          'match:read:public',
          'scoring:read:public',
          'bracket:read:public',
        ],
        isSystem: true,
        organizationScoped: false,
        tournamentScoped: false,
      },
    ];

    systemRoles.forEach(role => {
      this.roles.set(role.name, role);
      if (role.inherits) {
        this.roleHierarchy.set(role.name, new Set(role.inherits));
      }
    });
  }

  createRole(role: Omit<RoleDefinition, 'isSystem'>): void {
    const roleDefinition: RoleDefinition = {
      ...role,
      isSystem: false,
    };

    this.roles.set(role.name, roleDefinition);

    if (role.inherits) {
      this.roleHierarchy.set(role.name, new Set(role.inherits));
    }
  }

  updateRole(roleName: Role, updates: Partial<RoleDefinition>): void {
    const existing = this.roles.get(roleName);
    if (!existing) {
      throw new Error(`Role ${roleName} not found`);
    }

    if (existing.isSystem) {
      throw new Error(`Cannot modify system role ${roleName}`);
    }

    const updated = { ...existing, ...updates };
    this.roles.set(roleName, updated);

    if (updates.inherits) {
      this.roleHierarchy.set(roleName, new Set(updates.inherits));
    }
  }

  deleteRole(roleName: Role): void {
    const role = this.roles.get(roleName);
    if (!role) {
      throw new Error(`Role ${roleName} not found`);
    }

    if (role.isSystem) {
      throw new Error(`Cannot delete system role ${roleName}`);
    }

    this.roles.delete(roleName);
    this.roleHierarchy.delete(roleName);
  }

  assignRoleToUser(userId: string, role: Role): void {
    if (!this.roles.has(role)) {
      throw new Error(`Role ${role} does not exist`);
    }

    const userRoles = this.userRoles.get(userId) || [];
    if (!userRoles.includes(role)) {
      userRoles.push(role);
      this.userRoles.set(userId, userRoles);
    }
  }

  removeRoleFromUser(userId: string, role: Role): void {
    const userRoles = this.userRoles.get(userId);
    if (!userRoles) {
      return;
    }

    const filtered = userRoles.filter(r => r !== role);
    this.userRoles.set(userId, filtered);
  }

  getUserRoles(userId: string): Role[] {
    return this.userRoles.get(userId) || [];
  }

  getUserPermissions(userId: string): Permission[] {
    const roles = this.getUserRoles(userId);
    const permissions = new Set<Permission>();

    roles.forEach(roleName => {
      const role = this.roles.get(roleName);
      if (role) {
        role.permissions.forEach(permission => {
          permissions.add(permission);
        });

        // Add inherited permissions
        this.addInheritedPermissions(roleName, permissions);
      }
    });

    return Array.from(permissions);
  }

  private addInheritedPermissions(
    roleName: Role,
    permissions: Set<Permission>
  ): void {
    const inherited = this.roleHierarchy.get(roleName);
    if (!inherited) {
      return;
    }

    inherited.forEach(inheritedRole => {
      const role = this.roles.get(inheritedRole);
      if (role) {
        role.permissions.forEach(permission => {
          permissions.add(permission);
        });

        // Recursively add inherited permissions
        this.addInheritedPermissions(inheritedRole, permissions);
      }
    });
  }

  hasPermission(userId: string, permission: Permission): boolean {
    const userPermissions = this.getUserPermissions(userId);
    return (
      userPermissions.includes('*') || userPermissions.includes(permission)
    );
  }

  hasRole(userId: string, role: Role): boolean {
    const userRoles = this.getUserRoles(userId);
    return userRoles.includes(role);
  }

  getRoleDefinition(roleName: Role): RoleDefinition | undefined {
    return this.roles.get(roleName);
  }

  listRoles(): RoleDefinition[] {
    return Array.from(this.roles.values());
  }
}

export class PolicyManager {
  private policies = new Map<string, PolicyRule>();

  createPolicy(policy: PolicyRule): void {
    this.policies.set(policy.id, policy);
  }

  updatePolicy(policyId: string, updates: Partial<PolicyRule>): void {
    const existing = this.policies.get(policyId);
    if (!existing) {
      throw new Error(`Policy ${policyId} not found`);
    }

    const updated = { ...existing, ...updates };
    this.policies.set(policyId, updated);
  }

  deletePolicy(policyId: string): void {
    this.policies.delete(policyId);
  }

  evaluatePolicy(context: AuthorizationContext): boolean {
    const applicablePolicies = this.getApplicablePolicies(context);

    // Sort by priority (higher priority first)
    const sortedPolicies = applicablePolicies.sort(
      (a, b) => b.priority - a.priority
    );

    for (const policy of sortedPolicies) {
      if (this.matchesPolicy(context, policy)) {
        return policy.effect === 'allow';
      }
    }

    // Default deny if no policies match
    return false;
  }

  private getApplicablePolicies(context: AuthorizationContext): PolicyRule[] {
    return Array.from(this.policies.values()).filter(
      policy => policy.isActive && this.isPolicyApplicable(context, policy)
    );
  }

  private isPolicyApplicable(
    context: AuthorizationContext,
    policy: PolicyRule
  ): boolean {
    // Check if user matches subjects
    const matchesSubjects =
      !policy.subjects.users ||
      policy.subjects.users.includes(context.userId) ||
      !policy.subjects.roles ||
      policy.subjects.roles.some(role => context.role === role);

    // Check if resource matches
    const matchesResources =
      policy.resources.includes('*') ||
      policy.resources.some(resource =>
        this.matchesResource(context.resourceId || '', resource)
      );

    // Check if action matches
    const matchesActions =
      policy.actions.includes('*') || policy.actions.includes(context.action);

    return matchesSubjects && matchesResources && matchesActions;
  }

  private matchesPolicy(
    context: AuthorizationContext,
    policy: PolicyRule
  ): boolean {
    if (!policy.conditions) {
      return true;
    }

    return policy.conditions.every(condition => {
      const contextValue = this.getContextValue(context, condition.field);
      return this.evaluateCondition(
        contextValue,
        condition.operator,
        condition.value
      );
    });
  }

  private matchesResource(resourceId: string, pattern: string): boolean {
    if (pattern === '*') {
      return true;
    }

    // Simple wildcard matching
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return regex.test(resourceId);
  }

  private getContextValue(context: AuthorizationContext, field: string): any {
    const fieldMap: Record<string, any> = {
      userId: context.userId,
      role: context.role,
      organizationId: context.organizationId,
      tournamentId: context.tournamentId,
      resourceId: context.resourceId,
      action: context.action,
    };

    return fieldMap[field];
  }

  private evaluateCondition(
    value: any,
    operator: string,
    expected: any
  ): boolean {
    switch (operator) {
      case 'eq':
        return value === expected;
      case 'ne':
        return value !== expected;
      case 'in':
        return Array.isArray(expected) && expected.includes(value);
      case 'nin':
        return Array.isArray(expected) && !expected.includes(value);
      case 'gt':
        return value > expected;
      case 'gte':
        return value >= expected;
      case 'lt':
        return value < expected;
      case 'lte':
        return value <= expected;
      case 'exists':
        return value !== undefined && value !== null;
      default:
        return false;
    }
  }

  listPolicies(): PolicyRule[] {
    return Array.from(this.policies.values());
  }
}

export class AuthorizationManager {
  private roleManager: RoleManager;
  private policyManager: PolicyManager;

  constructor() {
    this.roleManager = new RoleManager();
    this.policyManager = new PolicyManager();
  }

  getRoleManager(): RoleManager {
    return this.roleManager;
  }

  getPolicyManager(): PolicyManager {
    return this.policyManager;
  }

  authorize(context: AuthorizationContext): boolean {
    // First check role-based permissions
    if (this.roleManager.hasPermission(context.userId, context.action)) {
      return true;
    }

    // Then check policy-based permissions
    return this.policyManager.evaluatePolicy(context);
  }

  can(
    userId: string,
    action: string,
    resource?: string,
    additionalContext?: any
  ): boolean {
    const userRoles = this.roleManager.getUserRoles(userId);
    const primaryRole = userRoles[0] || 'viewer';

    const context: AuthorizationContext = {
      userId,
      role: primaryRole,
      permissions: this.roleManager.getUserPermissions(userId),
      resourceId: resource,
      action,
      ...additionalContext,
    };

    return this.authorize(context);
  }
}

// Authorization middleware
export const authorize = (
  authManager: AuthorizationManager,
  requiredPermission: Permission
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const context: AuthorizationContext = {
      userId: user.userId,
      role: user.role,
      permissions: user.permissions || [],
      organizationId: user.organizationId,
      tournamentId: user.tournamentId,
      resourceId: req.params.id,
      action: requiredPermission,
    };

    if (!authManager.authorize(context)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

// Dynamic authorization middleware
export const authorizeResource = (
  authManager: AuthorizationManager,
  getAction: (req: Request) => string
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const action = getAction(req);
    const resourceId = req.params.id || req.body.id;

    const context: AuthorizationContext = {
      userId: user.userId,
      role: user.role,
      permissions: user.permissions || [],
      organizationId: user.organizationId,
      tournamentId: user.tournamentId,
      resourceId,
      action,
    };

    if (!authManager.authorize(context)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

export default {
  RoleManager,
  PolicyManager,
  AuthorizationManager,
  authorize,
  authorizeResource,
};
