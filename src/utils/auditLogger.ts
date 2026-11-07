import { db } from '../db/index.ts';
import { auditEvents } from '../db/schema.ts';
import { eq, and, lt, sql } from 'drizzle-orm';

const SENSITIVE_KEY_PATTERNS = [
  /pass(word)?/i,
  /token/i,
  /secret/i,
  /api[_-]?key/i,
  /auth(orization)?/i,
  /cred(ential)?/i,
  /cookie/i,
  /private[_-]?key/i,
  /credit[_-]?card/i,
  /cvv/i,
  /ssn/i,
];

/**
 * Recursively strips or masks sensitive information from audit metadata
 * to ensure tokens, passwords, and API secrets are never persisted in logs.
 */
export function sanitizeAuditMetadata(obj: any, depth = 0): any {
  if (depth > 5) return '[Truncated: Max Depth]';
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    // Truncate excessively long strings
    if (obj.length > 500) {
      return obj.slice(0, 500) + '... [truncated]';
    }
    return obj;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.slice(0, 50).map(item => sanitizeAuditMetadata(item, depth + 1));
  }

  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const isSensitive = SENSITIVE_KEY_PATTERNS.some(pattern => pattern.test(key));
    if (isSensitive) {
      cleaned[key] = '[REDACTED]';
    } else {
      cleaned[key] = sanitizeAuditMetadata(value, depth + 1);
    }
  }

  return cleaned;
}

/**
 * Prunes audit events older than specified retention days for an organization.
 * Default retention is 90 days.
 */
export async function pruneOrganizationAuditEvents(
  organizationId: string, 
  retentionDays: number = 90
): Promise<{ deletedCount: number; cutoffDate: string }> {
  const safeDays = Math.max(7, Math.min(retentionDays, 730)); // 7 days min, 2 years max
  const cutoff = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);

  const deleteResult = await db
    .delete(auditEvents)
    .where(
      and(
        eq(auditEvents.organizationId, organizationId),
        lt(auditEvents.createdAt, cutoff)
      )
    )
    .returning({ id: auditEvents.id });

  return {
    deletedCount: deleteResult.length,
    cutoffDate: cutoff.toISOString(),
  };
}
