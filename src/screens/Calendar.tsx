import React, { useState, useMemo, useEffect } from 'react';
import { 
  ChevronLeft, ChevronRight, Plus, Search, Calendar as CalendarIcon, 
  Clock, CheckSquare, Users, FolderKanban, Link as LinkIcon, MapPin, 
  Layout, Download, CloudOff, Info, CheckCircle2, Circle, AlertTriangle, 
  ArrowUpRight, FileText, Filter, ShieldCheck, Share2, Sparkles
} from 'lucide-react';
import { Header } from '../components/Shared';
import { BottomSheet, BottomSheetField } from '../components/BottomSheet';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { SearchPicker } from '../components/SearchPicker';
import { useCalendar } from '../context/CalendarContext';
import { useClients } from '../context/ClientsContext';
import { useProjects } from '../context/ProjectsContext';
import { useTasks } from '../context/TasksContext';
import { useNavigation } from '../context/NavigationContext';
import { useTimeTracker } from '../context/TimeTrackerContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useAIAssistant } from '../context/AIAssistantContext';
import { EventItem, EventType, EventStatus, TaskItem, ProjectItem } from '../types';
import { Button, IconButton, Tabs, Badge, EmptyState } from '../components/ui';

export type ScheduleItemKind = 'event' | 'task_deadline' | 'project_milestone';

export interface UnifiedScheduleItem {
  id: string;
  kind: ScheduleItemKind;
  title: string;
  date: string; // YYYY-MM-DD
  startTime?: string;
  endTime?: string;
  allDay: boolean;
  typeBadge: string;
  status: string;
  notes?: string;
  projectId?: string;
  projectName?: string;
  clientId?: string;
  clientName?: string;
  taskId?: string;
  priority?: string;
  rawEvent?: EventItem;
  rawTask?: TaskItem;
  rawProject?: ProjectItem;
}

export function Calendar({ onDismiss }: { onDismiss?: () => void }) {
  const { events, addEvent, updateEvent, deleteEvent } = useCalendar();
  const { startTimerFor } = useTimeTracker();
  const { clients } = useClients();
  const { projects } = useProjects();
  const { tasks, completeTask } = useTasks();
  const { navigationOptions, push, goToTab, goToClient } = useNavigation();
  const { role } = useAuth();
  const { showToast } = useToast();
  const { openAssistant } = useAIAssistant();
  
  const isReadOnly = role === 'viewer';
  const userTimeZone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  }, []);

  const [filterProjectId, setFilterProjectId] = useState(navigationOptions?.filterProjectId || '');
  const [filterTaskId, setFilterTaskId] = useState(navigationOptions?.filterTaskId || '');
  const [filterClientId, setFilterClientId] = useState(navigationOptions?.clientId || '');
  const [itemTypeFilter, setItemTypeFilter] = useState<'all' | 'events' | 'tasks' | 'milestones'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (navigationOptions?.filterProjectId) setFilterProjectId(navigationOptions.filterProjectId);
    if (navigationOptions?.filterTaskId) setFilterTaskId(navigationOptions.filterTaskId);
    if (navigationOptions?.clientId) setFilterClientId(navigationOptions.clientId);
  }, [navigationOptions?.filterProjectId, navigationOptions?.filterTaskId, navigationOptions?.clientId]);

  const [view, setView] = useState<'day' | 'week' | 'month' | 'agenda'>('agenda');
  const [currentDate, setCurrentDate] = useState(new Date());

  const [isSheetOpen, setSheetOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [selectedTaskDetail, setSelectedTaskDetail] = useState<TaskItem | null>(null);
  const [selectedProjectDetail, setSelectedProjectDetail] = useState<ProjectItem | null>(null);
  const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  // Form State
  const defaultForm: Omit<EventItem, 'id' | 'createdAt' | 'updatedAt'> = {
    title: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '10:00',
    duration: 60,
    allDay: false,
    type: 'Meeting',
    status: 'scheduled',
    repeat: 'None',
    categoryId: '',
    notes: '',
  };

  const [form, setForm] = useState(defaultForm);
  const [dateValidationError, setDateValidationError] = useState<string | null>(null);

  // 1. Synthesize Unified Schedule Items (Events + Task Deadlines + Project Milestones)
  const unifiedScheduleItems = useMemo(() => {
    const list: UnifiedScheduleItem[] = [];

    // Add Calendar Events
    for (const e of events) {
      const p = projects.find(proj => proj.id === e.projectId);
      const c = clients.find(cli => cli.id === e.clientId || cli.id === p?.clientId);
      list.push({
        id: `event-${e.id}`,
        kind: 'event',
        title: e.title,
        date: e.date,
        startTime: e.startTime,
        endTime: e.endTime,
        allDay: e.allDay,
        typeBadge: e.type,
        status: e.status,
        notes: e.notes,
        projectId: e.projectId,
        projectName: p?.name,
        clientId: e.clientId || p?.clientId,
        clientName: c?.name,
        taskId: e.taskId,
        rawEvent: e,
      });
    }

    // Add Task Deadlines
    for (const t of tasks) {
      if (t.isArchived) continue;
      const taskDate = t.dueDate || t.date;
      if (!taskDate) continue;

      const dateOnly = taskDate.split('T')[0];
      const p = projects.find(proj => proj.id === t.projectId);
      const c = clients.find(cli => cli.id === t.clientId || cli.id === p?.clientId);

      list.push({
        id: `task-${t.id}`,
        kind: 'task_deadline',
        title: `Task Due: ${t.title}`,
        date: dateOnly,
        allDay: true,
        typeBadge: 'Task Deadline',
        status: t.status === 'done' ? 'completed' : 'scheduled',
        notes: t.notes,
        projectId: t.projectId,
        projectName: p?.name,
        clientId: t.clientId || p?.clientId,
        clientName: c?.name,
        taskId: t.id,
        priority: t.priority,
        rawTask: t,
      });
    }

    // Add Project Milestones
    for (const p of projects) {
      if (p.isArchived || !p.dueDate) continue;
      const c = clients.find(cli => cli.id === p.clientId);

      list.push({
        id: `milestone-${p.id}`,
        kind: 'project_milestone',
        title: `Project Milestone: ${p.name}`,
        date: p.dueDate.split('T')[0],
        allDay: true,
        typeBadge: 'Milestone',
        status: p.status === 'completed' ? 'completed' : 'scheduled',
        notes: p.notes,
        projectId: p.id,
        projectName: p.name,
        clientId: p.clientId,
        clientName: c?.name,
        rawProject: p,
      });
    }

    return list;
  }, [events, tasks, projects, clients]);

  // Filter Schedule Items
  const filteredSchedule = useMemo(() => {
    return unifiedScheduleItems.filter(item => {
      // Kind Filter
      if (itemTypeFilter === 'events' && item.kind !== 'event') return false;
      if (itemTypeFilter === 'tasks' && item.kind !== 'task_deadline') return false;
      if (itemTypeFilter === 'milestones' && item.kind !== 'project_milestone') return false;

      // Project Filter
      if (filterProjectId && item.projectId !== filterProjectId) return false;

      // Client Filter
      if (filterClientId && item.clientId !== filterClientId) return false;

      // Task Filter
      if (filterTaskId && item.taskId !== filterTaskId) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesNotes = item.notes?.toLowerCase().includes(q);
        const matchesProject = item.projectName?.toLowerCase().includes(q);
        const matchesClient = item.clientName?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesNotes && !matchesProject && !matchesClient) return false;
      }

      return true;
    });
  }, [unifiedScheduleItems, itemTypeFilter, filterProjectId, filterClientId, filterTaskId, searchQuery]);

  // Date Navigation
  const handlePrev = () => {
    const next = new Date(currentDate);
    if (view === 'month') next.setMonth(next.getMonth() - 1);
    else if (view === 'week') next.setDate(next.getDate() - 7);
    else next.setDate(next.getDate() - 1);
    setCurrentDate(next);
  };

  const handleNext = () => {
    const next = new Date(currentDate);
    if (view === 'month') next.setMonth(next.getMonth() + 1);
    else if (view === 'week') next.setDate(next.getDate() + 7);
    else next.setDate(next.getDate() + 1);
    setCurrentDate(next);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Visible Events based on current View
  const visibleItems = useMemo(() => {
    if (view === 'agenda') {
      const todayStr = new Date().toISOString().split('T')[0];
      return filteredSchedule
        .filter(e => e.date >= todayStr)
        .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || '').localeCompare(b.startTime || ''));
    }

    if (view === 'day') {
      const dateStr = currentDate.toISOString().split('T')[0];
      return filteredSchedule
        .filter(e => e.date === dateStr)
        .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
    }

    return filteredSchedule;
  }, [filteredSchedule, view, currentDate]);

  // Sheet Handlers
  const handleOpenSheet = (item?: UnifiedScheduleItem) => {
    setDateValidationError(null);
    if (!item) {
      if (isReadOnly) {
        showToast({ message: 'Viewing in read-only mode.' });
        return;
      }
      setEditingEvent(null);
      setSelectedTaskDetail(null);
      setSelectedProjectDetail(null);
      setForm({ 
        ...defaultForm, 
        date: currentDate.toISOString().split('T')[0],
        projectId: filterProjectId || undefined,
        clientId: filterClientId || undefined,
      });
      setSheetOpen(true);
      return;
    }

    if (item.kind === 'event' && item.rawEvent) {
      setEditingEvent(item.rawEvent);
      setSelectedTaskDetail(null);
      setSelectedProjectDetail(null);
      setForm({ ...item.rawEvent });
      setSheetOpen(true);
    } else if (item.kind === 'task_deadline' && item.rawTask) {
      setSelectedTaskDetail(item.rawTask);
    } else if (item.kind === 'project_milestone' && item.rawProject) {
      setSelectedProjectDetail(item.rawProject);
    }
  };

  const handleSave = () => {
    if (isReadOnly) return;
    setDateValidationError(null);

    if (!form.title.trim()) {
      setDateValidationError('Event title is required');
      return;
    }

    // Date Validation
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) {
      setDateValidationError('Invalid date format. Use YYYY-MM-DD');
      return;
    }

    // Time Validation
    if (!form.allDay && form.startTime && form.endTime) {
      if (form.startTime > form.endTime) {
        setDateValidationError('Start time must be before end time');
        return;
      }
    }

    if (editingEvent) {
      updateEvent(editingEvent.id, form);
      showToast({ message: 'Scheduled event updated' });
    } else {
      addEvent(form);
      showToast({ message: 'Event added to schedule' });
    }
    setSheetOpen(false);
  };

  // iCalendar (.ics) Export Generator (RFC 5545 Compliance)
  const handleExportICS = () => {
    let icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//MenkR-//Enterprise Schedule 1.0//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-TIMEZONE:${userTimeZone}`,
      `X-WR-CALNAME:MenkR- Work Schedule`,
    ];

    filteredSchedule.forEach((item) => {
      const uid = `${item.id.replace(/[^a-zA-Z0-9-]/g, '')}-${Date.now()}@menkir.internal`;
      const dateClean = item.date.replace(/-/g, '');
      const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

      let dtStart = `DTSTART;VALUE=DATE:${dateClean}`;
      let dtEnd = `DTEND;VALUE=DATE:${dateClean}`;

      if (!item.allDay && item.startTime) {
        const [sh, sm] = item.startTime.split(':');
        const [eh, em] = (item.endTime || item.startTime).split(':');
        dtStart = `DTSTART:${dateClean}T${sh || '09'}${sm || '00'}00`;
        dtEnd = `DTEND:${dateClean}T${eh || '10'}${em || '00'}00`;
      }

      const summary = item.title.replace(/[\\;,]/g, ' ');
      const desc = (item.notes || `Type: ${item.typeBadge} | Project: ${item.projectName || 'None'}`).replace(/[\\;,]/g, ' ');

      icsContent.push(
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${stamp}`,
        dtStart,
        dtEnd,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${desc}`,
        'STATUS:CONFIRMED',
        'END:VEVENT'
      );
    });

    icsContent.push('END:VCALENDAR');

    const blob = new Blob([icsContent.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `menkir-schedule-${new Date().toISOString().split('T')[0]}.ics`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    showToast({ message: 'iCalendar (.ics) schedule exported successfully' });
    setIsSyncModalOpen(false);
  };

  return (
    <div className="flex flex-col h-full bg-canvas relative">
      {/* Top Header */}
      <header className="px-4 pt-12 pb-3 md:pt-6 border-b border-bd-subtle shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {onDismiss && (
              <IconButton variant="ghost" onClick={onDismiss} className="md:hidden -ml-2">
                <ChevronLeft size={24} />
              </IconButton>
            )}
            <div>
              <h1 className="text-xl font-bold text-tx-primary flex items-center gap-2">
                Schedule & Calendar
              </h1>
              <span className="text-[11px] text-tx-muted flex items-center gap-1">
                <Clock size={11} /> Timezone: {userTimeZone}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <IconButton 
              variant="outline" 
              onClick={() => openAssistant('meeting-notes')}
              className="text-tx-secondary hover:text-tx-primary text-xs flex items-center gap-1.5 px-3 py-1.5 h-auto rounded-xl"
              title="Summarize meeting notes and extract action items with AI"
            >
              <Sparkles size={14} className="text-accent-primary" />
              <span className="hidden sm:inline text-xs font-semibold">AI Notes</span>
            </IconButton>

            <IconButton 
              variant="outline" 
              onClick={() => setIsSyncModalOpen(true)}
              className="text-tx-secondary hover:text-tx-primary text-xs flex items-center gap-1.5 px-3 py-1.5 h-auto rounded-xl"
              title="Calendar Synchronization Status"
            >
              <Download size={14} />
              <span className="hidden sm:inline text-xs font-semibold">Sync & Export</span>
            </IconButton>

            <IconButton variant="secondary" onClick={() => handleToday()} className="hidden md:flex">
              <span className="text-xs font-semibold">Today</span>
            </IconButton>

            {!isReadOnly && (
              <IconButton variant="primary" onClick={() => handleOpenSheet()} className="rounded-xl">
                <Plus size={18} />
              </IconButton>
            )}
          </div>
        </div>

        {/* View Switcher & Date Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
          <Tabs 
            tabs={[
              { id: 'agenda', label: 'Agenda' },
              { id: 'day', label: 'Day' },
              { id: 'week', label: 'Week' },
              { id: 'month', label: 'Month' },
            ]} 
            activeTab={view} 
            onChange={(v) => setView(v as any)} 
            className="w-full md:w-auto"
          />

          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-bold text-tx-primary">
              {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
            <div className="flex items-center gap-1">
              <IconButton variant="ghost" size="sm" onClick={handlePrev}><ChevronLeft size={16} /></IconButton>
              <IconButton variant="ghost" size="sm" onClick={handleNext}><ChevronRight size={16} /></IconButton>
            </div>
          </div>
        </div>

        {/* Search & Category Pills */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-tx-muted" />
            <input
              type="text"
              placeholder="Search schedule, milestones, tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-surface-neutral text-xs text-tx-primary placeholder:text-tx-muted outline-none"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {(['all', 'events', 'tasks', 'milestones'] as const).map(tabKey => (
              <button
                key={tabKey}
                onClick={() => setItemTypeFilter(tabKey)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors capitalize ${
                  itemTypeFilter === tabKey ? 'bg-tx-primary text-canvas' : 'bg-surface-neutral text-tx-muted hover:text-tx-primary'
                }`}
              >
                {tabKey === 'all' ? 'All Items' : tabKey}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Schedule Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 no-scrollbar">
        {view === 'agenda' && (
          <div className="space-y-3">
            {visibleItems.length === 0 ? (
              <EmptyState 
                icon={<CalendarIcon size={32} />} 
                title="No Scheduled Items" 
                description="Your upcoming timeline is clear. Add a meeting, project deadline, or task commitment." 
                action={!isReadOnly && <Button onClick={() => handleOpenSheet()}>Add Event</Button>} 
              />
            ) : (
              visibleItems.map(item => {
                const isTask = item.kind === 'task_deadline';
                const isMilestone = item.kind === 'project_milestone';
                const isCompleted = item.status === 'completed';

                return (
                  <div 
                    key={item.id} 
                    onClick={() => handleOpenSheet(item)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      isCompleted 
                        ? 'bg-surface-neutral/20 border-bd-subtle opacity-75' 
                        : isMilestone
                        ? 'bg-accent-secondary/5 border-accent-secondary/30 hover:border-accent-secondary'
                        : isTask
                        ? 'bg-surface-neutral/40 border-bd-subtle hover:border-tx-primary/30'
                        : 'bg-card border-bd-subtle hover:border-tx-primary/30 shadow-xs'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Left Time / Icon */}
                      <div className="w-16 shrink-0 text-center pt-0.5">
                        <div className="text-xs font-bold text-tx-primary">
                          {item.allDay ? 'All Day' : item.startTime}
                        </div>
                        <div className="text-[10px] text-tx-muted">
                          {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      </div>

                      {/* Middle Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className={`text-sm font-semibold truncate ${isCompleted ? 'line-through text-tx-muted' : 'text-tx-primary'}`}>
                            {item.title}
                          </h3>
                          <Badge variant={isMilestone ? 'warm' : isTask ? 'secondary' : isCompleted ? 'success' : 'outline'}>
                            {item.typeBadge}
                          </Badge>
                          {item.priority && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-neutral text-tx-muted">
                              {item.priority}
                            </span>
                          )}
                        </div>

                        {item.notes && (
                          <p className="text-xs text-tx-muted line-clamp-1 mb-2">{item.notes}</p>
                        )}

                        {/* Meta Links */}
                        <div className="flex items-center gap-2 flex-wrap text-xs pt-1">
                          {item.projectName && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                goToTab('projects', { filterProjectId: item.projectId });
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-surface-neutral hover:bg-surface-neutral/80 text-tx-primary rounded-md text-[11px] font-medium"
                              title="Go to project"
                            >
                              <FolderKanban size={11} className="text-accent-primary" />
                              <span className="truncate max-w-[130px]">{item.projectName}</span>
                              <ArrowUpRight size={10} className="opacity-60" />
                            </button>
                          )}

                          {item.clientName && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                goToClient(item.clientId!);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-surface-neutral hover:bg-surface-neutral/80 text-tx-muted hover:text-tx-primary rounded-md text-[11px] font-medium"
                              title="Go to client"
                            >
                              <Users size={11} className="text-accent-secondary" />
                              <span className="truncate max-w-[120px]">{item.clientName}</span>
                            </button>
                          )}

                          {item.projectId && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                push('library', { filterProjectId: item.projectId });
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-surface-neutral hover:bg-surface-neutral/80 text-tx-muted hover:text-tx-primary rounded-md text-[11px] font-medium"
                              title="Project documents in library"
                            >
                              <FileText size={11} />
                              <span>Docs</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Right Action */}
                      <div className="shrink-0 flex items-center gap-1">
                        {isTask && item.rawTask && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              completeTask(item.rawTask!.id);
                              showToast({ message: isCompleted ? 'Task marked active' : 'Task marked complete' });
                            }}
                            className="p-1.5 text-tx-muted hover:text-tx-primary transition-colors"
                            title="Toggle completion"
                          >
                            {isCompleted ? <CheckCircle2 size={18} className="text-accent-secondary" /> : <Circle size={18} />}
                          </button>
                        )}
                        {!isTask && !isMilestone && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startTimerFor({
                                projectId: item.projectId,
                                taskId: item.taskId,
                                clientId: item.clientId,
                                note: item.title,
                              });
                              push('time-tracker');
                            }}
                            className="p-1.5 rounded-lg text-tx-muted hover:text-accent-primary hover:bg-surface-neutral transition-colors"
                            title="Start timer for this event"
                          >
                            <Clock size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {view === 'day' && (
          <div className="space-y-3">
            <div className="text-xs font-bold text-tx-muted uppercase tracking-wider mb-2">
              {currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
            {visibleItems.length === 0 ? (
              <div className="text-center py-12 text-sm text-tx-muted">No items scheduled for this day.</div>
            ) : (
              visibleItems.map(item => (
                <div 
                  key={item.id} 
                  onClick={() => handleOpenSheet(item)}
                  className="flex items-start gap-4 p-3.5 rounded-xl border border-bd-subtle bg-surface-neutral/30 hover:border-tx-primary/30 cursor-pointer"
                >
                  <div className="w-16 shrink-0 text-xs font-bold text-tx-primary">
                    {item.allDay ? 'All Day' : item.startTime}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm text-tx-primary truncate">{item.title}</h3>
                      <Badge variant="outline">{item.typeBadge}</Badge>
                    </div>
                    {item.projectName && <p className="text-xs text-tx-muted mt-0.5">{item.projectName}</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {view === 'month' && (
          <div className="space-y-4">
            <div className="grid grid-cols-7 mb-1 text-center text-xs font-bold text-tx-muted">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {Array.from({ length: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay() }).map((_, i) => (
                <div key={`empty-${i}`} className="h-16 md:h-20 bg-canvas border border-transparent rounded-lg"></div>
              ))}
              {Array.from({ length: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate() }).map((_, i) => {
                const dateNum = i + 1;
                const dStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(dateNum).padStart(2, '0')}`;
                const dayItems = filteredSchedule.filter(e => e.date === dStr);
                const isToday = dStr === new Date().toISOString().split('T')[0];

                return (
                  <div 
                    key={dateNum} 
                    onClick={() => { setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), dateNum)); setView('day'); }} 
                    className="h-16 md:h-20 flex flex-col p-1 bg-surface-neutral/20 border border-bd-subtle rounded-xl cursor-pointer hover:border-tx-primary/50 transition-colors overflow-hidden"
                  >
                    <div className={`text-[11px] font-bold w-5 h-5 rounded-full flex items-center justify-center mb-0.5 ${isToday ? 'bg-accent-primary text-tx-primary' : 'text-tx-secondary'}`}>
                      {dateNum}
                    </div>
                    <div className="flex-1 flex flex-col gap-0.5 overflow-hidden">
                      {dayItems.slice(0, 2).map(e => (
                        <div 
                          key={e.id} 
                          className={`text-[9px] text-left px-1 py-0.5 rounded truncate font-medium ${
                            e.kind === 'project_milestone' 
                              ? 'bg-accent-secondary/20 text-tx-primary' 
                              : e.kind === 'task_deadline'
                              ? 'bg-surface-neutral text-tx-muted'
                              : 'bg-card border border-bd-subtle text-tx-primary'
                          }`}
                        >
                          {e.title}
                        </div>
                      ))}
                      {dayItems.length > 2 && (
                        <div className="text-[9px] text-tx-muted text-left px-1 font-bold">
                          +{dayItems.length - 2} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {view === 'week' && (
          <div className="flex flex-col min-w-[600px] overflow-x-auto">
            <div className="grid grid-cols-7 border-b border-bd-subtle sticky top-0 bg-canvas z-10">
              {Array.from({ length: 7 }).map((_, i) => {
                const curr = new Date(currentDate);
                curr.setDate(curr.getDate() - curr.getDay() + i);
                const dateStr = curr.toISOString().split('T')[0];
                const isToday = dateStr === new Date().toISOString().split('T')[0];
                return (
                  <div key={i} className="p-2.5 text-center border-r border-bd-subtle last:border-r-0">
                    <div className="text-[11px] text-tx-muted uppercase font-bold">{curr.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                    <div className={`text-sm font-bold mt-1 w-7 h-7 mx-auto rounded-full flex items-center justify-center ${isToday ? 'bg-accent-primary text-tx-primary' : 'text-tx-primary'}`}>
                      {curr.getDate()}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-7 min-h-[400px]">
              {Array.from({ length: 7 }).map((_, i) => {
                const curr = new Date(currentDate);
                curr.setDate(curr.getDate() - curr.getDay() + i);
                const dateStr = curr.toISOString().split('T')[0];
                const dayItems = filteredSchedule.filter(e => e.date === dateStr);

                return (
                  <div key={i} className="border-r border-bd-subtle last:border-r-0 p-1.5 flex flex-col gap-1.5">
                    {dayItems.map(item => (
                      <div 
                        key={item.id} 
                        onClick={() => handleOpenSheet(item)} 
                        className="p-1.5 bg-surface-neutral/40 border border-bd-subtle rounded-lg cursor-pointer hover:border-tx-primary text-left"
                      >
                        <div className="text-[9px] font-bold text-tx-muted">{item.allDay ? 'All Day' : item.startTime}</div>
                        <div className="text-[11px] font-semibold text-tx-primary truncate">{item.title}</div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Edit / New Event Bottom Sheet */}
      <BottomSheet
        isOpen={isSheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editingEvent ? 'Edit Event' : 'New Schedule Commitment'}
        onSave={handleSave}
      >
        {dateValidationError && (
          <div className="mb-3 p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2 text-xs text-red-600 font-medium">
            <AlertTriangle size={14} className="shrink-0" />
            <span>{dateValidationError}</span>
          </div>
        )}

        <BottomSheetField>
          <input
            type="text"
            placeholder="Event Title (e.g. Design Review with Apex)"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full text-[18px] font-semibold text-tx-primary placeholder:text-tx-muted/50 bg-transparent outline-none py-1.5"
            autoFocus
          />
        </BottomSheetField>
        
        <div className="grid grid-cols-2 gap-3">
          <BottomSheetField label="Type">
            <select 
              value={form.type}
              onChange={e => setForm({ ...form, type: e.target.value as EventType })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-neutral border border-bd-subtle text-xs text-tx-primary outline-none"
            >
              {['Meeting', 'Client Call', 'Focus Time', 'Deadline', 'Milestone', 'Task Block', 'Payment Deadline', 'Personal', 'Reminder'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </BottomSheetField>

          <BottomSheetField label="Date">
            <input 
              type="date" 
              value={form.date}
              onChange={e => setForm({ ...form, date: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-neutral border border-bd-subtle text-xs text-tx-primary outline-none" 
            />
          </BottomSheetField>
        </div>

        <div className="flex items-center justify-between py-2 border-y border-bd-subtle">
          <span className="text-xs font-semibold text-tx-primary">All-day commitment</span>
          <input 
            type="checkbox" 
            checked={form.allDay} 
            onChange={e => setForm({ ...form, allDay: e.target.checked })}
            className="w-4 h-4 rounded text-tx-primary"
          />
        </div>

        {!form.allDay && (
          <div className="grid grid-cols-2 gap-3 pt-2">
            <BottomSheetField label="Start Time">
              <input 
                type="time" 
                value={form.startTime || '09:00'} 
                onChange={e => setForm({ ...form, startTime: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-neutral border border-bd-subtle text-xs text-tx-primary outline-none" 
              />
            </BottomSheetField>
            <BottomSheetField label="End Time">
              <input 
                type="time" 
                value={form.endTime || '10:00'} 
                onChange={e => setForm({ ...form, endTime: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-neutral border border-bd-subtle text-xs text-tx-primary outline-none" 
              />
            </BottomSheetField>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 pt-2">
          <BottomSheetField label="Link Project">
            <SearchPicker
              items={projects.map(p => ({ id: p.id, label: p.name }))}
              value={form.projectId}
              onChange={(id) => setForm(f => ({ ...f, projectId: id }))}
            />
          </BottomSheetField>

          <BottomSheetField label="Link Client">
            <SearchPicker
              items={clients.map(c => ({ id: c.id, label: c.name }))}
              value={form.clientId}
              onChange={(id) => setForm(f => ({ ...f, clientId: id }))}
            />
          </BottomSheetField>
        </div>

        <BottomSheetField label="Meeting Link or Location">
          <div className="relative">
            <LinkIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-tx-muted" />
            <input 
              type="text" 
              placeholder="e.g. https://meet.google.com/xyz or Site Office Room 4" 
              value={form.meetingLink || form.location || ''} 
              onChange={e => setForm({ ...form, meetingLink: e.target.value, location: e.target.value })} 
              className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-surface-neutral border border-bd-subtle text-xs text-tx-primary outline-none" 
            />
          </div>
        </BottomSheetField>

        <BottomSheetField label="Notes & Agenda">
          <textarea 
            placeholder="Key discussion points, preparation checklist..." 
            value={form.notes || ''}
            onChange={e => setForm({ ...form, notes: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl bg-surface-neutral border border-bd-subtle text-xs text-tx-primary outline-none h-20 resize-none" 
          />
        </BottomSheetField>

        {editingEvent && (
          <div className="pt-3 border-t border-bd-subtle flex gap-2">
            <button 
              type="button"
              onClick={() => setDeleteConfirmOpen(true)}
              className="flex-1 py-2 rounded-xl border border-red-500/20 text-red-500 text-xs font-semibold hover:bg-red-500/10 transition-colors"
            >
              Delete Event
            </button>
            <button 
              type="button"
              onClick={() => { 
                setSheetOpen(false); 
                startTimerFor({ projectId: form.projectId, taskId: form.taskId, clientId: form.clientId, note: form.title });
                push('time-tracker');
              }}
              className="flex-1 py-2 rounded-xl bg-accent-primary/10 border border-accent-primary/30 text-tx-primary text-xs font-semibold hover:bg-accent-primary/20 transition-colors"
            >
              Start Timer
            </button>
          </div>
        )}
      </BottomSheet>

      {/* Detail View for Linked Task Deadline */}
      {selectedTaskDetail && (
        <BottomSheet
          isOpen={true}
          onClose={() => setSelectedTaskDetail(null)}
          title="Task Deadline"
        >
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-bold text-tx-primary">{selectedTaskDetail.title}</h3>
              <p className="text-xs text-tx-muted mt-0.5">Due date: {selectedTaskDetail.dueDate || selectedTaskDetail.date}</p>
            </div>

            {selectedTaskDetail.notes && (
              <div className="p-3 bg-surface-neutral rounded-xl text-xs text-tx-secondary">
                {selectedTaskDetail.notes}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button 
                variant="secondary" 
                onClick={() => {
                  const tId = selectedTaskDetail.id;
                  setSelectedTaskDetail(null);
                  push('tasks', { filterTaskId: tId });
                }}
              >
                Open in Tasks
              </Button>
              {selectedTaskDetail.projectId && (
                <Button 
                  onClick={() => {
                    const pId = selectedTaskDetail.projectId;
                    setSelectedTaskDetail(null);
                    goToTab('projects', { filterProjectId: pId });
                  }}
                >
                  Project Workspace
                </Button>
              )}
            </div>
          </div>
        </BottomSheet>
      )}

      {/* Detail View for Linked Project Milestone */}
      {selectedProjectDetail && (
        <BottomSheet
          isOpen={true}
          onClose={() => setSelectedProjectDetail(null)}
          title="Project Milestone"
        >
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-bold text-tx-primary">{selectedProjectDetail.name}</h3>
              <p className="text-xs text-tx-muted mt-0.5">Project Deadline: {selectedProjectDetail.dueDate}</p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-tx-primary">Progress:</span>
              <span className="text-xs font-bold text-accent-secondary">{selectedProjectDetail.completionPct}%</span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button 
                onClick={() => {
                  const pId = selectedProjectDetail.id;
                  setSelectedProjectDetail(null);
                  goToTab('projects', { filterProjectId: pId });
                }}
              >
                Project Workspace
              </Button>
              <Button 
                variant="secondary"
                onClick={() => {
                  const pId = selectedProjectDetail.id;
                  setSelectedProjectDetail(null);
                  push('library', { filterProjectId: pId });
                }}
              >
                Library Docs
              </Button>
            </div>
          </div>
        </BottomSheet>
      )}

      {/* Honest Calendar Synchronization & iCal Export Modal */}
      <BottomSheet
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        title="Calendar Sync & Export"
      >
        <div className="space-y-4 py-2">
          {/* Honest Status Notice */}
          <div className="p-3.5 bg-surface-neutral/80 rounded-2xl border border-bd-subtle space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-tx-primary">
              <CloudOff size={16} className="text-accent-secondary shrink-0" />
              <span>External Cloud Sync: Not Configured</span>
            </div>
            <p className="text-xs text-tx-muted leading-relaxed">
              Google Workspace and Microsoft Outlook live 2-way synchronization require OAuth credentials configured in your backend organization settings.
            </p>
            <div className="flex items-center gap-1.5 text-[11px] text-accent-primary font-semibold pt-1">
              <ShieldCheck size={13} />
              <span>Local Offline-First Scheduling is fully operational.</span>
            </div>
          </div>

          {/* Real Export Action */}
          <div>
            <h4 className="text-xs font-bold text-tx-primary uppercase tracking-wider mb-2">Export iCalendar Feed</h4>
            <p className="text-xs text-tx-muted mb-3">
              Download your complete schedule (meetings, task deadlines, and project milestones) as an industry-standard <strong>.ics</strong> file compatible with Google Calendar, Apple Calendar, and Microsoft Outlook.
            </p>
            <Button 
              className="w-full flex items-center justify-center gap-2" 
              onClick={handleExportICS}
            >
              <Download size={16} />
              <span>Download iCalendar (.ics)</span>
            </Button>
          </div>
        </div>
      </BottomSheet>

      {/* Confirm Delete */}
      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={() => {
          if (editingEvent) {
            deleteEvent(editingEvent.id);
            setSheetOpen(false);
            setDeleteConfirmOpen(false);
            showToast({ message: 'Event deleted from schedule' });
          }
        }}
        title="Delete Scheduled Item"
        body="Are you sure you want to delete this event? Linked tasks and projects will remain intact."
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
