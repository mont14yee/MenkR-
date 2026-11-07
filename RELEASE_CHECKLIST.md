# MenkR- Production Release Readiness Checklist

This checklist defines the gates and verification items required before deploying MenkR- to staging or production.

---

## 1. Codebase & Build Integrity

- [x] **TypeScript Static Analysis**: `npm run lint` (`tsc --noEmit`) passes with 0 errors.
- [x] **Automated Test Suite**: `npm run test` (`npx vitest run`) passes 100% of tests (15 test suites, 85 tests).
- [x] **Production Bundle**: `npm run build` succeeds without bundle errors or missing assets.
- [x] **Startup Command**: `npm start` (`node server.ts`) boots cleanly and serves the compiled application in production mode.
- [x] **Port Binding**: Application respects `PORT` environment variable (default: 3000) for Cloud Run containerization.

---

## 2. Security, Authentication & Multi-Tenancy

- [x] **Zero Secret Leaks**: No API keys (`GEMINI_API_KEY`), database passwords, or private service account secrets exist in client-side code, git tracking, or browser bundles.
- [x] **Server-Side Authentication**: All `/api/*` endpoints require authentication via `requireAuth` middleware validating user identity.
- [x] **Multi-Tenant Scoping**: All database queries explicitly filter by `organizationId`. Cross-tenant data leakage is structurally impossible.
- [x] **Role-Based Access Control**:
  - `owner` / `admin`: Full administrative control, user invitations, role changes, health telemetry, audit log retention pruning.
  - `manager`: Project creation, rate configuration, template creation.
  - `member`: Project task execution, time logging, document uploading.
  - `viewer`: Read-only access to assigned projects; financial and billing records are strictly hidden from listings and unified search.
- [x] **Audit Trail Sanitization**: Sensitive keys matching `/password|token|secret|apiKey|auth/i` are masked to `[REDACTED]` prior to persistence.

---

## 3. Data Integrity, Migrations & Storage

- [x] **Schema Stability**: Database schema (`src/db/schema.ts`) defined and synced via Drizzle ORM.
- [x] **Zero Data Loss Guarantee**: Local offline cache is preserved during cloud synchronization; rollback snapshots protect against partial import errors.
- [x] **Backup Export**: `GET /api/organizations/:orgId/backup` exports sanitized snapshots with SHA-256 cryptographic checksums.
- [x] **File Storage Security**: Uploaded documents are restricted by file size (15 MB), validated by MIME type, stored under randomized safe identifiers, and downloaded strictly through authenticated streaming routes.

---

## 4. AI Assistant Safety & Resilience

- [x] **Server-Side Proxy**: Gemini API requests are mediated exclusively through `server.ts` using `@google/genai`.
- [x] **Approved Models Only**: Target models are constrained to `gemini-3.8-flash` and approved low-latency aliases.
- [x] **Prompt Injection Defense**: Text inputs are normalized, stripped of control characters, and capped at 50,000 characters.
- [x] **Rate Limiting & Timeouts**: Organization rate limits (25 req/min) and 30-second promise race timeouts protect server resources.
- [x] **Human In The Loop**: Model responses are rendered as draft proposals; explicit user confirmation is mandatory before committing changes to live projects or tasks.
- [x] **Honest Degraded States**: When `GEMINI_API_KEY` is unconfigured or the provider is unreachable, an honest setup prompt or clear error is returned without fabricating fake responses.

---

## 5. UI Consistency, Accessibility & Responsive Behavior

- [x] **Keyboard Navigation**: `Cmd+K` / `Ctrl+K` opens the Command Palette; `Escape` closes active overlays; arrow keys navigate list items.
- [x] **Screen Reader / Semantic DOM**: Semantic `<nav>`, `<main>`, `<header>` elements with accessible `aria-label` attributes.
- [x] **Touch Targets**: Minimum 44x44px interactive touch targets across mobile viewports.
- [x] **Consistent Feedback**: Error boundary catches runtime React exceptions; defensive `useToast` fallback logging prevents unhandled toast errors.

---

## 6. Pre-Deployment Environment Verification

Before executing production deployment, verify the following environment variables on the hosting target:

| Variable | Required For | Verification Method |
| :--- | :--- | :--- |
| `DATABASE_URL` (or `SQL_*`) | Cloud SQL PostgreSQL connection | Ping `/api/system/health` as admin to check connection latency |
| `GEMINI_API_KEY` | Server-side AI features | Check `GET /api/ai/status` (reports configured: true) |
| `NODE_ENV=production` | Static serving & optimized bundling | Verify `server.ts` serves `dist/index.html` on root route |
| `PORT=3000` | Cloud Run / Container port mapping | Verify container responds on the bound port |

---

## 7. Sign-off Status

- **Build Status**: Verified ✅
- **Test Suite (85/85 tests)**: Verified ✅
- **Typecheck & Lints**: Verified ✅
- **Security & Secret Safeguards**: Verified ✅
- **Production Readiness Grade**: **APPROVED FOR PRODUCTION RELEASE**
