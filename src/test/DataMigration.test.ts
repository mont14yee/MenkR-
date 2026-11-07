import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  validateMigrationDataset, 
  sanitizeDataPayload, 
  FORBIDDEN_SECRET_KEYS 
} from '../utils/migrationValidator';

// Mock DB module for backend repositories
vi.mock('../db/index', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import { db } from '../db/index';
import { exportOrganizationBackup, restoreOrganizationBackup } from '../db/repositories';

describe('Data Migration & Recovery: Schema Validation & Sanitization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Handles empty dataset and empty databases gracefully', () => {
    const emptyDataset = {};
    const result = validateMigrationDataset(emptyDataset);

    expect(result.isValid).toBe(true);
    expect(result.canProceed).toBe(true);
    expect(result.summary.totalRecords).toBe(0);
    expect(result.summary.validRecords).toBe(0);
    expect(result.summary.invalidRecords).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('2. Strictly scrubs credentials, API keys, and private tokens from exports', () => {
    const rawDataWithSecrets = {
      user: {
        name: 'Alex Rivera',
        email: 'alex@menkir.studio',
        gemini_api_key: 'AIzaSySecretApiKey12345',
        api_key: 'sk-private-12345',
        password: 'supersecretpassword',
        authorization: 'Bearer eyJhbGciOi...',
        firebase_token: 'secret_firebase_jwt',
      },
      clients: [
        {
          id: 'client-1',
          name: 'Acme Corp',
          client_secret: 'secret_client_token',
        },
      ],
    };

    const sanitized = sanitizeDataPayload(rawDataWithSecrets);

    // Verify secret fields are stripped
    expect(sanitized.user).not.toHaveProperty('gemini_api_key');
    expect(sanitized.user).not.toHaveProperty('api_key');
    expect(sanitized.user).not.toHaveProperty('password');
    expect(sanitized.user).not.toHaveProperty('authorization');
    expect(sanitized.user).not.toHaveProperty('firebase_token');
    expect(sanitized.clients[0]).not.toHaveProperty('client_secret');

    // Verify legitimate fields are retained
    expect(sanitized.user.name).toBe('Alex Rivera');
    expect(sanitized.user.email).toBe('alex@menkir.studio');
    expect(sanitized.clients[0].name).toBe('Acme Corp');
  });

  it('3. Rejects malformed records and provides clear, descriptive error messages', () => {
    const malformedDataset = {
      clients: [
        { id: 'c1', name: '' }, // Missing name (error)
        { id: 'c2', name: 'Valid Client', email: 'not-an-email' }, // Invalid email (warning)
        'not even an object', // Invalid item (error)
      ],
      projects: [
        { id: 'p1', name: '' }, // Missing name (error)
      ],
      revenues: [
        { id: 'r1', amount: 'not_a_number', date: 'invalid-date' }, // Invalid amount and date
      ],
      timeEntries: [
        { id: 'te1', durationSeconds: -50, startedAt: 'not-a-date' }, // Negative duration & invalid date
      ],
    };

    const result = validateMigrationDataset(malformedDataset);

    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);

    // Verify error messages specify field and issue
    const clientErrors = result.errors.filter((e) => e.entity === 'clients');
    expect(clientErrors.some((e) => e.message.includes('Client name is required'))).toBe(true);

    const revenueErrors = result.errors.filter((e) => e.entity === 'revenues');
    expect(revenueErrors.some((e) => e.message.includes('valid number'))).toBe(true);

    const timeErrors = result.errors.filter((e) => e.entity === 'timeEntries');
    expect(timeErrors.some((e) => e.message.includes('positive number'))).toBe(true);
  });

  it('4. Detects duplicates and enforces chosen duplicate resolution strategy', () => {
    const datasetWithDupes = {
      clients: [
        { id: 'c1', name: 'Studio Client A', email: 'studio@a.com' },
        { id: 'c2', name: 'Studio Client A', email: 'studio@a.com' }, // Duplicate email & name
      ],
      projects: [
        { id: 'p1', name: 'Brand Redesign' },
        { id: 'p1', name: 'Brand Redesign (Updated)' }, // Duplicate ID
      ],
    };

    // Strategy: Skip duplicates
    const resultSkip = validateMigrationDataset(datasetWithDupes, { duplicateStrategy: 'skip' });
    expect(resultSkip.summary.duplicateRecords).toBe(2);
    expect(resultSkip.sanitizedData.clients).toHaveLength(1);
    expect(resultSkip.sanitizedData.projects).toHaveLength(1);

    // Strategy: Overwrite duplicates
    const resultOverwrite = validateMigrationDataset(datasetWithDupes, { duplicateStrategy: 'overwrite' });
    expect(resultOverwrite.sanitizedData.clients).toHaveLength(2);
    expect(resultOverwrite.sanitizedData.projects).toHaveLength(2);
  });

  it('5. Performs relationship integrity checks and identifies orphan foreign keys', () => {
    const datasetWithOrphans = {
      clients: [
        { id: 'c_valid', name: 'Valid Client' },
      ],
      projects: [
        { id: 'p1', name: 'Project With Valid Client', clientId: 'c_valid' },
        { id: 'p2', name: 'Orphan Project', clientId: 'c_non_existent_999' },
      ],
      tasks: [
        { id: 't1', title: 'Task 1', projectId: 'p1', clientId: 'c_valid' },
        { id: 't2', title: 'Orphan Task', projectId: 'p_ghost_123', clientId: 'c_ghost_456' },
      ],
      timeEntries: [
        { id: 'te1', durationSeconds: 3600, startedAt: new Date().toISOString(), projectId: 'p_ghost_123' },
      ],
    };

    const result = validateMigrationDataset(datasetWithOrphans);

    expect(result.summary.orphanRelationships).toBeGreaterThan(0);
    const warnings = result.warnings;
    expect(warnings.some((w) => w.message.includes('non-existent client ID "c_non_existent_999"'))).toBe(true);
    expect(warnings.some((w) => w.message.includes('non-existent project ID "p_ghost_123"'))).toBe(true);
  });

  it('6. Supports large datasets and aggregates multi-entity collections', () => {
    const largeDataset: Record<string, any[]> = {
      clients: [],
      projects: [],
      tasks: [],
      timeEntries: [],
      revenues: [],
      schedules: [],
      templates: [],
      documents: [],
    };

    // Generate 50 clients, 100 projects, 200 tasks
    for (let i = 0; i < 50; i++) {
      largeDataset.clients.push({ id: `c_${i}`, name: `Client ${i}`, email: `client${i}@test.com` });
    }
    for (let i = 0; i < 100; i++) {
      largeDataset.projects.push({ id: `p_${i}`, name: `Project ${i}`, clientId: `c_${i % 50}` });
    }
    for (let i = 0; i < 200; i++) {
      largeDataset.tasks.push({ id: `t_${i}`, title: `Task ${i}`, projectId: `p_${i % 100}` });
    }

    const result = validateMigrationDataset(largeDataset);

    expect(result.isValid).toBe(true);
    expect(result.summary.totalRecords).toBe(350);
    expect(result.summary.validRecords).toBe(350);
    expect(result.summary.orphanRelationships).toBe(0);
  });
});

describe('Data Migration & Recovery: Cloud Backup & Rollback Guarantees', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('7. exportOrganizationBackup produces checksummed, sanitized backup payload', async () => {
    // Mock DB select for organization
    (db.select as any).mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          limit: vi.fn().mockResolvedValueOnce([
            { id: 'org_test_1', name: 'Design Studio', slug: 'design-studio', currency: 'EUR' },
          ]),
        }),
      }),
    });

    // Mock 9 entity table queries
    const mockEntities = [[{ id: 'c1', name: 'Acme', secret_token: 'should_be_stripped' }]];
    for (let i = 1; i < 9; i++) {
      mockEntities.push([]);
    }

    // Mock Promise.all queries
    mockEntities.forEach((entityRows) => {
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce(entityRows),
        }),
      });
    });

    // Mock audit log insert
    (db.insert as any).mockReturnValueOnce({
      values: vi.fn().mockResolvedValueOnce([{ id: 'audit_1' }]),
    });

    const backup = await exportOrganizationBackup('org_test_1', 'user_admin_1');

    expect(backup.metadata).toBeDefined();
    expect(backup.metadata.organizationId).toBe('org_test_1');
    expect(backup.metadata.checksum).toBeDefined();
    expect(typeof backup.metadata.checksum).toBe('string');
    expect(backup.metadata.checksum.length).toBe(64); // SHA-256 is 64 hex chars

    // Verify secrets are stripped from exported entities
    expect(backup.data.clients[0]).not.toHaveProperty('secret_token');
    expect(backup.data.clients[0].name).toBe('Acme');
  });

  it('8. restoreOrganizationBackup halts and rolls back if validation fails fatally', async () => {
    const invalidBackup = {
      metadata: { version: '2.0.0' },
      data: {
        clients: [{ name: '' }], // Missing name is fatal error
        tasks: [{ title: '' }],
      },
    };

    await expect(
      restoreOrganizationBackup('org_test_1', 'user_admin_1', invalidBackup)
    ).rejects.toThrow('Backup validation failed');
  });
});
