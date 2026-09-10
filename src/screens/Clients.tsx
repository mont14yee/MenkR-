import React, { useState, useMemo, useEffect } from 'react';
import {
  Users, Search, Plus, Phone, Mail, MoreVertical, X, ChevronLeft, 
  MessageSquare, PhoneCall, Video, Smartphone, StickyNote, Building2,
  Briefcase, DollarSign, Tag, Send, Check, Calendar, CheckSquare, Clock, FileText,
  FolderHeart, Activity, Calendar as CalendarIcon, File
} from 'lucide-react';
import { Header } from '../components/Shared';
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
import { Client, ClientStatus, MessageChannel, ProjectItem, TaskItem, EventItem, LibraryItem } from '../types';
import { formatCurrency, formatCurrencyCompact, getCurrencySymbol } from '../utils/currency';
import { generateId } from '../utils/id';

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
  const { tasks, addTask } = useTasks();
  const { events, addEvent } = useCalendar();
  const { library: libraryItems, addLibraryItem } = useLibrary();
  const { timeEntries } = useTimeTracker();
  const { preferences } = usePreferences();
  const { push, goToTab } = useNavigation();

  const [selectedClientId, setSelectedClientId] = useState<string | null>(initialClientId || null);
  const [filter, setFilter] = useState<'all' | ClientStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Sheet / Modals
  const [isSheetOpen, setIsSheetOpen] = useState(!!initialOpenCreate);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);

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
  
  const [projectForm, setProjectForm] = useState({ name: '', priority: 'high' as 'high' | 'low', tone: 'neutral' as any });
  const [taskForm, setTaskForm] = useState({ title: '', priority: 'Medium' as 'Low'|'Medium'|'High', categoryId: '' });
  const [eventForm, setEventForm] = useState({ title: '', date: new Date().toISOString().split('T')[0], type: 'Meeting' as any });
  const [libForm, setLibForm] = useState({ name: '', type: 'link' as 'file'|'link'|'note', category: 'Documents' as any, urlOrReference: '' });

  useEffect(() => {
    if (initialClientId) setSelectedClientId(initialClientId);
  }, [initialClientId]);
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

  const combinedActivity = useMemo(() => {
    if (!clientData) return [];
    type ActivityItem = { id: string; type: 'message'|'time'|'event'|'revenue'; date: Date; data: any };
    const items: ActivityItem[] = [];
    clientData.messages.forEach(m => items.push({ id: m.id, type: 'message', date: new Date(m.createdAt), data: m }));
    clientData.time.forEach(t => items.push({ id: t.id, type: 'time', date: new Date(t.startedAt), data: t }));
    clientData.events.filter(e => e.status === 'completed').forEach(e => items.push({ id: e.id, type: 'event', date: new Date(e.date + 'T00:00:00'), data: e }));
    clientData.revenues.forEach(r => items.push({ id: r.id, type: 'revenue', date: new Date(r.date + 'T00:00:00'), data: r }));
    return items.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [clientData]);

  const counts = useMemo(() => ({
    all: clients.length,
    lead: clients.filter(c => c.status === 'lead').length,
    active: clients.filter(c => c.status === 'active').length,
    past: clients.filter(c => c.status === 'past').length,
  }), [clients]);

  const handleSaveClient = (addAnother: boolean = false) => {
    if (!form.name.trim()) return;
    if (editingClientId) {
      updateClient(editingClientId, form);
    } else {
      addClient({ ...form, avatarSeed: generateId(), createdAt: new Date().toISOString() });
    }
    if (addAnother) {
      setForm(initialFormState);
      setEditingClientId(null);
    } else {
      setIsSheetOpen(false);
    }
  };

  const confirmDelete = () => {
    if (selectedClientId) {
      deleteClient(selectedClientId);
      setSelectedClientId(null);
    }
  };

  const handleSendMsg = () => {
    if (!msgBody.trim() || !selectedClientId) return;
    addMessage({ clientId: selectedClientId, body: msgBody.trim(), channel: msgChannel });
    setMsgBody('');
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
    if (!projectForm.name || !selectedClientId) return;
    addProject({
      ...projectForm,
      completionPct: 0,
      clientId: selectedClientId,
      status: 'active'
    });
    setActiveActionSheet(null);
    setProjectForm({ name: '', priority: 'high', tone: 'neutral' });
  };

  const handleCreateTask = () => {
    if (!taskForm.title || !taskForm.categoryId || !selectedClientId) return;
    addTask({
      ...taskForm,
      status: 'active',
      clientId: selectedClientId
    });
    setActiveActionSheet(null);
    setTaskForm({ title: '', priority: 'Medium', categoryId: taskForm.categoryId });
  };

  const handleCreateEvent = () => {
    if (!eventForm.title || !selectedClientId) return;
    const cat = preferences.categories.find(c => c.scope === 'event');
    addEvent({
      ...eventForm,
      allDay: true,
      status: 'scheduled',
      clientId: selectedClientId,
      categoryId: cat?.id || '',
      repeat: 'none'
    });
    setActiveActionSheet(null);
    setEventForm({ title: '', date: new Date().toISOString().split('T')[0], type: 'Meeting' });
  };

  const handleCreateLibrary = () => {
    if (!libForm.name || !selectedClientId) return;
    addLibraryItem({
      ...libForm,
      clientId: selectedClientId,
      tags: []
    });
    setActiveActionSheet(null);
    setLibForm({ name: '', type: 'link', category: 'Documents', urlOrReference: '' });
  };

  return (
    <div className="flex flex-col h-full bg-canvas relative pb-[88px] overflow-hidden">
      <div className={`flex-col w-full md:w-[350px] lg:w-[400px] h-full bg-canvas shrink-0 border-r border-bd-subtle ${selectedClient ? 'hidden md:flex' : 'flex'}`}>
        <Header title="Clients" rightIcon={
          <div className="flex items-center gap-1">
            <button onClick={() => setIsSearchOpen(!isSearchOpen)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-neutral text-tx-primary transition-colors">
              <Search size={20} />
            </button>
            <button onClick={() => { setForm(initialFormState); setEditingClientId(null); setIsSheetOpen(true); }} className="w-10 h-10 flex items-center justify-center rounded-full bg-tx-primary text-tx-inverse hover:opacity-90 transition-opacity" aria-label="Add client">
              <Plus size={22} />
            </button>
          </div>
        } />
        {isSearchOpen && (
          <div className="px-4 py-2">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-tx-muted" />
              <input type="text" autoFocus value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search clients..." className="w-full bg-surface-neutral rounded-xl py-2.5 pl-10 pr-10 text-[15px] outline-none" />
              {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-tx-muted p-1"><X size={16} /></button>}
            </div>
          </div>
        )}
        <div className="px-4 py-3 overflow-x-auto no-scrollbar flex gap-2">
          {(['all', 'lead', 'active', 'past'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`whitespace-nowrap px-4 py-1.5 rounded-full text-[14px] font-medium transition-colors border ${filter === f ? 'bg-tx-primary text-tx-inverse border-tx-primary' : 'bg-surface-neutral text-tx-secondary border-transparent'}`}>
              <span className="capitalize">{f}</span>
              <span className={`ml-1.5 text-[12px] ${filter === f ? 'text-tx-inverse/70' : 'text-tx-muted'}`}>{counts[f]}</span>
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-6 flex flex-col gap-3">
          {filteredClients.map(c => (
            <button key={c.id} onClick={() => { setSelectedClientId(c.id); setActiveTab('overview'); }} className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-colors text-left ${selectedClientId === c.id ? 'bg-surface-hover border-accent-primary/50' : 'bg-canvas border-bd-subtle hover:border-accent-primary/30'}`}>
              <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${c.avatarSeed}`} alt={c.name} className="w-12 h-12 rounded-full bg-surface-neutral object-cover shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-[16px] text-tx-primary truncate leading-tight">{c.name}</h3>
                {c.company && <div className="text-[14px] text-tx-muted truncate mt-0.5">{c.company}</div>}
              </div>
              <div className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase border ${STATUS_COLORS[c.status]}`}>{c.status}</div>
            </button>
          ))}
          {filteredClients.length === 0 && <div className="py-12 text-center text-tx-muted">No clients found.</div>}
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
                            setForm({
                              name: selectedClient.name, company: selectedClient.company || '',
                              email: selectedClient.email || '', phone: selectedClient.phone || '',
                              status: selectedClient.status, tags: [...(selectedClient.tags || [])], notes: selectedClient.notes || ''
                            });
                            setEditingClientId(selectedClient.id); setIsMenuOpen(false); setIsSheetOpen(true); 
                          }} className="w-full text-left px-4 py-3 text-[15px] font-medium text-tx-primary hover:bg-surface-neutral">Edit Client</button>
                        <button onClick={() => { setIsMenuOpen(false); setIsDeleteOpen(true); }} className="w-full text-left px-4 py-3 text-[15px] font-medium text-red-500 hover:bg-red-500/10">Delete Client</button>
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
                    <div className="bg-canvas border border-bd-subtle rounded-2xl p-4 flex flex-col">
                      <div className="flex items-center justify-between mb-2"><span className="text-[13px] text-tx-muted font-medium">Active Projects</span><Briefcase size={16} className="text-blue-500" /></div>
                      <span className="text-2xl font-bold text-tx-primary">{stats.activeProj}</span>
                    </div>
                    <div className="bg-canvas border border-bd-subtle rounded-2xl p-4 flex flex-col">
                      <div className="flex items-center justify-between mb-2"><span className="text-[13px] text-tx-muted font-medium">Open Tasks</span><CheckSquare size={16} className="text-orange-500" /></div>
                      <span className="text-2xl font-bold text-tx-primary">{stats.openTasks}</span>
                    </div>
                    <div className="bg-canvas border border-bd-subtle rounded-2xl p-4 flex flex-col">
                      <div className="flex items-center justify-between mb-2"><span className="text-[13px] text-tx-muted font-medium">Total Billed</span><DollarSign size={16} className="text-emerald-500" /></div>
                      <span className="text-2xl font-bold text-tx-primary">{formatCurrencyCompact(stats.totalRevenue, preferences.currency)}</span>
                    </div>
                    <div className="bg-canvas border border-bd-subtle rounded-2xl p-4 flex flex-col">
                      <div className="flex items-center justify-between mb-2"><span className="text-[13px] text-tx-muted font-medium">Upcoming Events</span><CalendarIcon size={16} className="text-purple-500" /></div>
                      <span className="text-2xl font-bold text-tx-primary">{stats.upcomingEvents}</span>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div>
                    <h3 className="text-[15px] font-bold text-tx-primary mb-3">Quick Actions</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <button onClick={() => setActiveActionSheet('project')} className="bg-canvas border border-bd-subtle hover:border-accent-primary/50 rounded-xl p-3 flex items-center gap-2 transition-colors">
                        <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0"><Briefcase size={16}/></div>
                        <span className="text-[14px] font-medium text-tx-primary">New Project</span>
                      </button>
                      <button onClick={() => setActiveActionSheet('task')} className="bg-canvas border border-bd-subtle hover:border-accent-primary/50 rounded-xl p-3 flex items-center gap-2 transition-colors">
                        <div className="w-8 h-8 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0"><CheckSquare size={16}/></div>
                        <span className="text-[14px] font-medium text-tx-primary">New Task</span>
                      </button>
                      <button onClick={() => setActiveActionSheet('event')} className="bg-canvas border border-bd-subtle hover:border-accent-primary/50 rounded-xl p-3 flex items-center gap-2 transition-colors">
                        <div className="w-8 h-8 rounded-full bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0"><CalendarIcon size={16}/></div>
                        <span className="text-[14px] font-medium text-tx-primary">Schedule</span>
                      </button>
                      <button onClick={() => setActiveActionSheet('library')} className="bg-canvas border border-bd-subtle hover:border-accent-primary/50 rounded-xl p-3 flex items-center gap-2 transition-colors">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0"><FileText size={16}/></div>
                        <span className="text-[14px] font-medium text-tx-primary">Add Doc</span>
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
                        <button onClick={handleSendMsg} disabled={!msgBody.trim()} className="w-8 h-8 rounded-full bg-tx-primary text-tx-inverse flex items-center justify-center disabled:opacity-50">
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
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-[14px] font-medium capitalize text-tx-primary">{act.type}</span>
                            <span className="text-[12px] text-tx-muted">{act.date.toLocaleDateString()}</span>
                          </div>
                          {act.type === 'message' && <p className="text-[14px] text-tx-secondary">{act.data.body}</p>}
                          {act.type === 'time' && <p className="text-[14px] text-tx-secondary">Logged {Math.round(act.data.durationSeconds/60)} mins {act.data.note && `- ${act.data.note}`}</p>}
                          {act.type === 'event' && <p className="text-[14px] text-tx-secondary">Completed: {act.data.title}</p>}
                          {act.type === 'revenue' && <p className="text-[14px] text-tx-secondary">Payment: {formatCurrency(act.data.amount, preferences.currency)}</p>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'projects' && (
                <div className="space-y-3">
                  <button onClick={() => setActiveActionSheet('project')} className="w-full flex items-center justify-center gap-2 py-3 bg-surface-neutral rounded-xl border border-dashed border-bd-subtle text-tx-primary font-medium hover:bg-surface-hover transition-colors mb-2">
                    <Plus size={18} /> New Project
                  </button>
                  {clientData.projects.length === 0 ? (
                    <div className="text-center py-8 text-tx-muted">No linked projects.</div>
                  ) : (
                    clientData.projects.map(p => (
                      <div key={p.id} onClick={() => goToTab('projects', { filterProjectId: p.id })} className="bg-canvas border border-bd-subtle rounded-xl p-4 flex justify-between items-center cursor-pointer hover:border-accent-primary/50 transition-colors">
                        <div>
                          <div className="text-[15px] font-bold text-tx-primary mb-1">{p.name}</div>
                          <div className="text-[13px] text-tx-muted uppercase tracking-wider">{p.status}</div>
                        </div>
                        <ChevronLeft size={20} className="text-tx-muted rotate-180" />
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'tasks' && (
                <div className="space-y-3">
                  <button onClick={() => setActiveActionSheet('task')} className="w-full flex items-center justify-center gap-2 py-3 bg-surface-neutral rounded-xl border border-dashed border-bd-subtle text-tx-primary font-medium hover:bg-surface-hover transition-colors mb-2">
                    <Plus size={18} /> New Task
                  </button>
                  {clientData.tasks.length === 0 ? (
                    <div className="text-center py-8 text-tx-muted">No open tasks.</div>
                  ) : (
                    clientData.tasks.map(t => (
                      <div key={t.id} className="bg-canvas border border-bd-subtle rounded-xl p-3 flex items-center gap-3">
                        <div className={`w-4 h-4 rounded border shrink-0 ${t.status === 'done' ? 'bg-emerald-500 border-emerald-500' : 'border-tx-muted'}`} />
                        <div className={`flex-1 text-[15px] font-medium ${t.status === 'done' ? 'text-tx-muted line-through' : 'text-tx-primary'}`}>{t.title}</div>
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
                  <button onClick={() => setActiveActionSheet('library')} className="w-full flex items-center justify-center gap-2 py-3 bg-surface-neutral rounded-xl border border-dashed border-bd-subtle text-tx-primary font-medium hover:bg-surface-hover transition-colors mb-2">
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
      <BottomSheet isOpen={isSheetOpen} onClose={() => setIsSheetOpen(false)} title={editingClientId ? "Edit Client" : "New Client"} onSave={() => handleSaveClient(false)} saveLabel="Save">
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
      <BottomSheet isOpen={activeActionSheet === 'project'} onClose={() => setActiveActionSheet(null)} title="New Project" onSave={handleCreateProject} saveLabel="Create Project">
        <BottomSheetField label="Project Name *"><input type="text" value={projectForm.name} onChange={e => setProjectForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Q4 Website Redesign" /></BottomSheetField>
        <BottomSheetField label="Priority">
          <div className="flex bg-surface-neutral p-1 rounded-xl">
            {(['high', 'low'] as const).map(p => (
              <button key={p} onClick={() => setProjectForm(f => ({...f, priority: p}))} className={`flex-1 py-1.5 text-[14px] font-medium rounded-lg capitalize transition-all ${projectForm.priority === p ? 'bg-canvas text-tx-primary shadow-sm' : 'text-tx-muted'}`}>{p}</button>
            ))}
          </div>
        </BottomSheetField>
      </BottomSheet>

      <BottomSheet isOpen={activeActionSheet === 'task'} onClose={() => setActiveActionSheet(null)} title="New Task" onSave={handleCreateTask} saveLabel="Add Task">
        <BottomSheetField label="Task Title *"><input type="text" value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Send proposal" /></BottomSheetField>
        <BottomSheetField label="Category">
          <select value={taskForm.categoryId} onChange={e => setTaskForm(f => ({...f, categoryId: e.target.value}))}>
            {preferences.categories.filter(c => c.scope === 'task').map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </BottomSheetField>
      </BottomSheet>

      <BottomSheet isOpen={activeActionSheet === 'event'} onClose={() => setActiveActionSheet(null)} title="Schedule Event" onSave={handleCreateEvent} saveLabel="Schedule">
        <BottomSheetField label="Title *"><input type="text" value={eventForm.title} onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Discovery Call" /></BottomSheetField>
        <BottomSheetField label="Date"><input type="date" value={eventForm.date} onChange={e => setEventForm(f => ({ ...f, date: e.target.value }))} /></BottomSheetField>
      </BottomSheet>

      <BottomSheet isOpen={activeActionSheet === 'library'} onClose={() => setActiveActionSheet(null)} title="Add Document" onSave={handleCreateLibrary} saveLabel="Save Document">
        <BottomSheetField label="Name *"><input type="text" value={libForm.name} onChange={e => setLibForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. NDA" /></BottomSheetField>
        <BottomSheetField label="Link / URL"><input type="url" value={libForm.urlOrReference} onChange={e => setLibForm(f => ({ ...f, urlOrReference: e.target.value }))} placeholder="https://..." /></BottomSheetField>
      </BottomSheet>

      <ConfirmDialog isOpen={isDeleteOpen} onCancel={() => setIsDeleteOpen(false)} onConfirm={confirmDelete} title="Delete Client" body={`Are you sure you want to delete ${selectedClient?.name}? Linked records will remain.`} confirmLabel="Delete" />
    </div>
  );
}
