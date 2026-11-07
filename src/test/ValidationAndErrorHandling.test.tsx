import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  validateRequired, 
  validateEmail, 
  validatePhone, 
  validatePositiveNumber, 
  validateUrl, 
  validateDateString, 
  safeJsonParse 
} from '../utils/validation';
import { checkClientDependencies, checkProjectDependencies } from '../services/activityService';
import { pushDataToPostgres } from '../services/syncService';

describe('Validation, Error Handling, and Resilience', () => {
  describe('Input Validation Utilities', () => {
    it('validates required fields and strips leading/trailing whitespace', () => {
      expect(validateRequired('').isValid).toBe(false);
      expect(validateRequired('   ').isValid).toBe(false);
      expect(validateRequired(null).isValid).toBe(false);
      expect(validateRequired(undefined).isValid).toBe(false);

      const valid = validateRequired('  Design System  ', 'Project Name');
      expect(valid.isValid).toBe(true);
      expect(valid.value).toBe('Design System');
    });

    it('validates email addresses accurately', () => {
      // Valid emails
      expect(validateEmail('mon14yee@gmail.com').isValid).toBe(true);
      expect(validateEmail('alex.smith+test@sub.example.co.uk').isValid).toBe(true);

      // Invalid emails
      expect(validateEmail('invalid-email').isValid).toBe(false);
      expect(validateEmail('@missing-user.com').isValid).toBe(false);
      expect(validateEmail('user@missing-tld').isValid).toBe(false);
      expect(validateEmail('user@.com').isValid).toBe(false);

      // Optional behavior
      expect(validateEmail('', false).isValid).toBe(true);
      expect(validateEmail('', true).isValid).toBe(false);
    });

    it('validates international and domestic phone numbers', () => {
      expect(validatePhone('+1 555-0199').isValid).toBe(true);
      expect(validatePhone('(555) 234-5678').isValid).toBe(true);
      expect(validatePhone('+44 20 7946 0991').isValid).toBe(true);

      // Invalid phone
      expect(validatePhone('abc-phone').isValid).toBe(false);
      expect(validatePhone('12').isValid).toBe(false); // too short

      // Optional behavior
      expect(validatePhone('', false).isValid).toBe(true);
      expect(validatePhone('', true).isValid).toBe(false);
    });

    it('validates positive numbers and monetary amounts strictly', () => {
      // Valid positive numbers
      const validAmount = validatePositiveNumber('1500.50', 'Budget');
      expect(validAmount.isValid).toBe(true);
      expect(validAmount.value).toBe(1500.5);

      // Rejects negative amounts and zero when zero is disallowed
      expect(validatePositiveNumber('-250', 'Expense').isValid).toBe(false);
      expect(validatePositiveNumber(0, 'Hourly Rate', false).isValid).toBe(false);

      // Allows zero when explicitly permitted
      expect(validatePositiveNumber(0, 'Hourly Rate', true).isValid).toBe(true);

      // Rejects non-numeric strings
      expect(validatePositiveNumber('not-a-number').isValid).toBe(false);
    });

    it('validates web URLs safely', () => {
      expect(validateUrl('https://example.com').isValid).toBe(true);
      expect(validateUrl('subdomain.company.org/path?q=1').isValid).toBe(true);

      // Optional behavior
      expect(validateUrl('', false).isValid).toBe(true);
      expect(validateUrl('', true).isValid).toBe(false);
    });

    it('validates date strings (YYYY-MM-DD or standard parseable dates)', () => {
      expect(validateDateString('2026-11-03').isValid).toBe(true);
      expect(validateDateString('2026-12-31T23:59:59.000Z').isValid).toBe(true);

      // Invalid dates
      expect(validateDateString('invalid-date').isValid).toBe(false);
      expect(validateDateString('').isValid).toBe(false);
      expect(validateDateString(null).isValid).toBe(false);
    });

    it('safely parses JSON without throwing unhandled fatal exceptions', () => {
      const fallback = { status: 'default' };

      // Valid JSON
      const good = safeJsonParse('{"status": "ok", "count": 5}', fallback);
      expect(good.success).toBe(true);
      expect((good.data as any).count).toBe(5);

      // Corrupted / malformed JSON recovers using fallback
      const corrupt = safeJsonParse('{status: broken, json', fallback);
      expect(corrupt.success).toBe(false);
      expect(corrupt.data).toEqual(fallback);
      expect(corrupt.error).toBeDefined();

      // Empty input
      const empty = safeJsonParse('', fallback);
      expect(empty.success).toBe(false);
      expect(empty.data).toEqual(fallback);
    });
  });

  describe('Service Failure and Network Resilience', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('checkClientDependencies handles network timeouts and 500 errors gracefully returning null fallback', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network timeout'));

      const result = await checkClientDependencies('test-token', 'org-1', 'client-xyz');
      // When network drops, returns null preventing blocking client deletion flow
      expect(result).toBeNull();

      // When API succeeds, returns parsed dependencies
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ clientId: 'client-xyz', hasDependencies: true, projectsCount: 2, tasksCount: 5 }),
      });
      const successResult = await checkClientDependencies('test-token', 'org-1', 'client-xyz');
      expect(successResult).not.toBeNull();
      expect(successResult?.hasDependencies).toBe(true);
      expect(successResult?.projectsCount).toBe(2);
      expect(successResult?.tasksCount).toBe(5);
    });

    it('checkProjectDependencies handles network drop gracefully and parses successful responses', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Connection reset'));

      const result = await checkProjectDependencies('test-token', 'org-1', 'proj-xyz');
      expect(result).toBeNull();

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ projectId: 'proj-xyz', hasDependencies: true, tasksCount: 3, timeEntriesCount: 4 }),
      });
      const successResult = await checkProjectDependencies('test-token', 'org-1', 'proj-xyz');
      expect(successResult).not.toBeNull();
      expect(successResult?.hasDependencies).toBe(true);
      expect(successResult?.tasksCount).toBe(3);
      expect(successResult?.timeEntriesCount).toBe(4);
    });

    it('pushDataToPostgres surfaces meaningful error message when server responds with 400/500', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Database constraint violation: duplicate slug' }),
      });

      await expect(
        pushDataToPostgres('dummy-token', { name: 'Test', email: 'test@example.com', avatarSeed: 'seed' }, {})
      ).rejects.toThrow('Database constraint violation: duplicate slug');
    });
  });
});
