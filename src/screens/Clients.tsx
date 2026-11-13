import React, { useState, useMemo, useEffect } from 'react';
import {
  Users, Search, Plus, Phone, Mail, MoreVertical, X, ChevronLeft, 
  MessageSquare, PhoneCall, Video, Smartphone, StickyNote, Building2,
  Briefcase, DollarSign, Tag, Send, Check, Calendar, CheckSquare, Clock, FileText,
  FolderHeart, Activity, Calendar as CalendarIcon, File, Archive, AlertTriangle
} from 'lucide-react';
import { Header, ProgressBar } from '../components/Shared';
import { BottomSheet, BottomSheetField } from '../components/BottomSheet';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useClients } from '../context/ClientsContext';
import { useMessages } from '../context/MessagesContext';
import { useProjects } from '../context/ProjectsContext';
import { useRevenue } from '../context/RevenueContext';
import { useNavigation } from '../context/NavigationContext';
import { useTasks } from '../context/TasksContext';
import { useCalendar } from '../context/CalendarContext';
import { useLibrary } from '../context/LibraryContext';
import { useTimeTracker } from '../context/TimeTrackerContext';
import { usePreferences } from '../context/PreferencesContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { logAuditEvent, fetchAuditEvents } from '../services/activityService';
import { Client, ClientStatus, MessageChannel, ProjectItem, TaskItem, EventItem, LibraryItem } from '../types';
import { formatCurrency, formatCurrencyCompact, getCurrencySymbol } from '../utils/currency';
import { generateId } from '../utils/id';
import { validateRequired, validateEmail, validatePositiveNumber, validateUrl } from '../utils/validation';

const STATUS_COLORS: Record<ClientStatus, string> = {
  lead: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  active: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  past: 'bg-tx-muted/10 text-tx-muted border-tx-muted/20'
};

const CHANNEL_ICONS: Record<MessageChannel, React.ElementType> = {
  note: StickyNote,
  email: Mail,
  sms: Smartphone,
  call: PhoneCall,
  meeting: Video,
};

type TabType = 'overview' | 'projects' | 'tasks' | 'schedule' | 'revenue' | 'library' | 'activity';

export function Clients({ initialClientId, initialOpenCreate }: { initialClientId?: string; initialOpenCreate?: boolean }) {
  const { clients, addClient, updateClient, deleteClient } = useClients();
  const { messagesForClient, addMessage } = useMessages();
  const { projects, addProject } = useProjects();
  const { revenues } = useRevenue();
  const { tasks, addTask, completeTask } = useTasks();
  const { events, addEvent } = useCalendar();
  const { library: libraryItems, addLibraryItem } = useLibrary();
  const { timeEntries } = useTimeTracker();
  const { preferences } = usePreferences();
  const { push, goToTab, navigationOptions } = useNavigation();
  const { role, idToken, organization } = useAuth();
  const { showToast } = useToast();
  const isReadOnly = role === 'viewer';

  const [selectedClientId, setSelectedClientId] = useState<string | null>(initialClientId || null);
  const [filter, setFilter] = useState<'all' | ClientStatus>('all');
  const [taskFilter, setTaskFilter] = useState<'all' | 'active' | 'done'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Sheet / Modals
  const [isSheetOpen, setIsSheetOpen] = useState(!!initialOpenCreate);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Forms
  const initialFormState = {
    name: '', company: '', email: '', phone: '', status: 'lead' as ClientStatus, tags: [] as string[], notes: ''
  };
  const [form, setForm] = useState(initialFormState);
  const [newTag, setNewTag] = useState('');

  const [msgBody, setMsgBody] = useState('');
  const [msgChannel, setMsgChannel] = useState<MessageChannel>('note');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Quick Action Sheets
  const [activeActionSheet, setActiveActionSheet] = useState<'project' | 'task' | 'event' | 'library' | null>(null);
  
  const [projectForm, setProjectForm] = useState({ name: '', priority: 'high' as 'high' | 'low', tone: 'neutral' as any, dueDate: '', budget: '' });
  const [taskForm, setTaskForm] = useState({ title: '', priority: 'Medium' as 'Low'|'Medium'|'High', categoryId: '', projectId: '', dueDate: '' });
  const [eventForm, setEventForm] = useState({ title: '', date: new Date().toISOString().split('T')[0], type: 'Meeting' as any });
  const [libForm, setLibForm] = useState({ name: '', type: 'link' as 'file'|'link'|'note', category: 'Documents' as any, urlOrReference: '' });
  const [auditEventsList, setAuditEventsList] = useState<any[]>([]);

  useEffect(() => {
    if (initialClientId) {
      setSelectedClientId(initialClientId);
    } else if (navigationOptions?.clientId) {
      setSelectedClientId(navigationOptions.clientId);
    } else if (navigationOptions?.filterClientId) {
      setSelectedClientId(navigationOptions.filterClientId);
    }
  }, [initialClientId, navigationOptions?.clientId, navigationOptions?.filterClientId]);

  useEffect(() => {
    if (initialOpenCreate) setIsSheetOpen(true);
  }, [initialOpenCreate]);

  // Load real audit events for client
  useEffect(() => {
    if (selectedClientId && activeTab === 'activity') {
      fetchAuditEvents(idToken, organization?.id || null, { entityType: 'client', entityId: selectedClientId })
        .then(setAuditEventsList)
        .catch(() => {});
    }
  }, [selectedClientId, activeTab, idToken, organization?.id]);
  
  // Set default categoryId for tasks
  useEffect(() => {
    if (!taskForm.categoryId && preferences.categories.length > 0) {
      const taskCats = preferences.categories.filter(c => c.scope === 'task');
      if (taskCats.length > 0) setTaskForm(prev => ({ ...prev, categoryId: taskCats[0].id }));
    }
  }, [preferences.categories, taskForm.categoryId]);

  const filteredClients = useMemo(() => {
    let result = clients;
    if (filter !== 'all') result = result.filter(c => c.status === filter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c => 
        c.name.toLowerCase().includes(q) || (c.company && c.company.toLowerCase().includes(q)) || (c.email && c.email.toLowerCase().includes(q))
      );
    }
    return result;
  }, [clients, filter, searchQuery]);

  const selectedClient = clients.find(c => c.id === selectedClientId);

  const clientData = useMemo(() => {
    if (!selectedClient) return null;
    const cid = selectedClient.id;
    return {
      projects: projects.filter(p => p.clientId === cid),
      tasks: tasks.filter(t => t.clientId === cid),
      events: events.filter(e => e.clientId === cid).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
      library: libraryItems.filter(l => l.clientId === cid),
      revenues: revenues.filter(r => r.clientId === cid),
      messages: messagesForClient(cid),
      time: timeEntries.filter(t => t.clientId === cid || projects.find(p => p.id === t.projectId)?.clientId === cid)
    };
  }, [selectedClient, projects, tasks, events, libraryItems, revenues, timeEntries, messagesForClient]);

  const stats = useMemo(() => {
    if (!clientData) return null;
    const activeProj = clientData.projects.filter(p => p.status !== 'completed').length;
    const openTasks = clientData.tasks.filter(t => t.status !== 'done').length;
    const today = new Date().toISOString().split('T')[0];
    const upcomingEvents = clientData.events.filter(e => e.date >= today);
    const totalRevenue = clientData.revenues.filter(r => r.status === 'Paid').reduce((sum, r) => sum + r.amount, 0);
    return { activeProj, openTasks, upcomingEvents: upcomingEvents.length, totalRevenue, docCount: clientData.library.length };
  }, [clientData]);

  const displayedClientTasks = useMemo(() => {
    if (!clientData) return [];
    if (taskFilter === 'active') return clientData.tasks.filter(t => t.status !== 'done');
    if (taskFilter === 'done') return clientData.tasks.filter(t => t.status === 'done');
    return clientData.tasks;
  }, [clientData, taskFilter]);

  const combinedActivity = useMemo(() => {
    if (!clientData) return [];
    type ActivityItem = { id: string; type: 'message'|'time'|'event'|'revenue'|'audit'; date: Date; data: any };
    const items: ActivityItem[] = [];
    clientData.messages.forEach(m => items.push({ id: m.id, type: 'message', date: new Date(m.createdAt), data: m }));
    clientData.time.forEach(t => items.push({ id: t.id, type: 'time', date: new Date(t.startedAt), data: t }));
    clientData.events.filter(e => e.status === 'completed').forEach(e => items.push({ id: e.id, type: 'event', date: new Date(e.date + 'T00:00:00'), data: e }));
    clientData.revenues.forEach(r => items.push({ id: r.id, type: 'revenue', date: new Date(r.date + 'T00:00:00'), data: r }));
    auditEventsList.forEach(ae => items.push({ id: ae.id, type: 'audit', date: new Date(ae.createdAt), data: ae }));
    return items.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [clientData, auditEventsList]);

  const counts = useMemo(() => ({
    all: clients.length,
    lead: clients.filter(c => c.status === 'lead').length,
    active: clients.filter(c => c.status === 'active').length,
    past: clients.filter(c => c.status === 'past').length,
  }), [clients]);

  const handleSaveClient = (addAnother: boolean = false) => {
    if (isSubmitting) return;
    if (isReadOnly) {
      const msg = 'Viewer role has read-only access';
      showToast({ message: msg });
      throw new Error(msg);
    }
    const nameValidation = validateRequired(form.name, 'Client name');
    if (!nameValidation.isValid) {
      const msg = nameValidation.error || 'Client name is required.';
      showToast({ message: msg });
      throw new Error(msg);
    }
    const emailValidation = validateEmail(form.email, false);
    if (!emailValidation.isValid) {
      const msg = emailValidation.error || 'Please enter a valid email address.';
      showToast({ message: msg });
      throw new Error(msg);
    }

    setIsSubmitting(true);
    try {
      if (editingClientId) {
        updateClient(editingClientId, { ...form, name: form.name.trim() });
        logAuditEvent(idToken, organization?.id || null, 'client.updated', 'client', editingClientId, { name: form.name.trim() });
        showToast({ message: 'Client updated successfully.' });
      } else {
        const newId = addClient({ ...form, name: form.name.trim(), avatarSeed: generateId(), createdAt: new Date().toISOString() });
        logAuditEvent(idToken, organization?.id || null, 'client.created', 'client', newId, { name: form.name.trim() });
        showToast({ message: 'Client created successfully.' });
      }
      if (addAnother) {
        setForm(initialFormState);
        setEditingClientId(null);
      } else {
        setIsSheetOpen(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error && err.message ? err.message : 'Failed to save client.';
      showToast({ message: msg });
      throw err instanceof Error ? err : new Error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmArchive = () => {
    if (isReadOnly) {
      showToast({ message: 'Viewer role has read-only access' });
      setIsArchiveOpen(false);
      return;
    }
    if (selectedClientId) {
      updateClient(selectedClientId, { status: 'past', isArchived: true });
      logAuditEvent(idToken, organization?.id || null, 'client.archived', 'client', selectedClientId, { name: selectedClient?.name });
      showToast({ message: 'Client safely archived' });
      setIsArchiveOpen(false);
    }
  };

  const confirmDelete = () => {
    if (isReadOnly) {
      showToast({ message: 'Viewer role has read-only access' });
      setIsDeleteOpen(false);
      return;
    }
    if (selectedClientId) {
      const projCount = clientData?.projects.length || 0;
      const taskCount = clientData?.tasks.length || 0;
      deleteClient(selectedClientId);
      logAuditEvent(idToken, organization?.id || null, 'client.deleted', 'client', selectedClientId, {
        name: selectedClient?.name,
        unlinkedProjects: projCount,
        unlinkedTasks: taskCount,
      });
      showToast({ message: 'Client deleted' });
      setSelectedClientId(null);
      setIsDeleteOpen(false);
    }
  };

  const handleToggleTask = (t: TaskItem) => {
    if (isReadOnly) {
      showToast({ message: 'Viewer role has read-only access' });
      return;
    }
    completeTask(t.id);
    const newStatus = t.status === 'done' ? 'active' : 'done';
    logAuditEvent(idToken, organization?.id || null, `task.${newStatus}`, 'client', selectedClientId || undefined, {
      taskId: t.id,
      title: t.title,
    });
    showToast({ message: `Task marked as ${newStatus}` });
  };

  const handleSendMsg = () => {
    if (isReadOnly) {
      showToast({ message: 'Viewer role has read-only access' });
      return;
    }
    if (!selectedClientId) return;
    if (!msgBody.trim()) {
      showToast({ message: 'Please enter a note or message.' });
      return;
    }
    addMessage({ clientId: selectedClientId, body: msgBody.trim(), channel: msgChannel });
    setMsgBody('');
    showToast({ message: 'Activity note recorded' });
  };

  const addTag = () => {
    const t = newTag.trim().toLowerCase();
    if (t && !form.tags.includes(t)) setForm(prev => ({ ...prev, tags: [...prev.tags, t] }));
    setNewTag('');
  };

  const removeTag = (t: string) => {
    setForm(prev => ({ ...prev, tags: prev.tags.filter(tag => tag !== t) }));
  };

  // Creation Handlers
  const handleCreateProject = () => {
    if (isSubmitting) return;
    if (isReadOnly) {
      const msg = 'Viewer role has read-only access';
      showToast({ message: msg });
      throw new Error(msg);
    }
    if (!selectedClientId) {
      const msg = 'Please select a client.';
      showToast({ message: msg });
      throw new Error(msg);
    }
    const nameValidation = validateRequired(projectForm.name, 'Project name');
    if (!nameValidation.isValid) {
      const msg = nameValidation.error || 'Project name is required.';
      showToast({ message: msg });
      throw new Error(msg);
    }
    if (projectForm.budget && projectForm.budget.trim()) {
      const budgetValidation = validatePositiveNumber(projectForm.budget, 'Budget', true);
      if (!budgetValidation.isValid) {
        const msg = budgetValidation.error || 'Budget must be a valid number.';
        showToast({ message: msg });
        throw new Error(msg);
      }
    }

    setIsSubmitting(true);
    try {
      const newProjId = addProject({
        name: projectForm.name.trim(),
        priority: projectForm.priority,
        tone: projectForm.tone,
        completionPct: 0,
        clientId: selectedClientId,
        status: 'active',
        dueDate: projectForm.dueDate || undefined,
        budget: projectForm.budget ? Number(projectForm.budget) : undefined,
      });
      logAuditEvent(idToken, organization?.id || null, 'project.created', 'client', selectedClientId, {
        projectId: newProjId,
        projectName: projectForm.name.trim(),
      });
      showToast({ message: 'Project created for client' });
      setActiveActionSheet(null);
      setProjectForm({ name: '', priority: 'high', tone: 'neutral', dueDate: '', budget: '' });
    } catch (err: unknown) {
      const msg = err instanceof Error && err.message ? err.message : 'Failed to create project.';
      showToast({ message: msg });
      throw err instanceof Error ? err : new Error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateTask = () => {
    if (isSubmitting) return;
    if (isReadOnly) {
      const msg = 'Viewer role has read-only access';
      showToast({ message: msg });
      throw new Error(msg);
    }
    if (!selectedClientId) {
      const msg = 'Please select a client.';
      showToast({ message: msg });
      throw new Error(msg);
    }
    const titleValidation = validateRequired(taskForm.title, 'Task title');
    if (!titleValidation.isValid) {
      const msg = titleValidation.error || 'Task title is required.';
      showToast({ message: msg });
      throw new Error(msg);
    }
    if (!taskForm.categoryId) {
      const msg = 'Please select a category for the task.';
      showToast({ message: msg });
      throw new Error(msg);
    }

    setIsSubmitting(true);
    try {
      const newTaskId = addTask({
        title: taskForm.title.trim(),
        priority: taskForm.priority,
        categoryId: taskForm.categoryId,
        status: 'active',
        clientId: selectedClientId,
        projectId: taskForm.projectId || undefined,
        dueDate: taskForm.dueDate || undefined,
        date: taskForm.dueDate || new Date().toISOString(),
      });
      logAuditEvent(idToken, organization?.id || null, 'task.created', 'client', selectedClientId, {
        taskId: newTaskId,
        taskTitle: taskForm.title.trim(),
        projectId: taskForm.projectId,
      });
      showToast({ message: 'Task added for client' });
      setActiveActionSheet(null);
      setTaskForm({ title: '', priority: 'Medium', categoryId: taskForm.categoryId, projectId: '', dueDate: '' });
    } catch (err: unknown) {
      const msg = err instanceof Error && err.message ? err.message : 'Failed to create task.';
      showToast({ message: msg });
      throw err instanceof Error ? err : new Error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateEvent = () => {
    if (isSubmitting) return;
    if (isReadOnly) {
      const msg = 'Viewer role has read-only access';
      showToast({ message: msg });
      throw new Error(msg);
    }
    if (!selectedClientId) {
      const msg = 'Please select a client.';
      showToast({ message: msg });
      throw new Error(msg);
    }
    const titleValidation = validateRequired(eventForm.title, 'Event title');
    if (!titleValidation.isValid) {
      const msg = titleValidation.error || 'Event title is required.';
      showToast({ message: msg });
      throw new Error(msg);
    }

    setIsSubmitting(true);
    try {
      const cat = preferences.categories.find(c => c.scope === 'event');
      addEvent({
        ...eventForm,
        title: eventForm.title.trim(),
        allDay: true,
        status: 'scheduled',
        clientId: selectedClientId,
        categoryId: cat?.id || '',
        repeat: 'none'
      });
      showToast({ message: 'Event scheduled for client' });
      setActiveActionSheet(null);
      setEventForm({ title: '', date: new Date().toISOString().split('T')[0], type: 'Meeting' });
    } catch (err: unknown) {
      const msg = err instanceof Error && err.message ? err.message : 'Failed to schedule event.';
      showToast({ message: msg });
      throw err instanceof Error ? err : new Error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateLibrary = () => {
    if (isSubmitting) return;
    if (isReadOnly) {
      const msg = 'Viewer role has read-only access';
      showToast({ message: msg });
      throw new Error(msg);
    }
    if (!selectedClientId) {
      const msg = 'Please select a client.';
      showToast({ message: msg });
      throw new Error(msg);
    }
    const nameValidation = validateRequired(libForm.name, 'Document name');
    if (!nameValidation.isValid) {
      const msg = nameValidation.error || 'Document name is required.';
      showToast({ message: msg });
      throw new Error(msg);
    }
    if (libForm.type === 'link' && libForm.urlOrReference.trim()) {
      const urlValidation = validateUrl(libForm.urlOrReference, false);
      if (!urlValidation.isValid) {
        const msg = urlValidation.error || 'Please enter a valid web URL.';
        showToast({ message: msg });
        throw new Error(msg);
      }
    }

    setIsSubmitting(true);
    try {
      addLibraryItem({
        ...libForm,
        name: libForm.name.trim(),
        clientId: selectedClientId,
        tags: []
      });
      showToast({ message: 'Document added for client' });
      setActiveActionSheet(null);
      setLibForm({ name: '', type: 'link', category: 'Documents', urlOrReference: '' });
    } catch (err: unknown) {
      const msg = err instanceof Error && err.message ? err.message : 'Failed to save resource.';
      showToast({ message: msg });
      throw err instanceof Error ? err : new Error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-canvas relative pb-[88px] overflow-hidden">
      <div className={`flex-col w-full md:w-[350px] lg:w-[400px] h-full bg-canvas shrink-0 border-r border-bd-subtle ${selectedClient ? 'hidden md:flex' : 'flex'}`}>
        <Header title="Clients" rightIcon={
          <div className="flex items-center gap-1">
            <button onClick={() => setIsSearchOpen(!isSearchOpen)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-neutral text-tx-primary transition-colors">
              <Search size={20} />
            </button>
            <button
              onClick={() => {
                if (isReadOnly) {
                  showToast({ message: 'Viewer role has read-only access' });
                  return;
                }
                setForm(initialFormState);
                setEditingClientId(null);
                setIsSheetOpen(true);
              }}
              disabled={isReadOnly}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-tx-primary text-tx-inverse hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Add client"
            >
              <Plus size={22} />
            </button>
          </div>
        } />
        {isSearchOpen && (
          <div className="px-4 py-2 border-b border-bd-subtle">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-tx-muted" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search clients..."
                className="w-full bg-surface-neutral border border-bd-subtle rounded-xl py-2 pl-9 pr-9 text-sm text-tx-primary placeholder:text-tx-muted focus:outline-none focus:ring-1 focus:ring-tx-primary"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-tx-muted hover:text-tx-primary p-1">
                  <X size={15} />
                </button>
              )}
            </div>
          </div>
        )}
        <div className="px-4 py-2.5 overflow-x-auto no-scrollbar flex gap-1.5 border-b border-bd-subtle">
          {(['all', 'lead', 'active', 'past'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`whitespace-nowrap px-3 py-1 rounded-lg text-xs font-medium transition-all border ${
                filter === f
                  ? 'bg-tx-primary text-tx-inverse border-tx-primary shadow-xs'
                  : 'bg-canvas text-tx-muted border-bd-subtle hover:text-tx-primary hover:bg-surface-neutral'
              }`}
            >
              <span className="capitalize">{f}</span>
              <span className={`ml-1.5 font-mono tabular-nums text-[11px] ${filter === f ? 'text-accent-primary font-bold' : 'text-tx-muted'}`}>
                {counts[f]}
              </span>
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-6 flex flex-col gap-2 mt-2">
          {filteredClients.map(c => {
            const isSelected = selectedClientId === c.id;
            return (
              <button
                key={c.id}
                onClick={() => { setSelectedClientId(c.id); setActiveTab('overview'); }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left group ${
                  isSelected
                    ? 'bg-canvas-card border-accent-primary shadow-xs ring-1 ring-accent-primary/50'
                    : 'bg-canvas border-bd-subtle hover:border-bd-strong hover:bg-surface-hover'
                }`}
              >
                <img
                  src={`https://api.dicebear.com/7.x/notionists/svg?seed=${c.avatarSeed}`}
                  alt={c.name}
                  className="w-11 h-11 rounded-lg bg-surface-neutral object-cover shrink-0 border border-bd-subtle/70"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm text-tx-primary truncate leading-tight group-hover:text-tx-primary">
                    {c.name}
                  </h3>
                  {c.company && (
                    <div className="text-xs text-tx-muted truncate mt-0.5">{c.company}</div>
                  )}
                </div>
                <div className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase border ${STATUS_COLORS[c.status]}`}>
                  {c.status}
                </div>
              </button>
            );
          })}
          {filteredClients.length === 0 && (
            <div className="py-12 text-center text-sm text-tx-muted">No clients found.</div>
          )}
        </div>
      </div>

      <div className={`flex-col flex-1 h-full bg-surface-neutral/10 relative ${selectedClient ? 'flex' : 'hidden md:flex'}`}>
        {selectedClient && clientData && stats ? (
          <div className="flex flex-col h-full">
            {/* 360 Header */}
            <div className="bg-canvas border-b border-bd-subtle shrink-0 relative">
              <div className="px-4 py-3 flex items-center justify-between">
                <button onClick={() => setSelectedClientId(null)} className="w-10 h-10 flex items-center justify-center -ml-2 rounded-full hover:bg-surface-neutral text-tx-primary md:hidden">
                  <ChevronLeft size={24} />
                </button>
                <div className="flex-1" />
                <div className="relative">
                  <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="w-10 h-10 flex items-center justify-center -mr-2 rounded-full hover:bg-surface-neutral text-tx-primary" aria-label="More options">
                    <MoreVertical size={20} />
                  </button>
                  {isMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)} />
                      <div className="absolute top-full right-0 mt-1 w-48 bg-canvas border border-bd-subtle rounded-xl shadow-xl z-50 overflow-hidden">
                        <button onClick={() => { 
                            if (role === 'viewer') {
                              showToast({ message: 'Viewer role has read-only access' });
                              return;
                            }
                            setForm({
                              name: selectedClient.name, company: selectedClient.company || '',
                              email: selectedClient.email || '', phone: selectedClient.phone || '',
                              status: selectedClient.status, tags: [...(selectedClient.tags || [])], notes: selectedClient.notes || ''
                            });
                            setEditingClientId(selectedClient.id); setIsMenuOpen(false); setIsSheetOpen(true); 
                          }} 
                          disabled={role === 'viewer'}
                          className={`w-full text-left px-4 py-3 text-[14px] font-medium text-tx-primary hover:bg-surface-neutral flex items-center justify-between ${role === 'viewer' ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <span>Edit Client</span>
                        </button>
                        <button 
                          onClick={() => { 
                            if (role === 'viewer') {
                              showToast({ message: 'Viewer role has read-only access' });
                              return;
                            }
                            setIsMenuOpen(false); 
                            setIsArchiveOpen(true); 
                          }} 
                          disabled={role === 'viewer'}
                          className={`w-full text-left px-4 py-3 text-[14px] font-medium text-tx-secondary hover:bg-surface-neutral flex items-center gap-2 ${role === 'viewer' ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <Archive size={15} />
                          <span>Archive Client</span>
                        </button>
                        <button 
                          onClick={() => { 
                            if (role === 'viewer') {
                              showToast({ message: 'Viewer role has read-only access' });
                              return;
                            }
                            setIsMenuOpen(false); 
                            setIsDeleteOpen(true); 
                          }} 
                          disabled={role === 'viewer'}
                          className={`w-full text-left px-4 py-3 text-[14px] font-medium text-red-500 hover:bg-red-500/10 flex items-center gap-2 ${role === 'viewer' ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <AlertTriangle size={15} />
                          <span>Delete Client</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              <div className="px-6 pb-6 pt-2 flex flex-col md:flex-row gap-6 items-center md:items-start text-center md:text-left">
                <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${selectedClient.avatarSeed}`} alt={selectedClient.name} className="w-24 h-24 rounded-full bg-surface-neutral border border-bd-subtle shadow-sm object-cover shrink-0" />
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-tx-primary mb-1">{selectedClient.name}</h2>
                  {selectedClient.company && (
                    <div className="flex items-center justify-center md:justify-start text-tx-muted text-[15px] mb-3">
                      <Building2 size={16} className="mr-1.5" />
                      <span>{selectedClient.company}</span>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 justify-center md:justify-start items-center mb-4">
                    <div className={`px-2.5 py-1 rounded-full text-[12px] font-bold tracking-wider uppercase border ${STATUS_COLORS[selectedClient.status]}`}>
                      {selectedClient.status}
                    </div>
                    {selectedClient.tags.map(t => (
                      <span key={t} className="px-2.5 py-1 bg-surface-neutral text-tx-secondary rounded-md text-[12px] font-medium border border-bd-subtle/50">{t}</span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                  <a href={selectedClient.phone ? `tel:${selectedClient.phone}` : '#'} onClick={e => !selectedClient.phone && e.preventDefault()} className={`flex-1 md:flex-none flex items-center justify-center w-12 h-12 rounded-full border transition-colors ${selectedClient.phone ? 'bg-surface-neutral border-bd-subtle text-tx-primary' : 'bg-transparent border-dashed text-tx-muted opacity-50'}`}>
                    <Phone size={18} />
                  </a>
                  <a href={selectedClient.email ? `mailto:${selectedClient.email}` : '#'} onClick={e => !selectedClient.email && e.preventDefault()} className={`flex-1 md:flex-none flex items-center justify-center w-12 h-12 rounded-full border transition-colors ${selectedClient.email ? 'bg-surface-neutral border-bd-subtle text-tx-primary' : 'bg-transparent border-dashed text-tx-muted opacity-50'}`}>
                    <Mail size={18} />
                  </a>
                </div>
              </div>

              {/* Tabs */}
              <div className="px-2 md:px-6 flex overflow-x-auto no-scrollbar border-t border-bd-subtle">
                {(['overview', 'activity', 'projects', 'tasks', 'schedule', 'revenue', 'library'] as TabType[]).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-3 text-[14px] font-medium capitalize border-b-2 whitespace-nowrap transition-colors ${activeTab === tab ? 'border-tx-primary text-tx-primary' : 'border-transparent text-tx-muted hover:text-tx-secondary'}`}>
                    {tab} 
                    {tab === 'projects' && clientData.projects.length > 0 && <span className="ml-1.5 opacity-50">({clientData.projects.length})</span>}
                    {tab === 'tasks' && clientData.tasks.length > 0 && <span className="ml-1.5 opacity-50">({clientData.tasks.length})</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-surface-neutral/30 no-scrollbar">
              
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-canvas border border-bd-subtle rounded-xl p-4 flex flex-col shadow-xs">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-tx-muted uppercase tracking-wider">Active Projects</span>
                        <Briefcase size={15} className="text-tx-secondary" />
                      </div>
                      <span className="text-2xl font-bold font-mono tabular-nums text-tx-primary">{stats.activeProj}</span>
                    </div>
                    <div className="bg-canvas border border-bd-subtle rounded-xl p-4 flex flex-col shadow-xs">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-tx-muted uppercase tracking-wider">Open Tasks</span>
                        <CheckSquare size={15} className="text-orange-600" />
                      </div>
                      <span className="text-2xl font-bold font-mono tabular-nums text-tx-primary">{stats.openTasks}</span>
                    </div>
                    <div className="bg-canvas border border-bd-subtle rounded-xl p-4 flex flex-col shadow-xs">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-tx-muted uppercase tracking-wider">Total Billed</span>
                        <DollarSign size={15} className="text-emerald-600" />
                      </div>
                      <span className="text-2xl font-bold font-mono tabular-nums text-tx-primary">{formatCurrencyCompact(stats.totalRevenue, preferences.currency)}</span>
                    </div>
                    <div className="bg-canvas border border-bd-subtle rounded-xl p-4 flex flex-col shadow-xs">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-tx-muted uppercase tracking-wider">Upcoming</span>
                        <CalendarIcon size={15} className="text-tx-secondary" />
                      </div>
                      <span className="text-2xl font-bold font-mono tabular-nums text-tx-primary">{stats.upcomingEvents}</span>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div>
                    <h3 className="text-xs font-semibold text-tx-muted uppercase tracking-wider mb-2.5">Quick Actions</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                      <button
                        onClick={() => isReadOnly ? showToast({ message: 'Viewer role has read-only access' }) : setActiveActionSheet('project')}
                        disabled={isReadOnly}
                        className="bg-canvas border border-bd-subtle hover:border-tx-primary rounded-xl p-3 flex items-center gap-2.5 transition-all group shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="w-8 h-8 rounded-lg bg-surface-neutral text-tx-primary flex items-center justify-center shrink-0 border border-bd-subtle"><Briefcase size={16}/></div>
                        <span className="text-xs font-semibold text-tx-primary">New Project</span>
                      </button>
                      <button
                        onClick={() => isReadOnly ? showToast({ message: 'Viewer role has read-only access' }) : setActiveActionSheet('task')}
                        disabled={isReadOnly}
                        className="bg-canvas border border-bd-subtle hover:border-tx-primary rounded-xl p-3 flex items-center gap-2.5 transition-all group shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="w-8 h-8 rounded-lg bg-surface-neutral text-tx-primary flex items-center justify-center shrink-0 border border-bd-subtle"><CheckSquare size={16}/></div>
                        <span className="text-xs font-semibold text-tx-primary">New Task</span>
                      </button>
                      <button
                        onClick={() => isReadOnly ? showToast({ message: 'Viewer role has read-only access' }) : setActiveActionSheet('event')}
                        disabled={isReadOnly}
                        className="bg-canvas border border-bd-subtle hover:border-tx-primary rounded-xl p-3 flex items-center gap-2.5 transition-all group shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="w-8 h-8 rounded-lg bg-surface-neutral text-tx-primary flex items-center justify-center shrink-0 border border-bd-subtle"><CalendarIcon size={16}/></div>
                        <span className="text-xs font-semibold text-tx-primary">Schedule</span>
                      </button>
                      <button
                        onClick={() => isReadOnly ? showToast({ message: 'Viewer role has read-only access' }) : setActiveActionSheet('library')}
                        disabled={isReadOnly}
                        className="bg-canvas border border-bd-subtle hover:border-tx-primary rounded-xl p-3 flex items-center gap-2.5 transition-all group shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="w-8 h-8 rounded-lg bg-surface-neutral text-tx-primary flex items-center justify-center shrink-0 border border-bd-subtle"><FileText size={16}/></div>
                        <span className="text-xs font-semibold text-tx-primary">Add File</span>
                      </button>
                    </div>
                  </div>

                  {/* Notes / Log */}
                  <div className="bg-canvas border border-bd-subtle rounded-2xl p-4">
                    <h3 className="text-[15px] font-bold text-tx-primary mb-3">Log Interaction</h3>
                    <div className="border border-bd-subtle rounded-xl p-3 focus-within:border-accent-primary transition-colors">
                      <textarea value={msgBody} onChange={e => setMsgBody(e.target.value)} placeholder="Log a note, call, meeting..." className="w-full bg-transparent resize-none outline-none text-[15px] text-tx-primary placeholder:text-tx-muted min-h-[60px]" />
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-bd-subtle/50">
                        <div className="flex gap-1">
                          {(['note', 'email', 'call', 'meeting', 'sms'] as MessageChannel[]).map(ch => {
                            const Icon = CHANNEL_ICONS[ch];
                            return (
                              <button key={ch} onClick={() => setMsgChannel(ch)} className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${msgChannel === ch ? 'bg-surface-neutral text-tx-primary' : 'text-tx-muted hover:bg-surface-neutral'}`}>
                                <Icon size={16} />
                              </button>
                            )
                          })}
                        </div>
                        <button onClick={handleSendMsg} disabled={isReadOnly || !msgBody.trim()} className="w-8 h-8 rounded-full bg-tx-primary text-tx-inverse flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                          <Send size={14} className="ml-0.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'activity' && (
                <div className="space-y-4">
                  {combinedActivity.length === 0 ? (
                    <div className="text-center py-12 text-tx-muted">No recent activity.</div>
                  ) : (
                    combinedActivity.map((act, i) => (
                      <div key={act.id + i} className="flex gap-3 bg-canvas p-4 rounded-2xl border border-bd-subtle">
                        <div className="w-10 h-10 rounded-full bg-surface-neutral flex items-center justify-center shrink-0 text-tx-muted">
                          {act.type === 'message' && <MessageSquare size={18} />}
                          {act.type === 'time' && <Clock size={18} />}
                          {act.type === 'event' && <CalendarIcon size={18} />}
                          {act.type === 'revenue' && <DollarSign size={18} />}
                          {act.type === 'audit' && <Activity size={18} className="text-accent-primary" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-[14px] font-medium capitalize text-tx-primary">
                              {act.type === 'audit' ? act.data.action.replace('.', ' ') : act.type}
                            </span>
                            <span className="text-[12px] text-tx-muted">{act.date.toLocaleDateString()}</span>
                          </div>
                          {act.type === 'message' && <p className="text-[14px] text-tx-secondary">{act.data.body}</p>}
                          {act.type === 'time' && <p className="text-[14px] text-tx-secondary">Logged {Math.round(act.data.durationSeconds/60)} mins {act.data.note && `- ${act.data.note}`}</p>}
                          {act.type === 'event' && <p className="text-[14px] text-tx-secondary">Completed: {act.data.title}</p>}
                          {act.type === 'revenue' && <p className="text-[14px] text-tx-secondary">Payment: {formatCurrency(act.data.amount, preferences.currency)}</p>}
                          {act.type === 'audit' && (
                            <p className="text-[14px] text-tx-secondary">
                              {act.data.metadata?.taskTitle || act.data.metadata?.projectName || act.data.metadata?.title || 'System action recorded'}
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'projects' && (
                <div className="space-y-3">
                  <button 
                    onClick={() => {
                      if (role === 'viewer') {
                        showToast({ message: 'Viewer role has read-only access' });
                        return;
                      }
                      setActiveActionSheet('project');
                    }} 
                    disabled={role === 'viewer'}
                    className={`w-full flex items-center justify-center gap-2 py-3 bg-surface-neutral rounded-xl border border-dashed border-bd-subtle text-tx-primary font-medium transition-colors mb-2 ${role === 'viewer' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-surface-hover'}`}
                  >
                    <Plus size={18} /> New Project
                  </button>
                  {clientData.projects.length === 0 ? (
                    <div className="text-center py-12 bg-canvas rounded-2xl border border-bd-subtle p-6">
                      <Briefcase size={28} className="mx-auto text-tx-muted mb-2 opacity-50" />
                      <div className="text-sm font-semibold text-tx-primary mb-1">No linked projects</div>
                      <p className="text-xs text-tx-muted max-w-xs mx-auto">Create a project for {selectedClient.name} to track progress, milestones, and deliverables.</p>
                    </div>
                  ) : (
                    clientData.projects.map(p => {
                      const projTasks = tasks.filter(t => t.projectId === p.id);
                      const openCount = projTasks.filter(t => t.status !== 'done').length;
                      return (
                        <div 
                          key={p.id} 
                          onClick={() => goToTab('projects', { filterProjectId: p.id })} 
                          className="bg-canvas border border-bd-subtle hover:border-accent-primary/60 rounded-xl p-4 cursor-pointer transition-all shadow-xs group"
                        >
                          <div className="flex items-start justify-between gap-3 mb-2.5">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[15px] font-bold text-tx-primary group-hover:text-tx-primary">{p.name}</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border ${STATUS_COLORS[p.status || 'active'] || 'bg-surface-neutral text-tx-muted'}`}>
                                  {p.status || 'active'}
                                </span>
                                {p.priority === 'high' && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-600 border border-orange-500/20">
                                    HIGH
                                  </span>
                                )}
                              </div>
                              {p.dueDate && (
                                <div className="text-xs text-tx-muted mt-1 flex items-center gap-1.5">
                                  <CalendarIcon size={12} />
                                  <span>Due {p.dueDate}</span>
                                </div>
                              )}
                            </div>
                            <span className="text-xs font-mono font-bold text-tx-primary">{p.completionPct}%</span>
                          </div>

                          <div className="w-full bg-surface-neutral h-1.5 rounded-full overflow-hidden mb-3">
                            <div className="bg-accent-primary h-full transition-all duration-300" style={{ width: `${Math.min(100, Math.max(0, p.completionPct))}%` }} />
                          </div>

                          <div className="flex items-center justify-between text-xs text-tx-muted pt-2 border-t border-bd-subtle/50">
                            <span className="flex items-center gap-1.5">
                              <CheckSquare size={13} />
                              <span className="font-mono">{openCount}</span> open {openCount === 1 ? 'task' : 'tasks'}
                            </span>
                            <span className="text-tx-primary font-medium flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                              Open Workspace <ChevronLeft size={14} className="rotate-180" />
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {activeTab === 'tasks' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex bg-surface-neutral p-1 rounded-xl text-xs font-medium">
                      {(['all', 'active', 'done'] as const).map(tf => (
                        <button
                          key={tf}
                          onClick={() => setTaskFilter(tf)}
                          className={`px-3 py-1 rounded-lg capitalize transition-all ${taskFilter === tf ? 'bg-canvas text-tx-primary shadow-xs font-bold' : 'text-tx-muted hover:text-tx-primary'}`}
                        >
                          {tf}
                        </button>
                      ))}
                    </div>
                    <button 
                      onClick={() => {
                        if (role === 'viewer') {
                          showToast({ message: 'Viewer role has read-only access' });
                          return;
                        }
                        setActiveActionSheet('task');
                      }} 
                      disabled={role === 'viewer'}
                      className={`flex items-center gap-1.5 px-3 py-1.5 bg-tx-primary text-tx-inverse rounded-xl text-xs font-semibold transition-opacity ${role === 'viewer' ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}`}
                    >
                      <Plus size={14} /> Add Task
                    </button>
                  </div>

                  {displayedClientTasks.length === 0 ? (
                    <div className="text-center py-12 bg-canvas rounded-2xl border border-bd-subtle p-6">
                      <CheckSquare size={28} className="mx-auto text-tx-muted mb-2 opacity-50" />
                      <div className="text-sm font-semibold text-tx-primary mb-1">No tasks in this view</div>
                      <p className="text-xs text-tx-muted max-w-xs mx-auto">Create a task linked to this client and optional project.</p>
                    </div>
                  ) : (
                    displayedClientTasks.map(t => {
                      const parentProj = projects.find(p => p.id === t.projectId);
                      return (
                        <div key={t.id} className="bg-canvas border border-bd-subtle rounded-xl p-3.5 flex items-start gap-3 hover:border-bd-strong transition-all shadow-xs">
                          <button
                            type="button"
                            onClick={() => handleToggleTask(t)}
                            disabled={role === 'viewer'}
                            className={`w-5 h-5 mt-0.5 rounded border shrink-0 flex items-center justify-center transition-colors cursor-pointer ${t.status === 'done' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-tx-muted hover:border-tx-primary'}`}
                            aria-label={`Toggle task "${t.title}"`}
                          >
                            {t.status === 'done' && <Check size={12} className="stroke-[3]" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-[14px] font-medium leading-tight ${t.status === 'done' ? 'text-tx-muted line-through' : 'text-tx-primary'}`}>
                                {t.title}
                              </span>
                              {parentProj && (
                                <button
                                  onClick={() => goToTab('projects', { filterProjectId: parentProj.id })}
                                  className="text-[11px] px-2 py-0.5 rounded-md font-medium bg-surface-neutral text-tx-secondary hover:text-tx-primary hover:border-bd-strong border border-bd-subtle transition-colors flex items-center gap-1"
                                >
                                  <Briefcase size={10} />
                                  <span className="truncate max-w-[120px]">{parentProj.name}</span>
                                </button>
                              )}
                              {t.priority && (
                                <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${t.priority === 'High' ? 'bg-orange-500/10 text-orange-600' : 'bg-surface-neutral text-tx-muted'}`}>
                                  {t.priority}
                                </span>
                              )}
                            </div>
                            {(t.dueDate || t.date) && (
                              <div className="text-xs text-tx-muted mt-1 flex items-center gap-1">
                                <Clock size={11} />
                                <span>Due {t.dueDate || t.date}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {activeTab === 'schedule' && (
                <div className="space-y-3">
                  <button
                    onClick={() => isReadOnly ? showToast({ message: 'Viewer role has read-only access' }) : setActiveActionSheet('event')}
                    disabled={isReadOnly}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-surface-neutral rounded-xl border border-dashed border-bd-subtle text-tx-primary font-medium hover:bg-surface-hover transition-colors mb-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus size={18} /> Schedule Event
                  </button>
                  {clientData.events.length === 0 ? (
                    <div className="text-center py-8 text-tx-muted">No scheduled events.</div>
                  ) : (
                    clientData.events.map(e => (
                      <div key={e.id} className="bg-canvas border border-bd-subtle rounded-xl p-4 flex justify-between items-center">
                        <div>
                          <div className="text-[15px] font-bold text-tx-primary mb-1">{e.title}</div>
                          <div className="text-[13px] text-tx-muted">{e.date} • {e.type}</div>
                        </div>
                        <div className={`px-2 py-1 rounded-md text-[11px] font-medium uppercase ${e.status === 'completed' ? 'bg-surface-neutral text-tx-muted' : 'bg-purple-500/10 text-purple-600'}`}>
                          {e.status}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'revenue' && (() => {
                const totalRevenue = clientData.revenues.reduce((sum, r) => sum + r.amount, 0);
                const totalTrackedSeconds = clientData.time.reduce((sum, t) => sum + t.durationSeconds, 0);
                const totalTrackedHours = totalTrackedSeconds / 3600;
                const effectiveHourly = totalTrackedHours > 0 ? totalRevenue / totalTrackedHours : 0;
                
                return (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="bg-surface-neutral p-4 rounded-2xl flex flex-col justify-center">
                      <div className="text-[13px] font-medium text-tx-muted mb-1">Total Revenue</div>
                      <div className="text-[24px] font-light text-tx-primary">{formatCurrency(totalRevenue, preferences.currency)}</div>
                    </div>
                    <div className="bg-surface-neutral p-4 rounded-2xl flex flex-col justify-center">
                      <div className="text-[13px] font-medium text-tx-muted mb-1">Tracked Hours</div>
                      <div className="text-[24px] font-light text-tx-primary">{totalTrackedHours.toFixed(1)}h</div>
                    </div>
                    <div className="bg-surface-neutral p-4 rounded-2xl flex flex-col justify-center">
                      <div className="text-[13px] font-medium text-tx-muted mb-1">Effective Hourly</div>
                      <div className="text-[24px] font-light text-tx-primary">{formatCurrency(effectiveHourly, preferences.currency)}/h</div>
                    </div>
                    <div className="bg-surface-neutral p-4 rounded-2xl flex flex-col justify-center">
                      <div className="text-[13px] font-medium text-tx-muted mb-1">Profit Estimate</div>
                      <div className="text-[24px] font-light text-tx-primary">{formatCurrency(totalRevenue, preferences.currency)}</div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[15px] font-semibold text-tx-primary">Revenue Entries</h3>
                    </div>
                    {clientData.revenues.length === 0 ? (
                      <div className="text-center py-8 text-tx-muted border border-dashed border-bd-subtle rounded-xl">No revenue logged.</div>
                    ) : (
                      clientData.revenues.map(r => (
                        <div key={r.id} className="bg-canvas border border-bd-subtle rounded-xl p-4 flex justify-between items-center">
                          <div>
                            <div className="text-[15px] font-bold text-tx-primary mb-1">{formatCurrency(r.amount, preferences.currency)}</div>
                            <div className="text-[13px] text-tx-muted">{new Date(r.date + 'T00:00:00').toLocaleDateString()} {r.notes && `• ${r.notes}`}</div>
                          </div>
                          <div className={`px-2.5 py-1 rounded-full text-[11px] font-medium uppercase ${r.status === 'Paid' ? 'bg-emerald-500/10 text-emerald-600' : r.status === 'Pending' ? 'bg-yellow-500/10 text-yellow-600' : 'bg-red-500/10 text-red-500'}`}>
                            {r.status}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )})()}
              {activeTab === 'library' && (
                <div className="space-y-3">
                  <button
                    onClick={() => isReadOnly ? showToast({ message: 'Viewer role has read-only access' }) : setActiveActionSheet('library')}
                    disabled={isReadOnly}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-surface-neutral rounded-xl border border-dashed border-bd-subtle text-tx-primary font-medium hover:bg-surface-hover transition-colors mb-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus size={18} /> Add Document
                  </button>
                  {clientData.library.length === 0 ? (
                    <div className="text-center py-8 text-tx-muted">No documents found.</div>
                  ) : (
                    clientData.library.map(l => (
                      <div key={l.id} className="bg-canvas border border-bd-subtle rounded-xl p-4 flex justify-between items-center">
                        <div>
                          <div className="text-[15px] font-bold text-tx-primary mb-1">{l.name}</div>
                          <div className="text-[13px] text-tx-muted">{l.category} • {l.type}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-tx-muted p-8">
            <div className="w-16 h-16 rounded-full bg-surface-neutral flex items-center justify-center mb-4"><Users size={32} /></div>
            <p className="text-lg font-medium text-tx-primary">No Client Selected</p>
            <p className="text-sm mt-1 text-center">Select a client from the list to view their 360 workspace.</p>
          </div>
        )}
      </div>

      {/* Primary Sheet: Edit/Create Client */}
      <BottomSheet 
        isOpen={isSheetOpen} 
        onClose={() => setIsSheetOpen(false)} 
        title={editingClientId ? "Edit Client" : "New Client"} 
        onSave={() => handleSaveClient(false)} 
        saveLabel={editingClientId ? "Save Changes" : "Create Client"}
        savingLabel={editingClientId ? "Saving..." : "Creating..."}
        isSaving={isSubmitting}
        saveDisabled={isReadOnly || isSubmitting || !form.name.trim() || (!!form.email.trim() && !validateEmail(form.email, false).isValid)}
      >
        <BottomSheetField label="Name *"><input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Jane Doe" /></BottomSheetField>
        <BottomSheetField label="Company"><input type="text" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="Acme Corp" /></BottomSheetField>
        <div className="grid grid-cols-2 gap-4">
          <BottomSheetField label="Email"><input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jane@example.com" /></BottomSheetField>
          <BottomSheetField label="Phone"><input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="555-0199" /></BottomSheetField>
        </div>
        <BottomSheetField label="Status">
          <div className="flex bg-surface-neutral p-1 rounded-xl">
            {(['lead', 'active', 'past'] as const).map(s => (
              <button key={s} onClick={() => setForm(f => ({ ...f, status: s }))} className={`flex-1 py-1.5 text-[14px] font-medium rounded-lg capitalize transition-all ${form.status === s ? 'bg-canvas text-tx-primary shadow-sm' : 'text-tx-muted hover:text-tx-primary'}`}>{s}</button>
            ))}
          </div>
        </BottomSheetField>
        <BottomSheetField label="Tags">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              {form.tags.map(t => (
                <span key={t} className="px-3 py-1 bg-surface-neutral text-tx-primary text-[14px] font-medium rounded-full border border-bd-subtle flex items-center gap-1.5">{t} <button onClick={() => removeTag(t)} className="text-tx-muted hover:text-tx-primary"><X size={14} /></button></span>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="text" value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addTag(); }} placeholder="Add a tag (press Enter)" className="flex-1 min-w-0" />
              <button onClick={addTag} disabled={!newTag.trim()} className="px-4 bg-surface-neutral text-tx-primary rounded-xl font-medium disabled:opacity-50">Add</button>
            </div>
          </div>
        </BottomSheetField>
      </BottomSheet>

      {/* Action Sheets */}
      <BottomSheet 
        isOpen={activeActionSheet === 'project'} 
        onClose={() => setActiveActionSheet(null)} 
        title="New Project" 
        onSave={handleCreateProject} 
        saveLabel="Create Project"
        savingLabel="Creating..."
        isSaving={isSubmitting}
        saveDisabled={isReadOnly || isSubmitting || !projectForm.name.trim() || (!!projectForm.budget.trim() && !validatePositiveNumber(projectForm.budget, 'Budget', true).isValid)}
      >
        <BottomSheetField label="Project Name *"><input type="text" value={projectForm.name} onChange={e => setProjectForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Q4 Website Redesign" /></BottomSheetField>
        <div className="grid grid-cols-2 gap-3">
          <BottomSheetField label="Due Date">
            <input type="date" value={projectForm.dueDate} onChange={e => setProjectForm(f => ({ ...f, dueDate: e.target.value }))} />
          </BottomSheetField>
          <BottomSheetField label={`Budget (${preferences.currency})`}>
            <input type="number" min="0" step="100" value={projectForm.budget} onChange={e => setProjectForm(f => ({ ...f, budget: e.target.value }))} placeholder="5000" />
          </BottomSheetField>
        </div>
        <BottomSheetField label="Priority">
          <div className="flex bg-surface-neutral p-1 rounded-xl">
            {(['high', 'low'] as const).map(p => (
              <button key={p} onClick={() => setProjectForm(f => ({...f, priority: p}))} className={`flex-1 py-1.5 text-[14px] font-medium rounded-lg capitalize transition-all ${projectForm.priority === p ? 'bg-canvas text-tx-primary shadow-sm' : 'text-tx-muted'}`}>{p}</button>
            ))}
          </div>
        </BottomSheetField>
      </BottomSheet>

      <BottomSheet 
        isOpen={activeActionSheet === 'task'} 
        onClose={() => setActiveActionSheet(null)} 
        title="New Task" 
        onSave={handleCreateTask} 
        saveLabel="Create Task"
        savingLabel="Creating..."
        isSaving={isSubmitting}
        saveDisabled={isReadOnly || isSubmitting || !taskForm.title.trim() || !taskForm.categoryId}
      >
        <BottomSheetField label="Task Title *"><input type="text" value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Send proposal" /></BottomSheetField>
        {clientData && clientData.projects.length > 0 && (
          <BottomSheetField label="Link to Project (Optional)">
            <select 
              value={taskForm.projectId} 
              onChange={e => setTaskForm(f => ({ ...f, projectId: e.target.value }))}
              className="w-full bg-surface-neutral border border-bd-subtle rounded-xl p-3 text-sm text-tx-primary outline-none"
            >
              <option value="">No Project (General Client Task)</option>
              {clientData.projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </BottomSheetField>
        )}
        <div className="grid grid-cols-2 gap-3">
          <BottomSheetField label="Category">
            <select value={taskForm.categoryId} onChange={e => setTaskForm(f => ({...f, categoryId: e.target.value}))}>
              {preferences.categories.filter(c => c.scope === 'task').map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </BottomSheetField>
          <BottomSheetField label="Due Date">
            <input type="date" value={taskForm.dueDate} onChange={e => setTaskForm(f => ({ ...f, dueDate: e.target.value }))} />
          </BottomSheetField>
        </div>
        <BottomSheetField label="Priority">
          <div className="flex bg-surface-neutral p-1 rounded-xl">
            {(['Low', 'Medium', 'High'] as const).map(p => (
              <button key={p} onClick={() => setTaskForm(f => ({...f, priority: p}))} className={`flex-1 py-1.5 text-[14px] font-medium rounded-lg capitalize transition-all ${taskForm.priority === p ? 'bg-canvas text-tx-primary shadow-sm' : 'text-tx-muted'}`}>{p}</button>
            ))}
          </div>
        </BottomSheetField>
      </BottomSheet>

      <BottomSheet 
        isOpen={activeActionSheet === 'event'} 
        onClose={() => setActiveActionSheet(null)} 
        title="Schedule Event" 
        onSave={handleCreateEvent} 
        saveLabel="Save Event"
        savingLabel="Saving..."
        isSaving={isSubmitting}
        saveDisabled={isReadOnly || isSubmitting || !eventForm.title.trim() || !eventForm.date}
      >
        <BottomSheetField label="Title *"><input type="text" value={eventForm.title} onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Discovery Call" /></BottomSheetField>
        <BottomSheetField label="Date"><input type="date" value={eventForm.date} onChange={e => setEventForm(f => ({ ...f, date: e.target.value }))} /></BottomSheetField>
      </BottomSheet>

      <BottomSheet 
        isOpen={activeActionSheet === 'library'} 
        onClose={() => setActiveActionSheet(null)} 
        title="Add Document" 
        onSave={handleCreateLibrary} 
        saveLabel="Save Resource"
        savingLabel="Saving..."
        isSaving={isSubmitting}
        saveDisabled={isReadOnly || isSubmitting || !libForm.name.trim() || (libForm.type === 'link' && !!libForm.urlOrReference.trim() && !validateUrl(libForm.urlOrReference, false).isValid)}
      >
        <BottomSheetField label="Name *"><input type="text" value={libForm.name} onChange={e => setLibForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. NDA" /></BottomSheetField>
        <BottomSheetField label="Link / URL"><input type="url" value={libForm.urlOrReference} onChange={e => setLibForm(f => ({ ...f, urlOrReference: e.target.value }))} placeholder="https://..." /></BottomSheetField>
      </BottomSheet>

      {/* Safe Deletion Dialog with Dependency Warning */}
      <ConfirmDialog 
        isOpen={isDeleteOpen} 
        onCancel={() => setIsDeleteOpen(false)} 
        onConfirm={confirmDelete} 
        title="Delete Client" 
        body={
          clientData && (clientData.projects.length > 0 || clientData.tasks.length > 0)
            ? `Warning: ${selectedClient?.name} has ${clientData.projects.length} linked project(s) and ${clientData.tasks.length} task(s). Deleting will unlink these records. We recommend Archiving instead to preserve project history.`
            : `Are you sure you want to delete ${selectedClient?.name}? This action cannot be undone.`
        } 
        confirmLabel={clientData && (clientData.projects.length > 0 || clientData.tasks.length > 0) ? "Delete & Unlink" : "Delete"}
        danger={true}
      />

      {/* Safe Archive Dialog */}
      <ConfirmDialog
        isOpen={isArchiveOpen}
        onCancel={() => setIsArchiveOpen(false)}
        onConfirm={confirmArchive}
        title="Archive Client"
        body={`Archive ${selectedClient?.name}? All ${clientData?.projects.length || 0} linked project(s) and ${clientData?.tasks.length || 0} task(s) will remain intact.`}
        confirmLabel="Archive Client"
        danger={false}
      />
    </div>
  );
}
