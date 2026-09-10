export type ClientStatus = 'lead' | 'active' | 'past';
export type Tone = 'lime' | 'olive' | 'neutral';

export interface Category {
  id: string;
  label: string;
  color: string;
  scope: 'task' | 'event' | 'revenue';
}

export interface TaskItem {
  id: string;
  title: string;
  categoryId: string;
  priority: 'Low' | 'Medium' | 'High';
  date?: string; // ISO date-time
  notes?: string;
  status: 'done' | 'active' | 'upcoming';
  projectId?: string;
  repeat?: string;
  reminder?: number;
  clientId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectItem {
  id: string;
  index: string;
  name: string;
  priority: 'high' | 'low';
  completionPct: number;
  tone: Tone;
  clientId?: string;
  status?: 'active' | 'completed' | 'on-hold';
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type LibraryCategory = 'Documents' | 'Project Files' | 'Contracts' | 'Proposals' | 'Reports' | 'Images' | 'References' | 'Templates' | 'Design Assets' | 'Notes';

export interface LibraryItem {
  id: string;
  name: string;
  type: 'file' | 'link' | 'note';
  category: LibraryCategory;
  size?: number; // in bytes
  mimeType?: string;
  urlOrReference: string;
  clientId?: string;
  projectId?: string;
  taskId?: string;
  templateId?: string;
  tags: string[];
  description?: string;
  isFavorite?: boolean;
  createdAt: string;
  updatedAt: string;
}





export interface RevenueMonth {
  label: string;
  amount: number;
  overduePct?: number;
  isCurrent?: boolean;
}

export interface RevenueEntry {
  id: string;
  amount: number;
  clientOrProject: string; // Legacy, migrating away
  date: string;
  status: 'Paid' | 'Pending' | 'Overdue';
  invoiceNumber?: string;
  notes?: string;
  clientId?: string;
  projectId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type EventType = 'Meeting' | 'Client Call' | 'Focus Time' | 'Deadline' | 'Milestone' | 'Task Block' | 'Payment Deadline' | 'Personal' | 'Reminder';
export type EventStatus = 'scheduled' | 'in-progress' | 'completed' | 'cancelled' | 'rescheduled';

export interface EventItem {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  duration?: number; // minutes
  allDay: boolean;
  type: EventType;
  status: EventStatus;
  notes?: string;
  clientId?: string;
  projectId?: string;
  taskId?: string;
  timeEntryId?: string;
  assetId?: string;
  reminder?: string; // e.g., '15m', '1h', '1d'
  location?: string;
  meetingLink?: string;
  repeat: string;
  categoryId: string; // legacy/color tagging
  createdAt?: string;
  updatedAt?: string;
}

export interface TimeEntry {
  id: string;
  projectId?: string;
  taskId?: string;
  clientId?: string;
  startedAt: string;
  durationSeconds: number;
  billable: boolean;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Client {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  status: ClientStatus;
  tags: string[];
  notes?: string;
  avatarSeed: string;
  createdAt: string;
}

export type MessageChannel = 'note' | 'call' | 'email' | 'meeting' | 'sms';

export interface MessageItem {
  id: string;
  clientId: string;
  channel: MessageChannel;
  body: string;
  createdAt: string;
  pinned?: boolean;
}

export interface UserPreferences {
  currency: string;
  firstDayOfWeek: 'sun' | 'mon';
  defaultReminderMinutes: number;
  roundingIncrementMinutes: number;
  overdueThresholdDays: number;
  defaultTaskDuration: number;
  categories: Category[];
}

export type TabState = 'dashboard' | 'projects' | 'productivity' | 'tools' | 'clients' | 'profile';
export type PushedScreenState = 'none' | 'tasks' | 'calendar' | 'finance' | 'time-tracker' | 'settings' | 'templates' | 'library';



export interface UserProfile {
  name: string;
  email: string;
  businessName?: string;
  avatarSeed: string;
}

export type TemplateType = 'project' | 'task' | 'meeting' | 'workflow' | 'checklist';

export interface TemplateTaskDef {
  id: string; // internal id
  title: string;
  priority: 'Low' | 'Medium' | 'High';
  durationMinutes?: number;
  offsetDays: number; // relative to template start date
  notes?: string;
  dependencies?: string[]; // IDs of other tasks
}

export interface TemplateScheduleDef {
  id: string;
  title: string;
  type: EventType;
  durationMinutes: number;
  offsetDays: number;
  startTime?: string; // specific time of day HH:mm if applicable
  notes?: string;
}

export interface TemplateChecklistDef {
  id: string;
  title: string;
  items: string[];
}

export interface TemplateLibraryDef {
  id: string;
  name: string;
  type: 'file' | 'link' | 'note';
  category: LibraryCategory;
  tags: string[];
}

export interface TemplateItem {
  id: string;
  name: string;
  type: TemplateType;
  description?: string;
  isFavorite: boolean;
  isArchived: boolean;
  
  // Project-specific defaults
  projectPriority?: 'high' | 'low';
  projectDurationDays?: number; // Total duration
  projectNotes?: string;
  projectTags?: string[];
  
  tasks: TemplateTaskDef[];
  schedule: TemplateScheduleDef[];
  checklists: TemplateChecklistDef[];
  library: TemplateLibraryDef[];

  createdAt: string;
  updatedAt: string;
}
