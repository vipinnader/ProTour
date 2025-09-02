import { Request, Response, NextFunction } from 'express';
import { AuthorizationManager, RoleManager, PolicyManager } from './authorization';

export interface RBACConfig {
  organizationHierarchy: boolean;
  tournamentHierarchy: boolean;
  resourceInheritance: boolean;
  cacheTTL: number;
  auditEnabled: boolean;
}

export interface AccessRequest {
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  context?: {
    organizationId?: string;
    tournamentId?: string;
    ownerId?: string;
    metadata?: Record<string, any>;
  };
}

export interface AccessResult {
  allowed: boolean;
  reason: string;
  appliedRules: string[];
  cacheable: boolean;
  expiresAt?: Date;
}

export interface ResourceDefinition {
  type: string;
  actions: string[];
  ownershipField?: string;
  hierarchical: boolean;
  parent?: string;
  allowedOperations: {
    create: string[];
    read: string[];
    update: string[];
    delete: string[];
  };
}

export interface ContextualRule {
  id: string;
  name: string;
  resource: string;
  action: string;
  condition: (context: AccessRequest['context']) => boolean;
  effect: 'allow' | 'deny';
  priority: number;
}

export class RBACManager {
  private authManager: AuthorizationManager;
  private config: RBACConfig;
  private accessCache = new Map<string, { result: AccessResult; expiresAt: Date }>();
  private resources = new Map<string, ResourceDefinition>();
  private contextualRules: ContextualRule[] = [];

  constructor(config: Partial<RBACConfig> = {}) {
    this.config = {
      organizationHierarchy: true,
      tournamentHierarchy: true,
      resourceInheritance: true,
      cacheTTL: 5 * 60 * 1000, // 5 minutes
      auditEnabled: true,
      ...config,
    };

    this.authManager = new AuthorizationManager();
    this.initializeResources();
    this.initializeContextualRules();
  }

  private initializeResources(): void {
    const resources: ResourceDefinition[] = [
      // Organization resources
      {
        type: 'organization',
        actions: ['create', 'read', 'update', 'delete', 'manage_users', 'manage_billing'],
        ownershipField: 'ownerId',
        hierarchical: false,
        allowedOperations: {
          create: ['super_admin'],
          read: ['org_admin', 'tournament_admin', 'tournament_organizer'],
          update: ['org_admin'],
          delete: ['super_admin'],
        },
      },

      // Tournament resources
      {
        type: 'tournament',
        actions: ['create', 'read', 'update', 'delete', 'publish', 'manage_participants', 'manage_brackets', 'manage_scoring'],
        ownershipField: 'organizerId',
        hierarchical: true,
        parent: 'organization',
        allowedOperations: {
          create: ['org_admin', 'tournament_admin'],
          read: ['org_admin', 'tournament_admin', 'tournament_organizer', 'participant', 'viewer'],
          update: ['org_admin', 'tournament_admin', 'tournament_organizer'],
          delete: ['org_admin', 'tournament_admin'],
        },
      },

      // Participant resources
      {
        type: 'participant',
        actions: ['create', 'read', 'update', 'delete', 'register', 'withdraw'],
        ownershipField: 'userId',
        hierarchical: true,
        parent: 'tournament',
        allowedOperations: {
          create: ['org_admin', 'tournament_admin', 'tournament_organizer'],
          read: ['org_admin', 'tournament_admin', 'tournament_organizer', 'participant', 'viewer'],
          update: ['org_admin', 'tournament_admin', 'tournament_organizer'],
          delete: ['org_admin', 'tournament_admin', 'tournament_organizer'],
        },
      },

      // Match resources
      {
        type: 'match',
        actions: ['create', 'read', 'update', 'delete', 'score', 'officiate'],
        hierarchical: true,
        parent: 'tournament',
        allowedOperations: {
          create: ['org_admin', 'tournament_admin', 'tournament_organizer'],
          read: ['org_admin', 'tournament_admin', 'tournament_organizer', 'participant', 'referee', 'viewer'],
          update: ['org_admin', 'tournament_admin', 'tournament_organizer', 'referee'],
          delete: ['org_admin', 'tournament_admin'],
        },
      },

      // User profile resources
      {
        type: 'user_profile',
        actions: ['read', 'update', 'delete'],
        ownershipField: 'userId',
        hierarchical: false,
        allowedOperations: {
          create: ['super_admin', 'org_admin'],
          read: ['super_admin', 'org_admin', 'tournament_admin', 'self'],
          update: ['super_admin', 'org_admin', 'self'],
          delete: ['super_admin', 'org_admin'],
        },
      },

      // Payment resources
      {
        type: 'payment',
        actions: ['create', 'read', 'process', 'refund'],
        ownershipField: 'userId',
        hierarchical: true,
        parent: 'tournament',
        allowedOperations: {
          create: ['org_admin', 'tournament_admin', 'participant'],
          read: ['org_admin', 'tournament_admin', 'self'],
          update: ['org_admin', 'tournament_admin'],
          delete: ['org_admin'],
        },
      },

      // Report resources
      {
        type: 'report',
        actions: ['create', 'read', 'export'],
        hierarchical: true,
        parent: 'tournament',
        allowedOperations: {
          create: ['org_admin', 'tournament_admin', 'tournament_organizer'],
          read: ['org_admin', 'tournament_admin', 'tournament_organizer'],
          update: ['org_admin', 'tournament_admin'],
          delete: ['org_admin', 'tournament_admin'],
        },
      },
    ];

    resources.forEach(resource => {
      this.resources.set(resource.type, resource);
    });
  }

  private initializeContextualRules(): void {
    this.contextualRules = [
      // Tournament visibility rule
      {
        id: 'tournament_visibility',
        name: 'Tournament Visibility Check',
        resource: 'tournament',
        action: 'read',
        condition: (context) => {
          // Allow if tournament is public or user is part of the organization
          return context?.metadata?.isPublic === true || !!context?.organizationId;
        },
        effect: 'allow',
        priority: 100,
      },

      // Self-access rule for profiles
      {
        id: 'self_profile_access',
        name: 'Self Profile Access',
        resource: 'user_profile',
        action: '*',
        condition: (context) => {
          return context?.ownerId === context?.metadata?.requestingUserId;
        },
        effect: 'allow',
        priority: 200,
      },

      // Participant access to own data
      {
        id: 'participant_own_data',
        name: 'Participant Own Data Access',
        resource: 'participant',
        action: 'read',
        condition: (context) => {
          return context?.ownerId === context?.metadata?.requestingUserId;
        },
        effect: 'allow',
        priority: 150,
      },

      // Time-based tournament access
      {
        id: 'tournament_time_based',
        name: 'Tournament Time-based Access',
        resource: 'tournament',
        action: 'update',
        condition: (context) => {
          const now = new Date();
          const startDate = context?.metadata?.startDate ? new Date(context.metadata.startDate) : null;
          // Don't allow updates to started tournaments unless super admin
          return !startDate || startDate > now;
        },
        effect: 'deny',
        priority: 50,
      },

      // Payment processing rule
      {
        id: 'payment_processing',
        name: 'Payment Processing Rule',
        resource: 'payment',
        action: 'process',
        condition: (context) => {
          // Only allow payment processing during registration period
          const now = new Date();
          const regDeadline = context?.metadata?.registrationDeadline ? 
            new Date(context.metadata.registrationDeadline) : null;
          return !regDeadline || now <= regDeadline;
        },
        effect: 'allow',
        priority: 75,
      },
    ];
  }

  async checkAccess(request: AccessRequest): Promise<AccessResult> {
    const cacheKey = this.generateCacheKey(request);
    
    // Check cache first
    const cached = this.accessCache.get(cacheKey);
    if (cached && cached.expiresAt > new Date()) {
      return cached.result;
    }

    const result = await this.evaluateAccess(request);
    
    // Cache the result if cacheable
    if (result.cacheable) {
      const expiresAt = new Date(Date.now() + this.config.cacheTTL);
      this.accessCache.set(cacheKey, { result, expiresAt });
    }

    return result;
  }

  private async evaluateAccess(request: AccessRequest): Promise<AccessResult> {
    const appliedRules: string[] = [];
    
    try {
      // 1. Check resource existence and definition
      const resourceDef = this.resources.get(request.resource);
      if (!resourceDef) {
        return {
          allowed: false,
          reason: `Unknown resource type: ${request.resource}`,
          appliedRules,
          cacheable: false,
        };
      }

      // 2. Check if action is valid for resource
      if (!resourceDef.actions.includes(request.action) && request.action !== '*') {
        return {
          allowed: false,
          reason: `Invalid action ${request.action} for resource ${request.resource}`,
          appliedRules,
          cacheable: true,
        };
      }

      // 3. Apply contextual rules first (they have higher priority)
      const contextualResult = this.applyContextualRules(request, appliedRules);
      if (contextualResult !== null) {
        return contextualResult;
      }

      // 4. Check role-based permissions
      const roleResult = await this.checkRoleBasedAccess(request, appliedRules);
      if (roleResult !== null) {
        return roleResult;
      }

      // 5. Check ownership if applicable
      const ownershipResult = this.checkOwnership(request, resourceDef, appliedRules);
      if (ownershipResult !== null) {
        return ownershipResult;
      }

      // 6. Check hierarchical permissions
      if (this.config.resourceInheritance && resourceDef.hierarchical) {
        const hierarchyResult = await this.checkHierarchicalAccess(request, resourceDef, appliedRules);
        if (hierarchyResult !== null) {
          return hierarchyResult;
        }
      }

      // 7. Default deny
      return {
        allowed: false,
        reason: 'Access denied by default policy',
        appliedRules: [...appliedRules, 'default_deny'],
        cacheable: true,
      };

    } catch (error) {
      return {
        allowed: false,
        reason: `Access evaluation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        appliedRules,
        cacheable: false,
      };
    }
  }

  private applyContextualRules(request: AccessRequest, appliedRules: string[]): AccessResult | null {
    // Sort rules by priority (higher first)
    const sortedRules = this.contextualRules
      .filter(rule => 
        rule.resource === request.resource && 
        (rule.action === request.action || rule.action === '*')
      )
      .sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      try {
        const conditionMet = rule.condition(request.context);
        appliedRules.push(rule.id);
        
        if (conditionMet) {
          return {
            allowed: rule.effect === 'allow',
            reason: `Contextual rule: ${rule.name}`,
            appliedRules: [...appliedRules],
            cacheable: true,
          };
        }
      } catch (error) {
        console.error(`Error evaluating contextual rule ${rule.id}:`, error);
      }
    }

    return null;
  }

  private async checkRoleBasedAccess(request: AccessRequest, appliedRules: string[]): Promise<AccessResult | null> {
    const userRoles = this.authManager.getRoleManager().getUserRoles(request.userId);
    const resourceDef = this.resources.get(request.resource)!;
    
    appliedRules.push('role_based_check');

    // Map action to operation category
    const operationMap: Record<string, keyof ResourceDefinition['allowedOperations']> = {
      create: 'create',
      read: 'read',
      update: 'update',
      delete: 'delete',
    };

    const operation = operationMap[request.action];
    if (!operation) {
      return null; // Let other checks handle non-standard actions
    }

    const allowedRoles = resourceDef.allowedOperations[operation];
    const hasRequiredRole = userRoles.some(role => allowedRoles.includes(role));

    if (hasRequiredRole) {
      return {
        allowed: true,
        reason: `Role-based access granted for roles: ${userRoles.join(', ')}`,
        appliedRules: [...appliedRules],
        cacheable: true,
      };
    }

    return null;
  }

  private checkOwnership(
    request: AccessRequest, 
    resourceDef: ResourceDefinition, 
    appliedRules: string[]
  ): AccessResult | null {
    if (!resourceDef.ownershipField || !request.context?.ownerId) {
      return null;
    }

    appliedRules.push('ownership_check');

    // Check if user owns the resource
    if (request.context.ownerId === request.userId) {
      return {
        allowed: true,
        reason: 'Resource ownership granted',
        appliedRules: [...appliedRules],
        cacheable: true,
      };
    }

    return null;
  }

  private async checkHierarchicalAccess(
    request: AccessRequest,
    resourceDef: ResourceDefinition,
    appliedRules: string[]
  ): Promise<AccessResult | null> {
    if (!resourceDef.parent) {
      return null;
    }

    appliedRules.push('hierarchical_check');

    // Check access to parent resource
    const parentRequest: AccessRequest = {
      ...request,
      resource: resourceDef.parent,
      action: 'read', // Use read permission for hierarchy check
    };

    const parentResult = await this.evaluateAccess(parentRequest);
    
    if (parentResult.allowed) {
      return {
        allowed: true,
        reason: `Hierarchical access through parent resource: ${resourceDef.parent}`,
        appliedRules: [...appliedRules, ...parentResult.appliedRules],
        cacheable: true,
      };
    }

    return null;
  }

  private generateCacheKey(request: AccessRequest): string {
    const contextStr = request.context ? JSON.stringify(request.context) : '';
    return `${request.userId}:${request.action}:${request.resource}:${request.resourceId || ''}:${contextStr}`;
  }

  // Middleware factory
  requirePermission(action: string, resource?: string, options: {
    getResourceId?: (req: Request) => string;
    getContext?: (req: Request) => AccessRequest['context'];
  } = {}) {
    return async (req: Request, res: Response, next: NextFunction) => {
      const user = (req as any).user;
      
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const resourceType = resource || req.route?.path.split('/')[1] || 'unknown';
      const resourceId = options.getResourceId ? options.getResourceId(req) : req.params.id;
      const context = options.getContext ? options.getContext(req) : {
        organizationId: user.organizationId,
        tournamentId: user.tournamentId,
        requestingUserId: user.userId,
      };

      const request: AccessRequest = {
        userId: user.userId,
        action,
        resource: resourceType,
        resourceId,
        context,
      };

      try {
        const result = await this.checkAccess(request);
        
        if (!result.allowed) {
          return res.status(403).json({ 
            error: 'Access denied', 
            reason: result.reason 
          });
        }

        // Add access info to request for audit logging
        (req as any).accessInfo = {
          result,
          appliedRules: result.appliedRules,
        };

        next();
      } catch (error) {
        console.error('RBAC middleware error:', error);
        return res.status(500).json({ error: 'Access control error' });
      }
    };
  }

  // Utility methods
  getUserPermissions(userId: string): string[] {
    return this.authManager.getRoleManager().getUserPermissions(userId);
  }

  assignRole(userId: string, role: string): void {
    this.authManager.getRoleManager().assignRoleToUser(userId, role);
    this.clearUserCache(userId);
  }

  removeRole(userId: string, role: string): void {
    this.authManager.getRoleManager().removeRoleFromUser(userId, role);
    this.clearUserCache(userId);
  }

  addContextualRule(rule: ContextualRule): void {
    this.contextualRules.push(rule);
    this.contextualRules.sort((a, b) => b.priority - a.priority);
    this.clearAllCache();
  }

  removeContextualRule(ruleId: string): void {
    this.contextualRules = this.contextualRules.filter(rule => rule.id !== ruleId);
    this.clearAllCache();
  }

  private clearUserCache(userId: string): void {
    for (const key of this.accessCache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        this.accessCache.delete(key);
      }
    }
  }

  private clearAllCache(): void {
    this.accessCache.clear();
  }

  getStats(): {
    cacheSize: number;
    cacheHitRate: number;
    rulesCount: number;
    resourcesCount: number;
  } {
    return {
      cacheSize: this.accessCache.size,
      cacheHitRate: 0, // Would need to track hits vs misses
      rulesCount: this.contextualRules.length,
      resourcesCount: this.resources.size,
    };
  }
}

export default RBACManager;