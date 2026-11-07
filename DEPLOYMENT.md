# MenkR- Production Deployment & Operations Manual

This document outlines the architecture, environment variables, database migrations, security safeguards, AI provider configuration, audit logging, monitoring, and disaster recovery procedures for deploying MenkR- to production.

---

## 1. System Architecture

MenkR- is architected as an offline-first, multi-tenant enterprise business suite with a full-stack Node.js + Express backend running a modern React single-page application built on Vite and Tailwind CSS.

- **Frontend Client**: React 18, TypeScript, Tailwind CSS, Lucide icons.
- **Backend API Server**: Node.js 20+, Express (`server.ts`).
- **Relational Database**: Cloud SQL PostgreSQL 15+, managed via Drizzle ORM (`src/db/schema.ts`).
- **Identity & Authentication**: Firebase Authentication (Google OAuth & JWT Bearer token validation) with server-side RBAC verification (`src/middleware/auth.ts`, `src/middleware/rbac.ts`).
- **AI Processing**: Google Gemini 3.8 Flash accessed strictly server-side via `@google/genai` TypeScript SDK.
- **Secure File Storage**: Organization-isolated encrypted storage on protected disk volume (`data/secure_library_files`).

---

## 2. Environment Variables Reference

| Variable | Target | Required | Description |
|---|---|---|---|
| `PORT` | Server | Optional (Default: `3000`) | Network port on which Express listens. |
| `NODE_ENV` | Server | Required | Set to `production` in staging and production deployments. |
| `DATABASE_URL` | Server | Required | PostgreSQL connection string (Cloud SQL UNIX socket or SSL TCP host). |
| `GEMINI_API_KEY` | Server | Optional (AI Features) | Google Gemini API key. **Must never be prefixed with `VITE_` or exposed to browser bundles.** |
| `APP_URL` | Server/Client | Recommended | Public URL where the application is hosted (e.g., Cloud Run or custom domain). |
| `VITE_FIREBASE_API_KEY` | Client | Optional | Public Firebase API key for client-side Auth. |
| `VITE_FIREBASE_AUTH_DOMAIN` | Client | Optional | Firebase Auth domain. |
| `VITE_FIREBASE_PROJECT_ID` | Client | Optional | Firebase Project identifier. |

> **Security Rule**: All privileged AI requests, database queries, and audit log operations are strictly proxied through the Express server. The client never receives database credentials, Gemini API keys, or raw service account secrets.

---

## 3. Database Access & Schema Migrations

The database layer uses **Drizzle ORM** with PostgreSQL.

### Schema Definition
Schema tables and relational definitions reside in:
```
src/db/schema.ts
```

Tables include:
- `users`: Registered platform users with Firebase UIDs.
- `organizations`: Multi-tenant workspaces with isolated slugs and currency settings.
- `memberships`: User-to-organization join table enforcing roles (`owner`, `admin`, `manager`, `member`, `viewer`).
- `clients`, `projects`, `tasks`, `schedules`, `time_entries`, `financial_records`: Core enterprise business entities.
- `templates`, `documents`: Workflow blueprints and encrypted document metadata.
- `audit_events`: Immutable audit trail for compliance and activity tracking.
- `invitations`: Workspace invite tokens with expiration and role assignment.

### Applying Schema Updates
In AI Studio, schema updates are applied using the `cloudsql-update-schema` workflow:
```bash
# Verify schema and build
npm run build
```
In external CI/CD pipelines:
```bash
npx drizzle-kit push
```

---

## 4. AI Provider Configuration (Gemini 3.8 Flash)

All AI interactions run through the server-side proxy routes:
- `GET /api/ai/status`: Inspects if `GEMINI_API_KEY` is present and returns whitelisted models without revealing keys.
- `POST /api/ai/generate`: General scoped prompt completion with timeout protection.
- `POST /api/ai/workflow`: Structured executive workflows (project summaries, task breakdowns, meeting notes, project plans, risk identification, status reports).

### Operational Safeguards
1. **Model Whitelisting**: Restricted to `gemini-3.8-flash` and approved low-latency models.
2. **Request Rate Limiting**: Enforces max 25 requests per minute per organization (`checkAIRateLimit`).
3. **Execution Timeout**: Strict 30-second promise race timeout preventing hanging server connections.
4. **Prompt Injection Defense**: Strips control characters, normalizes Unicode, and rejects prompts exceeding 50,000 characters (`sanitizeAIText`).
5. **Human In The Loop**: Model outputs are treated as suggestions; the user must explicitly confirm before creating or modifying live project or task records.

---

## 5. Audit Logging, Secret Protection & Retention Policies

MenkR- provides an enterprise-grade activity and security audit trail for all critical operational events.

### Audited Actions
- **Membership & Access**: `organization.created`, `organization.updated`, `membership.role_updated`, `membership.removed`, `invitation.created`, `invitation.revoked`, `invitation.accepted`.
- **Projects & Tasks**: Project updates, deletions, and dependency checks.
- **Financial**: Creation, updates, and deletion of financial records.
- **Data & Backups**: `data.synchronized`, `backup.exported`, `backup.restored`.
- **System & AI**: `ai.workflow_generated`, `audit.retention_pruned`.

### Secret Scrubbing
Before writing any event to `audit_events`, the metadata is sanitized by `sanitizeAuditMetadata` in `src/utils/auditLogger.ts`. Any keys matching tokens, passwords, API keys, credentials, or cookies are automatically redacted (`[REDACTED]`).

### Retention Policy & Pruning
- Default retention window is **90 days** (configurable to 30, 60, 90, 180, 365 days in Organization Settings).
- Administrators can trigger automated pruning via `POST /api/audit-events/retention`.
- Pruning operations write an `audit.retention_pruned` event recording the number of deleted records.

---

## 6. Unified Search & Record-Level Permissions

The unified search endpoint (`GET /api/search`) operates under strict multi-tenant isolation:
1. Every query requires valid authentication (`requireAuth`) and membership verification (`requireOrgRole('viewer')`).
2. Search filters records across `clients`, `projects`, `tasks`, `templates`, and `documents` scoped strictly by `organizationId = req.orgMember.organizationId`.
3. **Record-Level Permission Check**: Financial records are only queried and returned if the user possesses `manager`, `admin`, or `owner` roles (`hasMinRole(userRole, 'manager')`). Viewers and standard members never receive financial figures in search results.
4. Sensitive document storage paths are never leaked; only high-level metadata (tags, categories) is returned.

---

## 7. Logging, Error Monitoring & Health Diagnostics

### Health Endpoints
- **Public Health Check**: `GET /api/health`
  Returns service status and database engine for load balancers.
- **Operational Administrator Diagnostics**: `GET /api/system/health`
  Protected by `requireOrgRole('admin')`. Provides:
  - Database connectivity latency (ms) and row counts.
  - Storage volume utilization (file count, total MB).
  - Gemini AI status and rate-limiting metrics.
  - Audit trail health and oldest record timestamp.
  - Node process uptime, RSS memory, and heap utilization.

### Client-Side Error Boundary
The application wraps rendering components in `ErrorBoundary.tsx` and provides a safe fallback for `useToast` to prevent unhandled React crashes from breaking the user experience.

---

## 8. Backups, Disaster Recovery & Migration

### Data Snapshot Export
- Administrators can download a complete, sanitized snapshot via `GET /api/organizations/:orgId/backup`.
- The export computes a cryptographic SHA-256 integrity checksum (`metadata.checksum`) and logs `backup.exported` to the audit trail.
- All private authentication credentials, passwords, and API keys are strictly excluded.

### Transactional Restore
- Restoring from backup via `POST /api/organizations/:orgId/restore` runs schema validation with conflict resolution strategies (`skip`, `overwrite`).
- If validation fails, the transaction rolls back cleanly, leaving existing data untouched.

---

## 9. Verification & Runbook

To verify production readiness:

1. **Verify TypeScript compilation**:
   ```bash
   npm run lint
   ```
2. **Build production bundles**:
   ```bash
   npm run build
   ```
3. **Execute unit & integration tests**:
   ```bash
   npx vitest run
   ```
4. **Check health endpoint**:
   ```bash
   curl -s http://localhost:3000/api/health
   ```
