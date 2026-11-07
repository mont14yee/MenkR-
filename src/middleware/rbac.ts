import type { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.ts';
import { db } from '../db/index.ts';
import { users, organizations, memberships } from '../db/schema.ts';
import { eq, and } from 'drizzle-orm';

export type OrgRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer';

export const ROLE_HIERARCHY: Record<OrgRole, number> = {
  owner: 50,
  admin: 40,
  manager: 30,
  member: 20,
  viewer: 10,
};

export interface OrgAuthRequest extends AuthRequest {
  orgMember?: {
    userId: string;
    organizationId: string;
    role: OrgRole;
    userEmail: string;
    orgName: string;
  };
}

export function hasMinRole(userRole: OrgRole, requiredRole: OrgRole): boolean {
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[requiredRole] ?? 0);
}

export function requireOrgRole(minRole: OrgRole) {
  return async (req: OrgAuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !req.user.uid) {
        return res.status(401).json({ error: 'Unauthorized: Authentication required', code: 'AUTH_REQUIRED' });
      }

      // Determine organization ID from headers, query, or path params
      const orgId = 
        (req.headers['x-organization-id'] as string) || 
        req.params.orgId || 
        req.body?.organizationId || 
        (req.query?.organizationId as string);

      // Fetch user from PostgreSQL
      const userList = await db.select().from(users).where(eq(users.uid, req.user.uid)).limit(1);
      if (userList.length === 0) {
        return res.status(404).json({ error: 'User not registered in database', code: 'USER_NOT_FOUND' });
      }
      const dbUser = userList[0];

      // If no orgId is specified in request, retrieve the user's primary/first organization
      let targetOrgId = orgId;
      if (!targetOrgId) {
        const userMemberships = await db
          .select()
          .from(memberships)
          .where(eq(memberships.userId, dbUser.id))
          .limit(1);

        if (userMemberships.length === 0) {
          return res.status(403).json({ 
            error: 'User has no organization memberships', 
            code: 'NO_ORGANIZATION' 
          });
        }
        targetOrgId = userMemberships[0].organizationId;
      }

      // Verify membership and fetch role
      const memberList = await db
        .select({
          membershipId: memberships.id,
          role: memberships.role,
          orgId: organizations.id,
          orgName: organizations.name,
        })
        .from(memberships)
        .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
        .where(
          and(
            eq(memberships.organizationId, targetOrgId),
            eq(memberships.userId, dbUser.id)
          )
        )
        .limit(1);

      if (memberList.length === 0) {
        return res.status(403).json({
          error: 'Access denied: You are not a member of this organization',
          code: 'CROSS_ORG_ACCESS_DENIED',
        });
      }

      const userRole = memberList[0].role as OrgRole;

      // Check role hierarchy
      if (!hasMinRole(userRole, minRole)) {
        return res.status(403).json({
          error: `Permission denied: Insufficient permissions (requires ${minRole}, current role is ${userRole})`,
          code: 'PERMISSION_DENIED',
          requiredRole: minRole,
          actualRole: userRole,
        });
      }

      // Enforce read-only constraint for viewers on mutating HTTP methods
      if (userRole === 'viewer' && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        return res.status(403).json({
          error: 'Permission denied: Viewers have read-only access and cannot perform modifications',
          code: 'VIEWER_READ_ONLY',
        });
      }

      req.orgMember = {
        userId: dbUser.id,
        organizationId: targetOrgId,
        role: userRole,
        userEmail: dbUser.email,
        orgName: memberList[0].orgName,
      };

      next();
    } catch (err: any) {
      console.error('RBAC authorization error:', err);
      return res.status(500).json({ error: 'Internal authorization error', code: 'INTERNAL_ERROR' });
    }
  };
}
