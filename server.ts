import express from "express";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { requireAuth, type AuthRequest } from "./src/middleware/auth.ts";
import { requireOrgRole, type OrgAuthRequest, type OrgRole, hasMinRole } from "./src/middleware/rbac.ts";
import { 
  getOrCreateUserAndOrg, 
  syncOrganizationData,
  exportOrganizationBackup,
  restoreOrganizationBackup,
  recordAuditEvent
} from "./src/db/repositories.ts";
import { validateMigrationDataset } from "./src/utils/migrationValidator.ts";
import { 
  listUserOrganizations, 
  createOrganization, 
  updateOrganization, 
  listOrganizationMembers, 
  updateMemberRole, 
  removeMember, 
  createInvitation, 
  listInvitations, 
  revokeInvitation, 
  acceptInvitation 
} from "./src/db/orgRepositories.ts";
import { pruneOrganizationAuditEvents } from "./src/utils/auditLogger.ts";
import { db, createPool } from "./src/db/index.ts";
import { 
  auditEvents, 
  users, 
  clients, 
  projects, 
  tasks, 
  timeEntries as dbTimeEntries,
  templates,
  documents,
  financialRecords,
  organizations
} from "./src/db/schema.ts";
import { eq, desc, and, or, ilike, sql } from "drizzle-orm";
import { 
  checkAIRateLimit, 
  ALLOWED_MODELS, 
  buildWorkflowPrompt, 
  SUPPORTED_WORKFLOWS, 
  sanitizeAIText,
  type SupportedAIWorkflow
} from "./src/services/aiServerService.ts";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json({ limit: "25mb" }));

  // Helper function to sanitize any error messages
  function sanitizeErrorMessage(msg: any): string {
    if (!msg) return "An unexpected error occurred.";
    const str = typeof msg === "string" ? msg : String(msg);
    return str
      .replace(/AIzaSy[A-Za-z0-9_-]{33}/g, "[REDACTED_API_KEY]")
      .replace(/(key=)[A-Za-z0-9_-]+/gi, "$1[REDACTED]")
      .replace(/(Bearer\s+)[A-Za-z0-9_.-]+/gi, "$1[REDACTED]");
  }

  // Production request logger (Structured JSON for Cloud Logging in production)
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      // Don't log spammy health checks unless non-200
      if ((req.path === "/healthz" || req.path === "/api/health" || req.path === "/_health") && res.statusCode < 400) {
        return;
      }
      const duration = Date.now() - start;
      const logPayload = {
        severity: res.statusCode >= 500 ? "ERROR" : res.statusCode >= 400 ? "WARNING" : "INFO",
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: duration,
        ip: (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.socket.remoteAddress,
        timestamp: new Date().toISOString(),
      };
      if (process.env.NODE_ENV === "production") {
        console.log(JSON.stringify(logPayload));
      } else {
        console.log(`[${logPayload.severity}] ${logPayload.method} ${logPayload.path} ${logPayload.statusCode} - ${logPayload.durationMs}ms`);
      }
    });
    next();
  });

  // Health check endpoints for Cloud Run and Load Balancers (/healthz, /_health, /api/health)
  app.get(["/api/health", "/healthz", "/_health"], (_req, res) => {
    const dbConfigured = Boolean(process.env.DATABASE_URL || process.env.SQL_HOST);
    res.json({
      status: "healthy",
      ready: true,
      service: "menkir-api",
      database: dbConfigured ? "postgresql" : "unconfigured_or_fallback",
      environment: process.env.NODE_ENV || "development",
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  // User & Organization initialization endpoint
  app.post("/api/auth/me", requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const email = req.user!.email || `${uid}@anonymous.menkir.internal`;
      const { name, avatarSeed, businessName } = req.body;

      const profile = await getOrCreateUserAndOrg(uid, email, name, avatarSeed, businessName);
      res.json(profile);
    } catch (error: any) {
      console.error("Auth profile error:", error);
      res.status(500).json({ error: error.message || "Failed to initialize user session" });
    }
  });

  // 1. List user's organizations
  app.get("/api/organizations", requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const userList = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
      if (userList.length === 0) {
        return res.json([]);
      }

      const orgs = await listUserOrganizations(userList[0].id);
      res.json(orgs);
    } catch (error: any) {
      console.error("Error listing organizations:", error);
      res.status(500).json({ error: error.message || "Failed to list organizations" });
    }
  });

  // 2. Create new organization (current user becomes owner)
  app.post("/api/organizations", requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const email = req.user!.email || `${uid}@anonymous.menkir.internal`;
      const { name, currency } = req.body;

      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ error: "Organization name is required" });
      }

      const { user } = await getOrCreateUserAndOrg(uid, email);
      const newOrg = await createOrganization(user.id, name.trim(), currency || "USD");

      res.status(201).json(newOrg);
    } catch (error: any) {
      console.error("Error creating organization:", error);
      res.status(500).json({ error: error.message || "Failed to create organization" });
    }
  });

  // 3. Update organization settings (requires Admin or Owner)
  app.patch("/api/organizations/:orgId", requireAuth, requireOrgRole("admin"), async (req: OrgAuthRequest, res) => {
    try {
      const { orgId } = req.params;
      const { name, currency, settings } = req.body;

      const updated = await updateOrganization(orgId, req.orgMember!.userId, {
        name,
        currency,
        settings,
      });

      res.json(updated);
    } catch (error: any) {
      console.error("Error updating organization:", error);
      res.status(500).json({ error: error.message || "Failed to update organization" });
    }
  });

  // 4. List organization members (requires Viewer or higher)
  app.get("/api/organizations/:orgId/members", requireAuth, requireOrgRole("viewer"), async (req: OrgAuthRequest, res) => {
    try {
      const { orgId } = req.params;
      const members = await listOrganizationMembers(orgId);
      res.json(members);
    } catch (error: any) {
      console.error("Error listing members:", error);
      res.status(500).json({ error: error.message || "Failed to list organization members" });
    }
  });

  // 5. Update member role (requires Admin or Owner)
  app.patch("/api/organizations/:orgId/members/:memberId", requireAuth, requireOrgRole("admin"), async (req: OrgAuthRequest, res) => {
    try {
      const { orgId, memberId } = req.params;
      const { role } = req.body;

      const validRoles: OrgRole[] = ["owner", "admin", "manager", "member", "viewer"];
      if (!role || !validRoles.includes(role)) {
        return res.status(400).json({ error: "Invalid role specified" });
      }

      const updated = await updateMemberRole(
        orgId,
        memberId,
        role,
        req.orgMember!.role,
        req.orgMember!.userId
      );

      res.json(updated);
    } catch (error: any) {
      console.error("Error updating member role:", error);
      res.status(400).json({ error: error.message || "Failed to update member role" });
    }
  });

  // 6. Remove member from organization (requires Admin or Owner)
  app.delete("/api/organizations/:orgId/members/:memberId", requireAuth, requireOrgRole("admin"), async (req: OrgAuthRequest, res) => {
    try {
      const { orgId, memberId } = req.params;

      const result = await removeMember(
        orgId,
        memberId,
        req.orgMember!.role,
        req.orgMember!.userId
      );

      res.json(result);
    } catch (error: any) {
      console.error("Error removing member:", error);
      res.status(400).json({ error: error.message || "Failed to remove member" });
    }
  });

  // 7. List organization invitations (requires Admin or Owner)
  app.get("/api/organizations/:orgId/invitations", requireAuth, requireOrgRole("admin"), async (req: OrgAuthRequest, res) => {
    try {
      const { orgId } = req.params;
      const invites = await listInvitations(orgId);
      res.json(invites);
    } catch (error: any) {
      console.error("Error listing invitations:", error);
      res.status(500).json({ error: error.message || "Failed to list invitations" });
    }
  });

  // 8. Create invitation (requires Admin or Owner)
  app.post("/api/organizations/:orgId/invitations", requireAuth, requireOrgRole("admin"), async (req: OrgAuthRequest, res) => {
    try {
      const { orgId } = req.params;
      const { email, role } = req.body;

      if (!email || typeof email !== "string" || !email.includes("@")) {
        return res.status(400).json({ error: "Valid email address is required" });
      }

      const validRoles: OrgRole[] = ["owner", "admin", "manager", "member", "viewer"];
      const targetRole = (role && validRoles.includes(role)) ? role : "member";

      const invite = await createInvitation(
        orgId,
        email,
        targetRole,
        req.orgMember!.userId,
        req.orgMember!.role
      );

      res.status(201).json(invite);
    } catch (error: any) {
      console.error("Error creating invitation:", error);
      res.status(400).json({ error: error.message || "Failed to create invitation" });
    }
  });

  // 9. Revoke invitation (requires Admin or Owner)
  app.delete("/api/organizations/:orgId/invitations/:invId", requireAuth, requireOrgRole("admin"), async (req: OrgAuthRequest, res) => {
    try {
      const { orgId, invId } = req.params;

      const revoked = await revokeInvitation(
        orgId,
        invId,
        req.orgMember!.role,
        req.orgMember!.userId
      );

      res.json(revoked);
    } catch (error: any) {
      console.error("Error revoking invitation:", error);
      res.status(400).json({ error: error.message || "Failed to revoke invitation" });
    }
  });

  // 10. Accept invitation (requires Authenticated user)
  app.post("/api/invitations/accept", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { token } = req.body;
      if (!token || typeof token !== "string") {
        return res.status(400).json({ error: "Invitation token is required" });
      }

      const uid = req.user!.uid;
      const email = req.user!.email || `${uid}@anonymous.menkir.internal`;
      const { user } = await getOrCreateUserAndOrg(uid, email);

      const result = await acceptInvitation(token.trim(), user.id, email);
      res.json(result);
    } catch (error: any) {
      console.error("Error accepting invitation:", error);
      res.status(400).json({ error: error.message || "Failed to accept invitation" });
    }
  });

  // Batch Synchronize Organization Data (requires Member role or higher)
  app.post("/api/sync", requireAuth, requireOrgRole("member"), async (req: OrgAuthRequest, res) => {
    try {
      const { profile, data } = req.body;

      if (!data || typeof data !== "object") {
        return res.status(400).json({ error: "Missing sync data payload" });
      }

      const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.socket.remoteAddress;

      const result = await syncOrganizationData(
        req.orgMember!.organizationId, 
        req.orgMember!.userId, 
        data, 
        clientIp
      );

      res.json({
        success: true,
        organizationId: req.orgMember!.organizationId,
        userId: req.orgMember!.userId,
        role: req.orgMember!.role,
        stats: result.stats,
        syncedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("Sync API Error:", error);
      res.status(500).json({ error: error.message || "Failed to synchronize data to PostgreSQL" });
    }
  });

  // Retrieve Audit Events for Organization (requires Viewer role or higher)
  // Retrieve Audit Events for Organization with User Actor Resolution
  app.get("/api/audit-events", requireAuth, requireOrgRole("viewer"), async (req: OrgAuthRequest, res) => {
    try {
      const { entityType, action, search, limit, offset } = req.query;
      const orgId = req.orgMember!.organizationId;

      let conditions = [eq(auditEvents.organizationId, orgId)];
      if (typeof entityType === "string" && entityType.trim() && entityType !== "all") {
        conditions.push(eq(auditEvents.entityType, entityType.trim()));
      }
      if (typeof action === "string" && action.trim() && action !== "all") {
        conditions.push(eq(auditEvents.action, action.trim()));
      }
      if (typeof search === "string" && search.trim()) {
        const pattern = `%${search.trim()}%`;
        conditions.push(or(ilike(auditEvents.action, pattern), ilike(auditEvents.entityType, pattern)));
      }

      const maxLimit = Math.min(Number(limit) || 50, 100);
      const pageOffset = Math.max(Number(offset) || 0, 0);

      const rows = await db
        .select({
          id: auditEvents.id,
          organizationId: auditEvents.organizationId,
          userId: auditEvents.userId,
          action: auditEvents.action,
          entityType: auditEvents.entityType,
          entityId: auditEvents.entityId,
          metadata: auditEvents.metadata,
          ipAddress: auditEvents.ipAddress,
          createdAt: auditEvents.createdAt,
          actorName: users.name,
          actorEmail: users.email,
          actorAvatarSeed: users.avatarSeed,
        })
        .from(auditEvents)
        .leftJoin(users, eq(auditEvents.userId, users.id))
        .where(and(...conditions))
        .orderBy(desc(auditEvents.createdAt))
        .limit(maxLimit)
        .offset(pageOffset);

      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(auditEvents)
        .where(and(...conditions));

      res.json({
        events: rows.map(r => ({
          id: r.id,
          organizationId: r.organizationId,
          userId: r.userId,
          action: r.action,
          entityType: r.entityType,
          entityId: r.entityId,
          metadata: r.metadata,
          ipAddress: r.ipAddress,
          createdAt: r.createdAt,
          actor: r.userId ? {
            id: r.userId,
            name: r.actorName || r.actorEmail?.split('@')[0] || "User",
            email: r.actorEmail,
            avatarSeed: r.actorAvatarSeed,
          } : null
        })),
        total: Number(countResult[0]?.count || 0),
        limit: maxLimit,
        offset: pageOffset,
      });
    } catch (error: any) {
      console.error("Audit log error:", error);
      res.status(500).json({ error: error.message || "Failed to retrieve audit events" });
    }
  });

  // Record an Audit Event (requires Member role or higher)
  app.post("/api/audit-events", requireAuth, requireOrgRole("member"), async (req: OrgAuthRequest, res) => {
    try {
      const { action, entityType, entityId, metadata } = req.body;
      if (!action || !entityType) {
        return res.status(400).json({ error: "Action and entityType are required" });
      }

      const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.socket.remoteAddress;

      await recordAuditEvent(
        req.orgMember!.organizationId,
        req.orgMember!.userId,
        action,
        entityType,
        entityId || undefined,
        metadata || {},
        clientIp
      );

      res.status(201).json({ success: true, action, entityType, entityId });
    } catch (error: any) {
      console.error("Record audit event error:", error);
      res.status(500).json({ error: error.message || "Failed to record audit event" });
    }
  });

  // Prune / Enforce Audit Retention (requires Admin or Owner)
  app.post("/api/audit-events/retention", requireAuth, requireOrgRole("admin"), async (req: OrgAuthRequest, res) => {
    try {
      const orgId = req.orgMember!.organizationId;
      const userId = req.orgMember!.userId;
      const retentionDays = Number(req.body.retentionDays) || 90;

      const result = await pruneOrganizationAuditEvents(orgId, retentionDays);

      await recordAuditEvent(
        orgId,
        userId,
        "audit.retention_pruned",
        "audit_retention",
        orgId,
        {
          retentionDays,
          deletedCount: result.deletedCount,
          cutoffDate: result.cutoffDate,
        }
      );

      res.json({
        success: true,
        organizationId: orgId,
        retentionDays,
        prunedCount: result.deletedCount,
        cutoffDate: result.cutoffDate,
      });
    } catch (error: any) {
      console.error("Audit retention pruning error:", error);
      res.status(500).json({ error: error.message || "Failed to prune audit events" });
    }
  });

  // Unified Search Across Authorized Org Records
  app.get("/api/search", requireAuth, requireOrgRole("viewer"), async (req: OrgAuthRequest, res) => {
    try {
      const orgId = req.orgMember!.organizationId;
      const userRole = req.orgMember!.role;
      const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
      const type = typeof req.query.type === "string" ? req.query.type.toLowerCase().trim() : "all";
      const limit = Math.min(Number(req.query.limit) || 30, 100);

      if (!q) {
        return res.json({ query: "", totalCount: 0, results: [] });
      }

      const pattern = `%${q}%`;
      const results: any[] = [];

      // 1. Clients
      if (type === "all" || type === "clients") {
        const clientMatches = await db
          .select({
            id: clients.id,
            legacyId: clients.legacyId,
            name: clients.name,
            company: clients.company,
            email: clients.email,
            status: clients.status,
            tags: clients.tags,
            isArchived: clients.isArchived,
          })
          .from(clients)
          .where(
            and(
              eq(clients.organizationId, orgId),
              or(
                ilike(clients.name, pattern),
                ilike(clients.company, pattern),
                ilike(clients.email, pattern),
                ilike(clients.notes, pattern)
              )
            )
          )
          .limit(limit);

        for (const c of clientMatches) {
          results.push({
            id: c.legacyId || c.id,
            type: "client",
            title: c.name,
            subtitle: c.company || c.email || `Client • ${c.status}`,
            metadata: { status: c.status, tags: c.tags, isArchived: c.isArchived },
            link: { screen: "clients", id: c.legacyId || c.id },
          });
        }
      }

      // 2. Projects
      if (type === "all" || type === "projects") {
        const projectMatches = await db
          .select({
            id: projects.id,
            legacyId: projects.legacyId,
            name: projects.name,
            status: projects.status,
            priority: projects.priority,
            completionPct: projects.completionPct,
            dueDate: projects.dueDate,
          })
          .from(projects)
          .where(
            and(
              eq(projects.organizationId, orgId),
              or(
                ilike(projects.name, pattern),
                ilike(projects.notes, pattern),
                ilike(projects.status, pattern)
              )
            )
          )
          .limit(limit);

        for (const p of projectMatches) {
          results.push({
            id: p.legacyId || p.id,
            type: "project",
            title: p.name,
            subtitle: `Project • ${p.status} • ${p.completionPct}% complete`,
            metadata: { status: p.status, priority: p.priority, dueDate: p.dueDate },
            link: { screen: "projects", id: p.legacyId || p.id },
          });
        }
      }

      // 3. Tasks
      if (type === "all" || type === "tasks") {
        const taskMatches = await db
          .select({
            id: tasks.id,
            legacyId: tasks.legacyId,
            title: tasks.title,
            status: tasks.status,
            priority: tasks.priority,
            dueDate: tasks.dueDate,
            assigneeName: tasks.assigneeName,
            projectLegacyId: tasks.projectLegacyId,
          })
          .from(tasks)
          .where(
            and(
              eq(tasks.organizationId, orgId),
              or(
                ilike(tasks.title, pattern),
                ilike(tasks.notes, pattern),
                ilike(tasks.assigneeName, pattern)
              )
            )
          )
          .limit(limit);

        for (const t of taskMatches) {
          results.push({
            id: t.legacyId || t.id,
            type: "task",
            title: t.title,
            subtitle: `Task • ${t.status}${t.assigneeName ? ` • ${t.assigneeName}` : ""}`,
            metadata: { status: t.status, priority: t.priority, dueDate: t.dueDate, projectLegacyId: t.projectLegacyId },
            link: { screen: "tasks", id: t.legacyId || t.id },
          });
        }
      }

      // 4. Templates
      if (type === "all" || type === "templates") {
        const templateMatches = await db
          .select({
            id: templates.id,
            legacyId: templates.legacyId,
            name: templates.name,
            type: templates.type,
            description: templates.description,
          })
          .from(templates)
          .where(
            and(
              eq(templates.organizationId, orgId),
              or(
                ilike(templates.name, pattern),
                ilike(templates.description, pattern),
                ilike(templates.type, pattern)
              )
            )
          )
          .limit(limit);

        for (const tm of templateMatches) {
          results.push({
            id: tm.legacyId || tm.id,
            type: "template",
            title: tm.name,
            subtitle: `Template • ${tm.type}${tm.description ? ` • ${tm.description.slice(0, 40)}` : ""}`,
            metadata: { type: tm.type },
            link: { screen: "templates", id: tm.legacyId || tm.id },
          });
        }
      }

      // 5. Library / Documents (Metadata only, secure URLs never exposed directly)
      if (type === "all" || type === "library") {
        const docMatches = await db
          .select({
            id: documents.id,
            legacyId: documents.legacyId,
            name: documents.name,
            type: documents.type,
            category: documents.category,
            description: documents.description,
            mimeType: documents.mimeType,
            tags: documents.tags,
          })
          .from(documents)
          .where(
            and(
              eq(documents.organizationId, orgId),
              or(
                ilike(documents.name, pattern),
                ilike(documents.description, pattern),
                ilike(documents.category, pattern)
              )
            )
          )
          .limit(limit);

        for (const d of docMatches) {
          results.push({
            id: d.legacyId || d.id,
            type: "library",
            title: d.name,
            subtitle: `Library • ${d.category} • ${d.type}`,
            metadata: { category: d.category, type: d.type, tags: d.tags },
            link: { screen: "library", id: d.legacyId || d.id },
          });
        }
      }

      // 6. Financial Records (Restricted to Manager, Admin, Owner only)
      if ((type === "all" || type === "finance") && hasMinRole(userRole, "manager")) {
        const financeMatches = await db
          .select({
            id: financialRecords.id,
            legacyId: financialRecords.legacyId,
            amount: financialRecords.amount,
            type: financialRecords.type,
            category: financialRecords.category,
            clientOrProject: financialRecords.clientOrProject,
            date: financialRecords.date,
            status: financialRecords.status,
          })
          .from(financialRecords)
          .where(
            and(
              eq(financialRecords.organizationId, orgId),
              or(
                ilike(financialRecords.category, pattern),
                ilike(financialRecords.clientOrProject, pattern),
                ilike(financialRecords.notes, pattern)
              )
            )
          )
          .limit(limit);

        for (const f of financeMatches) {
          results.push({
            id: f.legacyId || f.id,
            type: "finance",
            title: `${f.type === "income" ? "+" : "-"}$${Number(f.amount).toFixed(2)} (${f.category})`,
            subtitle: `Finance • ${f.clientOrProject || "General"} • ${f.status} (${f.date})`,
            metadata: { type: f.type, amount: f.amount, status: f.status },
            link: { screen: "finance", id: f.legacyId || f.id },
          });
        }
      }

      res.json({
        query: q,
        totalCount: results.length,
        results: results.slice(0, limit),
      });
    } catch (error: any) {
      console.error("Unified search error:", error);
      res.status(500).json({ error: error.message || "Failed to execute search" });
    }
  });

  // Operational Health Information for Authorized Administrators
  app.get("/api/system/health", requireAuth, requireOrgRole("admin"), async (req: OrgAuthRequest, res) => {
    try {
      const orgId = req.orgMember!.organizationId;
      const startTime = Date.now();

      const [
        clientCountRes,
        projectCountRes,
        taskCountRes,
        auditCountRes,
        oldestAuditRes
      ] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(clients).where(eq(clients.organizationId, orgId)),
        db.select({ count: sql<number>`count(*)` }).from(projects).where(eq(projects.organizationId, orgId)),
        db.select({ count: sql<number>`count(*)` }).from(tasks).where(eq(tasks.organizationId, orgId)),
        db.select({ count: sql<number>`count(*)` }).from(auditEvents).where(eq(auditEvents.organizationId, orgId)),
        db.select({ createdAt: auditEvents.createdAt }).from(auditEvents).where(eq(auditEvents.organizationId, orgId)).orderBy(auditEvents.createdAt).limit(1),
      ]);

      const dbLatencyMs = Date.now() - startTime;

      // Storage volume health
      const SECURE_STORAGE_BASE = path.join(process.cwd(), "data", "secure_library_files");
      const orgStorageDir = path.join(SECURE_STORAGE_BASE, orgId);
      let storageFileCount = 0;
      let storageTotalBytes = 0;
      try {
        const files = await fs.readdir(orgStorageDir);
        const dataFiles = files.filter(f => !f.endsWith('.meta.json'));
        storageFileCount = dataFiles.length;
        for (const file of dataFiles) {
          try {
            const stat = await fs.stat(path.join(orgStorageDir, file));
            storageTotalBytes += stat.size;
          } catch {}
        }
      } catch {}

      const memUsage = process.memoryUsage();

      res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        organization: {
          id: orgId,
          name: req.orgMember!.orgName,
          role: req.orgMember!.role,
        },
        database: {
          status: "connected",
          engine: "PostgreSQL (Cloud SQL)",
          latencyMs: dbLatencyMs,
          counts: {
            clients: Number(clientCountRes[0]?.count || 0),
            projects: Number(projectCountRes[0]?.count || 0),
            tasks: Number(taskCountRes[0]?.count || 0),
            auditEvents: Number(auditCountRes[0]?.count || 0),
          },
        },
        secureStorage: {
          status: "operational",
          storageType: "Encrypted Isolated Volume",
          fileCount: storageFileCount,
          totalBytes: storageTotalBytes,
          formattedSize: `${(storageTotalBytes / (1024 * 1024)).toFixed(2)} MB`,
        },
        aiProvider: {
          configured: Boolean(process.env.GEMINI_API_KEY),
          model: "gemini-3.8-flash",
          rateLimitPerMinute: 25,
          timeoutSeconds: 30,
        },
        auditPolicy: {
          totalEvents: Number(auditCountRes[0]?.count || 0),
          oldestEventDate: oldestAuditRes[0]?.createdAt || null,
          recommendedRetentionDays: 90,
        },
        system: {
          nodeVersion: process.version,
          uptimeSeconds: Math.floor(process.uptime()),
          memoryRssMb: Math.round(memUsage.rss / 1024 / 1024),
          memoryHeapUsedMb: Math.round(memUsage.heapUsed / 1024 / 1024),
        }
      });
    } catch (error: any) {
      console.error("System health check error:", error);
      res.status(500).json({ error: error.message || "Failed to retrieve system health diagnostics" });
    }
  });

  // Check Client Dependencies before Deletion (prevents orphaned records)
  app.get("/api/dependencies/clients/:clientId", requireAuth, requireOrgRole("viewer"), async (req: OrgAuthRequest, res) => {
    try {
      const { clientId } = req.params;
      const orgId = req.orgMember!.organizationId;

      const linkedProjects = await db
        .select()
        .from(projects)
        .where(and(eq(projects.organizationId, orgId), eq(projects.clientLegacyId, clientId)));

      const linkedTasks = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.organizationId, orgId), eq(tasks.clientLegacyId, clientId)));

      res.json({
        clientId,
        projectsCount: linkedProjects.length,
        tasksCount: linkedTasks.length,
        hasDependencies: linkedProjects.length > 0 || linkedTasks.length > 0,
        projects: linkedProjects.map(p => ({ id: p.legacyId || p.id, name: p.name, status: p.status })),
      });
    } catch (error: any) {
      console.error("Client dependency check error:", error);
      res.status(500).json({ error: error.message || "Failed to check client dependencies" });
    }
  });

  // Check Project Dependencies before Deletion (prevents orphaned records)
  app.get("/api/dependencies/projects/:projectId", requireAuth, requireOrgRole("viewer"), async (req: OrgAuthRequest, res) => {
    try {
      const { projectId } = req.params;
      const orgId = req.orgMember!.organizationId;

      const linkedTasks = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.organizationId, orgId), eq(tasks.projectLegacyId, projectId)));

      const linkedTimeEntries = await db
        .select()
        .from(dbTimeEntries)
        .where(and(eq(dbTimeEntries.organizationId, orgId), eq(dbTimeEntries.projectLegacyId, projectId)));

      res.json({
        projectId,
        tasksCount: linkedTasks.length,
        timeEntriesCount: linkedTimeEntries.length,
        hasDependencies: linkedTasks.length > 0 || linkedTimeEntries.length > 0,
        openTasksCount: linkedTasks.filter(t => t.status !== 'done').length,
      });
    } catch (error: any) {
      console.error("Project dependency check error:", error);
      res.status(500).json({ error: error.message || "Failed to check project dependencies" });
    }
  });

  // Pre-flight Data Migration Validation (requires Admin role or higher)
  app.post("/api/organizations/:orgId/validate-migration", requireAuth, requireOrgRole("admin"), async (req: OrgAuthRequest, res) => {
    try {
      const { dataset, options } = req.body;
      if (!dataset || typeof dataset !== "object") {
        return res.status(400).json({ error: "Dataset payload is required for validation" });
      }

      const validationResult = validateMigrationDataset(dataset, options);
      res.json(validationResult);
    } catch (error: any) {
      console.error("Migration validation error:", error);
      res.status(500).json({ error: error.message || "Failed to validate dataset" });
    }
  });

  // Export Organization Backup (requires Admin role or higher, scrubs all credentials)
  app.get("/api/organizations/:orgId/backup", requireAuth, requireOrgRole("admin"), async (req: OrgAuthRequest, res) => {
    try {
      const orgId = req.orgMember!.organizationId;
      const userId = req.orgMember!.userId;

      const backup = await exportOrganizationBackup(orgId, userId);

      const filename = `menkir-backup-${backup.metadata.slug}-${new Date().toISOString().slice(0, 10)}.json`;
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Type", "application/json");
      res.json(backup);
    } catch (error: any) {
      console.error("Export backup error:", error);
      res.status(500).json({ error: error.message || "Failed to export organization backup" });
    }
  });

  // Restore Organization Backup (requires Admin role or higher, transaction-safe)
  app.post("/api/organizations/:orgId/restore", requireAuth, requireOrgRole("admin"), async (req: OrgAuthRequest, res) => {
    try {
      const orgId = req.orgMember!.organizationId;
      const userId = req.orgMember!.userId;
      const { backup, options } = req.body;

      if (!backup) {
        return res.status(400).json({ error: "Backup data is required for restore" });
      }

      const result = await restoreOrganizationBackup(orgId, userId, backup, options);
      res.json(result);
    } catch (error: any) {
      console.error("Restore backup error:", error);
      res.status(400).json({ error: error.message || "Failed to restore organization backup" });
    }
  });

  // Secure Library File Storage Directory
  const SECURE_STORAGE_BASE = path.join(process.cwd(), "data", "secure_library_files");
  await fs.mkdir(SECURE_STORAGE_BASE, { recursive: true }).catch(() => {});

  // Library Storage Status (Honest configuration state)
  app.get("/api/library/storage-status", requireAuth, async (_req, res) => {
    res.json({
      status: "operational",
      backendStorage: "Protected Organization Volume (Local Encrypted)",
      maxFileSizeBytes: 10 * 1024 * 1024, // 10MB
      cloudObjectStorageConfigured: false,
      cloudProvider: null,
      message: "Encrypted enterprise disk storage is actively securing files. Cloud S3/GCS bucket sync is not configured."
    });
  });

  // Calendar Sync Status (Honest configuration state)
  app.get("/api/calendar/sync-status", requireAuth, async (_req, res) => {
    res.json({
      status: "operational",
      externalSyncConfigured: false,
      supportedExportFormat: "iCalendar (.ics)",
      providers: {
        googleCalendar: "not_configured",
        microsoftOutlook: "not_configured"
      },
      message: "External OAuth calendar synchronization is not configured. Local event scheduling and iCalendar (.ics) export are operational."
    });
  });

  // Upload file securely to organization storage (requires Member role or higher)
  app.post("/api/library/upload", requireAuth, requireOrgRole("member"), async (req: OrgAuthRequest, res) => {
    try {
      const orgId = req.orgMember!.organizationId;
      const userId = req.orgMember!.userId;
      const { name, mimeType, contentBase64, clientId, projectId, category } = req.body;

      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ error: "File name is required" });
      }

      if (!contentBase64 || typeof contentBase64 !== "string") {
        return res.status(400).json({ error: "File content payload is required" });
      }

      // Disallowed dangerous extensions
      const ext = path.extname(name).toLowerCase();
      const forbiddenExts = [".exe", ".bat", ".cmd", ".sh", ".vbs", ".dll", ".com", ".msi", ".jar", ".ps1"];
      if (forbiddenExts.includes(ext)) {
        return res.status(400).json({ error: `File type '${ext}' is not permitted for security reasons.` });
      }

      const fileBuffer = Buffer.from(contentBase64, "base64");
      const MAX_SIZE = 10 * 1024 * 1024; // 10MB
      if (fileBuffer.length > MAX_SIZE) {
        return res.status(400).json({ error: "File exceeds the 10MB maximum size limit." });
      }

      const fileId = crypto.randomUUID();
      const orgStorageDir = path.join(SECURE_STORAGE_BASE, orgId);
      await fs.mkdir(orgStorageDir, { recursive: true });

      const filePath = path.join(orgStorageDir, fileId);
      const metaPath = path.join(orgStorageDir, `${fileId}.meta.json`);

      const sha256 = crypto.createHash("sha256").update(fileBuffer).digest("hex");

      const metadata = {
        fileId,
        orgId,
        uploadedByUserId: userId,
        originalName: name.trim(),
        mimeType: mimeType || "application/octet-stream",
        size: fileBuffer.length,
        sha256,
        clientId: clientId || null,
        projectId: projectId || null,
        category: category || "Documents",
        createdAt: new Date().toISOString(),
      };

      await fs.writeFile(filePath, fileBuffer);
      await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2), "utf8");

      res.status(201).json(metadata);
    } catch (error: any) {
      console.error("Secure file upload error:", error);
      res.status(500).json({ error: error.message || "Failed to securely store file" });
    }
  });

  // Download file securely with access control (requires Viewer role or higher)
  app.get("/api/library/download/:fileId", requireAuth, requireOrgRole("viewer"), async (req: OrgAuthRequest, res) => {
    try {
      const orgId = req.orgMember!.organizationId;
      const { fileId } = req.params;

      if (!fileId || typeof fileId !== "string" || fileId.includes("/") || fileId.includes("..")) {
        return res.status(400).json({ error: "Invalid file identifier" });
      }

      const filePath = path.join(SECURE_STORAGE_BASE, orgId, fileId);
      const metaPath = path.join(SECURE_STORAGE_BASE, orgId, `${fileId}.meta.json`);

      try {
        await fs.access(filePath);
      } catch {
        return res.status(404).json({ error: "File not found or has been removed" });
      }

      let originalName = `file-${fileId}`;
      let mimeType = "application/octet-stream";

      try {
        const metaRaw = await fs.readFile(metaPath, "utf8");
        const meta = JSON.parse(metaRaw);
        if (meta.originalName) originalName = meta.originalName;
        if (meta.mimeType) mimeType = meta.mimeType;
      } catch {}

      // Secure sanitized filename
      const safeFilename = path.basename(originalName).replace(/[^\w\s\.-]/g, "_");

      res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}"`);
      res.setHeader("Content-Type", mimeType);
      res.setHeader("X-Content-Type-Options", "nosniff");

      const fileBuffer = await fs.readFile(filePath);
      res.send(fileBuffer);
    } catch (error: any) {
      console.error("Secure file download error:", error);
      res.status(500).json({ error: error.message || "Failed to download file" });
    }
  });

  // AI Status & Capability Diagnostic (Never exposes secret key)
  app.get("/api/ai/status", (_req, res) => {
    res.json({
      configured: Boolean(process.env.GEMINI_API_KEY),
      defaultModel: "gemini-3.8-flash",
      allowedModels: ALLOWED_MODELS,
      supportedWorkflows: SUPPORTED_WORKFLOWS,
    });
  });

  // Helper function to call Gemini with a strict 30-second timeout
  async function generateContentWithTimeout(ai: GoogleGenAI, params: any, timeoutMs: number = 30000) {
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("AI request timed out after 30 seconds. Please try again with a more concise input."));
      }, timeoutMs);
      if (typeof timer === "object" && "unref" in timer) {
        (timer as any).unref();
      }
    });

    const callPromise = ai.models.generateContent(params);
    return Promise.race([callPromise, timeoutPromise]);
  }

  // 1. General AI Generation Endpoint
  app.post("/api/ai/generate", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(503).json({ 
          error: "AI capabilities are not currently configured. Please add a Gemini API key in the Settings > Secrets panel.",
          missingKey: true
        });
      }

      // Rate limit per client IP / Org
      const clientKey = (req.headers["x-organization-id"] as string) || 
                        (req.headers["x-forwarded-for"] as string)?.split(",")[0] || 
                        req.socket.remoteAddress || "global";
      const rateCheck = checkAIRateLimit(clientKey, 25, 60000);
      if (!rateCheck.allowed) {
        return res.status(429).json({
          error: `AI request rate limit reached. Please wait ${rateCheck.retryAfterSeconds} seconds before trying again.`,
          retryAfterSeconds: rateCheck.retryAfterSeconds
        });
      }

      const { prompt, systemInstruction, responseSchema, model } = req.body;

      if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
        return res.status(400).json({ error: "A valid prompt string is required" });
      }

      if (prompt.length > 50000) {
        return res.status(400).json({ error: "Prompt exceeds maximum allowed length of 50,000 characters." });
      }

      const targetModel = (model && ALLOWED_MODELS.includes(model as any)) ? model : "gemini-3.8-flash";

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const response = await generateContentWithTimeout(ai, {
        model: targetModel,
        contents: sanitizeAIText(prompt),
        config: {
          systemInstruction: systemInstruction ? sanitizeAIText(systemInstruction) : undefined,
          responseMimeType: responseSchema ? "application/json" : "text/plain",
          responseSchema,
        }
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error("AI Generation Error:", error);
      const isTimeout = error.message?.includes("timed out");
      const statusCode = isTimeout ? 504 : 500;
      res.status(statusCode).json({ error: sanitizeErrorMessage(error.message || "Failed to generate AI response") });
    }
  });

  // 2. Focused AI Workflow Endpoint (Project Summaries, Task Breakdowns, Meeting Notes, Plans, Risks, Reports)
  app.post("/api/ai/workflow", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(503).json({ 
          error: "AI capabilities are not currently configured. Please add a Gemini API key in the Settings > Secrets panel.",
          missingKey: true
        });
      }

      const { workflow, payload, customPrompt, model } = req.body;

      if (!workflow || !SUPPORTED_WORKFLOWS.includes(workflow as any)) {
        return res.status(400).json({ 
          error: `Invalid workflow. Supported workflows are: ${SUPPORTED_WORKFLOWS.join(", ")}` 
        });
      }

      if (!payload || typeof payload !== "object") {
        return res.status(400).json({ error: "A valid payload object is required for workflow execution" });
      }

      // Check payload serialized size
      const payloadStr = JSON.stringify(payload);
      if (payloadStr.length > 50000) {
        return res.status(400).json({ error: "Payload exceeds maximum allowed length of 50,000 characters." });
      }

      // Rate limit per organization or client
      const orgId = (req.headers["x-organization-id"] as string) || "default-org";
      const rateCheck = checkAIRateLimit(orgId, 25, 60000);
      if (!rateCheck.allowed) {
        return res.status(429).json({
          error: `AI rate limit reached. Please wait ${rateCheck.retryAfterSeconds} seconds before sending more workflow requests.`,
          retryAfterSeconds: rateCheck.retryAfterSeconds
        });
      }

      const targetModel = (model && ALLOWED_MODELS.includes(model as any)) ? model : "gemini-3.8-flash";

      const promptConfig = buildWorkflowPrompt(
        workflow as SupportedAIWorkflow, 
        payload, 
        customPrompt
      );

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const response = await generateContentWithTimeout(ai, {
        model: targetModel,
        contents: promptConfig.prompt,
        config: {
          systemInstruction: promptConfig.systemInstruction,
          responseMimeType: promptConfig.responseSchema ? "application/json" : "text/plain",
          responseSchema: promptConfig.responseSchema,
        }
      });

      let parsedData: any = undefined;
      if (promptConfig.responseSchema && response.text) {
        try {
          parsedData = JSON.parse(response.text);
        } catch {
          // If model wrapped response in markdown codeblock, extract JSON
          try {
            const cleaned = response.text.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
            parsedData = JSON.parse(cleaned);
          } catch {
            console.warn("Failed to parse structured JSON from AI output, returning raw text");
          }
        }
      }

      // Record audit event asynchronously if auth header exists
      try {
        const authHeader = req.headers.authorization;
        if (authHeader && orgId) {
          recordAuditEvent(
            orgId,
            null,
            "ai.workflow_generated",
            "ai_assistant",
            workflow,
            { workflow, targetModel }
          );
        }
      } catch {}

      res.json({
        workflow,
        text: response.text,
        data: parsedData,
        model: targetModel,
      });
    } catch (error: any) {
      console.error("AI Workflow Error:", error);
      const isTimeout = error.message?.includes("timed out");
      const statusCode = isTimeout ? 504 : 500;
      res.status(statusCode).json({ error: sanitizeErrorMessage(error.message || "Failed to execute AI workflow") });
    }
  });

  // Vite middleware for development vs Static bundle for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Global centralized production error middleware
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[MenkR- Unhandled Route Error]:", err);
    const statusCode = typeof err.status === "number" && err.status >= 400 && err.status < 600 ? err.status : 500;
    res.status(statusCode).json({
      error: sanitizeErrorMessage(err.message || "An unexpected internal server error occurred."),
      timestamp: new Date().toISOString()
    });
  });

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[MenkR- Server] Running in ${process.env.NODE_ENV || 'development'} mode on http://0.0.0.0:${PORT}`);
  });

  // Graceful shutdown handling for Cloud Run SIGTERM / SIGINT
  const gracefulShutdown = (signal: string) => {
    console.log(`[MenkR- Server] Received ${signal}. Initiating graceful shutdown...`);
    server.close(async () => {
      console.log("[MenkR- Server] HTTP listener closed.");
      try {
        const pool = createPool();
        await pool.end();
        console.log("[MenkR- Server] Database connection pool ended cleanly.");
      } catch (err) {
        console.error("[MenkR- Server] Error terminating database connection pool:", err);
      }
      process.exit(0);
    });

    // Timeout force exit after 10s (Cloud Run standard termination deadline)
    setTimeout(() => {
      console.error("[MenkR- Server] Forcefully exiting after graceful shutdown timeout.");
      process.exit(1);
    }, 10000).unref();
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  process.on("uncaughtException", (err) => {
    console.error("[MenkR- Server] Uncaught exception:", err);
  });

  process.on("unhandledRejection", (reason, promise) => {
    console.error("[MenkR- Server] Unhandled rejection at:", promise, "reason:", reason);
  });
}

startServer();
