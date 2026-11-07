# MenkR- Production Business & Workflow Management Suite

MenkR- is an offline-first, multi-tenant enterprise business suite designed for agencies, studios, and freelance operators. It connects client relationships, projects, milestones, time tracking, budgets, reusable workflow templates, encrypted library resources, and an executive Gemini AI assistant into one cohesive platform.

---

## 1. Core Capabilities & Workflows

- **Multi-Tenant Organization Workspaces**: Strict database-level isolation by `organizationId`. Supports collaborative multi-member teams with a 5-tier role-based access control matrix (`owner`, `admin`, `manager`, `member`, `viewer`).
- **Client & CRM Management**: Lead tracking, client dossiers, status lifecycle, interaction history, and contextual links to linked projects and billing.
- **Projects & Task Delivery**: Priority rankings, milestone tracking, interactive checklists, progress calculations, and relational dependency validation.
- **Schedule & Calendar**: Real-time project milestones, task deadlines, time-based commitments, and deep links into parent projects and task details.
- **Workflow Templates**: Blueprint definitions for recurring client onboarding, project plans, task structures, and schedules. Applying a template generates independent live records while keeping the template immutable.
- **Library & Document Management**: Tagged asset library with categorization, ownership tracking, secure disk storage, and safe stream downloads.
- **Time Tracking & Billing**: Single active timer enforcement policy (preventing conflicting timers), manual entries, project/task attribution, and billable revenue calculation based on configured hourly rates.
- **Finance & Budgeting**: Distinct accounting boundaries between estimated budgets and actual logged expenses/income, with project-level profitability summaries.
- **Unified Command Palette (`Cmd+K` / `Ctrl+K`)**: Instant search across clients, projects, tasks, templates, library assets, and navigation actions with keyboard traversal and record-level RBAC filtering.
- **Audit Logging & Retention**: Automated recording of operational events (membership changes, financial edits, migrations) with automated secret scrubbing and configurable retention pruning (30–365 days).
- **Gemini AI Productivity Assistant**: Server-side proxy powering project summaries, task breakdowns, meeting briefs, project plans, risk identification, and status reports with human-in-the-loop confirmation.

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Browser                         │
│  React 19 + TypeScript + Vite + Tailwind CSS + Lucide Icons │
│  Offline Cache (localStorage with auto-healing recovery)   │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS / JSON API (Bearer JWT)
┌──────────────────────────────▼──────────────────────────────┐
│                    Express Backend Server                   │
│  - Middleware: requireAuth, requireOrgRole (RBAC)           │
│  - Multi-tenant query isolation (organization_id)          │
│  - AI Proxy Service: Rate limiting & prompt sanitization    │
│  - Storage Controller: MIME validation & safe streams       │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
┌──────────────▼──────────────┐┌──────────────▼───────────────┐
│     Cloud SQL PostgreSQL    ││       Google Gemini API       │
│  Drizzle ORM (schema.ts)    ││  models/gemini-3.8-flash     │
│  Multi-tenant foreign keys  ││  Server-side API key only    │
└─────────────────────────────┘└──────────────────────────────┘
```

---

## 3. Quickstart & Verification Commands

### Prerequisites
- Node.js 20+ (tested on Node 22)
- PostgreSQL 15+ (optional for local mock / Cloud SQL for production)

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
# Starts backend server + Vite SPA middleware on http://localhost:3000
```

### Static Typecheck & Linting
```bash
npm run lint
# Executes tsc --noEmit (0 errors)
```

### Automated Test Suite
```bash
npm run test
# Executes 15 Vitest test suites (85 passing tests)
```

### Production Build
```bash
npm run build
# Compiles Vite production bundle into dist/
```

### Production Start
```bash
npm start
# Runs node server.ts in production mode, serving dist/
```

---

## 4. Security & Compliance Principles

1. **Server-Side Secret Isolation**: No API keys, database credentials, or service account tokens are exposed to browser bundles or client storage. The Gemini API key is strictly accessed via server environment variables (`GEMINI_API_KEY`).
2. **Multi-Tenant Boundaries**: Every API endpoint verifies `req.orgMember.organizationId`. Records from foreign organizations cannot be read, updated, or discovered via search.
3. **Record-Level RBAC in Search**: Global search queries enforce role entitlements. Users with `viewer` or `member` roles cannot retrieve financial or invoice records.
4. **Audit Metadata Sanitization**: Sensitive keys matching `/password|token|secret|apiKey|auth/i` are automatically masked to `[REDACTED]` before writing to the immutable audit database.
5. **AI Safety & Human Confirmation**: AI prompts are limited to 50,000 characters and stripped of control characters. AI suggestions require explicit user confirmation before modifying project records.

---

## 5. Documentation Directory

- **`DEPLOYMENT.md`**: Complete production operations manual, Cloud SQL setup, environment variable reference, health diagnostics, and container configuration.
- **`DATA_RECOVERY_AND_MIGRATION.md`**: Database backup export with SHA-256 integrity checksums, transactional restore runbooks, and schema evolution rules.
- **`SMOKE_TEST.md`**: Step-by-step walkthrough covering empty states, CRUD lifecycle, and offline persistence.
- **`RELEASE_CHECKLIST.md`**: Production release verification gates and sign-off criteria.

---

## 6. Known Limitations & External Services

- **External Calendar Sync (Google Calendar / Microsoft 365)**: MenkR- provides an internal calendar and schedule view. Bidirectional two-way synchronization with external calendar providers requires configured OAuth credentials and user consent. An honest setup state is displayed when external OAuth is unconfigured.
- **Cloud Object Storage (S3 / GCS)**: File storage currently uses secure local volume disk storage with randomized file naming and access-token verification. Distributed cloud bucket storage (AWS S3 / Google Cloud Storage) can be plugged into the storage controller when credentials are supplied.
- **Accounting & Tax Compliance**: MenkR- provides internal business budgeting, billable rate calculations, and income/expense tracking. It does not provide full tax filing, payroll processing, or statutory accounting compliance.
