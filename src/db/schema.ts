import { relations } from 'drizzle-orm';
import { 
  pgTable, 
  uuid, 
  text, 
  varchar, 
  integer, 
  numeric, 
  boolean, 
  timestamp, 
  jsonb, 
  index, 
  uniqueIndex 
} from 'drizzle-orm/pg-core';

// 1. Users Table
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  name: text('name'),
  avatarSeed: text('avatar_seed'),
  businessName: text('business_name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('users_uid_idx').on(table.uid),
  index('users_email_idx').on(table.email),
]);

// 2. Organizations Table
export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  currency: varchar('currency', { length: 10 }).default('USD').notNull(),
  settings: jsonb('settings').$type<Record<string, any>>().default({}).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('orgs_slug_idx').on(table.slug),
]);

// 3. Memberships Table
export const memberships = pgTable('memberships', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  role: varchar('role', { length: 30 }).default('owner').notNull(), // 'owner' | 'admin' | 'manager' | 'member' | 'viewer'
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('memberships_org_user_idx').on(table.organizationId, table.userId),
  index('memberships_user_idx').on(table.userId),
]);

// 4. Clients Table
export const clients = pgTable('clients', {
  id: uuid('id').defaultRandom().primaryKey(),
  legacyId: text('legacy_id'), // maps existing client id for lossless migration
  organizationId: uuid('organization_id')
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  company: text('company'),
  email: text('email'),
  phone: text('phone'),
  status: varchar('status', { length: 30 }).default('active').notNull(), // 'lead' | 'active' | 'past'
  tags: jsonb('tags').$type<string[]>().default([]).notNull(),
  notes: text('notes'),
  avatarSeed: text('avatar_seed'),
  isArchived: boolean('is_archived').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('clients_org_idx').on(table.organizationId),
  index('clients_status_idx').on(table.status),
  index('clients_legacy_idx').on(table.legacyId),
]);

// 5. Projects Table
export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  legacyId: text('legacy_id'),
  organizationId: uuid('organization_id')
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'set null' }),
  clientLegacyId: text('client_legacy_id'),
  index: varchar('index', { length: 30 }),
  name: text('name').notNull(),
  priority: varchar('priority', { length: 20 }).default('low').notNull(), // 'high' | 'low'
  completionPct: integer('completion_pct').default(0).notNull(),
  tone: varchar('tone', { length: 20 }).default('neutral').notNull(), // 'lime' | 'olive' | 'neutral'
  status: varchar('status', { length: 30 }).default('active').notNull(), // 'active' | 'completed' | 'on-hold'
  notes: text('notes'),
  dueDate: text('due_date'),
  budget: numeric('budget', { precision: 12, scale: 2 }),
  hourlyRate: numeric('hourly_rate', { precision: 10, scale: 2 }),
  assignedMemberIds: jsonb('assigned_member_ids').$type<string[]>().default([]).notNull(),
  isArchived: boolean('is_archived').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('projects_org_idx').on(table.organizationId),
  index('projects_client_idx').on(table.clientId),
  index('projects_status_idx').on(table.status),
  index('projects_legacy_idx').on(table.legacyId),
]);

// 6. Tasks Table
export const tasks = pgTable('tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  legacyId: text('legacy_id'),
  organizationId: uuid('organization_id')
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'set null' }),
  projectLegacyId: text('project_legacy_id'),
  clientLegacyId: text('client_legacy_id'),
  title: text('title').notNull(),
  categoryId: varchar('category_id', { length: 100 }),
  priority: varchar('priority', { length: 20 }).default('Medium').notNull(), // 'Low' | 'Medium' | 'High'
  status: varchar('status', { length: 20 }).default('active').notNull(), // 'active' | 'done' | 'upcoming'
  date: text('date'),
  dueDate: text('due_date'),
  assigneeId: text('assignee_id'),
  assigneeName: text('assignee_name'),
  notes: text('notes'),
  repeat: varchar('repeat', { length: 50 }),
  reminder: integer('reminder'),
  isArchived: boolean('is_archived').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('tasks_org_idx').on(table.organizationId),
  index('tasks_project_idx').on(table.projectId),
  index('tasks_status_idx').on(table.status),
  index('tasks_legacy_idx').on(table.legacyId),
]);

// 7. Comments / Client Messages Table
export const comments = pgTable('comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  legacyId: text('legacy_id'),
  organizationId: uuid('organization_id')
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
  clientLegacyId: text('client_legacy_id'),
  channel: varchar('channel', { length: 30 }).default('note').notNull(), // 'note' | 'call' | 'email' | 'meeting' | 'sms'
  body: text('body').notNull(),
  pinned: boolean('pinned').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('comments_org_idx').on(table.organizationId),
  index('comments_client_idx').on(table.clientId),
  index('comments_project_idx').on(table.projectId),
]);

// 8. Schedules / Events Table
export const schedules = pgTable('schedules', {
  id: uuid('id').defaultRandom().primaryKey(),
  legacyId: text('legacy_id'),
  organizationId: uuid('organization_id')
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  date: text('date').notNull(), // YYYY-MM-DD
  startTime: varchar('start_time', { length: 10 }),
  endTime: varchar('end_time', { length: 10 }),
  duration: integer('duration'),
  allDay: boolean('all_day').default(false).notNull(),
  type: varchar('type', { length: 50 }).default('Meeting').notNull(),
  status: varchar('status', { length: 30 }).default('scheduled').notNull(),
  location: text('location'),
  meetingLink: text('meeting_link'),
  notes: text('notes'),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'set null' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'set null' }),
  clientLegacyId: text('client_legacy_id'),
  projectLegacyId: text('project_legacy_id'),
  taskLegacyId: text('task_legacy_id'),
  categoryId: varchar('category_id', { length: 100 }),
  repeat: varchar('repeat', { length: 50 }),
  reminder: varchar('reminder', { length: 30 }),
  isArchived: boolean('is_archived').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('schedules_org_idx').on(table.organizationId),
  index('schedules_date_idx').on(table.date),
  index('schedules_project_idx').on(table.projectId),
  index('schedules_legacy_idx').on(table.legacyId),
]);

// 9. Time Entries Table
export const timeEntries = pgTable('time_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  legacyId: text('legacy_id'),
  organizationId: uuid('organization_id')
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'set null' }),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'set null' }),
  projectLegacyId: text('project_legacy_id'),
  taskLegacyId: text('task_legacy_id'),
  clientLegacyId: text('client_legacy_id'),
  startedAt: text('started_at').notNull(), // ISO timestamp
  durationSeconds: integer('duration_seconds').notNull(),
  billable: boolean('billable').default(true).notNull(),
  hourlyRate: numeric('hourly_rate', { precision: 10, scale: 2 }),
  userName: text('user_name'),
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('time_entries_org_idx').on(table.organizationId),
  index('time_entries_project_idx').on(table.projectId),
  index('time_entries_legacy_idx').on(table.legacyId),
]);

// 10. Financial Records Table (Revenue & Invoicing)
export const financialRecords = pgTable('financial_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  legacyId: text('legacy_id'),
  organizationId: uuid('organization_id')
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'set null' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  clientLegacyId: text('client_legacy_id'),
  projectLegacyId: text('project_legacy_id'),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  type: varchar('type', { length: 20 }).default('income').notNull(), // 'income' | 'expense'
  category: varchar('category', { length: 100 }).default('Services').notNull(),
  clientOrProject: text('client_or_project'),
  date: text('date').notNull(), // YYYY-MM-DD
  status: varchar('status', { length: 30 }).default('Pending').notNull(), // 'Paid' | 'Pending' | 'Overdue'
  invoiceNumber: varchar('invoice_number', { length: 100 }),
  receiptReference: text('receipt_reference'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('financial_org_idx').on(table.organizationId),
  index('financial_status_idx').on(table.status),
  index('financial_date_idx').on(table.date),
  index('financial_legacy_idx').on(table.legacyId),
]);

// 11. Templates Table
export const templates = pgTable('templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  legacyId: text('legacy_id'),
  organizationId: uuid('organization_id')
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  type: varchar('type', { length: 30 }).default('project').notNull(),
  description: text('description'),
  isFavorite: boolean('is_favorite').default(false).notNull(),
  isArchived: boolean('is_archived').default(false).notNull(),
  projectPriority: varchar('project_priority', { length: 20 }),
  projectDurationDays: integer('project_duration_days'),
  projectNotes: text('project_notes'),
  tasks: jsonb('tasks').$type<any[]>().default([]).notNull(),
  schedule: jsonb('schedule').$type<any[]>().default([]).notNull(),
  checklists: jsonb('checklists').$type<any[]>().default([]).notNull(),
  library: jsonb('library').$type<any[]>().default([]).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('templates_org_idx').on(table.organizationId),
  index('templates_legacy_idx').on(table.legacyId),
]);

// 12. Documents Table (Library)
export const documents = pgTable('documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  legacyId: text('legacy_id'),
  organizationId: uuid('organization_id')
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  type: varchar('type', { length: 20 }).default('file').notNull(), // 'file' | 'link' | 'note'
  category: varchar('category', { length: 50 }).default('Documents').notNull(),
  size: integer('size'),
  mimeType: varchar('mime_type', { length: 100 }),
  urlOrReference: text('url_or_reference').notNull(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'set null' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'set null' }),
  clientLegacyId: text('client_legacy_id'),
  projectLegacyId: text('project_legacy_id'),
  taskLegacyId: text('task_legacy_id'),
  tags: jsonb('tags').$type<string[]>().default([]).notNull(),
  description: text('description'),
  isFavorite: boolean('is_favorite').default(false).notNull(),
  isArchived: boolean('is_archived').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('documents_org_idx').on(table.organizationId),
  index('documents_category_idx').on(table.category),
  index('documents_legacy_idx').on(table.legacyId),
]);

// 13. Notifications Table
export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 30 }).notNull(), // 'task' | 'event' | 'revenue' | 'system'
  title: text('title').notNull(),
  subtitle: text('subtitle'),
  read: boolean('read').default(false).notNull(),
  targetId: varchar('target_id', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('notifications_org_idx').on(table.organizationId),
  index('notifications_user_idx').on(table.userId),
]);

// 14. Audit Events Table
export const auditEvents = pgTable('audit_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: varchar('entity_id', { length: 100 }),
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}).notNull(),
  ipAddress: varchar('ip_address', { length: 45 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('audit_events_org_idx').on(table.organizationId),
  index('audit_events_action_idx').on(table.action),
]);

// 15. Invitations Table
export const invitations = pgTable('invitations', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  email: text('email').notNull(),
  role: varchar('role', { length: 30 }).default('member').notNull(), // 'owner' | 'admin' | 'manager' | 'member' | 'viewer'
  token: text('token').notNull().unique(),
  invitedById: uuid('invited_by_id').references(() => users.id, { onDelete: 'set null' }),
  status: varchar('status', { length: 20 }).default('pending').notNull(), // 'pending' | 'accepted' | 'declined' | 'revoked'
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('invitations_org_idx').on(table.organizationId),
  index('invitations_email_idx').on(table.email),
  uniqueIndex('invitations_token_idx').on(table.token),
]);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(memberships),
  comments: many(comments),
  timeEntries: many(timeEntries),
  notifications: many(notifications),
  invitationsCreated: many(invitations),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  memberships: many(memberships),
  clients: many(clients),
  projects: many(projects),
  tasks: many(tasks),
  comments: many(comments),
  schedules: many(schedules),
  timeEntries: many(timeEntries),
  financialRecords: many(financialRecords),
  templates: many(templates),
  documents: many(documents),
  notifications: many(notifications),
  auditEvents: many(auditEvents),
  invitations: many(invitations),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  organization: one(organizations, {
    fields: [invitations.organizationId],
    references: [organizations.id],
  }),
  invitedBy: one(users, {
    fields: [invitations.invitedById],
    references: [users.id],
  }),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  organization: one(organizations, {
    fields: [memberships.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [memberships.userId],
    references: [users.id],
  }),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [clients.organizationId],
    references: [organizations.id],
  }),
  projects: many(projects),
  tasks: many(tasks),
  comments: many(comments),
  documents: many(documents),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [projects.organizationId],
    references: [organizations.id],
  }),
  client: one(clients, {
    fields: [projects.clientId],
    references: [clients.id],
  }),
  tasks: many(tasks),
  schedules: many(schedules),
  timeEntries: many(timeEntries),
  documents: many(documents),
}));
