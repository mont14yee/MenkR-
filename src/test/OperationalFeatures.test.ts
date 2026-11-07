import { describe, it, expect } from 'vitest';
import { sanitizeAuditMetadata } from '../utils/auditLogger';
import { hasMinRole, ROLE_HIERARCHY, OrgRole } from '../middleware/rbac';

describe('Company-Level Operational Features', () => {
  describe('Audit Metadata Sanitization', () => {
    it('redacts sensitive keys including passwords, tokens, API keys, and credentials', () => {
      const sensitiveInput = {
        eventName: 'user.login',
        userId: 'u-123',
        password: 'superSecretPassword123!',
        userToken: 'ey123456789.sample.jwt',
        apiKey: 'AIzaSySampleKey123',
        authSecret: 'super-secret-value',
        creditCardNumber: '4111222233334444',
        safeMetadata: {
          clientId: 'client-99',
          role: 'admin',
          nestedSecret: {
            sensitiveField: 'secret-123',
          },
          nestedObject: {
            token: 'nested-token',
            allowedField: 'safe data',
          },
        },
      };

      const sanitized = sanitizeAuditMetadata(sensitiveInput);

      expect(sanitized.eventName).toBe('user.login');
      expect(sanitized.userId).toBe('u-123');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.userToken).toBe('[REDACTED]');
      expect(sanitized.apiKey).toBe('[REDACTED]');
      expect(sanitized.authSecret).toBe('[REDACTED]');
      expect(sanitized.creditCardNumber).toBe('[REDACTED]');
      expect(sanitized.safeMetadata.clientId).toBe('client-99');
      expect(sanitized.safeMetadata.role).toBe('admin');
      expect(sanitized.safeMetadata.nestedSecret).toBe('[REDACTED]');
      expect(sanitized.safeMetadata.nestedObject.token).toBe('[REDACTED]');
      expect(sanitized.safeMetadata.nestedObject.allowedField).toBe('safe data');
    });

    it('truncates excessively long string metadata to prevent log bloating', () => {
      const longString = 'A'.repeat(800);
      const input = {
        notes: longString,
        smallNote: 'Hello world',
      };

      const result = sanitizeAuditMetadata(input);
      expect(result.notes.length).toBeLessThan(600);
      expect(result.notes).toContain('... [truncated]');
      expect(result.smallNote).toBe('Hello world');
    });

    it('handles null, undefined, and non-object values safely', () => {
      expect(sanitizeAuditMetadata(null)).toBeNull();
      expect(sanitizeAuditMetadata(undefined)).toBeUndefined();
      expect(sanitizeAuditMetadata(42)).toBe(42);
      expect(sanitizeAuditMetadata('string')).toBe('string');
    });
  });

  describe('Record-Level Permissions & Search Boundaries', () => {
    it('correctly validates role hierarchy', () => {
      expect(hasMinRole('owner', 'admin')).toBe(true);
      expect(hasMinRole('admin', 'manager')).toBe(true);
      expect(hasMinRole('manager', 'member')).toBe(true);
      expect(hasMinRole('member', 'viewer')).toBe(true);

      // Lower roles cannot access higher role operations
      expect(hasMinRole('viewer', 'member')).toBe(false);
      expect(hasMinRole('viewer', 'manager')).toBe(false);
      expect(hasMinRole('member', 'manager')).toBe(false);
      expect(hasMinRole('manager', 'admin')).toBe(false);
      expect(hasMinRole('admin', 'owner')).toBe(false);
    });

    it('enforces financial search restriction: only manager, admin, and owner can view financial records', () => {
      const roles: OrgRole[] = ['viewer', 'member', 'manager', 'admin', 'owner'];
      
      const canAccessFinance = (r: OrgRole) => hasMinRole(r, 'manager');

      expect(canAccessFinance('viewer')).toBe(false);
      expect(canAccessFinance('member')).toBe(false);
      expect(canAccessFinance('manager')).toBe(true);
      expect(canAccessFinance('admin')).toBe(true);
      expect(canAccessFinance('owner')).toBe(true);
    });

    it('enforces retention policy management restriction: only admin and owner can manage audit retention', () => {
      const canManageRetention = (r: OrgRole) => hasMinRole(r, 'admin');

      expect(canManageRetention('viewer')).toBe(false);
      expect(canManageRetention('member')).toBe(false);
      expect(canManageRetention('manager')).toBe(false);
      expect(canManageRetention('admin')).toBe(true);
      expect(canManageRetention('owner')).toBe(true);
    });
  });
});
