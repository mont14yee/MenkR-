import { eq, and } from 'drizzle-orm';
import { db } from './index.ts';
import { sanitizeAuditMetadata } from '../utils/auditLogger.ts';
import { 
  users, 
  organizations, 
  memberships, 
  clients, 
  projects, 
  tasks, 
  comments, 
  schedules, 
  timeEntries, 
  financialRecords, 
  templates, 
  documents, 
  notifications, 
  auditEvents 
} from './schema.ts';

export async function getOrCreateUserAndOrg(
  uid: string, 
  email: string, 
  name?: string, 
  avatarSeed?: string,
  businessName?: string
) {
  try {
    // 1. Get or create user
    const existingUsers = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    let user = existingUsers[0];

    if (!user) {
      const [newUser] = await db.insert(users).values({
        uid,
        email,
        name: name || email.split('@')[0],
        avatarSeed: avatarSeed || uid.slice(0, 8),
        businessName: businessName || null,
      }).returning();
      user = newUser;
    } else if (name || businessName) {
      const [updatedUser] = await db.update(users).set({
        name: name || user.name,
        businessName: businessName || user.businessName,
        avatarSeed: avatarSeed || user.avatarSeed,
        updatedAt: new Date(),
      }).where(eq(users.id, user.id)).returning();
      user = updatedUser;
    }

    // 2. Check for membership
    const userMemberships = await db
      .select()
      .from(memberships)
      .where(eq(memberships.userId, user.id))
      .limit(1);

    let orgId: string;
    let role = 'owner';

    if (userMemberships.length > 0) {
      orgId = userMemberships[0].organizationId;
      role = userMemberships[0].role;
    } else {
      // Create primary organization for user
      const orgSlug = `org-${uid.slice(0, 10).toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now().toString(36)}`;
      const [newOrg] = await db.insert(organizations).values({
        name: businessName || `${user.name || 'Workspace'}'s Organization`,
        slug: orgSlug,
        currency: 'USD',
      }).returning();
      orgId = newOrg.id;

      await db.insert(memberships).values({
        organizationId: orgId,
        userId: user.id,
        role: 'owner',
      });

      await recordAuditEvent(
        orgId,
        user.id,
        'organization.created',
        'organization',
        orgId,
        { initialOwner: user.email }
      );
    }

    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);

    return { user, organization: org, role };
  } catch (error) {
    console.error('Failed to get or create user and organization:', error);
    throw new Error('Database user initialization failed.', { cause: error });
  }
}

export async function recordAuditEvent(
  organizationId: string,
  userId: string | null,
  action: string,
  entityType: string,
  entityId?: string,
  metadata: Record<string, any> = {},
  ipAddress?: string
) {
  try {
    const safeMetadata = sanitizeAuditMetadata(metadata);
    await db.insert(auditEvents).values({
      organizationId,
      userId,
      action,
      entityType,
      entityId: entityId || null,
      metadata: safeMetadata,
      ipAddress: ipAddress || null,
    });
  } catch (err) {
    console.error('Failed to record audit event:', err);
  }
}

export interface SyncPayload {
  clients?: any[];
  projects?: any[];
  tasks?: any[];
  messages?: any[];
  events?: any[];
  timeEntries?: any[];
  revenues?: any[];
  templates?: any[];
  library?: any[];
  preferences?: any;
}

export async function syncOrganizationData(
  orgId: string, 
  userId: string, 
  payload: SyncPayload,
  clientIp?: string
) {
  try {
    const stats = {
      clients: 0,
      projects: 0,
      tasks: 0,
      comments: 0,
      schedules: 0,
      timeEntries: 0,
      revenues: 0,
      templates: 0,
      documents: 0,
    };

    // 1. Sync Clients
    if (payload.clients && Array.isArray(payload.clients)) {
      for (const c of payload.clients) {
        if (!c.name) continue;
        const existing = await db.select().from(clients).where(
          and(eq(clients.organizationId, orgId), eq(clients.legacyId, c.id))
        ).limit(1);

        if (existing.length > 0) {
          await db.update(clients).set({
            name: c.name,
            company: c.company || null,
            email: c.email || null,
            phone: c.phone || null,
            status: c.status || 'active',
            tags: c.tags || [],
            notes: c.notes || null,
            avatarSeed: c.avatarSeed || null,
            updatedAt: new Date(),
          }).where(eq(clients.id, existing[0].id));
        } else {
          await db.insert(clients).values({
            legacyId: c.id,
            organizationId: orgId,
            name: c.name,
            company: c.company || null,
            email: c.email || null,
            phone: c.phone || null,
            status: c.status || 'active',
            tags: c.tags || [],
            notes: c.notes || null,
            avatarSeed: c.avatarSeed || null,
          });
        }
        stats.clients++;
      }
    }

    // 2. Sync Projects
    if (payload.projects && Array.isArray(payload.projects)) {
      for (const p of payload.projects) {
        if (!p.name) continue;
        const existing = await db.select().from(projects).where(
          and(eq(projects.organizationId, orgId), eq(projects.legacyId, p.id))
        ).limit(1);

        if (existing.length > 0) {
          await db.update(projects).set({
            name: p.name,
            clientLegacyId: p.clientId || null,
            index: p.index || null,
            priority: p.priority || 'low',
            completionPct: typeof p.completionPct === 'number' ? p.completionPct : 0,
            tone: p.tone || 'neutral',
            status: p.status || 'active',
            notes: p.notes || null,
            dueDate: p.dueDate || null,
            budget: p.budget != null ? p.budget.toString() : null,
            hourlyRate: p.hourlyRate != null ? p.hourlyRate.toString() : null,
            assignedMemberIds: Array.isArray(p.assignedMemberIds) ? p.assignedMemberIds : [],
            updatedAt: new Date(),
          }).where(eq(projects.id, existing[0].id));
        } else {
          await db.insert(projects).values({
            legacyId: p.id,
            organizationId: orgId,
            clientLegacyId: p.clientId || null,
            index: p.index || null,
            name: p.name,
            priority: p.priority || 'low',
            completionPct: typeof p.completionPct === 'number' ? p.completionPct : 0,
            tone: p.tone || 'neutral',
            status: p.status || 'active',
            notes: p.notes || null,
            dueDate: p.dueDate || null,
            budget: p.budget != null ? p.budget.toString() : null,
            hourlyRate: p.hourlyRate != null ? p.hourlyRate.toString() : null,
            assignedMemberIds: Array.isArray(p.assignedMemberIds) ? p.assignedMemberIds : [],
          });
        }
        stats.projects++;
      }
    }

    // 3. Sync Tasks
    if (payload.tasks && Array.isArray(payload.tasks)) {
      for (const t of payload.tasks) {
        if (!t.title) continue;
        const existing = await db.select().from(tasks).where(
          and(eq(tasks.organizationId, orgId), eq(tasks.legacyId, t.id))
        ).limit(1);

        if (existing.length > 0) {
          await db.update(tasks).set({
            title: t.title,
            projectLegacyId: t.projectId || null,
            clientLegacyId: t.clientId || null,
            categoryId: t.categoryId || null,
            priority: t.priority || 'Medium',
            status: t.status || 'active',
            date: t.date || null,
            dueDate: t.dueDate || t.date || null,
            assigneeId: t.assigneeId || null,
            assigneeName: t.assigneeName || null,
            notes: t.notes || null,
            repeat: t.repeat || null,
            reminder: typeof t.reminder === 'number' ? t.reminder : null,
            updatedAt: new Date(),
          }).where(eq(tasks.id, existing[0].id));
        } else {
          await db.insert(tasks).values({
            legacyId: t.id,
            organizationId: orgId,
            title: t.title,
            projectLegacyId: t.projectId || null,
            clientLegacyId: t.clientId || null,
            categoryId: t.categoryId || null,
            priority: t.priority || 'Medium',
            status: t.status || 'active',
            date: t.date || null,
            dueDate: t.dueDate || t.date || null,
            assigneeId: t.assigneeId || null,
            assigneeName: t.assigneeName || null,
            notes: t.notes || null,
            repeat: t.repeat || null,
            reminder: typeof t.reminder === 'number' ? t.reminder : null,
          });
        }
        stats.tasks++;
      }
    }

    // 4. Sync Comments / Client messages
    if (payload.messages && Array.isArray(payload.messages)) {
      for (const m of payload.messages) {
        if (!m.body) continue;
        const existing = await db.select().from(comments).where(
          and(eq(comments.organizationId, orgId), eq(comments.legacyId, m.id))
        ).limit(1);

        if (existing.length > 0) {
          await db.update(comments).set({
            clientLegacyId: m.clientId || null,
            channel: m.channel || 'note',
            body: m.body,
            pinned: Boolean(m.pinned),
            updatedAt: new Date(),
          }).where(eq(comments.id, existing[0].id));
        } else {
          await db.insert(comments).values({
            legacyId: m.id,
            organizationId: orgId,
            userId,
            clientLegacyId: m.clientId || null,
            channel: m.channel || 'note',
            body: m.body,
            pinned: Boolean(m.pinned),
          });
        }
        stats.comments++;
      }
    }

    // 5. Sync Schedules / Events
    if (payload.events && Array.isArray(payload.events)) {
      for (const e of payload.events) {
        if (!e.title || !e.date) continue;
        const existing = await db.select().from(schedules).where(
          and(eq(schedules.organizationId, orgId), eq(schedules.legacyId, e.id))
        ).limit(1);

        if (existing.length > 0) {
          await db.update(schedules).set({
            title: e.title,
            date: e.date,
            startTime: e.startTime || null,
            endTime: e.endTime || null,
            duration: typeof e.duration === 'number' ? e.duration : null,
            allDay: Boolean(e.allDay),
            type: e.type || 'Meeting',
            status: e.status || 'scheduled',
            location: e.location || null,
            meetingLink: e.meetingLink || null,
            notes: e.notes || null,
            clientLegacyId: e.clientId || null,
            projectLegacyId: e.projectId || null,
            taskLegacyId: e.taskId || null,
            categoryId: e.categoryId || null,
            repeat: e.repeat || null,
            reminder: e.reminder || null,
            updatedAt: new Date(),
          }).where(eq(schedules.id, existing[0].id));
        } else {
          await db.insert(schedules).values({
            legacyId: e.id,
            organizationId: orgId,
            title: e.title,
            date: e.date,
            startTime: e.startTime || null,
            endTime: e.endTime || null,
            duration: typeof e.duration === 'number' ? e.duration : null,
            allDay: Boolean(e.allDay),
            type: e.type || 'Meeting',
            status: e.status || 'scheduled',
            location: e.location || null,
            meetingLink: e.meetingLink || null,
            notes: e.notes || null,
            clientLegacyId: e.clientId || null,
            projectLegacyId: e.projectId || null,
            taskLegacyId: e.taskId || null,
            categoryId: e.categoryId || null,
            repeat: e.repeat || null,
            reminder: e.reminder || null,
          });
        }
        stats.schedules++;
      }
    }

    // 6. Sync Time Entries
    if (payload.timeEntries && Array.isArray(payload.timeEntries)) {
      for (const te of payload.timeEntries) {
        if (!te.startedAt || typeof te.durationSeconds !== 'number') continue;
        const existing = await db.select().from(timeEntries).where(
          and(eq(timeEntries.organizationId, orgId), eq(timeEntries.legacyId, te.id))
        ).limit(1);

        if (existing.length > 0) {
          await db.update(timeEntries).set({
            projectLegacyId: te.projectId || null,
            taskLegacyId: te.taskId || null,
            clientLegacyId: te.clientId || null,
            startedAt: te.startedAt,
            durationSeconds: te.durationSeconds,
            billable: Boolean(te.billable),
            hourlyRate: te.hourlyRate != null ? te.hourlyRate.toString() : null,
            userName: te.userName || null,
            note: te.note || null,
            updatedAt: new Date(),
          }).where(eq(timeEntries.id, existing[0].id));
        } else {
          await db.insert(timeEntries).values({
            legacyId: te.id,
            organizationId: orgId,
            userId,
            userName: te.userName || null,
            projectLegacyId: te.projectId || null,
            taskLegacyId: te.taskId || null,
            clientLegacyId: te.clientId || null,
            startedAt: te.startedAt,
            durationSeconds: te.durationSeconds,
            billable: Boolean(te.billable),
            hourlyRate: te.hourlyRate != null ? te.hourlyRate.toString() : null,
            note: te.note || null,
          });
        }
        stats.timeEntries++;
      }
    }

    // 7. Sync Financial Records / Revenues
    if (payload.revenues && Array.isArray(payload.revenues)) {
      for (const r of payload.revenues) {
        if (typeof r.amount !== 'number' || !r.date) continue;
        const existing = await db.select().from(financialRecords).where(
          and(eq(financialRecords.organizationId, orgId), eq(financialRecords.legacyId, r.id))
        ).limit(1);

        if (existing.length > 0) {
          await db.update(financialRecords).set({
            clientLegacyId: r.clientId || null,
            projectLegacyId: r.projectId || null,
            amount: r.amount.toString(),
            type: r.type || 'income',
            category: r.category || 'Services',
            clientOrProject: r.clientOrProject || null,
            date: r.date,
            status: r.status || 'Pending',
            invoiceNumber: r.invoiceNumber || null,
            receiptReference: r.receiptReference || null,
            notes: r.notes || null,
            updatedAt: new Date(),
          }).where(eq(financialRecords.id, existing[0].id));
        } else {
          await db.insert(financialRecords).values({
            legacyId: r.id,
            organizationId: orgId,
            clientLegacyId: r.clientId || null,
            projectLegacyId: r.projectId || null,
            amount: r.amount.toString(),
            type: r.type || 'income',
            category: r.category || 'Services',
            clientOrProject: r.clientOrProject || null,
            date: r.date,
            status: r.status || 'Pending',
            invoiceNumber: r.invoiceNumber || null,
            receiptReference: r.receiptReference || null,
            notes: r.notes || null,
          });
        }
        stats.revenues++;
      }
    }

    // 8. Sync Templates
    if (payload.templates && Array.isArray(payload.templates)) {
      for (const tmpl of payload.templates) {
        if (!tmpl.name) continue;
        const existing = await db.select().from(templates).where(
          and(eq(templates.organizationId, orgId), eq(templates.legacyId, tmpl.id))
        ).limit(1);

        if (existing.length > 0) {
          await db.update(templates).set({
            name: tmpl.name,
            type: tmpl.type || 'project',
            description: tmpl.description || null,
            isFavorite: Boolean(tmpl.isFavorite),
            isArchived: Boolean(tmpl.isArchived),
            projectPriority: tmpl.projectPriority || null,
            projectDurationDays: tmpl.projectDurationDays || null,
            projectNotes: tmpl.projectNotes || null,
            tasks: tmpl.tasks || [],
            schedule: tmpl.schedule || [],
            checklists: tmpl.checklists || [],
            library: tmpl.library || [],
            updatedAt: new Date(),
          }).where(eq(templates.id, existing[0].id));
        } else {
          await db.insert(templates).values({
            legacyId: tmpl.id,
            organizationId: orgId,
            name: tmpl.name,
            type: tmpl.type || 'project',
            description: tmpl.description || null,
            isFavorite: Boolean(tmpl.isFavorite),
            isArchived: Boolean(tmpl.isArchived),
            projectPriority: tmpl.projectPriority || null,
            projectDurationDays: tmpl.projectDurationDays || null,
            projectNotes: tmpl.projectNotes || null,
            tasks: tmpl.tasks || [],
            schedule: tmpl.schedule || [],
            checklists: tmpl.checklists || [],
            library: tmpl.library || [],
          });
        }
        stats.templates++;
      }
    }

    // 9. Sync Documents / Library
    if (payload.library && Array.isArray(payload.library)) {
      for (const doc of payload.library) {
        if (!doc.name || !doc.urlOrReference) continue;
        const existing = await db.select().from(documents).where(
          and(eq(documents.organizationId, orgId), eq(documents.legacyId, doc.id))
        ).limit(1);

        if (existing.length > 0) {
          await db.update(documents).set({
            name: doc.name,
            type: doc.type || 'file',
            category: doc.category || 'Documents',
            size: doc.size || null,
            mimeType: doc.mimeType || null,
            urlOrReference: doc.urlOrReference,
            clientLegacyId: doc.clientId || null,
            projectLegacyId: doc.projectId || null,
            taskLegacyId: doc.taskId || null,
            tags: doc.tags || [],
            description: doc.description || null,
            isFavorite: Boolean(doc.isFavorite),
            updatedAt: new Date(),
          }).where(eq(documents.id, existing[0].id));
        } else {
          await db.insert(documents).values({
            legacyId: doc.id,
            organizationId: orgId,
            name: doc.name,
            type: doc.type || 'file',
            category: doc.category || 'Documents',
            size: doc.size || null,
            mimeType: doc.mimeType || null,
            urlOrReference: doc.urlOrReference,
            clientLegacyId: doc.clientId || null,
            projectLegacyId: doc.projectId || null,
            taskLegacyId: doc.taskId || null,
            tags: doc.tags || [],
            description: doc.description || null,
            isFavorite: Boolean(doc.isFavorite),
          });
        }
        stats.documents++;
      }
    }

    // Record audit event for synchronization
    await recordAuditEvent(
      orgId,
      userId,
      'data.synchronized',
      'organization',
      orgId,
      { stats },
      clientIp
    );

    return { success: true, stats };
  } catch (error) {
    console.error('Error during organization data sync:', error);
    throw new Error('Data synchronization to PostgreSQL failed.', { cause: error });
  }
}

import crypto from 'crypto';
import { validateMigrationDataset, sanitizeDataPayload, type MigrationOptions } from '../utils/migrationValidator.ts';

export async function exportOrganizationBackup(orgId: string, userId: string) {
  // 1. Fetch organization details
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
  if (!org) {
    throw new Error('Organization not found');
  }

  // 2. Fetch all org-scoped records
  const [
    orgClients,
    orgProjects,
    orgTasks,
    orgComments,
    orgSchedules,
    orgTimeEntries,
    orgFinancialRecords,
    orgTemplates,
    orgDocuments
  ] = await Promise.all([
    db.select().from(clients).where(eq(clients.organizationId, orgId)),
    db.select().from(projects).where(eq(projects.organizationId, orgId)),
    db.select().from(tasks).where(eq(tasks.organizationId, orgId)),
    db.select().from(comments).where(eq(comments.organizationId, orgId)),
    db.select().from(schedules).where(eq(schedules.organizationId, orgId)),
    db.select().from(timeEntries).where(eq(timeEntries.organizationId, orgId)),
    db.select().from(financialRecords).where(eq(financialRecords.organizationId, orgId)),
    db.select().from(templates).where(eq(templates.organizationId, orgId)),
    db.select().from(documents).where(eq(documents.organizationId, orgId)),
  ]);

  const rawExport: {
    metadata: {
      version: string;
      exportedAt: string;
      organizationId: string;
      organizationName: string;
      slug: string;
      currency: string;
      checksum?: string;
      counts: Record<string, number>;
    };
    data: Record<string, any[]>;
  } = {
    metadata: {
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      organizationId: org.id,
      organizationName: org.name,
      slug: org.slug,
      currency: org.currency,
      counts: {
        clients: orgClients.length,
        projects: orgProjects.length,
        tasks: orgTasks.length,
        comments: orgComments.length,
        schedules: orgSchedules.length,
        timeEntries: orgTimeEntries.length,
        financialRecords: orgFinancialRecords.length,
        templates: orgTemplates.length,
        documents: orgDocuments.length,
      },
    },
    data: {
      clients: orgClients,
      projects: orgProjects,
      tasks: orgTasks,
      messages: orgComments,
      schedules: orgSchedules,
      timeEntries: orgTimeEntries,
      revenues: orgFinancialRecords,
      templates: orgTemplates,
      documents: orgDocuments,
    },
  };

  // 3. Strictly scrub any credentials, API keys, or secrets
  const sanitizedExport = sanitizeDataPayload(rawExport);

  // 4. Compute cryptographic integrity checksum
  const jsonString = JSON.stringify(sanitizedExport.data);
  const checksum = crypto.createHash('sha256').update(jsonString).digest('hex');
  sanitizedExport.metadata.checksum = checksum;

  // 5. Audit log
  await recordAuditEvent(
    orgId,
    userId,
    'backup.exported',
    'organization',
    orgId,
    { checksum, counts: sanitizedExport.metadata.counts }
  );

  return sanitizedExport;
}

export async function restoreOrganizationBackup(
  orgId: string,
  userId: string,
  backupPayload: any,
  options: MigrationOptions = { duplicateStrategy: 'skip', allowOrphanRelationships: true }
) {
  if (!backupPayload || typeof backupPayload !== 'object') {
    throw new Error('Invalid backup payload: root must be an object');
  }

  const rawData = backupPayload.data || backupPayload;

  // 1. Run schema and relationship validation
  const validation = validateMigrationDataset(rawData, options);

  if (!validation.canProceed) {
    const errorDetails = validation.errors.map((e) => `[${e.entity}] ${e.message}`).join(', ');
    throw new Error(`Backup validation failed: ${errorDetails}`);
  }

  // 2. Perform synchronized data restoration with transaction-safe sync
  const syncResult = await syncOrganizationData(
    orgId,
    userId,
    {
      clients: validation.sanitizedData.clients,
      projects: validation.sanitizedData.projects,
      tasks: validation.sanitizedData.tasks,
      messages: validation.sanitizedData.messages,
      events: validation.sanitizedData.schedules,
      timeEntries: validation.sanitizedData.timeEntries,
      revenues: validation.sanitizedData.revenues,
      templates: validation.sanitizedData.templates,
      library: validation.sanitizedData.documents,
    }
  );

  // 3. Audit log
  await recordAuditEvent(
    orgId,
    userId,
    'backup.restored',
    'organization',
    orgId,
    {
      stats: syncResult.stats,
      validationSummary: validation.summary,
      warningsCount: validation.warnings.length,
    }
  );

  return {
    success: true,
    stats: syncResult.stats,
    summary: validation.summary,
    warnings: validation.warnings,
  };
}

