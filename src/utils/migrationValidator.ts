/**
 * Migration Validator & Data Recovery Utility for MenkiR
 *
 * Implements strict schema validation, relationship integrity checks,
 * duplicate detection, credential sanitization, and migration reporting.
 */

export interface ValidationIssue {
  entity: string;
  id?: string;
  field?: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface MigrationSummary {
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  duplicateRecords: number;
  orphanRelationships: number;
  entityCounts: Record<string, { total: number; valid: number; duplicates: number }>;
}

export interface ValidationResult {
  isValid: boolean;
  canProceed: boolean;
  summary: MigrationSummary;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  sanitizedData: Record<string, any[]>;
}

export interface MigrationOptions {
  duplicateStrategy?: 'skip' | 'overwrite' | 'keep-both';
  allowOrphanRelationships?: boolean;
}

// Sensitive keys that must NEVER appear in backups or exports
export const FORBIDDEN_SECRET_KEYS = [
  'gemini_api_key',
  'api_key',
  'apikey',
  'secret',
  'password',
  'token',
  'authorization',
  'firebase_token',
  'access_token',
  'refresh_token',
  'private_key',
  'client_secret',
];

/**
 * Recursively scrubs any sensitive secrets or credentials from an object or array.
 */
export function sanitizeDataPayload<T>(input: T): T {
  if (input === null || input === undefined) return input;

  if (Array.isArray(input)) {
    return input.map((item) => sanitizeDataPayload(item)) as unknown as T;
  }

  if (typeof input === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(input)) {
      const lowerKey = key.toLowerCase();
      const isForbidden = FORBIDDEN_SECRET_KEYS.some((secretKey) =>
        lowerKey.includes(secretKey)
      );

      if (!isForbidden) {
        cleaned[key] = sanitizeDataPayload(value);
      }
    }
    return cleaned as T;
  }

  return input;
}

/**
 * Validates individual client record
 */
function validateClient(c: any, index: number): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!c || typeof c !== 'object') {
    issues.push({ entity: 'clients', message: `Record at index ${index} is not an object`, severity: 'error' });
    return issues;
  }
  if (!c.name || typeof c.name !== 'string' || !c.name.trim()) {
    issues.push({ entity: 'clients', id: c.id, field: 'name', message: 'Client name is required', severity: 'error' });
  }
  if (c.email && (typeof c.email !== 'string' || !c.email.includes('@'))) {
    issues.push({ entity: 'clients', id: c.id, field: 'email', message: 'Invalid client email format', severity: 'warning' });
  }
  if (c.status && !['active', 'lead', 'archived', 'inactive'].includes(c.status)) {
    issues.push({ entity: 'clients', id: c.id, field: 'status', message: `Unknown client status: ${c.status}`, severity: 'warning' });
  }
  return issues;
}

/**
 * Validates individual project record
 */
function validateProject(p: any, index: number, validClientIds: Set<string>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!p || typeof p !== 'object') {
    issues.push({ entity: 'projects', message: `Record at index ${index} is not an object`, severity: 'error' });
    return issues;
  }
  if (!p.name || typeof p.name !== 'string' || !p.name.trim()) {
    issues.push({ entity: 'projects', id: p.id, field: 'name', message: 'Project name is required', severity: 'error' });
  }
  if (typeof p.completionPct === 'number' && (p.completionPct < 0 || p.completionPct > 100)) {
    issues.push({ entity: 'projects', id: p.id, field: 'completionPct', message: 'Completion percentage must be between 0 and 100', severity: 'warning' });
  }
  if (p.clientId && !validClientIds.has(p.clientId)) {
    issues.push({
      entity: 'projects',
      id: p.id,
      field: 'clientId',
      message: `Project references non-existent client ID "${p.clientId}"`,
      severity: 'warning',
    });
  }
  return issues;
}

/**
 * Validates individual task record
 */
function validateTask(t: any, index: number, validProjectIds: Set<string>, validClientIds: Set<string>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!t || typeof t !== 'object') {
    issues.push({ entity: 'tasks', message: `Record at index ${index} is not an object`, severity: 'error' });
    return issues;
  }
  if (!t.title || typeof t.title !== 'string' || !t.title.trim()) {
    issues.push({ entity: 'tasks', id: t.id, field: 'title', message: 'Task title is required', severity: 'error' });
  }
  if (t.projectId && !validProjectIds.has(t.projectId)) {
    issues.push({
      entity: 'tasks',
      id: t.id,
      field: 'projectId',
      message: `Task references non-existent project ID "${t.projectId}"`,
      severity: 'warning',
    });
  }
  if (t.clientId && !validClientIds.has(t.clientId)) {
    issues.push({
      entity: 'tasks',
      id: t.id,
      field: 'clientId',
      message: `Task references non-existent client ID "${t.clientId}"`,
      severity: 'warning',
    });
  }
  return issues;
}

/**
 * Validates individual time entry record
 */
function validateTimeEntry(te: any, index: number, validProjectIds: Set<string>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!te || typeof te !== 'object') {
    issues.push({ entity: 'timeEntries', message: `Record at index ${index} is not an object`, severity: 'error' });
    return issues;
  }
  if (typeof te.durationSeconds !== 'number' || te.durationSeconds < 0 || isNaN(te.durationSeconds)) {
    issues.push({ entity: 'timeEntries', id: te.id, field: 'durationSeconds', message: 'Duration in seconds must be a positive number', severity: 'error' });
  }
  if (!te.startedAt || isNaN(Date.parse(te.startedAt))) {
    issues.push({ entity: 'timeEntries', id: te.id, field: 'startedAt', message: 'Started at must be a valid date timestamp', severity: 'error' });
  }
  if (te.projectId && !validProjectIds.has(te.projectId)) {
    issues.push({
      entity: 'timeEntries',
      id: te.id,
      field: 'projectId',
      message: `Time entry references non-existent project ID "${te.projectId}"`,
      severity: 'warning',
    });
  }
  return issues;
}

/**
 * Validates individual financial record / revenue
 */
function validateRevenue(r: any, index: number): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!r || typeof r !== 'object') {
    issues.push({ entity: 'revenues', message: `Record at index ${index} is not an object`, severity: 'error' });
    return issues;
  }
  const amt = typeof r.amount === 'number' ? r.amount : parseFloat(r.amount);
  if (isNaN(amt)) {
    issues.push({ entity: 'revenues', id: r.id, field: 'amount', message: 'Revenue amount must be a valid number', severity: 'error' });
  }
  if (!r.date || isNaN(Date.parse(r.date))) {
    issues.push({ entity: 'revenues', id: r.id, field: 'date', message: 'Revenue date is missing or invalid', severity: 'error' });
  }
  return issues;
}

/**
 * Validates individual calendar / schedule event
 */
function validateSchedule(e: any, index: number): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!e || typeof e !== 'object') {
    issues.push({ entity: 'schedules', message: `Record at index ${index} is not an object`, severity: 'error' });
    return issues;
  }
  if (!e.title || typeof e.title !== 'string' || !e.title.trim()) {
    issues.push({ entity: 'schedules', id: e.id, field: 'title', message: 'Schedule title is required', severity: 'error' });
  }
  if (!e.date || isNaN(Date.parse(e.date))) {
    issues.push({ entity: 'schedules', id: e.id, field: 'date', message: 'Schedule date is missing or invalid', severity: 'error' });
  }
  return issues;
}

/**
 * Validates individual template record
 */
function validateTemplate(tmpl: any, index: number): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!tmpl || typeof tmpl !== 'object') {
    issues.push({ entity: 'templates', message: `Record at index ${index} is not an object`, severity: 'error' });
    return issues;
  }
  if (!tmpl.name || typeof tmpl.name !== 'string' || !tmpl.name.trim()) {
    issues.push({ entity: 'templates', id: tmpl.id, field: 'name', message: 'Template name is required', severity: 'error' });
  }
  return issues;
}

/**
 * Validates individual library document
 */
function validateDocument(doc: any, index: number): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!doc || typeof doc !== 'object') {
    issues.push({ entity: 'documents', message: `Record at index ${index} is not an object`, severity: 'error' });
    return issues;
  }
  if (!doc.name || typeof doc.name !== 'string' || !doc.name.trim()) {
    issues.push({ entity: 'documents', id: doc.id, field: 'name', message: 'Document title/name is required', severity: 'error' });
  }
  return issues;
}

/**
 * Comprehensive migration validator for complete MenkiR dataset
 */
export function validateMigrationDataset(
  rawDataset: Record<string, any>,
  options: MigrationOptions = { duplicateStrategy: 'skip', allowOrphanRelationships: true }
): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const summary: MigrationSummary = {
    totalRecords: 0,
    validRecords: 0,
    invalidRecords: 0,
    duplicateRecords: 0,
    orphanRelationships: 0,
    entityCounts: {},
  };

  const sanitizedData: Record<string, any[]> = {
    clients: [],
    projects: [],
    tasks: [],
    timeEntries: [],
    revenues: [],
    schedules: [],
    templates: [],
    documents: [],
    messages: [],
  };

  // Helper to extract array from either normalized keys or menkir- prefixed localStorage keys
  const getCollection = (canonicalKey: string, legacyKey: string): any[] => {
    let raw = rawDataset[canonicalKey] ?? rawDataset[legacyKey];
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch {
        errors.push({
          entity: canonicalKey,
          message: `Malformed JSON string for collection "${canonicalKey}"`,
          severity: 'error',
        });
        return [];
      }
    }
    return Array.isArray(raw) ? raw : [];
  };

  const rawClients = getCollection('clients', 'menkir-clients');
  const rawProjects = getCollection('projects', 'menkir-projects');
  const rawTasks = getCollection('tasks', 'menkir-tasks');
  const rawTimeEntries = getCollection('timeEntries', 'menkir-time-entries');
  const rawRevenues = getCollection('revenues', 'menkir-revenues');
  const rawEvents = getCollection('schedules', 'menkir-calendar-events');
  const rawTemplates = getCollection('templates', 'menkir-templates');
  const rawDocuments = getCollection('documents', 'menkir-library');
  const rawMessages = getCollection('messages', 'menkir-client-messages');

  // 1. Process & Validate Clients
  const seenClientIds = new Set<string>();
  const seenClientEmails = new Set<string>();
  const validClientIds = new Set<string>();
  let clientValid = 0;
  let clientDupes = 0;

  summary.entityCounts.clients = { total: rawClients.length, valid: 0, duplicates: 0 };
  summary.totalRecords += rawClients.length;

  for (let i = 0; i < rawClients.length; i++) {
    const c = sanitizeDataPayload(rawClients[i]);
    const issues = validateClient(c, i);
    const hasError = issues.some((iss) => iss.severity === 'error');

    if (hasError) {
      errors.push(...issues);
    } else {
      warnings.push(...issues.filter((iss) => iss.severity === 'warning'));
      const idKey = c.id || `client-${i}`;
      const emailKey = c.email ? c.email.trim().toLowerCase() : null;

      if (seenClientIds.has(idKey) || (emailKey && seenClientEmails.has(emailKey))) {
        clientDupes++;
        warnings.push({
          entity: 'clients',
          id: idKey,
          message: `Duplicate client detected (${c.name || emailKey})`,
          severity: 'warning',
        });
        if (options.duplicateStrategy === 'skip') continue;
      }

      seenClientIds.add(idKey);
      if (emailKey) seenClientEmails.add(emailKey);
      validClientIds.add(idKey);
      sanitizedData.clients.push({ ...c, id: idKey });
      clientValid++;
    }
  }
  summary.entityCounts.clients.valid = clientValid;
  summary.entityCounts.clients.duplicates = clientDupes;
  summary.duplicateRecords += clientDupes;

  // 2. Process & Validate Projects
  const seenProjectIds = new Set<string>();
  const validProjectIds = new Set<string>();
  let projectValid = 0;
  let projectDupes = 0;

  summary.entityCounts.projects = { total: rawProjects.length, valid: 0, duplicates: 0 };
  summary.totalRecords += rawProjects.length;

  for (let i = 0; i < rawProjects.length; i++) {
    const p = sanitizeDataPayload(rawProjects[i]);
    const issues = validateProject(p, i, validClientIds);
    const hasError = issues.some((iss) => iss.severity === 'error');

    if (hasError) {
      errors.push(...issues);
    } else {
      const pWarnings = issues.filter((iss) => iss.severity === 'warning');
      warnings.push(...pWarnings);
      if (pWarnings.some((w) => w.field === 'clientId')) {
        summary.orphanRelationships++;
      }

      const idKey = p.id || `proj-${i}`;
      if (seenProjectIds.has(idKey)) {
        projectDupes++;
        warnings.push({ entity: 'projects', id: idKey, message: `Duplicate project ID ${idKey}`, severity: 'warning' });
        if (options.duplicateStrategy === 'skip') continue;
      }

      seenProjectIds.add(idKey);
      validProjectIds.add(idKey);
      sanitizedData.projects.push({ ...p, id: idKey });
      projectValid++;
    }
  }
  summary.entityCounts.projects.valid = projectValid;
  summary.entityCounts.projects.duplicates = projectDupes;
  summary.duplicateRecords += projectDupes;

  // 3. Process & Validate Tasks
  const seenTaskIds = new Set<string>();
  let taskValid = 0;
  let taskDupes = 0;

  summary.entityCounts.tasks = { total: rawTasks.length, valid: 0, duplicates: 0 };
  summary.totalRecords += rawTasks.length;

  for (let i = 0; i < rawTasks.length; i++) {
    const t = sanitizeDataPayload(rawTasks[i]);
    const issues = validateTask(t, i, validProjectIds, validClientIds);
    const hasError = issues.some((iss) => iss.severity === 'error');

    if (hasError) {
      errors.push(...issues);
    } else {
      const tWarnings = issues.filter((iss) => iss.severity === 'warning');
      warnings.push(...tWarnings);
      if (tWarnings.some((w) => w.field === 'projectId' || w.field === 'clientId')) {
        summary.orphanRelationships++;
      }

      const idKey = t.id || `task-${i}`;
      if (seenTaskIds.has(idKey)) {
        taskDupes++;
        warnings.push({ entity: 'tasks', id: idKey, message: `Duplicate task ID ${idKey}`, severity: 'warning' });
        if (options.duplicateStrategy === 'skip') continue;
      }

      seenTaskIds.add(idKey);
      sanitizedData.tasks.push({ ...t, id: idKey });
      taskValid++;
    }
  }
  summary.entityCounts.tasks.valid = taskValid;
  summary.entityCounts.tasks.duplicates = taskDupes;
  summary.duplicateRecords += taskDupes;

  // 4. Process & Validate Time Entries
  const seenTimeIds = new Set<string>();
  let timeValid = 0;
  let timeDupes = 0;

  summary.entityCounts.timeEntries = { total: rawTimeEntries.length, valid: 0, duplicates: 0 };
  summary.totalRecords += rawTimeEntries.length;

  for (let i = 0; i < rawTimeEntries.length; i++) {
    const te = sanitizeDataPayload(rawTimeEntries[i]);
    const issues = validateTimeEntry(te, i, validProjectIds);
    const hasError = issues.some((iss) => iss.severity === 'error');

    if (hasError) {
      errors.push(...issues);
    } else {
      const teWarnings = issues.filter((iss) => iss.severity === 'warning');
      warnings.push(...teWarnings);
      if (teWarnings.some((w) => w.field === 'projectId')) {
        summary.orphanRelationships++;
      }

      const idKey = te.id || `time-${i}`;
      if (seenTimeIds.has(idKey)) {
        timeDupes++;
        if (options.duplicateStrategy === 'skip') continue;
      }

      seenTimeIds.add(idKey);
      sanitizedData.timeEntries.push({ ...te, id: idKey });
      timeValid++;
    }
  }
  summary.entityCounts.timeEntries.valid = timeValid;
  summary.entityCounts.timeEntries.duplicates = timeDupes;
  summary.duplicateRecords += timeDupes;

  // 5. Process & Validate Revenues
  const seenRevenueIds = new Set<string>();
  let revValid = 0;
  let revDupes = 0;

  summary.entityCounts.revenues = { total: rawRevenues.length, valid: 0, duplicates: 0 };
  summary.totalRecords += rawRevenues.length;

  for (let i = 0; i < rawRevenues.length; i++) {
    const r = sanitizeDataPayload(rawRevenues[i]);
    const issues = validateRevenue(r, i);
    const hasError = issues.some((iss) => iss.severity === 'error');

    if (hasError) {
      errors.push(...issues);
    } else {
      warnings.push(...issues.filter((iss) => iss.severity === 'warning'));
      const idKey = r.id || `rev-${i}`;
      if (seenRevenueIds.has(idKey)) {
        revDupes++;
        if (options.duplicateStrategy === 'skip') continue;
      }

      seenRevenueIds.add(idKey);
      sanitizedData.revenues.push({ ...r, id: idKey, amount: Number(r.amount) });
      revValid++;
    }
  }
  summary.entityCounts.revenues.valid = revValid;
  summary.entityCounts.revenues.duplicates = revDupes;
  summary.duplicateRecords += revDupes;

  // 6. Process & Validate Schedules
  const seenScheduleIds = new Set<string>();
  let schedValid = 0;

  summary.entityCounts.schedules = { total: rawEvents.length, valid: 0, duplicates: 0 };
  summary.totalRecords += rawEvents.length;

  for (let i = 0; i < rawEvents.length; i++) {
    const e = sanitizeDataPayload(rawEvents[i]);
    const issues = validateSchedule(e, i);
    if (issues.some((iss) => iss.severity === 'error')) {
      errors.push(...issues);
    } else {
      const idKey = e.id || `sched-${i}`;
      if (!seenScheduleIds.has(idKey)) {
        seenScheduleIds.add(idKey);
        sanitizedData.schedules.push({ ...e, id: idKey });
        schedValid++;
      }
    }
  }
  summary.entityCounts.schedules.valid = schedValid;

  // 7. Process & Validate Templates
  let tmplValid = 0;
  summary.entityCounts.templates = { total: rawTemplates.length, valid: 0, duplicates: 0 };
  summary.totalRecords += rawTemplates.length;

  for (let i = 0; i < rawTemplates.length; i++) {
    const tmpl = sanitizeDataPayload(rawTemplates[i]);
    const issues = validateTemplate(tmpl, i);
    if (issues.some((iss) => iss.severity === 'error')) {
      errors.push(...issues);
    } else {
      sanitizedData.templates.push(tmpl);
      tmplValid++;
    }
  }
  summary.entityCounts.templates.valid = tmplValid;

  // 8. Process & Validate Documents
  let docValid = 0;
  summary.entityCounts.documents = { total: rawDocuments.length, valid: 0, duplicates: 0 };
  summary.totalRecords += rawDocuments.length;

  for (let i = 0; i < rawDocuments.length; i++) {
    const doc = sanitizeDataPayload(rawDocuments[i]);
    const issues = validateDocument(doc, i);
    if (issues.some((iss) => iss.severity === 'error')) {
      errors.push(...issues);
    } else {
      sanitizedData.documents.push(doc);
      docValid++;
    }
  }
  summary.entityCounts.documents.valid = docValid;

  // 9. Comments / Messages
  for (const msg of rawMessages) {
    if (msg && msg.body) {
      sanitizedData.messages.push(sanitizeDataPayload(msg));
    }
  }

  // Calculate totals
  summary.validRecords =
    clientValid + projectValid + taskValid + timeValid + revValid + schedValid + tmplValid + docValid;
  summary.invalidRecords = errors.length;

  const isValid = errors.length === 0;
  // If there are only warnings or no fatal errors, we can proceed
  const canProceed = errors.length === 0 || (summary.validRecords > 0 && errors.length < summary.validRecords);

  return {
    isValid,
    canProceed,
    summary,
    errors,
    warnings,
    sanitizedData,
  };
}
