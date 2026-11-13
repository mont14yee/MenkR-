import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, signInWithPopup, signOut as fbSignOut, onAuthStateChanged } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import { useToast } from './ToastContext';

export type OrgRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer';

export interface OrgInfo {
  id: string;
  name: string;
  slug: string;
  currency: string;
  role: OrgRole;
}

export interface OrgMember {
  membershipId: string;
  userId: string;
  email: string;
  name?: string;
  avatarSeed?: string;
  role: OrgRole;
  joinedAt: string;
}

export interface OrgInvitation {
  id: string;
  email: string;
  role: OrgRole;
  token: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  invitedByName?: string;
}

interface AuthContextType {
  user: User | null;
  idToken: string | null;
  organization: OrgInfo | null;
  organizations: OrgInfo[];
  role: OrgRole | null;
  isLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshToken: () => Promise<string | null>;
  switchOrganization: (orgId: string) => Promise<void>;
  createOrg: (name: string, currency?: string) => Promise<OrgInfo | null>;
  fetchMembers: () => Promise<OrgMember[]>;
  fetchInvitations: () => Promise<OrgInvitation[]>;
  inviteUser: (email: string, role: OrgRole) => Promise<boolean>;
  revokeInvite: (invitationId: string) => Promise<boolean>;
  acceptInvite: (token: string) => Promise<boolean>;
  changeMemberRole: (membershipId: string, newRole: OrgRole) => Promise<boolean>;
  removeMember: (membershipId: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  idToken: null,
  organization: null,
  organizations: [],
  role: null,
  isLoading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
  refreshToken: async () => null,
  switchOrganization: async () => {},
  createOrg: async () => null,
  fetchMembers: async () => [],
  fetchInvitations: async () => [],
  inviteUser: async () => false,
  revokeInvite: async () => false,
  acceptInvite: async () => false,
  changeMemberRole: async () => false,
  removeMember: async () => false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [organization, setOrganization] = useState<OrgInfo | null>(null);
  const [organizations, setOrganizations] = useState<OrgInfo[]>([]);
  const [role, setRole] = useState<OrgRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { showToast } = useToast();

  const loadOrganizations = async (token: string) => {
    try {
      const res = await fetch('/api/organizations', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const orgList: OrgInfo[] = await res.json();
        setOrganizations(orgList);
        return orgList;
      }
    } catch (err) {
      console.warn('Failed to load user organizations:', err);
    }
    return [];
  };

  const syncUserSession = async (currentUser: User, token: string) => {
    try {
      const res = await fetch('/api/auth/me', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: currentUser.displayName,
          avatarSeed: currentUser.uid.slice(0, 8),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const activeOrg: OrgInfo = {
          ...data.organization,
          role: data.role,
        };
        setOrganization(activeOrg);
        setRole(data.role);

        // Load full list of organizations
        const orgList = await loadOrganizations(token);
        if (orgList.length > 0 && !orgList.find(o => o.id === activeOrg.id)) {
          setOrganizations([activeOrg, ...orgList]);
        }
      }
    } catch (err) {
      console.warn('Failed to initialize server-side database session:', err);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const token = await currentUser.getIdToken();
          setIdToken(token);
          await syncUserSession(currentUser, token);
        } catch (err) {
          console.error('Error fetching auth token:', err);
        }
      } else {
        setIdToken(null);
        setOrganization(null);
        setOrganizations([]);
        setRole(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const refreshToken = useCallback(async (): Promise<string | null> => {
    if (!auth.currentUser) return null;
    const token = await auth.currentUser.getIdToken(true);
    setIdToken(token);
    return token;
  }, []);

  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      const token = await result.user.getIdToken();
      setIdToken(token);
      await syncUserSession(result.user, token);
      showToast({ message: `Signed in as ${result.user.displayName || result.user.email}` });
    } catch (err: any) {
      console.error('Sign-in error:', err);
      showToast({ message: `Sign in error: ${err.message || 'Authentication cancelled'}` });
    }
  };

  const signOut = async () => {
    try {
      await fbSignOut(auth);
      setIdToken(null);
      setOrganization(null);
      setOrganizations([]);
      setRole(null);
      showToast({ message: 'Signed out successfully' });
    } catch (err: any) {
      console.error('Sign-out error:', err);
    }
  };

  const switchOrganization = async (orgId: string) => {
    const target = organizations.find(o => o.id === orgId);
    if (!target) return;

    setOrganization(target);
    setRole(target.role);
    showToast({ message: `Switched to ${target.name} (${target.role})` });
  };

  const createOrg = async (name: string, currency = 'USD'): Promise<OrgInfo | null> => {
    let token = idToken;
    if (!token && user) token = await refreshToken();
    if (!token) {
      const msg = 'Please sign in to create a workspace.';
      showToast({ message: msg });
      throw new Error(msg);
    }

    try {
      const res = await fetch('/api/organizations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, currency }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to create organization (${res.status})`);
      }

      const created: OrgInfo = await res.json();
      setOrganizations(prev => [...prev, created]);
      setOrganization(created);
      setRole(created.role);
      showToast({ message: `Created organization ${created.name}` });
      return created;
    } catch (err: any) {
      console.error('Create organization error:', err);
      const msg = err?.message || 'Network error while creating organization.';
      showToast({ message: msg });
      throw err instanceof Error ? err : new Error(msg);
    }
  };

  const fetchMembers = async (): Promise<OrgMember[]> => {
    if (!organization) return [];
    let token = idToken;
    if (!token && user) token = await refreshToken();
    if (!token) return [];

    try {
      const res = await fetch(`/api/organizations/${organization.id}/members`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Organization-Id': organization.id,
        },
      });

      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.error('Fetch members error:', err);
    }
    return [];
  };

  const fetchInvitations = async (): Promise<OrgInvitation[]> => {
    if (!organization) return [];
    let token = idToken;
    if (!token && user) token = await refreshToken();
    if (!token) return [];

    try {
      const res = await fetch(`/api/organizations/${organization.id}/invitations`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Organization-Id': organization.id,
        },
      });

      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.error('Fetch invitations error:', err);
    }
    return [];
  };

  const inviteUser = async (email: string, role: OrgRole): Promise<boolean> => {
    if (!organization) return false;
    let token = idToken;
    if (!token && user) token = await refreshToken();
    if (!token) return false;

    try {
      const res = await fetch(`/api/organizations/${organization.id}/invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Organization-Id': organization.id,
        },
        body: JSON.stringify({ email, role }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to send invitation');
      }

      showToast({ message: `Invitation sent to ${email}` });
      return true;
    } catch (err: any) {
      console.error('Invite user error:', err);
      showToast({ message: err.message || 'Failed to send invitation' });
      return false;
    }
  };

  const revokeInvite = async (invitationId: string): Promise<boolean> => {
    if (!organization) return false;
    let token = idToken;
    if (!token && user) token = await refreshToken();
    if (!token) return false;

    try {
      const res = await fetch(`/api/organizations/${organization.id}/invitations/${invitationId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Organization-Id': organization.id,
        },
      });

      if (res.ok) {
        showToast({ message: 'Invitation revoked' });
        return true;
      }
    } catch (err: any) {
      console.error('Revoke invite error:', err);
    }
    return false;
  };

  const acceptInvite = async (tokenStr: string): Promise<boolean> => {
    let token = idToken;
    if (!token && user) token = await refreshToken();
    if (!token) return false;

    try {
      const res = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ token: tokenStr }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to accept invitation');
      }

      const result = await res.json();
      showToast({ message: `Successfully joined ${result.organization?.name || 'organization'}!` });
      await loadOrganizations(token);
      return true;
    } catch (err: any) {
      console.error('Accept invite error:', err);
      showToast({ message: err.message || 'Failed to accept invitation' });
      return false;
    }
  };

  const changeMemberRole = async (membershipId: string, newRole: OrgRole): Promise<boolean> => {
    if (!organization) return false;
    let token = idToken;
    if (!token && user) token = await refreshToken();
    if (!token) return false;

    try {
      const res = await fetch(`/api/organizations/${organization.id}/members/${membershipId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Organization-Id': organization.id,
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update member role');
      }

      showToast({ message: `Updated member role to ${newRole}` });
      return true;
    } catch (err: any) {
      console.error('Change role error:', err);
      showToast({ message: err.message || 'Failed to update member role' });
      return false;
    }
  };

  const removeMember = async (membershipId: string): Promise<boolean> => {
    if (!organization) return false;
    let token = idToken;
    if (!token && user) token = await refreshToken();
    if (!token) return false;

    try {
      const res = await fetch(`/api/organizations/${organization.id}/members/${membershipId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Organization-Id': organization.id,
        },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to remove member');
      }

      showToast({ message: 'Member removed from organization' });
      return true;
    } catch (err: any) {
      console.error('Remove member error:', err);
      showToast({ message: err.message || 'Failed to remove member' });
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        idToken,
        organization,
        organizations,
        role,
        isLoading,
        signInWithGoogle,
        signOut,
        refreshToken,
        switchOrganization,
        createOrg,
        fetchMembers,
        fetchInvitations,
        inviteUser,
        revokeInvite,
        acceptInvite,
        changeMemberRole,
        removeMember,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
