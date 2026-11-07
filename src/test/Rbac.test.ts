import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hasMinRole, requireOrgRole, OrgRole, ROLE_HIERARCHY } from '../middleware/rbac';

// Mock DB module for testing RBAC middleware and repository rules
vi.mock('../db/index', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import { db } from '../db/index';

describe('RBAC Role Hierarchy and Matrix', () => {
  it('correctly orders the 5 organizational roles by weight', () => {
    expect(ROLE_HIERARCHY.owner).toBe(50);
    expect(ROLE_HIERARCHY.admin).toBe(40);
    expect(ROLE_HIERARCHY.manager).toBe(30);
    expect(ROLE_HIERARCHY.member).toBe(20);
    expect(ROLE_HIERARCHY.viewer).toBe(10);

    expect(ROLE_HIERARCHY.owner).toBeGreaterThan(ROLE_HIERARCHY.admin);
    expect(ROLE_HIERARCHY.admin).toBeGreaterThan(ROLE_HIERARCHY.manager);
    expect(ROLE_HIERARCHY.manager).toBeGreaterThan(ROLE_HIERARCHY.member);
    expect(ROLE_HIERARCHY.member).toBeGreaterThan(ROLE_HIERARCHY.viewer);
  });

  it('evaluates hasMinRole accurately across all role combinations', () => {
    const roles: OrgRole[] = ['owner', 'admin', 'manager', 'member', 'viewer'];

    // Owner satisfies all minRoles
    roles.forEach(role => {
      expect(hasMinRole('owner', role)).toBe(true);
    });

    // Admin satisfies admin, manager, member, viewer, but NOT owner
    expect(hasMinRole('admin', 'owner')).toBe(false);
    expect(hasMinRole('admin', 'admin')).toBe(true);
    expect(hasMinRole('admin', 'manager')).toBe(true);
    expect(hasMinRole('admin', 'member')).toBe(true);
    expect(hasMinRole('admin', 'viewer')).toBe(true);

    // Manager satisfies manager, member, viewer, but NOT admin or owner
    expect(hasMinRole('manager', 'owner')).toBe(false);
    expect(hasMinRole('manager', 'admin')).toBe(false);
    expect(hasMinRole('manager', 'manager')).toBe(true);
    expect(hasMinRole('manager', 'member')).toBe(true);
    expect(hasMinRole('manager', 'viewer')).toBe(true);

    // Member satisfies member and viewer, but NOT manager, admin, or owner
    expect(hasMinRole('member', 'owner')).toBe(false);
    expect(hasMinRole('member', 'admin')).toBe(false);
    expect(hasMinRole('member', 'manager')).toBe(false);
    expect(hasMinRole('member', 'member')).toBe(true);
    expect(hasMinRole('member', 'viewer')).toBe(true);

    // Viewer only satisfies viewer
    expect(hasMinRole('viewer', 'owner')).toBe(false);
    expect(hasMinRole('viewer', 'admin')).toBe(false);
    expect(hasMinRole('viewer', 'manager')).toBe(false);
    expect(hasMinRole('viewer', 'member')).toBe(false);
    expect(hasMinRole('viewer', 'viewer')).toBe(true);
  });
});

describe('requireOrgRole Middleware Enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockReq = (options: {
    uid?: string;
    orgId?: string;
    method?: string;
    body?: any;
    params?: any;
    headers?: Record<string, string>;
  }) => {
    return {
      user: options.uid ? { uid: options.uid, email: 'test@menkir.studio' } : undefined,
      method: options.method || 'GET',
      headers: options.headers || (options.orgId ? { 'x-organization-id': options.orgId } : {}),
      params: options.params || {},
      body: options.body || {},
      query: {},
    } as any;
  };

  const createMockRes = () => {
    const res: any = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
  };

  it('rejects unauthenticated requests with 401 AUTH_REQUIRED', async () => {
    const middleware = requireOrgRole('viewer');
    const req = createMockReq({ uid: undefined });
    const res = createMockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'AUTH_REQUIRED' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects cross-organization access attempts with 403 CROSS_ORG_ACCESS_DENIED', async () => {
    const middleware = requireOrgRole('viewer');
    const req = createMockReq({ uid: 'user_attacker', orgId: 'org_victim_corp' });
    const res = createMockRes();
    const next = vi.fn();

    // Mock DB user lookup succeeds
    (db.select as any).mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          limit: vi.fn().mockResolvedValueOnce([{ id: 'db_user_1', uid: 'user_attacker', email: 'attacker@evil.com' }]),
        }),
      }),
    });

    // Mock DB membership query returns empty (user does NOT belong to org_victim_corp)
    (db.select as any).mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        innerJoin: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([]), // Not a member
          }),
        }),
      }),
    });

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'CROSS_ORG_ACCESS_DENIED',
        error: 'Access denied: You are not a member of this organization',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('blocks insufficient role privilege with 403 PERMISSION_DENIED', async () => {
    // Requires 'admin', but user is only 'member'
    const middleware = requireOrgRole('admin');
    const req = createMockReq({ uid: 'user_regular', orgId: 'org_test' });
    const res = createMockRes();
    const next = vi.fn();

    // Mock DB user lookup
    (db.select as any).mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          limit: vi.fn().mockResolvedValueOnce([{ id: 'db_user_2', uid: 'user_regular', email: 'member@test.com' }]),
        }),
      }),
    });

    // Mock DB membership query returns 'member' role
    (db.select as any).mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        innerJoin: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([
              { membershipId: 'mem_1', role: 'member', orgId: 'org_test', orgName: 'Test Org' },
            ]),
          }),
        }),
      }),
    });

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'PERMISSION_DENIED',
        requiredRole: 'admin',
        actualRole: 'member',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('blocks viewers from executing mutating HTTP methods with 403 VIEWER_READ_ONLY', async () => {
    const mutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];

    for (const method of mutatingMethods) {
      vi.clearAllMocks();
      const middleware = requireOrgRole('viewer');
      const req = createMockReq({ uid: 'user_viewer', orgId: 'org_test', method });
      const res = createMockRes();
      const next = vi.fn();

      // Mock DB user lookup
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([{ id: 'db_user_3', uid: 'user_viewer', email: 'viewer@test.com' }]),
          }),
        }),
      });

      // Mock DB membership query returns 'viewer' role
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          innerJoin: vi.fn().mockReturnValueOnce({
            where: vi.fn().mockReturnValueOnce({
              limit: vi.fn().mockResolvedValueOnce([
                { membershipId: 'mem_v', role: 'viewer', orgId: 'org_test', orgName: 'Test Org' },
              ]),
            }),
          }),
        }),
      });

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'VIEWER_READ_ONLY',
        })
      );
      expect(next).not.toHaveBeenCalled();
    }
  });

  it('allows viewers to perform read-only GET requests', async () => {
    const middleware = requireOrgRole('viewer');
    const req = createMockReq({ uid: 'user_viewer', orgId: 'org_test', method: 'GET' });
    const res = createMockRes();
    const next = vi.fn();

    // Mock DB user lookup
    (db.select as any).mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          limit: vi.fn().mockResolvedValueOnce([{ id: 'db_user_3', uid: 'user_viewer', email: 'viewer@test.com' }]),
        }),
      }),
    });

    // Mock DB membership query returns 'viewer' role
    (db.select as any).mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        innerJoin: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([
              { membershipId: 'mem_v', role: 'viewer', orgId: 'org_test', orgName: 'Test Org' },
            ]),
          }),
        }),
      }),
    });

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.orgMember).toEqual({
      userId: 'db_user_3',
      organizationId: 'org_test',
      role: 'viewer',
      userEmail: 'viewer@test.com',
      orgName: 'Test Org',
    });
  });

  it('allows authorized users to proceed and attaches orgMember context', async () => {
    const middleware = requireOrgRole('manager');
    const req = createMockReq({ uid: 'user_manager', orgId: 'org_test', method: 'POST' });
    const res = createMockRes();
    const next = vi.fn();

    // Mock DB user lookup
    (db.select as any).mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          limit: vi.fn().mockResolvedValueOnce([{ id: 'db_user_mgr', uid: 'user_manager', email: 'manager@test.com' }]),
        }),
      }),
    });

    // Mock DB membership query returns 'manager' role
    (db.select as any).mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        innerJoin: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([
              { membershipId: 'mem_m', role: 'manager', orgId: 'org_test', orgName: 'Test Org' },
            ]),
          }),
        }),
      }),
    });

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.orgMember).toEqual({
      userId: 'db_user_mgr',
      organizationId: 'org_test',
      role: 'manager',
      userEmail: 'manager@test.com',
      orgName: 'Test Org',
    });
  });
});

import { updateMemberRole, removeMember, createInvitation, acceptInvitation } from '../db/orgRepositories';

describe('Organization Membership & Invitation Security Invariants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prevents non-admins from updating member roles', async () => {
    await expect(
      updateMemberRole('org_1', 'mem_2', 'manager', 'member', 'user_1')
    ).rejects.toThrow('Permission denied: Only Admins or Owners can update member roles');
  });

  it('prevents admins (non-owners) from promoting someone to owner', async () => {
    await expect(
      updateMemberRole('org_1', 'mem_2', 'owner', 'admin', 'user_admin')
    ).rejects.toThrow('Permission denied: Only the current Owner can assign the Owner role');
  });

  it('prevents demoting the sole owner of an organization', async () => {
    // Mock target is owner
    (db.select as any).mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          limit: vi.fn().mockResolvedValueOnce([{ id: 'mem_owner', role: 'owner', userId: 'user_owner' }]),
        }),
      }),
    });

    // Mock count of owners returns 1
    (db.select as any).mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce([{ count: 1 }]),
      }),
    });

    await expect(
      updateMemberRole('org_1', 'mem_owner', 'admin', 'owner', 'user_owner')
    ).rejects.toThrow('Cannot demote the only owner. An organization must have at least one owner.');
  });

  it('prevents removing the sole owner of an organization', async () => {
    // Mock target is owner
    (db.select as any).mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          limit: vi.fn().mockResolvedValueOnce([{ id: 'mem_owner', role: 'owner', userId: 'user_owner' }]),
        }),
      }),
    });

    // Mock count of owners returns 1
    (db.select as any).mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce([{ count: 1 }]),
      }),
    });

    await expect(
      removeMember('org_1', 'mem_owner', 'owner', 'user_owner')
    ).rejects.toThrow('Cannot remove the only owner. Transfer ownership before leaving.');
  });

  it('prevents non-admins from creating invitations', async () => {
    await expect(
      createInvitation('org_1', 'guest@example.com', 'member', 'user_mem', 'member')
    ).rejects.toThrow('Permission denied: Only Admins or Owners can invite new members');
  });

  it('prevents non-owners from inviting new owners', async () => {
    await expect(
      createInvitation('org_1', 'newowner@example.com', 'owner', 'user_admin', 'admin')
    ).rejects.toThrow('Permission denied: Only the Owner can invite another Owner');
  });

  it('rejects invitation acceptance when token is expired', async () => {
    const pastDate = new Date(Date.now() - 1000 * 60 * 60 * 24); // 1 day ago
    (db.select as any).mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          limit: vi.fn().mockResolvedValueOnce([
            { id: 'inv_1', token: 'expired_token', expiresAt: pastDate, organizationId: 'org_1', role: 'member' },
          ]),
        }),
      }),
    });

    (db.update as any).mockReturnValueOnce({
      set: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce([]),
      }),
    });

    await expect(
      acceptInvitation('expired_token', 'user_new', 'guest@example.com')
    ).rejects.toThrow('Invitation has expired. Please request a new invite.');
  });
});

