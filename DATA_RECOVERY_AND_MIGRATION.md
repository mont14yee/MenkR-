# MenkiR Data Migration, Recovery & Backup Strategy

This document specifies the operational data migration architecture, backup schedules, retention policies, disaster recovery runbooks, and database rollback procedures for MenkiR.

---

## 1. Storage Architecture & Operational Mechanisms

MenkiR operates a hybrid storage architecture designed for speed, resilience, and multi-tenant security:

1. **Persistent Relational Tier (Cloud SQL PostgreSQL)**:
   - **Provider / Region**: Google Cloud SQL (PostgreSQL 16) in `europe-west1` (`ai-studio-8a5e965f`).
   - **Multi-Tenancy**: Tenant isolation enforced at the database and API layer via `organization_id` foreign keys and role-based access control (`Owner`, `Admin`, `Manager`, `Member`, `Viewer`).
   - **Tables**: `users`, `organizations`, `memberships`, `invitations`, `clients`, `projects`, `tasks`, `comments`, `schedules`, `time_entries`, `financial_records`, `templates`, `documents`, `notifications`, and `audit_events`.
   - **Integrity**: Referential constraints (`ON DELETE CASCADE` where appropriate, `ON DELETE SET NULL` for user attributions) and database indexes on tenant and status columns.

2. **Client-Side Snapshot Tier (Browser LocalStorage)**:
   - Serves as an offline cache and fast local buffer for transient work.
   - Operates with an atomic rollback snapshot mechanism: before any local import or migration, existing browser data is preserved in memory and restored if any write fails.
   - **Zero Data Loss Invariant**: Local storage data is **never deleted or overwritten** when migrating to Cloud SQL. It remains intact as a safety net.

---

## 2. Controlled Data Migration Pipeline

When migrating legacy local records to Cloud SQL, the migration pipeline executes through four strictly ordered phases:

```
[Raw Input] ──► [Phase 1: Validation & Sanitization] ──► [Phase 2: Relationship & Duplicate Check] ──► [Phase 3: Database Transaction] ──► [Phase 4: Audit Event]
```

### Phase 1: Pre-flight Schema Validation & Credential Sanitization
- Evaluates records against strict schema definitions (`validateMigrationDataset`).
- Verifies required fields (e.g. `client.name`, `project.name`, `task.title`, `revenue.amount`, `timeEntry.startedAt`).
- **Credential Scrubbing**: Recursively purges sensitive attributes matching forbidden keys (`gemini_api_key`, `api_key`, `password`, `token`, `authorization`, `firebase_token`, `client_secret`).

### Phase 2: Relationship Integrity & Duplicate Resolution
- **Relationship Graph**: Checks foreign keys across entities. Projects referencing missing clients or tasks referencing missing projects are flagged as orphan relationships with actionable warnings.
- **Duplicate Strategies**:
  - `skip` (Default): Cloud database records take precedence; incoming duplicate IDs or emails are ignored.
  - `overwrite`: Cloud database records are updated with the incoming migration state.

### Phase 3: Transactional Cloud SQL Synchronization
- Scoped to `POST /api/sync` or `POST /api/organizations/:orgId/restore`.
- Enforces RBAC permissions (`Admin` or `Owner` for full backup restore; `Member`+ for data sync; `Viewer` blocked).
- Executed with transactional guarantees. Any fatal schema violation or write failure triggers an immediate abort and rollback.

### Phase 4: Audit Logging
- Every migration and backup operation writes an immutable entry into `audit_events` with actor ID, organization ID, record counts, timestamp, and client IP.

---

## 3. Cloud Backup & Export Specifications

### Export (`GET /api/organizations/:orgId/backup`)
- **Authorization**: Restricted to `Owner` and `Admin`.
- **Payload Structure**:
  ```json
  {
    "metadata": {
      "version": "2.0.0",
      "exportedAt": "2026-10-30T18:25:00.000Z",
      "organizationId": "0e633d42-...",
      "organizationName": "Acme Studio",
      "slug": "acme-studio",
      "currency": "USD",
      "checksum": "a4f8b2c9...",
      "counts": {
        "clients": 42,
        "projects": 87,
        "tasks": 210,
        "timeEntries": 540,
        "financialRecords": 115
      }
    },
    "data": { ... }
  }
  ```
- **Integrity**: Encodes a SHA-256 cryptographic hash of the data payload into `metadata.checksum` to detect tampering or corruption.

### Restore (`POST /api/organizations/:orgId/restore`)
- Validates payload structure and checksum.
- Previews total records, duplicates, and orphan relationships.
- Commits records within the active tenant organization without affecting other organizations.

---

## 4. Backup Frequency & Retention Policy

| Tier | Mechanism | Schedule | Retention | Storage Location |
| :--- | :--- | :--- | :--- | :--- |
| **Cloud SQL Automated** | Cloud SQL automated backups & WAL archiving | Daily at 02:00 UTC | 7 to 30 days retention | Google Cloud Storage (Cross-zone redundant) |
| **Point-In-Time (PITR)**| Cloud SQL write-ahead log (WAL) replay | Continuous | 7 days rollback window | Managed GCP Cloud SQL storage |
| **On-Demand Org Snapshot** | Canonical JSON export via MenkiR API | Before major releases or migrations | Administrator-managed / S3 / GCS | Cold customer storage (Sanitized of credentials) |
| **Browser Local Snapshot** | In-memory rollback buffer | Automatic before any write/import | Immediate session lifetime | Client browser RAM |

---

## 5. Disaster Recovery Runbook

### Scenario A: Accidental Record Deletion
1. Verify the incident scope and tenant `organization_id`.
2. Inspect the `audit_events` table for the exact timestamp and user ID responsible for the deletion.
3. If point-in-time recovery is required, clone the Cloud SQL instance to a recovery instance at `T - 5 minutes`.
4. Extract the deleted records and re-inject them using `POST /api/organizations/:orgId/restore` with `duplicateStrategy: 'skip'`.

### Scenario B: Database Schema Rollback Procedure
If a database migration deployed via Drizzle Kit or `cloudsql.UpdateSchema` introduces a regression:
1. **Never perform destructive `DROP TABLE` or `DROP COLUMN` during production hours**.
2. **Rollback Step 1 (Application)**: Revert the backend code to the previous Git commit and restart the dev server or Cloud Run instance.
3. **Rollback Step 2 (Schema)**: Run the inverse Drizzle migration down-script against PostgreSQL:
   ```sql
   -- Example: Dropping newly added non-critical columns without losing table data
   ALTER TABLE "tasks" DROP COLUMN IF EXISTS "experimental_field";
   ```
4. **Rollback Step 3 (Full DB Restore)**: In catastrophic schema failure, restore Cloud SQL instance to the automated snapshot created prior to migration.

### Scenario C: Interrupted or Failed Migration
1. Because migrations are processed in transactional batches, partial failures do not leave orphaned child records.
2. The user's browser localStorage data is preserved without mutation.
3. Review the error details displayed in the UI ("Migration Halted - Safe Rollback").
4. Correct the malformed records identified in the Pre-flight Summary and click **Retry Migration**.

---

## 6. Automated Test Suite Verification

The migration and recovery mechanisms are validated by automated Vitest suites (`src/test/DataMigration.test.ts` and `src/test/Persistence.test.tsx`):

| Test Case | Scenario Tested | Outcome |
| :--- | :--- | :--- |
| **Empty Database** | Validates importing or exporting from an empty database or dataset. | **Passed**: Returns 0 records with `canProceed: true` without errors. |
| **Large Datasets** | Processes 350+ records across clients, projects, and tasks. | **Passed**: Successfully normalizes, links relationships, and computes counts. |
| **Malformed Records** | Injects invalid emails, negative durations, missing names, and non-object items. | **Passed**: Rejects malformed fields with specific error messages. |
| **Duplicate Detection** | Tests duplicate client emails and project IDs under `skip` and `overwrite` strategies. | **Passed**: Correctly filters duplicates according to selected strategy. |
| **Orphan Relationships** | Projects and tasks referencing nonexistent parent IDs. | **Passed**: Flags broken references with non-blocking warnings. |
| **Secret Sanitization** | Injects API keys (`gemini_api_key`), tokens, and passwords into export payloads. | **Passed**: All sensitive keys are purged; only legitimate business fields remain. |
| **Rollback on Error** | Attempts restoring invalid backup payloads. | **Passed**: Halts before writing and throws informative validation exception. |
| **Storage Quota Exceeded**| Simulates browser storage full error during write operations. | **Passed**: Automatically reverts to original state without data corruption. |
