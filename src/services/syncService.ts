export interface SyncStatus {
  isSyncing: boolean;
  lastSyncedAt: string | null;
  error: string | null;
  stats?: Record<string, number>;
}

export async function pushDataToPostgres(
  token: string, 
  profile: any, 
  appData: Record<string, any>,
  orgId?: string
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  if (orgId) {
    headers['X-Organization-Id'] = orgId;
  }

  const response = await fetch('/api/sync', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      profile,
      data: appData,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Sync failed' }));
    throw new Error(errorData.error || `Server responded with status ${response.status}`);
  }

  return await response.json();
}
