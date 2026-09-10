import React, { useState, useMemo, useEffect } from 'react';
import {
  Briefcase, Search, Plus, MoreVertical, X, ChevronLeft, 
  CheckSquare, Calendar as CalendarIcon, FileText, Clock, DollarSign, Activity, 
  Flag, Target, Play, User, Sparkles, Loader2
} from 'lucide-react';
import { Header, ProgressBar } from '../components/Shared';
import { BottomSheet, BottomSheetField } from '../components/BottomSheet';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useProjects } from '../context/ProjectsContext';
import { useTasks } from '../context/TasksContext';
import { useCalendar } from '../context/CalendarContext';
import { useLibrary } from '../context/LibraryContext';
import { useTimeTracker } from '../context/TimeTrackerContext';
import { useRevenue } from '../context/RevenueContext';
import { useClients } from '../context/ClientsContext';
import { usePreferences } from '../context/PreferencesContext';
import { useNavigation } from '../context/NavigationContext';
import { formatCurrency, formatCurrencyCompact } from '../utils/currency';
import { ProjectItem } from '../types';
import { generateAIContent } from '../lib/ai';

type TabType = 'overview' | 'tasks' | 'schedule' | 'timeline' | 'files' | 'time' | 'finance' | 'activity';

const STATUS_COLORS: Record<string, string> = {
  'active': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  'completed': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  'on-hold': 'bg-orange-500/10 text-orange-600 border-orange-500/20'
};

export function Projects({ initialProjectId, initialOpenCreate }: { initialProjectId?: string; initialOpenCreate?: boolean }) {
  const { projects, addProject, updateProject, deleteProject } = useProjects();
  const { clients } = useClients();
  const { tasks, addTask } = useTasks();
  const { events, addEvent } = useCalendar();
  const { library, addLibraryItem } = useLibrary();
  const { timeEntries, setActiveProjectId, startTimer, timerState } = useTimeTracker();
  const { revenues, addRevenue } = useRevenue();
  const { preferences } = usePreferences();
  const { startTimerFor } = useTimeTracker();
  const { push, goToClient, navigationOptions } = useNavigation();

  // Handle nav filter if present
  const filterClientId = navigationOptions?.filterClientId || '';

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(initialProjectId || null);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'on-hold'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Sheet / Modals
  const [isSheetOpen, setIsSheetOpen] = useState(!!initialOpenCreate);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Form states
  const initialFormState = {
    name: '', priority: 'low' as 'high'|'low', completionPct: '0', tone: 'lime' as any, clientId: filterClientId, status: 'active' as any
  };
  const [form, setForm] = useState(initialFormState);

  // Quick Action Sheets
  const [activeActionSheet, setActiveActionSheet] = useState<'task' | 'event' | 'library' | 'revenue' | null>(null);
  
  const [taskForm, setTaskForm] = useState({ title: '', priority: 'Medium' as 'Low'|'Medium'|'High', categoryId: '' });
  const [eventForm, setEventForm] = useState({ title: '', date: new Date().toISOString().split('T')[0], type: 'Deadline' as any });
  const [libForm, setLibForm] = useState({ name: '', type: 'link' as 'file'|'link'|'note', category: 'Project Files' as any, urlOrReference: '' });
  const [revForm, setRevForm] = useState({ amount: '', date: new Date().toISOString().split('T')[0], status: 'Pending' as any, notes: '' });

  // AI Summary State
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Clear AI state when project changes
  useEffect(() => {
    setAiSummary(null);
    setAiError(null);
  }, [selectedProjectId]);

  useEffect(() => {
    if (initialProjectId) setSelectedProjectId(initialProjectId);
  }, [initialProjectId]);
  useEffect(() => {
    if (initialOpenCreate) setIsSheetOpen(true);
  }, [initialOpenCreate]);

  // Set default categoryId for tasks
  useEffect(() => {
    if (!taskForm.categoryId && preferences.categories.length > 0) {
      const taskCats = preferences.categories.filter(c => c.scope === 'task');
      if (taskCats.length > 0) setTaskForm(prev => ({ ...prev, categoryId: taskCats[0].id }));
    }
  }, [preferences.categories, taskForm.categoryId]);

  const filteredProjects = useMemo(() => {
    let result = projects;
    if (filter !== 'all') result = result.filter(p => p.status === filter);
    if (filterClientId) result = result.filter(p => p.clientId === filterClientId);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(q) || p.index.toLowerCase().includes(q)
      );
    }
    return result;
  }, [projects, filter, searchQuery, filterClientId]);

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const linkedClient = selectedProject?.clientId ? clients.find(c => c.id === selectedProject.clientId) : null;

  const projectData = useMemo(() => {
    if (!selectedProject) return null;
    const pid = selectedProject.id;
    return {
      tasks: tasks.filter(t => t.projectId === pid),
      events: events.filter(e => e.projectId === pid).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
      library: library.filter(l => l.projectId === pid),
      revenues: revenues.filter(r => r.projectId === pid),
      time: timeEntries.filter(t => t.projectId === pid)
    };
  }, [selectedProject, tasks, events, library, revenues, timeEntries]);

  const stats = useMemo(() => {
    if (!projectData) return null;
    const openTasks = projectData.tasks.filter(t => t.status !== 'done').length;
    const today = new Date().toISOString().split('T')[0];
    const upcomingEvents = projectData.events.filter(e => e.date >= today);
    const deadlines = projectData.events.filter(e => e.type === 'Deadline' || e.type === 'Milestone');
    const nextDeadline = deadlines.find(d => d.date >= today);
    const totalBilled = projectData.revenues.filter(r => r.status === 'Paid').reduce((sum, r) => sum + r.amount, 0);
    const totalPending = projectData.revenues.filter(r => r.status === 'Pending').reduce((sum, r) => sum + r.amount, 0);
    const totalTimeSecs = projectData.time.reduce((sum, t) => sum + t.durationSeconds, 0);
    const totalTimeHrs = (totalTimeSecs / 3600).toFixed(1);
    
    return { 
      openTasks, 
      upcomingEvents: upcomingEvents.length, 
      totalBilled, 
      totalPending,
      totalTimeHrs,
      nextDeadline,
      docCount: projectData.library.length 
    };
  }, [projectData]);

  const combinedActivity = useMemo(() => {
    if (!projectData) return [];
    type ActivityItem = { id: string; type: 'task'|'time'|'event'|'revenue'|'library'; date: Date; data: any };
    const items: ActivityItem[] = [];
    projectData.tasks.filter(t => t.status === 'done').forEach(t => items.push({ id: t.id, type: 'task', date: new Date(t.updatedAt || t.createdAt || ''), data: t }));
    projectData.time.forEach(t => items.push({ id: t.id, type: 'time', date: new Date(t.startedAt), data: t }));
    projectData.events.filter(e => e.status === 'completed').forEach(e => items.push({ id: e.id, type: 'event', date: new Date(e.date + 'T00:00:00'), data: e }));
    projectData.revenues.forEach(r => items.push({ id: r.id, type: 'revenue', date: new Date(r.date + 'T00:00:00'), data: r }));
    projectData.library.forEach(l => items.push({ id: l.id, type: 'library', date: new Date(l.createdAt), data: l }));
    // filter out invalid dates
    return items.filter(i => !isNaN(i.date.getTime())).sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [projectData]);

  const timelineItems = useMemo(() => {
    if (!projectData) return [];
    type TimelineItem = { id: string; type: 'event'|'task'; date: string; data: any };
    const items: TimelineItem[] = [];
    projectData.events.forEach(e => items.push({ id: e.id, type: 'event', date: e.date, data: e }));
    projectData.tasks.filter(t => t.date).forEach(t => items.push({ id: t.id, type: 'task', date: t.date!, data: t }));
    return items.sort((a, b) => a.date.localeCompare(b.date));
  }, [projectData]);

  const counts = useMemo(() => ({
    all: projects.length,
    active: projects.filter(p => p.status === 'active').length,
    completed: projects.filter(p => p.status === 'completed').length,
    'on-hold': projects.filter(p => p.status === 'on-hold').length,
  }), [projects]);

  const handleSaveProject = (addAnother: boolean = false) => {
    if (!form.name.trim()) return;
    if (editingProjectId) {
      updateProject(editingProjectId, {
        name: form.name,
        priority: form.priority,
        completionPct: Number(form.completionPct),
        tone: form.tone,
        clientId: form.clientId || undefined,
        status: form.status
      });
    } else {
      addProject({
        name: form.name,
        priority: form.priority,
        completionPct: Number(form.completionPct),
        tone: form.tone,
        clientId: form.clientId || undefined,
        status: form.status
      });
    }
    if (addAnother) {
      setForm(initialFormState);
      setEditingProjectId(null);
    } else {
      setIsSheetOpen(false);
    }
  };

  const confirmDelete = () => {
    if (selectedProjectId) {
      deleteProject(selectedProjectId);
      setSelectedProjectId(null);
    }
  };

  // Creation Handlers
  const handleCreateTask = () => {
    if (!taskForm.title || !taskForm.categoryId || !selectedProjectId) return;
    addTask({
      ...taskForm,
      status: 'active',
      projectId: selectedProjectId
    });
    setActiveActionSheet(null);
    setTaskForm({ title: '', priority: 'Medium', categoryId: taskForm.categoryId });
  };

  const handleCreateEvent = () => {
    if (!eventForm.title || !selectedProjectId) return;
    const cat = preferences.categories.find(c => c.scope === 'event');
    addEvent({
      ...eventForm,
      allDay: true,
      status: 'scheduled',
      projectId: selectedProjectId,
      categoryId: cat?.id || '',
      repeat: 'none'
    });
    setActiveActionSheet(null);
    setEventForm({ title: '', date: new Date().toISOString().split('T')[0], type: 'Deadline' });
  };

  const handleCreateLibrary = () => {
    if (!libForm.name || !selectedProjectId) return;
    addLibraryItem({
      ...libForm,
      projectId: selectedProjectId,
      tags: []
    });
    setActiveActionSheet(null);
    setLibForm({ name: '', type: 'link', category: 'Project Files', urlOrReference: '' });
  };

  const handleCreateRevenue = () => {
    if (!revForm.amount || isNaN(Number(revForm.amount)) || !selectedProjectId) return;
    addRevenue({
      amount: Number(revForm.amount),
      date: revForm.date,
      status: revForm.status,
      notes: revForm.notes,
      projectId: selectedProjectId,
      clientOrProject: selectedProject?.name || ''
    });
    setActiveActionSheet(null);
    setRevForm({ amount: '', date: new Date().toISOString().split('T')[0], status: 'Pending', notes: '' });
  };

  const handleStartTimer = () => {
    if (!selectedProjectId) return;
    setActiveProjectId(selectedProjectId);
    if (timerState === 'idle') {
      startTimer();
    }
    push('time-tracker');
  };

  const handleGenerateAISummary = async () => {
    if (!selectedProject || !projectData || !stats) return;
    
    setIsGeneratingSummary(true);
    setAiError(null);
    setAiSummary(null);

    const prompt = `
      Please provide a brief, professional executive summary of the following project state, including 2-3 bullet points on recommended next steps.

      Project Name: ${selectedProject.name}
      Completion: ${selectedProject.completionPct}%
      Status: ${selectedProject.status}
      Client: ${linkedClient?.name || 'No client assigned'}
      
      Key Metrics:
      - Open Tasks: ${stats.openTasks}
      - Upcoming Events: ${stats.upcomingEvents}
      - Total Tracked Time: ${stats.totalTimeHrs} hrs
      - Total Billed Revenue: ${formatCurrency(stats.totalBilled, preferences.currency)}

      Tasks: ${projectData.tasks.slice(0, 5).map(t => `[${t.status}] ${t.title}`).join(', ')}
      Events: ${projectData.events.slice(0, 3).map(e => `[${e.date}] ${e.title}`).join(', ')}
    `;

    const response = await generateAIContent({
      prompt,
      systemInstruction: 'You are an elite project manager and executive assistant. Keep summaries concise, actionable, and formatted cleanly. Do not use markdown headers, just plain text and bullet points.',
    });

    setIsGeneratingSummary(false);
    
    if (response.error) {
      setAiError(response.error);
    } else if (response.data) {
      setAiSummary(response.data);
    }
  };

  return (
    <div className="flex flex-col h-full bg-canvas relative pb-[88px] overflow-hidden">
      {/* List Sidebar / Full View on Mobile if nothing selected */}
      <div className={`flex-col w-full md:w-[350px] lg:w-[400px] h-full bg-canvas shrink-0 border-r border-bd-subtle ${selectedProject ? 'hidden md:flex' : 'flex'}`}>
        <Header title="Projects" rightIcon={
          <div className="flex items-center gap-1">
            <button onClick={() => setIsSearchOpen(!isSearchOpen)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-neutral text-tx-primary transition-colors">
              <Search size={20} />
            </button>
            <button onClick={() => { setForm(initialFormState); setEditingProjectId(null); setIsSheetOpen(true); }} className="w-10 h-10 flex items-center justify-center rounded-full bg-tx-primary text-tx-inverse hover:opacity-90 transition-opacity" aria-label="Add project">
              <Plus size={22} />
            </button>
          </div>
        } />
        {isSearchOpen && (
          <div className="px-4 py-2">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-tx-muted" />
              <input type="text" autoFocus value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search projects..." className="w-full bg-surface-neutral rounded-xl py-2.5 pl-10 pr-10 text-[15px] outline-none" />
              {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-tx-muted p-1"><X size={16} /></button>}
            </div>
          </div>
        )}
        <div className="px-4 py-3 overflow-x-auto no-scrollbar flex gap-2">
          {(['all', 'active', 'completed', 'on-hold'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`whitespace-nowrap px-4 py-1.5 rounded-full text-[14px] font-medium transition-colors border ${filter === f ? 'bg-tx-primary text-tx-inverse border-tx-primary' : 'bg-surface-neutral text-tx-secondary border-transparent'}`}>
              <span className="capitalize">{f.replace('-', ' ')}</span>
              <span className={`ml-1.5 text-[12px] ${filter === f ? 'text-tx-inverse/70' : 'text-tx-muted'}`}>{counts[f]}</span>
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-6 flex flex-col gap-3 mt-1">
          {filteredProjects.map(p => (
            <button key={p.id} onClick={() => { setSelectedProjectId(p.id); setActiveTab('overview'); }} className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-colors text-left ${selectedProjectId === p.id ? 'bg-surface-hover border-accent-primary/50' : 'bg-canvas border-bd-subtle hover:border-accent-primary/30'}`}>
              <div className="w-12 h-12 rounded-xl bg-surface-neutral flex flex-col items-center justify-center shrink-0 border border-bd-subtle/50">
                <span className="text-[10px] font-bold text-tx-muted mb-0.5 tracking-wider">{p.index.split('-')[0]}</span>
                <span className="text-[13px] font-bold text-tx-primary leading-none">{p.index.split('-')[1]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-[16px] text-tx-primary truncate leading-tight">{p.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[13px] text-tx-muted truncate">{p.completionPct}% Complete</span>
                  {p.priority === 'high' && <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />}
                </div>
              </div>
            </button>
          ))}
          {filteredProjects.length === 0 && <div className="py-12 text-center text-tx-muted">No projects found.</div>}
        </div>
      </div>

      {/* 360 Workspace Area */}
      <div className={`flex-col flex-1 h-full bg-surface-neutral/10 relative ${selectedProject ? 'flex' : 'hidden md:flex'}`}>
        {selectedProject && projectData && stats ? (
          <div className="flex flex-col h-full">
            {/* 360 Header */}
            <div className="bg-canvas border-b border-bd-subtle shrink-0 relative">
              <div className="px-4 py-3 flex items-center justify-between">
                <button onClick={() => setSelectedProjectId(null)} className="w-10 h-10 flex items-center justify-center -ml-2 rounded-full hover:bg-surface-neutral text-tx-primary md:hidden">
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
                            setForm({
                              name: selectedProject.name, priority: selectedProject.priority,
                              completionPct: String(selectedProject.completionPct), tone: selectedProject.tone,
                              clientId: selectedProject.clientId || '', status: selectedProject.status || 'active'
                            });
                            setEditingProjectId(selectedProject.id); setIsMenuOpen(false); setIsSheetOpen(true); 
                          }} className="w-full text-left px-4 py-3 text-[15px] font-medium text-tx-primary hover:bg-surface-neutral">Edit Project</button>
                        <button onClick={() => { setIsMenuOpen(false); setIsDeleteOpen(true); }} className="w-full text-left px-4 py-3 text-[15px] font-medium text-red-500 hover:bg-red-500/10">Delete Project</button>
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              <div className="px-6 pb-6 pt-2">
                <div className="flex items-center gap-3 mb-2 text-[14px]">
                  <span className="font-bold text-tx-muted tracking-widest">{selectedProject.index}</span>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wide border ${STATUS_COLORS[selectedProject.status || 'active']}`}>
                    {selectedProject.status}
                  </span>
                  {selectedProject.priority === 'high' && (
                    <span className="flex items-center gap-1 text-[12px] font-bold text-orange-600 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20 uppercase tracking-wide">
                      <Flag size={12} /> High Priority
                    </span>
                  )}
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-tx-primary mb-4 leading-tight">{selectedProject.name}</h2>
                
                {linkedClient && (
                  <button onClick={() => goToClient(linkedClient.id)} className="flex items-center gap-2 px-3 py-1.5 bg-surface-neutral hover:bg-surface-hover transition-colors rounded-lg w-max mb-5 border border-bd-subtle/50">
                    <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${linkedClient.avatarSeed}`} alt={linkedClient.name} className="w-5 h-5 rounded-full object-cover" />
                    <span className="text-[13px] font-medium text-tx-primary">{linkedClient.name}</span>
                  </button>
                )}

                <div className="flex items-center gap-4">
                  <div className="flex-1 max-w-md">
                    <div className="flex justify-between text-[13px] font-medium mb-1.5">
                      <span className="text-tx-secondary">Progress</span>
                      <span className="text-tx-primary">{selectedProject.completionPct}%</span>
                    </div>
                    <ProgressBar progress={selectedProject.completionPct} tone={selectedProject.tone} />
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="px-2 md:px-6 flex overflow-x-auto no-scrollbar border-t border-bd-subtle">
                {(['overview', 'activity', 'tasks', 'schedule', 'timeline', 'files', 'time', 'finance'] as TabType[]).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-3 text-[14px] font-medium capitalize border-b-2 whitespace-nowrap transition-colors ${activeTab === tab ? 'border-tx-primary text-tx-primary' : 'border-transparent text-tx-muted hover:text-tx-secondary'}`}>
                    {tab} 
                    {tab === 'tasks' && projectData.tasks.length > 0 && <span className="ml-1.5 opacity-50">({projectData.tasks.length})</span>}
                    {tab === 'files' && projectData.library.length > 0 && <span className="ml-1.5 opacity-50">({projectData.library.length})</span>}
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
                    <div className="bg-canvas border border-bd-subtle rounded-2xl p-4 flex flex-col">
                      <div className="flex items-center justify-between mb-2"><span className="text-[13px] text-tx-muted font-medium">Open Tasks</span><CheckSquare size={16} className="text-orange-500" /></div>
                      <span className="text-2xl font-bold text-tx-primary">{stats.openTasks}</span>
                    </div>
                    <div className="bg-canvas border border-bd-subtle rounded-2xl p-4 flex flex-col">
                      <div className="flex items-center justify-between mb-2"><span className="text-[13px] text-tx-muted font-medium">Upcoming Events</span><CalendarIcon size={16} className="text-purple-500" /></div>
                      <span className="text-2xl font-bold text-tx-primary">{stats.upcomingEvents}</span>
                    </div>
                    <div className="bg-canvas border border-bd-subtle rounded-2xl p-4 flex flex-col">
                      <div className="flex items-center justify-between mb-2"><span className="text-[13px] text-tx-muted font-medium">Tracked Time</span><Clock size={16} className="text-blue-500" /></div>
                      <span className="text-2xl font-bold text-tx-primary">{stats.totalTimeHrs} <span className="text-sm font-normal text-tx-muted">hrs</span></span>
                    </div>
                    <div className="bg-canvas border border-bd-subtle rounded-2xl p-4 flex flex-col">
                      <div className="flex items-center justify-between mb-2"><span className="text-[13px] text-tx-muted font-medium">Billed Revenue</span><DollarSign size={16} className="text-emerald-500" /></div>
                      <span className="text-2xl font-bold text-tx-primary">{formatCurrencyCompact(stats.totalBilled, preferences.currency)}</span>
                    </div>
                  </div>

                  {/* Contextual Actions */}
                  <div>
                    <h3 className="text-[15px] font-bold text-tx-primary mb-3">Quick Actions</h3>
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                      <button onClick={() => setActiveActionSheet('task')} className="bg-canvas border border-bd-subtle hover:border-accent-primary/50 rounded-xl p-3 flex flex-col md:flex-row items-center gap-3 transition-colors text-center md:text-left">
                        <div className="w-10 h-10 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0"><CheckSquare size={18}/></div>
                        <span className="text-[14px] font-medium text-tx-primary">New Task</span>
                      </button>
                      <button onClick={() => setActiveActionSheet('event')} className="bg-canvas border border-bd-subtle hover:border-accent-primary/50 rounded-xl p-3 flex flex-col md:flex-row items-center gap-3 transition-colors text-center md:text-left">
                        <div className="w-10 h-10 rounded-full bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0"><CalendarIcon size={18}/></div>
                        <span className="text-[14px] font-medium text-tx-primary">Schedule</span>
                      </button>
                      <button onClick={() => setActiveActionSheet('library')} className="bg-canvas border border-bd-subtle hover:border-accent-primary/50 rounded-xl p-3 flex flex-col md:flex-row items-center gap-3 transition-colors text-center md:text-left">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0"><FileText size={18}/></div>
                        <span className="text-[14px] font-medium text-tx-primary">Add File</span>
                      </button>
                      <button onClick={handleStartTimer} className="bg-canvas border border-bd-subtle hover:border-accent-primary/50 rounded-xl p-3 flex flex-col md:flex-row items-center gap-3 transition-colors text-center md:text-left">
                        <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0"><Play size={18} className="ml-1" /></div>
                        <span className="text-[14px] font-medium text-tx-primary">Start Timer</span>
                      </button>
                      <button onClick={() => setActiveActionSheet('revenue')} className="bg-canvas border border-bd-subtle hover:border-accent-primary/50 rounded-xl p-3 flex flex-col md:flex-row items-center gap-3 transition-colors text-center md:text-left col-span-2 lg:col-span-1">
                        <div className="w-10 h-10 rounded-full bg-green-500/10 text-green-600 flex items-center justify-center shrink-0"><DollarSign size={18}/></div>
                        <span className="text-[14px] font-medium text-tx-primary">Log Revenue</span>
                      </button>
                    </div>
                  </div>

                  {stats.nextDeadline && (
                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-5 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-purple-500/20 text-purple-600 flex items-center justify-center shrink-0"><Target size={24} /></div>
                      <div>
                        <div className="text-[13px] font-bold text-purple-600 uppercase tracking-wider mb-1">Next Milestone</div>
                        <div className="text-[16px] font-bold text-tx-primary">{stats.nextDeadline.title}</div>
                        <div className="text-[14px] text-tx-secondary mt-0.5">{new Date(stats.nextDeadline.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric'})}</div>
                      </div>
                    </div>
                  )}

                  {/* AI Executive Summary */}
                  <div>
                    <h3 className="text-[15px] font-bold text-tx-primary mb-3">AI Executive Summary</h3>
                    <div className="bg-canvas border border-bd-subtle rounded-2xl p-5 relative overflow-hidden group">
                      {!aiSummary && !isGeneratingSummary && !aiError && (
                        <div className="text-center py-6">
                          <div className="w-12 h-12 rounded-full bg-blue-500/10 text-blue-500 mx-auto flex items-center justify-center mb-3">
                            <Sparkles size={24} />
                          </div>
                          <p className="text-[15px] font-medium text-tx-primary mb-1">Generate Project Brief</p>
                          <p className="text-[13px] text-tx-muted mb-4 max-w-sm mx-auto">Get a professional overview of the current project state and AI-recommended next steps.</p>
                          <button onClick={handleGenerateAISummary} className="px-5 py-2.5 rounded-full bg-tx-primary text-tx-inverse text-[14px] font-medium hover:opacity-90 transition-opacity">
                            Generate Summary
                          </button>
                        </div>
                      )}
                      
                      {isGeneratingSummary && (
                        <div className="flex flex-col items-center justify-center py-8">
                          <Loader2 size={28} className="text-blue-500 animate-spin mb-3" />
                          <p className="text-[14px] text-tx-muted font-medium">Analyzing project data...</p>
                        </div>
                      )}

                      {aiError && (
                        <div className="text-center py-6">
                          <p className="text-[14px] text-red-500 font-medium mb-3">{aiError}</p>
                          <button onClick={handleGenerateAISummary} className="px-4 py-2 rounded-full border border-bd-subtle text-[13px] font-medium hover:bg-surface-hover">
                            Try Again
                          </button>
                        </div>
                      )}

                      {aiSummary && (
                        <div className="relative z-10">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2 text-blue-500 text-[13px] font-bold tracking-wide uppercase">
                              <Sparkles size={14} />
                              AI Generated Brief
                            </div>
                            <button onClick={handleGenerateAISummary} className="text-[12px] font-medium text-tx-muted hover:text-tx-primary transition-colors">
                              Regenerate
                            </button>
                          </div>
                          <div className="text-[14px] text-tx-secondary leading-relaxed whitespace-pre-wrap">
                            {aiSummary}
                          </div>
                        </div>
                      )}
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
                      <div key={act.id + i} className="flex gap-4">
                        <div className="relative flex flex-col items-center">
                          <div className="w-10 h-10 rounded-full bg-canvas border border-bd-subtle flex items-center justify-center shrink-0 text-tx-muted z-10 shadow-sm">
                            {act.type === 'task' && <CheckSquare size={16} />}
                            {act.type === 'time' && <Clock size={16} />}
                            {act.type === 'event' && <CalendarIcon size={16} />}
                            {act.type === 'revenue' && <DollarSign size={16} />}
                            {act.type === 'library' && <FileText size={16} />}
                          </div>
                          {i !== combinedActivity.length - 1 && <div className="w-px h-full bg-bd-subtle/50 absolute top-10" />}
                        </div>
                        <div className="flex-1 bg-canvas border border-bd-subtle rounded-2xl p-4 mb-4 shadow-sm">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-[14px] font-medium capitalize text-tx-primary">{act.type}</span>
                            <span className="text-[12px] text-tx-muted">{act.date.toLocaleDateString()}</span>
                          </div>
                          {act.type === 'task' && <p className="text-[14px] text-tx-secondary">Completed task: {act.data.title}</p>}
                          {act.type === 'time' && <p className="text-[14px] text-tx-secondary">Logged {Math.round(act.data.durationSeconds/60)} mins {act.data.note && `- ${act.data.note}`}</p>}
                          {act.type === 'event' && <p className="text-[14px] text-tx-secondary">Completed event: {act.data.title}</p>}
                          {act.type === 'revenue' && <p className="text-[14px] text-tx-secondary">Logged payment: {formatCurrency(act.data.amount, preferences.currency)}</p>}
                          {act.type === 'library' && <p className="text-[14px] text-tx-secondary">Added file: {act.data.name}</p>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'timeline' && (
                <div className="space-y-4">
                  {timelineItems.length === 0 ? (
                    <div className="text-center py-12 text-tx-muted">No timeline items found.</div>
                  ) : (
                    timelineItems.map((item, i) => {
                      const isPast = new Date(item.date) < new Date(new Date().setHours(0,0,0,0));
                      return (
                        <div key={item.id + i} className={`flex gap-4 ${isPast ? 'opacity-60' : ''}`}>
                          <div className="relative flex flex-col items-center">
                            <div className={`w-3 h-3 rounded-full mt-1.5 z-10 ${item.type === 'event' ? 'bg-purple-500' : 'bg-orange-500'}`} />
                            {i !== timelineItems.length - 1 && <div className="w-px h-full bg-bd-subtle/50 absolute top-4" />}
                          </div>
                          <div className="flex-1 pb-6">
                            <div className="text-[12px] font-bold text-tx-muted uppercase tracking-wider mb-1">
                              {new Date(item.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric'})}
                            </div>
                            <div className="bg-canvas border border-bd-subtle rounded-xl p-3 shadow-sm">
                              <div className="text-[15px] font-medium text-tx-primary">
                                {item.type === 'event' ? item.data.title : item.data.title}
                              </div>
                              <div className="text-[13px] text-tx-muted mt-1 capitalize">{item.type} {item.type === 'event' ? `• ${item.data.type}` : ''}</div>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}

              {activeTab === 'tasks' && (
                <div className="space-y-3">
                  <button onClick={() => setActiveActionSheet('task')} className="w-full flex items-center justify-center gap-2 py-3 bg-surface-neutral rounded-xl border border-dashed border-bd-subtle text-tx-primary font-medium hover:bg-surface-hover transition-colors mb-2">
                    <Plus size={18} /> New Task
                  </button>
                  {projectData.tasks.length === 0 ? (
                    <div className="text-center py-8 text-tx-muted">No tasks found.</div>
                  ) : (
                    projectData.tasks.map(t => (
                      <div key={t.id} className="bg-canvas border border-bd-subtle rounded-xl p-3 flex items-center gap-3">
                        <div className={`w-5 h-5 rounded border shrink-0 flex items-center justify-center ${t.status === 'done' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-tx-muted'}`}>
                          {t.status === 'done' && <CheckSquare size={14} />}
                        </div>
                        <div className={`flex-1 text-[15px] font-medium ${t.status === 'done' ? 'text-tx-muted line-through' : 'text-tx-primary'}`}>{t.title}</div>
                        {t.priority === 'High' && <Flag size={14} className="text-orange-500" />}
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'schedule' && (
                <div className="space-y-3">
                  <button onClick={() => setActiveActionSheet('event')} className="w-full flex items-center justify-center gap-2 py-3 bg-surface-neutral rounded-xl border border-dashed border-bd-subtle text-tx-primary font-medium hover:bg-surface-hover transition-colors mb-2">
                    <Plus size={18} /> Schedule Event
                  </button>
                  {projectData.events.length === 0 ? (
                    <div className="text-center py-8 text-tx-muted">No scheduled events.</div>
                  ) : (
                    projectData.events.map(e => (
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

              {activeTab === 'files' && (
                <div className="space-y-3">
                  <button onClick={() => setActiveActionSheet('library')} className="w-full flex items-center justify-center gap-2 py-3 bg-surface-neutral rounded-xl border border-dashed border-bd-subtle text-tx-primary font-medium hover:bg-surface-hover transition-colors mb-2">
                    <Plus size={18} /> Add Document
                  </button>
                  {projectData.library.length === 0 ? (
                    <div className="text-center py-8 text-tx-muted">No documents found.</div>
                  ) : (
                    projectData.library.map(l => (
                      <div key={l.id} className="bg-canvas border border-bd-subtle rounded-xl p-4 flex justify-between items-center">
                        <div>
                          <div className="text-[15px] font-bold text-tx-primary mb-1">{l.name}</div>
                          <div className="text-[13px] text-tx-muted">{l.category} • {l.type}</div>
                        </div>
                        <a href={l.urlOrReference} target="_blank" rel="noreferrer" className="p-2 rounded-full hover:bg-surface-neutral text-tx-primary transition-colors">
                          <FileText size={18} />
                        </a>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'time' && (
                <div className="space-y-3">
                  <button onClick={handleStartTimer} className="w-full flex items-center justify-center gap-2 py-3 bg-surface-neutral rounded-xl border border-dashed border-bd-subtle text-tx-primary font-medium hover:bg-surface-hover transition-colors mb-2">
                    <Play size={18} /> Start Timer
                  </button>
                  {projectData.time.length === 0 ? (
                    <div className="text-center py-8 text-tx-muted">No time logged.</div>
                  ) : (
                    projectData.time.map(t => (
                      <div key={t.id} className="bg-canvas border border-bd-subtle rounded-xl p-4 flex justify-between items-center">
                        <div>
                          <div className="text-[15px] font-bold text-tx-primary mb-1">{Math.round(t.durationSeconds / 60)} mins</div>
                          <div className="text-[13px] text-tx-muted">{new Date(t.startedAt).toLocaleDateString()} {t.note && `• ${t.note}`}</div>
                        </div>
                        <div className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${t.billable ? 'bg-blue-500/10 text-blue-600' : 'bg-surface-neutral text-tx-muted'}`}>
                          {t.billable ? 'Billable' : 'Non-billable'}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'finance' && (() => {
                const totalRevenue = projectData.revenues.reduce((sum, r) => sum + r.amount, 0);
                const totalTrackedSeconds = projectData.time.reduce((sum, t) => sum + t.durationSeconds, 0);
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
                      <button onClick={() => setActiveActionSheet('revenue')} className="text-tx-primary hover:text-accent-primary transition-colors">
                        <Plus size={20} />
                      </button>
                    </div>
                    {projectData.revenues.length === 0 ? (
                      <div className="text-center py-8 text-tx-muted border border-dashed border-bd-subtle rounded-xl">No revenue logged.</div>
                    ) : (
                      projectData.revenues.map(r => (
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
              {activeTab === 'activity' && (
                <div className="space-y-4">
                  {combinedActivity.length === 0 ? (
                    <div className="text-center py-12 text-tx-muted">No recent activity.</div>
                  ) : (
                    combinedActivity.map((act, i) => (
                      <div key={act.id + i} className="flex gap-4">
                        <div className="relative flex flex-col items-center">
                          <div className="w-10 h-10 rounded-full bg-canvas border border-bd-subtle flex items-center justify-center shrink-0 text-tx-muted z-10 shadow-sm">
                            {act.type === 'task' && <CheckSquare size={16} />}
                            {act.type === 'time' && <Clock size={16} />}
                            {act.type === 'event' && <CalendarIcon size={16} />}
                            {act.type === 'revenue' && <DollarSign size={16} />}
                            {act.type === 'library' && <FileText size={16} />}
                          </div>
                          {i !== combinedActivity.length - 1 && <div className="w-px h-full bg-bd-subtle/50 absolute top-10" />}
                        </div>
                        <div className="flex-1 bg-canvas border border-bd-subtle rounded-2xl p-4 mb-4 shadow-sm">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-[14px] font-medium capitalize text-tx-primary">{act.type}</span>
                            <span className="text-[12px] text-tx-muted">{act.date.toLocaleDateString()}</span>
                          </div>
                          {act.type === 'task' && <p className="text-[14px] text-tx-secondary">Completed task: {act.data.title}</p>}
                          {act.type === 'time' && <p className="text-[14px] text-tx-secondary">Logged {Math.round(act.data.durationSeconds/60)} mins {act.data.note && `- ${act.data.note}`}</p>}
                          {act.type === 'event' && <p className="text-[14px] text-tx-secondary">Completed event: {act.data.title}</p>}
                          {act.type === 'revenue' && <p className="text-[14px] text-tx-secondary">Logged payment: {formatCurrency(act.data.amount, preferences.currency)}</p>}
                          {act.type === 'library' && <p className="text-[14px] text-tx-secondary">Added file: {act.data.name}</p>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'timeline' && (
                <div className="space-y-4">
                  {timelineItems.length === 0 ? (
                    <div className="text-center py-12 text-tx-muted">No timeline items found.</div>
                  ) : (
                    timelineItems.map((item, i) => {
                      const isPast = new Date(item.date) < new Date(new Date().setHours(0,0,0,0));
                      return (
                        <div key={item.id + i} className={`flex gap-4 ${isPast ? 'opacity-60' : ''}`}>
                          <div className="relative flex flex-col items-center">
                            <div className={`w-3 h-3 rounded-full mt-1.5 z-10 ${item.type === 'event' ? 'bg-purple-500' : 'bg-orange-500'}`} />
                            {i !== timelineItems.length - 1 && <div className="w-px h-full bg-bd-subtle/50 absolute top-4" />}
                          </div>
                          <div className="flex-1 pb-6">
                            <div className="text-[12px] font-bold text-tx-muted uppercase tracking-wider mb-1">
                              {new Date(item.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric'})}
                            </div>
                            <div className="bg-canvas border border-bd-subtle rounded-xl p-3 shadow-sm">
                              <div className="text-[15px] font-medium text-tx-primary">
                                {item.type === 'event' ? item.data.title : item.data.title}
                              </div>
                              <div className="text-[13px] text-tx-muted mt-1 capitalize">{item.type} {item.type === 'event' ? `• ${item.data.type}` : ''}</div>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}

              {activeTab === 'tasks' && (
                <div className="space-y-3">
                  <button onClick={() => setActiveActionSheet('task')} className="w-full flex items-center justify-center gap-2 py-3 bg-surface-neutral rounded-xl border border-dashed border-bd-subtle text-tx-primary font-medium hover:bg-surface-hover transition-colors mb-2">
                    <Plus size={18} /> New Task
                  </button>
                  {projectData.tasks.length === 0 ? (
                    <div className="text-center py-8 text-tx-muted">No tasks found.</div>
                  ) : (
                    projectData.tasks.map(t => (
                      <div key={t.id} className="bg-canvas border border-bd-subtle rounded-xl p-3 flex items-center gap-3">
                        <div className={`w-5 h-5 rounded border shrink-0 flex items-center justify-center ${t.status === 'done' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-tx-muted'}`}>
                          {t.status === 'done' && <CheckSquare size={14} />}
                        </div>
                        <div className={`flex-1 text-[15px] font-medium ${t.status === 'done' ? 'text-tx-muted line-through' : 'text-tx-primary'}`}>{t.title}</div>
                        {t.priority === 'High' && <Flag size={14} className="text-orange-500" />}
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'schedule' && (
                <div className="space-y-3">
                  <button onClick={() => setActiveActionSheet('event')} className="w-full flex items-center justify-center gap-2 py-3 bg-surface-neutral rounded-xl border border-dashed border-bd-subtle text-tx-primary font-medium hover:bg-surface-hover transition-colors mb-2">
                    <Plus size={18} /> Schedule Event
                  </button>
                  {projectData.events.length === 0 ? (
                    <div className="text-center py-8 text-tx-muted">No scheduled events.</div>
                  ) : (
                    projectData.events.map(e => (
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

              {activeTab === 'files' && (
                <div className="space-y-3">
                  <button onClick={() => setActiveActionSheet('library')} className="w-full flex items-center justify-center gap-2 py-3 bg-surface-neutral rounded-xl border border-dashed border-bd-subtle text-tx-primary font-medium hover:bg-surface-hover transition-colors mb-2">
                    <Plus size={18} /> Add Document
                  </button>
                  {projectData.library.length === 0 ? (
                    <div className="text-center py-8 text-tx-muted">No documents found.</div>
                  ) : (
                    projectData.library.map(l => (
                      <div key={l.id} className="bg-canvas border border-bd-subtle rounded-xl p-4 flex justify-between items-center">
                        <div>
                          <div className="text-[15px] font-bold text-tx-primary mb-1">{l.name}</div>
                          <div className="text-[13px] text-tx-muted">{l.category} • {l.type}</div>
                        </div>
                        <a href={l.urlOrReference} target="_blank" rel="noreferrer" className="p-2 rounded-full hover:bg-surface-neutral text-tx-primary transition-colors">
                          <FileText size={18} />
                        </a>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'time' && (
                <div className="space-y-3">
                  <button onClick={handleStartTimer} className="w-full flex items-center justify-center gap-2 py-3 bg-surface-neutral rounded-xl border border-dashed border-bd-subtle text-tx-primary font-medium hover:bg-surface-hover transition-colors mb-2">
                    <Play size={18} /> Start Timer
                  </button>
                  {projectData.time.length === 0 ? (
                    <div className="text-center py-8 text-tx-muted">No time logged.</div>
                  ) : (
                    projectData.time.map(t => (
                      <div key={t.id} className="bg-canvas border border-bd-subtle rounded-xl p-4 flex justify-between items-center">
                        <div>
                          <div className="text-[15px] font-bold text-tx-primary mb-1">{Math.round(t.durationSeconds / 60)} mins</div>
                          <div className="text-[13px] text-tx-muted">{new Date(t.startedAt).toLocaleDateString()} {t.note && `• ${t.note}`}</div>
                        </div>
                        <div className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${t.billable ? 'bg-blue-500/10 text-blue-600' : 'bg-surface-neutral text-tx-muted'}`}>
                          {t.billable ? 'Billable' : 'Non-billable'}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'finance' && (
                <div className="space-y-3">
                  <button onClick={() => setActiveActionSheet('revenue')} className="w-full flex items-center justify-center gap-2 py-3 bg-surface-neutral rounded-xl border border-dashed border-bd-subtle text-tx-primary font-medium hover:bg-surface-hover transition-colors mb-2">
                    <Plus size={18} /> Add Revenue Entry
                  </button>
                  {projectData.revenues.length === 0 ? (
                    <div className="text-center py-8 text-tx-muted">No revenue logged.</div>
                  ) : (
                    projectData.revenues.map(r => (
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
              )}

            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-tx-muted p-8">
            <div className="w-16 h-16 rounded-full bg-surface-neutral flex items-center justify-center mb-4"><Briefcase size={32} /></div>
            <p className="text-lg font-medium text-tx-primary">No Project Selected</p>
            <p className="text-sm mt-1 text-center">Select a project from the list to view its workspace.</p>
          </div>
        )}
      </div>

      {/* Primary Sheet: Edit/Create Project */}
      <BottomSheet isOpen={isSheetOpen} onClose={() => setIsSheetOpen(false)} title={editingProjectId ? "Edit Project" : "New Project"} onSave={() => handleSaveProject(false)} saveLabel="Save">
        <BottomSheetField label="Name *"><input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Website Redesign" /></BottomSheetField>
        
        <BottomSheetField label="Client (Optional)">
          <select value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}>
            <option value="">No Client</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </BottomSheetField>
        
        <BottomSheetField label="Status">
          <div className="flex bg-surface-neutral p-1 rounded-xl w-full">
            {(['active', 'completed', 'on-hold'] as const).map(s => (
              <button key={s} onClick={() => setForm(f => ({ ...f, status: s }))} className={`flex-1 py-1.5 text-[14px] font-medium rounded-lg capitalize transition-all ${form.status === s ? 'bg-canvas text-tx-primary shadow-sm' : 'text-tx-muted hover:text-tx-primary'}`}>{s.replace('-', ' ')}</button>
            ))}
          </div>
        </BottomSheetField>

        <div className="grid grid-cols-2 gap-4">
          <BottomSheetField label="Priority">
            <div className="flex bg-surface-neutral p-1 rounded-xl w-full">
              {(['low', 'high'] as const).map(p => (
                <button key={p} onClick={() => setForm(f => ({ ...f, priority: p }))} className={`flex-1 py-1.5 text-[14px] font-medium rounded-lg capitalize transition-all ${form.priority === p ? 'bg-canvas text-tx-primary shadow-sm' : 'text-tx-muted hover:text-tx-primary'}`}>{p}</button>
              ))}
            </div>
          </BottomSheetField>
          <BottomSheetField label="Completion %">
            <input type="number" min="0" max="100" value={form.completionPct} onChange={e => setForm(f => ({ ...f, completionPct: e.target.value }))} className="w-full text-center" />
          </BottomSheetField>
        </div>

        <BottomSheetField label="Theme Tone">
          <div className="flex bg-surface-neutral p-1 rounded-xl w-full">
            {(['lime', 'olive', 'neutral'] as const).map(t => (
              <button key={t} onClick={() => setForm(f => ({ ...f, tone: t }))} className={`flex-1 py-1.5 text-[14px] font-medium rounded-lg capitalize transition-all ${form.tone === t ? 'bg-canvas text-tx-primary shadow-sm' : 'text-tx-muted hover:text-tx-primary'}`}>{t}</button>
            ))}
          </div>
        </BottomSheetField>
      </BottomSheet>

      {/* Action Sheets */}
      <BottomSheet isOpen={activeActionSheet === 'task'} onClose={() => setActiveActionSheet(null)} title="New Task" onSave={handleCreateTask} saveLabel="Add Task">
        <BottomSheetField label="Task Title *"><input type="text" value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Design wireframes" /></BottomSheetField>
        <BottomSheetField label="Category">
          <select value={taskForm.categoryId} onChange={e => setTaskForm(f => ({...f, categoryId: e.target.value}))}>
            {preferences.categories.filter(c => c.scope === 'task').map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </BottomSheetField>
      </BottomSheet>

      <BottomSheet isOpen={activeActionSheet === 'event'} onClose={() => setActiveActionSheet(null)} title="Schedule Event" onSave={handleCreateEvent} saveLabel="Schedule">
        <BottomSheetField label="Title *"><input type="text" value={eventForm.title} onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Phase 1 Deadline" /></BottomSheetField>
        <div className="grid grid-cols-2 gap-4">
          <BottomSheetField label="Date"><input type="date" value={eventForm.date} onChange={e => setEventForm(f => ({ ...f, date: e.target.value }))} /></BottomSheetField>
          <BottomSheetField label="Type">
            <select value={eventForm.type} onChange={e => setEventForm(f => ({...f, type: e.target.value as any}))}>
              <option value="Deadline">Deadline</option>
              <option value="Milestone">Milestone</option>
              <option value="Meeting">Meeting</option>
              <option value="Task Block">Task Block</option>
            </select>
          </BottomSheetField>
        </div>
      </BottomSheet>

      <BottomSheet isOpen={activeActionSheet === 'library'} onClose={() => setActiveActionSheet(null)} title="Add Document" onSave={handleCreateLibrary} saveLabel="Save Document">
        <BottomSheetField label="Name *"><input type="text" value={libForm.name} onChange={e => setLibForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Figma Link" /></BottomSheetField>
        <BottomSheetField label="Link / URL"><input type="url" value={libForm.urlOrReference} onChange={e => setLibForm(f => ({ ...f, urlOrReference: e.target.value }))} placeholder="https://..." /></BottomSheetField>
      </BottomSheet>

      <BottomSheet isOpen={activeActionSheet === 'revenue'} onClose={() => setActiveActionSheet(null)} title="Add Revenue Entry" onSave={handleCreateRevenue} saveLabel="Add Revenue">
        <BottomSheetField label="Amount *"><input type="number" step="0.01" value={revForm.amount} onChange={e => setRevForm(f => ({ ...f, amount: e.target.value }))} placeholder="e.g. 5000" /></BottomSheetField>
        <div className="grid grid-cols-2 gap-4">
          <BottomSheetField label="Date"><input type="date" value={revForm.date} onChange={e => setRevForm(f => ({ ...f, date: e.target.value }))} /></BottomSheetField>
          <BottomSheetField label="Status">
            <select value={revForm.status} onChange={e => setRevForm(f => ({...f, status: e.target.value as any}))}>
              <option value="Paid">Paid</option>
              <option value="Pending">Pending</option>
              <option value="Overdue">Overdue</option>
            </select>
          </BottomSheetField>
        </div>
        <BottomSheetField label="Notes (Optional)"><input type="text" value={revForm.notes} onChange={e => setRevForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. Deposit" /></BottomSheetField>
      </BottomSheet>

      <ConfirmDialog isOpen={isDeleteOpen} onCancel={() => setIsDeleteOpen(false)} onConfirm={confirmDelete} title="Delete Project" body={`Are you sure you want to delete ${selectedProject?.name}? Linked records will remain.`} confirmLabel="Delete" />
    </div>
  );
}
