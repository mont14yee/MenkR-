export interface AuditEventRecord {
  id: string;
  organizationId: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface DependencyCheckResult {
  hasDependencies: boolean;
  projectsCount?: number;
  tasksCount?: number;
  timeEntriesCount?: number;
  openTasksCount?: number;
  projects?: Array<{ id: string; name: string; status: string }>;
}

/**
 * Record an activity event to backend PostgreSQL audit log
 */
export async function logAuditEvent(
  token: string | null,
  orgId: string | null,
  action: string,
  entityType: 'client' | 'project' | 'task' | 'general',
  entityId?: string,
  metadata: Record<string, any> = {}
): Promise<void> {
  if (!token || !orgId) return;

  try {
    await fetch('/api/audit-events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Organization-Id': orgId,
      },
      body: JSON.stringify({
        action,
        entityType,
        entityId,
        metadata,
      }),
    });
  } catch (err) {
    console.warn('Failed to record audit event to backend:', err);
  }
}

/**
 * Fetch real audit events for an organization, optionally filtered by entity
 */
export async function fetchAuditEvents(
  token: string | null,
  orgId: string | null,
  filters?: { entityType?: string; entityId?: string; limit?: number }
): Promise<AuditEventRecord[]> {
  if (!token || !orgId) return [];

  try {
    const params = new URLSearchParams();
    if (filters?.entityType) params.append('entityType', filters.entityType);
    if (filters?.entityId) params.append('entityId', filters.entityId);
    if (filters?.limit) params.append('limit', String(filters.limit));

    const res = await fetch(`/api/audit-events?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Organization-Id': orgId,
      },
    });

    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Failed to fetch audit events:', err);
  }
  return [];
}

/**
 * Check dependencies for a client before deletion
 */
export async function checkClientDependencies(
  token: string | null,
  orgId: string | null,
  clientId: string
): Promise<DependencyCheckResult | null> {
  if (!token || !orgId) return null;

  try {
    const res = await fetch(`/api/dependencies/clients/${encodeURIComponent(clientId)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Organization-Id': orgId,
      },
    });

    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Failed to check client dependencies:', err);
  }
  return null;
}

/**
 * Check dependencies for a project before deletion
 */
export async function checkProjectDependencies(
  token: string | null,
  orgId: string | null,
  projectId: string
): Promise<DependencyCheckResult | null> {
  if (!token || !orgId) return null;

  try {
    const res = await fetch(`/api/dependencies/projects/${encodeURIComponent(projectId)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Organization-Id': orgId,
      },
    });

    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Failed to check project dependencies:', err);
  }
  return null;
}
