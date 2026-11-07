import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, MoreVertical, Plus, ChevronDown, Layout, Calendar, Clock, 
  CheckCircle2, Circle, AlertTriangle, User, Search, 
  Building2, Archive, Trash2, ArrowUpRight, Lock, Briefcase, Sparkles
} from 'lucide-react';
import { Header, StatCard } from '../components/Shared';
import { Tabs } from '../components/ui';
import { BottomSheet, BottomSheetField, CategoryPicker } from '../components/BottomSheet';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { usePreferences } from '../context/PreferencesContext';
import { useToast } from '../context/ToastContext';
import { useTasks } from '../context/TasksContext';
import { useNavigation } from '../context/NavigationContext';
import { useAIAssistant } from '../context/AIAssistantContext';
import { useTimeTracker } from '../context/TimeTrackerContext';
import { useProjects } from '../context/ProjectsContext';
import { useClients } from '../context/ClientsContext';
import { useAuth } from '../context/AuthContext';
import { TaskItem } from '../types';
import { logAuditEvent } from '../services/activityService';

interface TasksProps {
  onDismiss?: () => void;
}

export function Tasks({ onDismiss }: TasksProps) {
  const [tab, setTab] = useState<'Today' | 'Active' | 'Completed' | 'All'>('Today');
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'All' | 'High' | 'Medium' | 'Low'>('All');
  const [isSheetOpen, setSheetOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = useState(false);
  const [taskToAction, setTaskToAction] = useState<TaskItem | null>(null);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [isTasksMenuOpen, setIsTasksMenuOpen] = useState(false);
  const [isStatsExpanded, setIsStatsExpanded] = useState(true);

  const { preferences, addCategory } = usePreferences();
  const { showToast } = useToast();
  const { startTimerFor } = useTimeTracker();
  const { tasks, addTask, updateTask, deleteTask, completeTask } = useTasks();
  const { projects, updateProject } = useProjects();
  const { clients } = useClients();
  const { role, idToken, organization, fetchMembers } = useAuth();
  const { navigationOptions, push, goToTab, goToClient } = useNavigation();
  const { openAssistant } = useAIAssistant();
  
  const isReadOnly = role === 'viewer';
  const orgId = organization?.id || null;

  // Initial filters from navigation options
  const [filterProjectId, setFilterProjectId] = useState(navigationOptions?.filterProjectId || '');
  const [filterClientId, setFilterClientId] = useState(navigationOptions?.clientId || '');

  useEffect(() => {
    if (navigationOptions?.filterProjectId) {
      setFilterProjectId(navigationOptions.filterProjectId);
    }
    if (navigationOptions?.clientId) {
      setFilterClientId(navigationOptions.clientId);
    }
  }, [navigationOptions?.filterProjectId, navigationOptions?.clientId]);

  // Load org members
  const [orgMembers, setOrgMembers] = useState<Array<{ id: string; name: string }>>([
    { id: 'usr-1', name: 'Alex Rivera' },
    { id: 'usr-2', name: 'Sarah Chen' },
    { id: 'usr-3', name: 'Marcus Brody' },
    { id: 'usr-4', name: 'Elena Rostova' },
  ]);

  useEffect(() => {
    let isMounted = true;
    fetchMembers().then((members) => {
      if (!isMounted || !members?.length) return;
      const mapped = members.map((m) => ({
        id: m.userId,
        name: m.name || m.email.split('@')[0],
      }));
      setOrgMembers((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const newOnes = mapped.filter((m) => !existingIds.has(m.id));
        return [...prev, ...newOnes];
      });
    }).catch(() => {});
    return () => { isMounted = false; };
  }, [fetchMembers]);

  // Form State
  const [form, setForm] = useState({
    title: '',
    projectId: '',
    clientId: '',
    assigneeId: '',
    assigneeName: '',
    dueDate: '',
    category: '',
    priority: 'Medium' as 'Low' | 'Medium' | 'High',
    notes: '',
  });

  const handleOpenSheet = (task?: TaskItem) => {
    if (isReadOnly) {
      showToast({ message: 'Viewing in read-only mode. You cannot edit tasks.' });
      return;
    }
    if (task) {
      setEditingTask(task);
      setForm({ 
        title: task.title, 
        projectId: task.projectId || '',
        clientId: task.clientId || '',
        assigneeId: task.assigneeId || '',
        assigneeName: task.assigneeName || '',
        dueDate: task.dueDate || task.date || '',
        category: task.categoryId || '', 
        priority: task.priority || 'Medium',
        notes: task.notes || ''
      });
    } else {
      setEditingTask(null);
      // Auto-populate from active filters
      const targetProject = projects.find(p => p.id === filterProjectId);
      const targetClientId = filterClientId || targetProject?.clientId || '';
      setForm({ 
        title: '', 
        projectId: filterProjectId,
        clientId: targetClientId,
        assigneeId: '',
        assigneeName: '',
        dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
        category: '', 
        priority: 'Medium', 
        notes: '' 
      });
    }
    setShowMoreDetails(false);
    setSheetOpen(true);
  };

  const handleProjectSelect = (projId: string) => {
    const proj = projects.find(p => p.id === projId);
    setForm(prev => ({
      ...prev,
      projectId: projId,
      clientId: proj?.clientId || prev.clientId
    }));
  };

  const handleAssigneeSelect = (memberId: string) => {
    const member = orgMembers.find(m => m.id === memberId);
    setForm(prev => ({
      ...prev,
      assigneeId: memberId,
      assigneeName: member?.name || ''
    }));
  };

  const handleSave = () => {
    if (isReadOnly) return;
    if (!form.title.trim()) {
      showToast({ message: 'Task title is required' });
      return;
    }

    if (editingTask) {
      updateTask(editingTask.id, {
        title: form.title,
        projectId: form.projectId || undefined,
        clientId: form.clientId || undefined,
        assigneeId: form.assigneeId || undefined,
        assigneeName: form.assigneeName || undefined,
        dueDate: form.dueDate || undefined,
        date: form.dueDate || undefined,
        categoryId: form.category,
        priority: form.priority,
        notes: form.notes,
      });

      logAuditEvent(idToken, orgId, 'task.updated', 'task', editingTask.id, {
        title: form.title,
        projectId: form.projectId,
        assignee: form.assigneeName,
        priority: form.priority,
        dueDate: form.dueDate
      });
      showToast({ message: 'Task updated successfully' });
    } else {
      const newId = addTask({
        title: form.title,
        projectId: form.projectId || undefined,
        clientId: form.clientId || undefined,
        assigneeId: form.assigneeId || undefined,
        assigneeName: form.assigneeName || undefined,
        dueDate: form.dueDate || undefined,
        date: form.dueDate || undefined,
        categoryId: form.category,
        priority: form.priority,
        notes: form.notes,
        status: 'active',
      });

      // If task belongs to a project, recalculate project completion percentage
      if (form.projectId) {
        const projTasks = [...tasks.filter(t => t.projectId === form.projectId), { status: 'active' }];
        const completedCount = projTasks.filter(t => t.status === 'done').length;
        const newPct = Math.round((completedCount / projTasks.length) * 100);
        updateProject(form.projectId, { completionPct: newPct });
      }

      logAuditEvent(idToken, orgId, 'task.created', 'task', newId, {
        title: form.title,
        projectId: form.projectId,
        assignee: form.assigneeName,
        priority: form.priority,
        dueDate: form.dueDate
      });

      showToast({
        message: 'Task created successfully',
        actionLabel: 'Add another',
        onAction: () => handleOpenSheet(),
      });
    }
    setSheetOpen(false);
  };

  const handleToggleComplete = (task: TaskItem) => {
    if (isReadOnly) {
      showToast({ message: 'Viewer role cannot change task status.' });
      return;
    }

    const willBeDone = task.status !== 'done';
    completeTask(task.id);

    // Auto-update project completion percentage
    if (task.projectId) {
      const projTasks = tasks.filter(t => t.projectId === task.projectId);
      const completedCount = projTasks.filter(t => t.id === task.id ? willBeDone : t.status === 'done').length;
      const newPct = projTasks.length > 0 ? Math.round((completedCount / projTasks.length) * 100) : 0;
      updateProject(task.projectId, { completionPct: newPct });
    }

    logAuditEvent(idToken, orgId, willBeDone ? 'task.completed' : 'task.reopened', 'task', task.id, {
      title: task.title,
      projectId: task.projectId
    });

    showToast({ message: willBeDone ? 'Task marked complete' : 'Task reopened' });
  };

  const handleArchiveTask = () => {
    if (!taskToAction || isReadOnly) return;
    updateTask(taskToAction.id, { isArchived: true, status: 'done' });
    logAuditEvent(idToken, orgId, 'task.archived', 'task', taskToAction.id, {
      title: taskToAction.title
    });
    showToast({ message: `Task "${taskToAction.title}" archived` });
    setIsArchiveConfirmOpen(false);
    setTaskToAction(null);
  };

  const handleDeleteTask = () => {
    if (!taskToAction || isReadOnly) return;
    deleteTask(taskToAction.id);
    
    // Recalculate parent project completion
    if (taskToAction.projectId) {
      const remainingTasks = tasks.filter(t => t.projectId === taskToAction.projectId && t.id !== taskToAction.id);
      const completedCount = remainingTasks.filter(t => t.status === 'done').length;
      const newPct = remainingTasks.length > 0 ? Math.round((completedCount / remainingTasks.length) * 100) : 0;
      updateProject(taskToAction.projectId, { completionPct: newPct });
    }

    logAuditEvent(idToken, orgId, 'task.deleted', 'task', taskToAction.id, {
      title: taskToAction.title,
      projectId: taskToAction.projectId
    });

    showToast({ message: 'Task permanently deleted' });
    setIsDeleteConfirmOpen(false);
    setTaskToAction(null);
  };

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Archived filter
      if (t.isArchived) return false;

      // Tab filter
      if (tab === 'Today') {
        const isNotDone = t.status !== 'done';
        if (!isNotDone) return false;
      } else if (tab === 'Active') {
        if (t.status === 'done') return false;
      } else if (tab === 'Completed') {
        if (t.status !== 'done') return false;
      }

      // Project filter
      if (filterProjectId && t.projectId !== filterProjectId) {
        return false;
      }

      // Client filter
      if (filterClientId && t.clientId !== filterClientId) {
        return false;
      }

      // Priority filter
      if (priorityFilter !== 'All' && t.priority !== priorityFilter) {
        return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesTitle = t.title.toLowerCase().includes(term);
        const matchesNotes = t.notes?.toLowerCase().includes(term);
        const matchesAssignee = t.assigneeName?.toLowerCase().includes(term);
        if (!matchesTitle && !matchesNotes && !matchesAssignee) return false;
      }

      return true;
    });
  }, [tasks, tab, filterProjectId, filterClientId, priorityFilter, searchTerm]);

  // Statistics
  const completedTasks = tasks.filter(t => t.status === 'done' && !t.isArchived).length;
  const activeTasks = tasks.filter(t => t.status !== 'done' && !t.isArchived).length;
  const totalTasks = tasks.filter(t => !t.isArchived).length;
  const overdueTasks = tasks.filter(t => {
    if (t.status === 'done' || t.isArchived || !t.dueDate) return false;
    return new Date(t.dueDate).getTime() < new Date().setHours(0, 0, 0, 0);
  }).length;

  return (
    <div className="absolute inset-0 bg-canvas z-50 flex flex-col overflow-y-auto no-scrollbar">
      {/* Header */}
      <Header
        leftIcon={
          <button 
            onClick={onDismiss || (() => goToTab('dashboard'))} 
            className="w-11 h-11 rounded-full bg-surface-neutral flex items-center justify-center text-tx-primary hover:bg-surface-neutral/80 transition-colors" 
            aria-label="Back"
          >
            <X size={20} />
          </button>
        }
        title="Tasks & Workflow"
        rightIcon={
          <button 
            onClick={() => setIsTasksMenuOpen(true)} 
            className="w-11 h-11 rounded-full bg-surface-neutral flex items-center justify-center text-tx-primary hover:bg-surface-neutral/80 transition-colors" 
            aria-label="Task options"
          >
            <MoreVertical size={20} />
          </button>
        }
      />

      {/* Viewer Warning */}
      {isReadOnly && (
        <div className="mx-5 mb-4 p-3 bg-surface-neutral rounded-xl border border-bd-subtle flex items-center gap-2.5 text-xs text-tx-muted">
          <Lock size={14} className="text-accent-secondary shrink-0" />
          <span>You have <strong>Viewer</strong> access. Task modifications and creations are restricted.</span>
        </div>
      )}

      {/* Tabs & Add Button */}
      <div className="flex items-center justify-between px-5 mt-1 mb-4">
        <Tabs
          tabs={[
            { id: 'Today', label: 'Today' },
            { id: 'Active', label: 'Active' },
            { id: 'Completed', label: 'Completed' },
            { id: 'All', label: 'All Tasks' },
          ]}
          activeTab={tab}
          onChange={(t) => setTab(t as any)}
        />
        <div className="flex items-center gap-2">
          <button
            onClick={() => openAssistant('task-breakdown', filterProjectId || undefined)}
            className="h-10 px-3 rounded-xl bg-surface-neutral hover:bg-surface-hover text-tx-primary border border-bd-subtle flex items-center gap-1.5 text-xs font-semibold shadow-xs transition-colors"
            title="Break down a project or goal into actionable tasks with AI"
          >
            <Sparkles size={14} className="text-accent-primary" />
            <span className="hidden sm:inline">AI Breakdown</span>
          </button>
          {!isReadOnly && (
            <button 
              onClick={() => handleOpenSheet()} 
              className="w-10 h-10 rounded-xl bg-tx-primary text-canvas flex items-center justify-center shrink-0 hover:bg-tx-primary/90 transition-opacity shadow-xs" 
              aria-label="Add task"
            >
              <Plus size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="px-5 mb-5">
        <button 
          onClick={() => setIsStatsExpanded(!isStatsExpanded)}
          className="w-full flex items-center justify-between mb-2.5 group text-left"
          aria-expanded={isStatsExpanded}
        >
          <h2 className="text-xs font-bold text-tx-muted uppercase tracking-wider group-hover:text-tx-primary transition-colors">
            Task Progress & SLA
          </h2>
          <ChevronDown size={16} className={`text-tx-muted transition-transform duration-200 ${isStatsExpanded ? 'rotate-0' : '-rotate-90'}`} />
        </button>
        {isStatsExpanded && (
          <div className="grid grid-cols-4 gap-2.5 animate-in fade-in-50 duration-200">
            <StatCard value={activeTasks.toString()} label="Active" tone="lime" />
            <StatCard value={completedTasks.toString()} label="Completed" tone="olive" />
            <StatCard value={overdueTasks.toString()} label="Overdue" tone={overdueTasks > 0 ? "olive" : "neutral"} />
            <StatCard value={totalTasks.toString()} label="Total" tone="neutral" />
          </div>
        )}
      </div>

      {/* Search & Filters */}
      <div className="px-5 mb-4 space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-tx-muted" />
          <input
            type="text"
            placeholder="Search tasks, assignees, notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-neutral/80 border border-bd-subtle text-sm text-tx-primary placeholder:text-tx-muted focus:outline-none focus:border-tx-primary"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {/* Project selector */}
          <select
            value={filterProjectId}
            onChange={(e) => setFilterProjectId(e.target.value)}
            className="px-3 py-1.5 bg-surface-neutral border border-bd-subtle rounded-lg text-xs font-medium text-tx-primary outline-none shrink-0"
          >
            <option value="">All Projects ({projects.length})</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {/* Client selector */}
          <select
            value={filterClientId}
            onChange={(e) => setFilterClientId(e.target.value)}
            className="px-3 py-1.5 bg-surface-neutral border border-bd-subtle rounded-lg text-xs font-medium text-tx-primary outline-none shrink-0"
          >
            <option value="">All Clients ({clients.length})</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Priority filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as any)}
            className="px-3 py-1.5 bg-surface-neutral border border-bd-subtle rounded-lg text-xs font-medium text-tx-primary outline-none shrink-0"
          >
            <option value="All">All Priorities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          {(filterProjectId || filterClientId || priorityFilter !== 'All' || searchTerm) && (
            <button
              onClick={() => {
                setFilterProjectId('');
                setFilterClientId('');
                setPriorityFilter('All');
                setSearchTerm('');
              }}
              className="text-xs text-tx-muted hover:text-tx-primary underline px-2 shrink-0"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Task List */}
      <div className="px-5 pb-24">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-tx-primary">
            {tab} Tasks ({filteredTasks.length})
          </h2>
          {!isReadOnly && (
            <button 
              onClick={() => handleOpenSheet()} 
              className="text-xs font-medium text-accent-primary flex items-center gap-1 hover:underline"
            >
              <Plus size={14} /> New Task
            </button>
          )}
        </div>

        {filteredTasks.length === 0 ? (
          <div className="bg-surface-neutral/40 rounded-2xl border border-dashed border-bd-subtle p-8 text-center">
            <CheckCircle2 size={32} className="mx-auto text-tx-muted mb-2 opacity-50" />
            <h3 className="text-sm font-semibold text-tx-primary mb-1">No tasks found</h3>
            <p className="text-xs text-tx-muted mb-4">
              {searchTerm || filterProjectId || filterClientId || priorityFilter !== 'All'
                ? 'Try adjusting your filters or search terms.'
                : 'All caught up! Create a task to track project milestones.'}
            </p>
            {!isReadOnly && (
              <button
                onClick={() => handleOpenSheet()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-tx-primary text-canvas rounded-xl text-xs font-semibold hover:bg-tx-primary/90 transition-opacity"
              >
                <Plus size={14} /> Create Task
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredTasks.map((task) => {
              const isDone = task.status === 'done';
              const parentProject = projects.find(p => p.id === task.projectId);
              const parentClient = clients.find(c => c.id === task.clientId || c.id === parentProject?.clientId);
              const isOverdue = task.dueDate && !isDone && new Date(task.dueDate).getTime() < new Date().setHours(0, 0, 0, 0);

              return (
                <div
                  key={task.id}
                  className={`group p-3.5 rounded-2xl border transition-all ${
                    isDone 
                      ? 'bg-surface-neutral/30 border-bd-subtle opacity-70' 
                      : 'bg-card border-bd-subtle hover:border-tx-primary/30 shadow-xs'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Completion Checkbox */}
                    <button
                      onClick={() => handleToggleComplete(task)}
                      disabled={isReadOnly}
                      className={`mt-0.5 shrink-0 transition-transform active:scale-90 ${isReadOnly ? 'cursor-not-allowed opacity-60' : ''}`}
                      aria-label={isDone ? 'Mark incomplete' : 'Mark complete'}
                    >
                      {isDone ? (
                        <CheckCircle2 size={20} className="text-accent-secondary" />
                      ) : (
                        <Circle size={20} className="text-tx-muted hover:text-tx-primary transition-colors" />
                      )}
                    </button>

                    {/* Task Content */}
                    <div className="flex-1 min-w-0" onClick={() => handleOpenSheet(task)}>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-sm font-semibold cursor-pointer ${isDone ? 'line-through text-tx-muted' : 'text-tx-primary'}`}>
                          {task.title}
                        </span>
                        
                        {/* Priority Badge */}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          task.priority === 'High' 
                            ? 'bg-red-500/10 text-red-600' 
                            : task.priority === 'Medium'
                            ? 'bg-accent-secondary/15 text-tx-primary'
                            : 'bg-surface-neutral text-tx-muted'
                        }`}>
                          {task.priority || 'Medium'}
                        </span>

                        {isOverdue && (
                          <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 bg-red-500/10 text-red-600 rounded">
                            <AlertTriangle size={11} /> Overdue
                          </span>
                        )}
                      </div>

                      {task.notes && (
                        <p className="text-xs text-tx-muted line-clamp-1 mb-2">
                          {task.notes}
                        </p>
                      )}

                      {/* Relationship & Metadata Badges */}
                      <div className="flex items-center gap-2 flex-wrap text-xs pt-1">
                        {/* Parent Project Link */}
                        {parentProject && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              goToTab('projects', { filterProjectId: parentProject.id });
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-surface-neutral hover:bg-surface-neutral/80 text-tx-primary rounded-md text-[11px] font-medium transition-colors"
                            title="Go to parent project workspace"
                          >
                            <Layout size={11} className="text-accent-primary" />
                            <span className="truncate max-w-[130px]">{parentProject.name}</span>
                            <ArrowUpRight size={10} className="opacity-60" />
                          </button>
                        )}

                        {/* Client Link */}
                        {parentClient && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              goToClient(parentClient.id);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-surface-neutral hover:bg-surface-neutral/80 text-tx-muted hover:text-tx-primary rounded-md text-[11px] font-medium transition-colors"
                            title="Go to client detail"
                          >
                            <Building2 size={11} className="text-accent-secondary" />
                            <span className="truncate max-w-[110px]">{parentClient.name}</span>
                          </button>
                        )}

                        {/* Assignee Badge */}
                        {task.assigneeName && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-tx-muted">
                            <User size={11} className="text-tx-muted" />
                            <span>{task.assigneeName}</span>
                          </span>
                        )}

                        {/* Due Date */}
                        {(task.dueDate || task.date) && (
                          <span className={`inline-flex items-center gap-1 text-[11px] ${isOverdue ? 'text-red-500 font-semibold' : 'text-tx-muted'}`}>
                            <Calendar size={11} />
                            <span>{new Date(task.dueDate || task.date || '').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quick Row Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          startTimerFor({ 
                            taskId: task.id, 
                            projectId: task.projectId, 
                            clientId: task.clientId, 
                            note: task.title 
                          });
                          push('time-tracker');
                        }}
                        className="p-1.5 rounded-lg text-tx-muted hover:text-accent-primary hover:bg-surface-neutral transition-colors"
                        title="Start timer for this task"
                        aria-label="Start timer"
                      >
                        <Clock size={15} />
                      </button>

                      {!isReadOnly && (
                        <>
                          <button
                            onClick={() => {
                              setTaskToAction(task);
                              setIsArchiveConfirmOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-tx-muted hover:text-tx-primary hover:bg-surface-neutral transition-colors"
                            title="Archive task"
                            aria-label="Archive task"
                          >
                            <Archive size={15} />
                          </button>
                          <button
                            onClick={() => {
                              setTaskToAction(task);
                              setIsDeleteConfirmOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-tx-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
                            title="Delete task"
                            aria-label="Delete task"
                          >
                            <Trash2 size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New / Edit Task BottomSheet */}
      <BottomSheet
        isOpen={isSheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editingTask ? 'Edit Task' : 'New Task'}
        onSave={handleSave}
      >
        <BottomSheetField>
          <input
            type="text"
            placeholder="Task Title (e.g., Deliver Phase 1 drawings)"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full text-[18px] font-semibold text-tx-primary placeholder:text-tx-muted/50 bg-transparent outline-none py-2"
            autoFocus
          />
        </BottomSheetField>

        {/* Project Relationship */}
        <BottomSheetField label="Linked Project">
          <select
            value={form.projectId}
            onChange={(e) => handleProjectSelect(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-surface-neutral border border-bd-subtle text-sm text-tx-primary outline-none"
          >
            <option value="">No Project (Standalone Task)</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </BottomSheetField>

        {/* Client Relationship */}
        <BottomSheetField label="Linked Client">
          <select
            value={form.clientId}
            onChange={(e) => setForm({ ...form, clientId: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl bg-surface-neutral border border-bd-subtle text-sm text-tx-primary outline-none"
          >
            <option value="">No Client Linked</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </BottomSheetField>

        {/* Assignee & Due Date Row */}
        <div className="grid grid-cols-2 gap-3">
          <BottomSheetField label="Assignee">
            <select
              value={form.assigneeId}
              onChange={(e) => handleAssigneeSelect(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-neutral border border-bd-subtle text-sm text-tx-primary outline-none"
            >
              <option value="">Unassigned</option>
              {orgMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </BottomSheetField>

          <BottomSheetField label="Due Date">
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-neutral border border-bd-subtle text-sm text-tx-primary outline-none"
            />
          </BottomSheetField>
        </div>

        {/* Priority */}
        <BottomSheetField label="Priority">
          <div className="flex bg-surface-neutral rounded-xl p-1 w-full border border-bd-subtle">
            {(['Low', 'Medium', 'High'] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setForm({ ...form, priority: opt })}
                className={`flex-1 py-1.5 text-center text-xs font-semibold rounded-lg transition-colors ${
                  form.priority === opt ? 'bg-card text-tx-primary shadow-xs' : 'text-tx-muted hover:text-tx-primary'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </BottomSheetField>

        {/* Category */}
        <BottomSheetField label="Category">
          <CategoryPicker
            value={form.category}
            onChange={(c) => setForm({ ...form, category: c })}
            scope="task"
            categories={preferences.categories}
            onAddCategory={addCategory}
          />
        </BottomSheetField>

        {!showMoreDetails ? (
          <button 
            type="button" 
            onClick={() => setShowMoreDetails(true)} 
            className="text-xs font-semibold text-accent-primary py-2 text-left w-full hover:underline"
          >
            + Add optional notes...
          </button>
        ) : (
          <BottomSheetField label="Notes & Specification">
            <textarea 
              placeholder="Add task context, deliverables, or checklist..." 
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-neutral border border-bd-subtle text-sm text-tx-primary outline-none h-20 resize-none placeholder:text-tx-muted" 
            />
          </BottomSheetField>
        )}

        {/* Connected Workflows */}
        {editingTask && (
          <div className="pt-4 mt-2 border-t border-bd-subtle">
            <h4 className="text-xs font-bold text-tx-muted uppercase tracking-wider mb-2.5">Workflow Jump Points</h4>
            <div className="grid grid-cols-2 gap-2">
              {editingTask.projectId && (
                <button 
                  type="button"
                  onClick={() => { setSheetOpen(false); goToTab('projects', { filterProjectId: editingTask.projectId }); }} 
                  className="flex items-center gap-2 p-2.5 bg-surface-neutral/50 rounded-xl border border-bd-subtle hover:border-tx-primary transition-colors text-left"
                >
                  <Layout size={15} className="text-accent-primary shrink-0" />
                  <span className="text-xs font-medium text-tx-primary truncate">Project Workspace</span>
                </button>
              )}
              {editingTask.clientId && (
                <button 
                  type="button"
                  onClick={() => { setSheetOpen(false); goToClient(editingTask.clientId!); }} 
                  className="flex items-center gap-2 p-2.5 bg-surface-neutral/50 rounded-xl border border-bd-subtle hover:border-tx-primary transition-colors text-left"
                >
                  <Building2 size={15} className="text-accent-secondary shrink-0" />
                  <span className="text-xs font-medium text-tx-primary truncate">Client Details</span>
                </button>
              )}
              <button 
                type="button"
                onClick={() => { 
                  setSheetOpen(false); 
                  startTimerFor({ taskId: editingTask.id, projectId: editingTask.projectId, clientId: editingTask.clientId, note: editingTask.title });
                  push('time-tracker');
                }} 
                className="flex items-center gap-2 p-2.5 bg-accent-primary/10 rounded-xl border border-accent-primary/30 hover:bg-accent-primary/20 transition-colors text-left col-span-2"
              >
                <Clock size={15} className="text-tx-primary shrink-0" />
                <span className="text-xs font-semibold text-tx-primary">Start Timer for this Task</span>
              </button>
            </div>
          </div>
        )}
      </BottomSheet>

      {/* Quick Menu */}
      <BottomSheet
        isOpen={isTasksMenuOpen}
        onClose={() => setIsTasksMenuOpen(false)}
        title="Task Actions"
      >
        <div className="space-y-1 py-1">
          {!isReadOnly && (
            <button 
              onClick={() => { setIsTasksMenuOpen(false); handleOpenSheet(); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-neutral rounded-xl transition-colors"
            >
              <Plus size={18} className="text-tx-primary" />
              <span className="text-sm font-medium text-tx-primary">Create New Task</span>
            </button>
          )}
          <button 
            onClick={() => { setIsTasksMenuOpen(false); goToTab('projects'); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-neutral rounded-xl transition-colors"
          >
            <Briefcase size={18} className="text-tx-primary" />
            <span className="text-sm font-medium text-tx-primary">Switch to Projects</span>
          </button>
          <button 
            onClick={() => { setIsTasksMenuOpen(false); goToTab('clients'); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-neutral rounded-xl transition-colors"
          >
            <Building2 size={18} className="text-tx-primary" />
            <span className="text-sm font-medium text-tx-primary">Switch to Clients</span>
          </button>
          <button 
            onClick={() => { setIsTasksMenuOpen(false); push('time-tracker'); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-neutral rounded-xl transition-colors"
          >
            <Clock size={18} className="text-tx-primary" />
            <span className="text-sm font-medium text-tx-primary">Open Time Tracker</span>
          </button>
        </div>
      </BottomSheet>

      {/* Safe Archive Dialog */}
      <ConfirmDialog
        isOpen={isArchiveConfirmOpen}
        onCancel={() => { setIsArchiveConfirmOpen(false); setTaskToAction(null); }}
        onConfirm={handleArchiveTask}
        title="Archive Task"
        body={`Archive "${taskToAction?.title}"? Archiving preserves historical time entries and project audit logs while marking the task as completed.`}
        confirmLabel="Archive Task"
        danger={false}
      />

      {/* Permanent Delete Dialog */}
      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        onCancel={() => { setIsDeleteConfirmOpen(false); setTaskToAction(null); }}
        onConfirm={handleDeleteTask}
        title="Permanently Delete Task"
        body={`Are you sure you want to permanently delete "${taskToAction?.title}"? This will remove it from all project milestone calculations.`}
        confirmLabel="Delete Permanently"
        danger={true}
      />
    </div>
  );
}
