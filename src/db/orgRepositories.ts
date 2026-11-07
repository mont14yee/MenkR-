import { eq, and, sql } from 'drizzle-orm';
import { db } from './index.ts';
import { users, organizations, memberships, invitations } from './schema.ts';
import { recordAuditEvent } from './repositories.ts';
import { type OrgRole, hasMinRole } from '../middleware/rbac.ts';
import crypto from 'crypto';

export async function listUserOrganizations(userId: string) {
  const orgs = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      currency: organizations.currency,
      settings: organizations.settings,
      role: memberships.role,
      joinedAt: memberships.createdAt,
    })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
    .where(eq(memberships.userId, userId));

  return orgs;
}

export async function createOrganization(userId: string, name: string, currency = 'USD') {
  const slug = `org-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString(36)}`;
  
  const [org] = await db.insert(organizations).values({
    name,
    slug,
    currency,
  }).returning();

  const [membership] = await db.insert(memberships).values({
    organizationId: org.id,
    userId,
    role: 'owner',
  }).returning();

  await recordAuditEvent(
    org.id,
    userId,
    'organization.created',
    'organization',
    org.id,
    { name, currency }
  );

  return { ...org, role: membership.role };
}

export async function updateOrganization(
  orgId: string,
  userId: string,
  data: { name?: string; currency?: string; settings?: any }
) {
  const updateData: Record<string, any> = { updatedAt: new Date() };
  if (data.name) updateData.name = data.name;
  if (data.currency) updateData.currency = data.currency;
  if (data.settings) updateData.settings = data.settings;

  const [updatedOrg] = await db
    .update(organizations)
    .set(updateData)
    .where(eq(organizations.id, orgId))
    .returning();

  await recordAuditEvent(
    orgId,
    userId,
    'organization.updated',
    'organization',
    orgId,
    data
  );

  return updatedOrg;
}

export async function listOrganizationMembers(orgId: string) {
  const members = await db
    .select({
      membershipId: memberships.id,
      role: memberships.role,
      joinedAt: memberships.createdAt,
      userId: users.id,
      email: users.email,
      name: users.name,
      avatarSeed: users.avatarSeed,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.organizationId, orgId));

  return members;
}

export async function updateMemberRole(
  orgId: string,
  targetMembershipId: string,
  newRole: OrgRole,
  operatorRole: OrgRole,
  operatorUserId: string
) {
  // 1. Only admins and owners can update roles
  if (!hasMinRole(operatorRole, 'admin')) {
    throw new Error('Permission denied: Only Admins or Owners can update member roles');
  }

  // 2. Only owners can assign or reassign 'owner' role
  if (newRole === 'owner' && operatorRole !== 'owner') {
    throw new Error('Permission denied: Only the current Owner can assign the Owner role');
  }

  // 3. Find target membership
  const [targetMember] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.id, targetMembershipId), eq(memberships.organizationId, orgId)))
    .limit(1);

  if (!targetMember) {
    throw new Error('Member not found in organization');
  }

  // 4. If demoting an owner, verify there is at least one other owner
  if (targetMember.role === 'owner' && newRole !== 'owner') {
    const ownerCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(memberships)
      .where(and(eq(memberships.organizationId, orgId), eq(memberships.role, 'owner')));

    if (Number(ownerCount[0]?.count || 0) <= 1) {
      throw new Error('Cannot demote the only owner. An organization must have at least one owner.');
    }
  }

  const [updated] = await db
    .update(memberships)
    .set({ role: newRole })
    .where(eq(memberships.id, targetMembershipId))
    .returning();

  await recordAuditEvent(
    orgId,
    operatorUserId,
    'membership.role_updated',
    'membership',
    targetMembershipId,
    { targetUserId: targetMember.userId, previousRole: targetMember.role, newRole }
  );

  return updated;
}

export async function removeMember(
  orgId: string,
  targetMembershipId: string,
  operatorRole: OrgRole,
  operatorUserId: string
) {
  if (!hasMinRole(operatorRole, 'admin')) {
    throw new Error('Permission denied: Only Admins or Owners can remove members');
  }

  const [targetMember] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.id, targetMembershipId), eq(memberships.organizationId, orgId)))
    .limit(1);

  if (!targetMember) {
    throw new Error('Member not found in organization');
  }

  // Cannot remove the only owner
  if (targetMember.role === 'owner') {
    const ownerCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(memberships)
      .where(and(eq(memberships.organizationId, orgId), eq(memberships.role, 'owner')));

    if (Number(ownerCount[0]?.count || 0) <= 1) {
      throw new Error('Cannot remove the only owner. Transfer ownership before leaving.');
    }
  }

  await db.delete(memberships).where(eq(memberships.id, targetMembershipId));

  await recordAuditEvent(
    orgId,
    operatorUserId,
    'membership.removed',
    'membership',
    targetMembershipId,
    { targetUserId: targetMember.userId, role: targetMember.role }
  );

  return { success: true };
}

export async function createInvitation(
  orgId: string,
  email: string,
  role: OrgRole,
  invitedById: string,
  operatorRole: OrgRole
) {
  if (!hasMinRole(operatorRole, 'admin')) {
    throw new Error('Permission denied: Only Admins or Owners can invite new members');
  }

  if (role === 'owner' && operatorRole !== 'owner') {
    throw new Error('Permission denied: Only the Owner can invite another Owner');
  }

  const cleanEmail = email.trim().toLowerCase();

  // Check if user is already an active member
  const existingMember = await db
    .select()
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.organizationId, orgId), eq(users.email, cleanEmail)))
    .limit(1);

  if (existingMember.length > 0) {
    throw new Error('User is already a member of this organization');
  }

  // Check for existing pending invitation
  const existingInvite = await db
    .select()
    .from(invitations)
    .where(
      and(
        eq(invitations.organizationId, orgId),
        eq(invitations.email, cleanEmail),
        eq(invitations.status, 'pending')
      )
    )
    .limit(1);

  if (existingInvite.length > 0) {
    // Revoke old pending invite to reissue clean token
    await db
      .update(invitations)
      .set({ status: 'revoked', updatedAt: new Date() })
      .where(eq(invitations.id, existingInvite[0].id));
  }

  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days expiration

  const [invite] = await db
    .insert(invitations)
    .values({
      organizationId: orgId,
      email: cleanEmail,
      role,
      token,
      invitedById,
      status: 'pending',
      expiresAt,
    })
    .returning();

  await recordAuditEvent(
    orgId,
    invitedById,
    'invitation.created',
    'invitation',
    invite.id,
    { email: cleanEmail, role, expiresAt: expiresAt.toISOString() }
  );

  return invite;
}

export async function listInvitations(orgId: string) {
  const invites = await db
    .select({
      id: invitations.id,
      email: invitations.email,
      role: invitations.role,
      token: invitations.token,
      status: invitations.status,
      expiresAt: invitations.expiresAt,
      createdAt: invitations.createdAt,
      invitedByName: users.name,
      invitedByEmail: users.email,
    })
    .from(invitations)
    .leftJoin(users, eq(users.id, invitations.invitedById))
    .where(and(eq(invitations.organizationId, orgId), eq(invitations.status, 'pending')));

  return invites;
}

export async function revokeInvitation(
  orgId: string,
  invitationId: string,
  operatorRole: OrgRole,
  operatorUserId: string
) {
  if (!hasMinRole(operatorRole, 'admin')) {
    throw new Error('Permission denied: Only Admins or Owners can revoke invitations');
  }

  const [updated] = await db
    .update(invitations)
    .set({ status: 'revoked', updatedAt: new Date() })
    .where(and(eq(invitations.id, invitationId), eq(invitations.organizationId, orgId)))
    .returning();

  await recordAuditEvent(
    orgId,
    operatorUserId,
    'invitation.revoked',
    'invitation',
    invitationId
  );

  return updated;
}

export async function acceptInvitation(token: string, userId: string, userEmail: string) {
  const [invite] = await db
    .select()
    .from(invitations)
    .where(and(eq(invitations.token, token), eq(invitations.status, 'pending')))
    .limit(1);

  if (!invite) {
    throw new Error('Invitation not found or has already been used');
  }

  if (new Date() > new Date(invite.expiresAt)) {
    await db
      .update(invitations)
      .set({ status: 'declined', updatedAt: new Date() })
      .where(eq(invitations.id, invite.id));
    throw new Error('Invitation has expired. Please request a new invite.');
  }

  // Create or update membership
  const [membership] = await db
    .insert(memberships)
    .values({
      organizationId: invite.organizationId,
      userId,
      role: invite.role,
    })
    .onConflictDoUpdate({
      target: [memberships.organizationId, memberships.userId],
      set: { role: invite.role },
    })
    .returning();

  // Mark invitation accepted
  await db
    .update(invitations)
    .set({ status: 'accepted', updatedAt: new Date() })
    .where(eq(invitations.id, invite.id));

  await recordAuditEvent(
    invite.organizationId,
    userId,
    'invitation.accepted',
    'membership',
    membership.id,
    { email: userEmail, role: invite.role }
  );

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, invite.organizationId))
    .limit(1);

  return { membership, organization: org };
}
