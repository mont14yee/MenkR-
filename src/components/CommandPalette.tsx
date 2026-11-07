import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useCommandPalette } from '../context/CommandPaletteContext';
import { useNavigation } from '../context/NavigationContext';
import { useClients } from '../context/ClientsContext';
import { useProjects } from '../context/ProjectsContext';
import { useTasks } from '../context/TasksContext';
import { useCalendar } from '../context/CalendarContext';
import { useLibrary } from '../context/LibraryContext';
import { useTemplates } from '../context/TemplatesContext';
import { useRevenue } from '../context/RevenueContext';
import { useAIAssistant } from '../context/AIAssistantContext';
import { useAuth } from '../context/AuthContext';
import { 
  Search, Users, CheckSquare, Calendar as CalendarIcon, 
  FileText, Target, DollarSign, CornerDownLeft, Plus, FolderKanban, Sparkles,
  Layers, Shield, Loader2, ArrowRight
} from 'lucide-react';

interface ResultItem {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  metadata?: Record<string, any>;
  icon: React.ReactNode;
  onSelect: () => void;
}

type SearchCategory = 'all' | 'clients' | 'projects' | 'tasks' | 'templates' | 'library' | 'finance' | 'actions';

export function CommandPalette() {
  const { isOpen, closePalette, togglePalette } = useCommandPalette();
  const { push, goToTab, goToClient } = useNavigation();
  const { clients } = useClients();
  const { projects } = useProjects();
  const { tasks } = useTasks();
  const { events } = useCalendar();
  const { library } = useLibrary();
  const { templates } = useTemplates();
  const { revenues } = useRevenue();
  const { openAssistant } = useAIAssistant();
  const { organization, idToken, role } = useAuth();

  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<SearchCategory>('all');
  const [activeIndex, setActiveIndex] = useState(0);
  const [serverResults, setServerResults] = useState<ResultItem[]>([]);
  const [isSearchingServer, setIsSearchingServer] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Can view financial results
  const canViewFinance = role === 'owner' || role === 'admin' || role === 'manager';

  // Global keyboard shortcuts: Cmd+K / Ctrl+K and Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        togglePalette();
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        closePalette();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePalette, closePalette, isOpen]);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedCategory('all');
      setActiveIndex(0);
      setServerResults([]);
      setTimeout(() => inputRef.current?.focus(), 15);
    }
  }, [isOpen]);

  // Debounced server search across PostgreSQL organization records
  useEffect(() => {
    if (!isOpen || !query.trim() || !idToken || !organization?.id) {
      setServerResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingServer(true);
      try {
        const typeParam = selectedCategory === 'all' || selectedCategory === 'actions' ? 'all' : selectedCategory;
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(query.trim())}&type=${typeParam}&limit=20`,
          {
            headers: {
              Authorization: `Bearer ${idToken}`,
              'x-organization-id': organization.id,
            },
          }
        );

        if (res.ok) {
          const data = await res.json();
          const mapped: ResultItem[] = (data.results || []).map((r: any) => {
            let icon: React.ReactNode = <Layers size={15} className="text-tx-secondary" />;
            let onSelect = () => closePalette();

            if (r.type === 'client') {
              icon = <Users size={15} className="text-blue-500" />;
              onSelect = () => { goToClient(r.id); closePalette(); };
            } else if (r.type === 'project') {
              icon = <FolderKanban size={15} className="text-indigo-500" />;
              onSelect = () => { goToTab('projects', { projectId: r.id }); closePalette(); };
            } else if (r.type === 'task') {
              icon = <CheckSquare size={15} className="text-amber-500" />;
              onSelect = () => { push('tasks'); closePalette(); };
            } else if (r.type === 'template') {
              icon = <Target size={15} className="text-emerald-500" />;
              onSelect = () => { push('templates'); closePalette(); };
            } else if (r.type === 'library') {
              icon = <FileText size={15} className="text-sky-500" />;
              onSelect = () => { push('library'); closePalette(); };
            } else if (r.type === 'finance') {
              icon = <DollarSign size={15} className="text-emerald-600" />;
              onSelect = () => { push('finance'); closePalette(); };
            }

            return {
              id: `srv-${r.type}-${r.id}`,
              type: r.type.charAt(0).toUpperCase() + r.type.slice(1),
              title: r.title,
              subtitle: r.subtitle,
              metadata: r.metadata,
              icon,
              onSelect,
            };
          });
          setServerResults(mapped);
        }
      } catch (err) {
        console.error('Server search failed, falling back to local dataset:', err);
      } finally {
        setIsSearchingServer(false);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [query, selectedCategory, isOpen, idToken, organization?.id, goToClient, goToTab, push, closePalette]);

  // Local dataset search results
  const localResults = useMemo(() => {
    const items: ResultItem[] = [];
    const q = query.toLowerCase().trim();

    const addActions = () => {
      if (selectedCategory === 'all' || selectedCategory === 'actions') {
        items.push({
          id: 'action-ai-assistant',
          type: 'AI Workflow',
          title: 'AI Productivity Assistant',
          subtitle: 'Summaries, task breakdowns, meeting notes, risk analysis',
          icon: <Sparkles size={15} className="text-accent-primary" />,
          onSelect: () => { openAssistant(); closePalette(); }
        });
        items.push({
          id: 'action-new-task',
          type: 'Action',
          title: 'Create New Task',
          subtitle: 'Quickly draft a deliverable with deadline and priority',
          icon: <Plus size={15} className="text-amber-500" />,
          onSelect: () => { push('tasks'); closePalette(); }
        });
        items.push({
          id: 'action-new-project',
          type: 'Action',
          title: 'Create New Project',
          subtitle: 'Initialize project roadmap and assign client',
          icon: <Plus size={15} className="text-blue-500" />,
          onSelect: () => { goToTab('projects', { openCreate: true }); closePalette(); }
        });
        items.push({
          id: 'action-schedule',
          type: 'Action',
          title: 'Schedule Calendar Event',
          subtitle: 'Plan a milestone, meeting or deliverable deadline',
          icon: <CalendarIcon size={15} className="text-purple-500" />,
          onSelect: () => { push('calendar'); closePalette(); }
        });
        items.push({
          id: 'action-use-template',
          type: 'Action',
          title: 'Apply Standard Template',
          subtitle: 'Instantiate pre-configured project and task workflow',
          icon: <Target size={15} className="text-emerald-500" />,
          onSelect: () => { push('templates'); closePalette(); }
        });
        items.push({
          id: 'action-open-library',
          type: 'Action',
          title: 'Browse Library & Documents',
          subtitle: 'Access files, contracts, and references',
          icon: <FileText size={15} className="text-sky-500" />,
          onSelect: () => { push('library'); closePalette(); }
        });
      }
    };

    if (!q) {
      addActions();
      return items;
    }

    // Actions filter matching query
    if (selectedCategory === 'all' || selectedCategory === 'actions') {
      if ('ai assistant summary breakdown gemini risks notes'.includes(q)) {
        items.push({
          id: 'action-ai-assistant',
          type: 'AI Workflow',
          title: 'AI Productivity Assistant',
          subtitle: 'Summaries, task breakdowns, meeting notes, risk analysis',
          icon: <Sparkles size={15} className="text-accent-primary" />,
          onSelect: () => { openAssistant(); closePalette(); }
        });
      }
      if ('create task new task todo deliverable'.includes(q)) {
        items.push({
          id: 'action-new-task',
          type: 'Action',
          title: 'Create New Task',
          subtitle: 'Open task creation panel',
          icon: <Plus size={15} className="text-amber-500" />,
          onSelect: () => { push('tasks'); closePalette(); }
        });
      }
      if ('create project new project roadmap initiative'.includes(q)) {
        items.push({
          id: 'action-new-project',
          type: 'Action',
          title: 'Create New Project',
          subtitle: 'Open project creation modal',
          icon: <Plus size={15} className="text-blue-500" />,
          onSelect: () => { goToTab('projects', { openCreate: true }); closePalette(); }
        });
      }
    }

    // Clients
    if (selectedCategory === 'all' || selectedCategory === 'clients') {
      clients
        .filter(c => 
          c.name.toLowerCase().includes(q) || 
          c.company?.toLowerCase().includes(q) || 
          c.email?.toLowerCase().includes(q) ||
          c.notes?.toLowerCase().includes(q)
        )
        .forEach(c => {
          items.push({
            id: `client-${c.id}`,
            type: 'Client',
            title: c.name,
            subtitle: c.company ? `${c.company} • ${c.status || 'Active'}` : (c.email || c.status || 'Active Client'),
            metadata: { status: c.status },
            icon: <Users size={15} className="text-blue-500" />,
            onSelect: () => { goToClient(c.id); closePalette(); }
          });
        });
    }

    // Projects
    if (selectedCategory === 'all' || selectedCategory === 'projects') {
      projects
        .filter(p => 
          p.name.toLowerCase().includes(q) || 
          p.status?.toLowerCase().includes(q) ||
          p.priority?.toLowerCase().includes(q) ||
          p.notes?.toLowerCase().includes(q)
        )
        .forEach(p => {
          items.push({
            id: `project-${p.id}`,
            type: 'Project',
            title: p.name,
            subtitle: `Project • ${p.status || 'active'} • ${p.completionPct || 0}% complete`,
            metadata: { status: p.status, priority: p.priority },
            icon: <FolderKanban size={15} className="text-indigo-500" />,
            onSelect: () => { goToTab('projects', { projectId: p.id }); closePalette(); }
          });
        });
    }

    // Tasks
    if (selectedCategory === 'all' || selectedCategory === 'tasks') {
      tasks
        .filter(t => 
          t.title.toLowerCase().includes(q) || 
          t.assigneeName?.toLowerCase().includes(q) ||
          t.notes?.toLowerCase().includes(q)
        )
        .forEach(t => {
          items.push({
            id: `task-${t.id}`,
            type: 'Task',
            title: t.title,
            subtitle: `Task • ${t.status || 'active'}${t.assigneeName ? ` • ${t.assigneeName}` : ''}`,
            metadata: { status: t.status, priority: t.priority },
            icon: <CheckSquare size={15} className="text-amber-500" />,
            onSelect: () => { push('tasks'); closePalette(); }
          });
        });
    }

    // Events / Schedule
    if (selectedCategory === 'all') {
      events
        .filter(e => e.title.toLowerCase().includes(q) || e.notes?.toLowerCase().includes(q))
        .forEach(e => {
          items.push({
            id: `event-${e.id}`,
            type: 'Schedule',
            title: e.title,
            subtitle: `Event • ${e.date}${e.startTime ? ` at ${e.startTime}` : ''}`,
            icon: <CalendarIcon size={15} className="text-purple-500" />,
            onSelect: () => { push('calendar'); closePalette(); }
          });
        });
    }

    // Templates
    if (selectedCategory === 'all' || selectedCategory === 'templates') {
      templates
        .filter(t => t.name.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q))
        .forEach(t => {
          items.push({
            id: `template-${t.id}`,
            type: 'Template',
            title: t.name,
            subtitle: `Template • ${t.type || 'Workflow starter'}`,
            icon: <Target size={15} className="text-emerald-500" />,
            onSelect: () => { push('templates'); closePalette(); }
          });
        });
    }

    // Library Documents
    if (selectedCategory === 'all' || selectedCategory === 'library') {
      library
        .filter(l => l.name.toLowerCase().includes(q) || l.category?.toLowerCase().includes(q) || l.tags?.some(tag => tag.toLowerCase().includes(q)))
        .forEach(l => {
          items.push({
            id: `library-${l.id}`,
            type: 'Library',
            title: l.name,
            subtitle: `Document • ${l.category || 'General'} • ${l.type}`,
            icon: <FileText size={15} className="text-sky-500" />,
            onSelect: () => { push('library'); closePalette(); }
          });
        });
    }

    // Financial Records (Only if authorized role)
    if ((selectedCategory === 'all' || selectedCategory === 'finance') && canViewFinance) {
      revenues
        .filter(r => 
          r.clientOrProject?.toLowerCase().includes(q) || 
          r.category?.toLowerCase().includes(q) || 
          r.notes?.toLowerCase().includes(q) ||
          String(r.amount).includes(q)
        )
        .forEach(r => {
          items.push({
            id: `revenue-${r.id}`,
            type: 'Finance',
            title: `${r.type === 'income' ? '+' : '-'}$${Number(r.amount).toFixed(2)} (${r.category})`,
            subtitle: `Finance • ${r.clientOrProject || 'General'} • ${r.status}`,
            metadata: { status: r.status, amount: r.amount },
            icon: <DollarSign size={15} className="text-emerald-600" />,
            onSelect: () => { push('finance'); closePalette(); }
          });
        });
    }

    return items;
  }, [
    query, 
    selectedCategory, 
    clients, 
    projects, 
    tasks, 
    events, 
    library, 
    templates, 
    revenues, 
    canViewFinance, 
    push, 
    goToTab, 
    goToClient, 
    openAssistant, 
    closePalette
  ]);

  // Combine and deduplicate local + server results
  const results = useMemo(() => {
    const combined = [...localResults];
    const seenTitles = new Set(localResults.map(r => `${r.type.toLowerCase()}:${r.title.toLowerCase()}`));

    for (const srv of serverResults) {
      const key = `${srv.type.toLowerCase()}:${srv.title.toLowerCase()}`;
      if (!seenTitles.has(key)) {
        seenTitles.add(key);
        combined.push(srv);
      }
    }

    return combined;
  }, [localResults, serverResults]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, selectedCategory]);

  // Auto-scroll active item into viewport
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector('[data-active="true"]') as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [activeIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev > 0 ? prev - 1 : Math.max(0, results.length - 1)));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[activeIndex]) {
        results[activeIndex].onSelect();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closePalette();
    }
  };

  if (!isOpen) return null;

  // Group items by category type
  const groupedResults = results.reduce((acc, item) => {
    if (!acc[item.type]) acc[item.type] = [];
    acc[item.type].push(item);
    return acc;
  }, {} as Record<string, ResultItem[]>);

  const categories: { id: SearchCategory; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'clients', label: 'Clients' },
    { id: 'projects', label: 'Projects' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'templates', label: 'Templates' },
    { id: 'library', label: 'Library' },
    ...(canViewFinance ? [{ id: 'finance' as SearchCategory, label: 'Finance' }] : []),
    { id: 'actions', label: 'Actions' },
  ];

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/50 z-[100] backdrop-blur-sm transition-opacity" 
        onClick={closePalette} 
        aria-hidden="true" 
      />
      <div 
        className="fixed top-[8%] md:top-[15%] left-1/2 -translate-x-1/2 w-full max-w-2xl bg-canvas rounded-2xl shadow-2xl z-[101] overflow-hidden flex flex-col max-h-[75vh] border border-bd-subtle animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-label="Unified Search and Command Palette"
      >
        {/* Search Header */}
        <div className="flex items-center px-4 py-3.5 border-b border-bd-subtle gap-3 bg-surface-neutral/30">
          <Search size={18} className="text-tx-muted shrink-0" />
          <input 
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={organization ? `Search in ${organization.name} (clients, projects, tasks, library)...` : "Search records or type a command..."}
            className="flex-1 bg-transparent border-none outline-none text-[15px] text-tx-primary placeholder:text-tx-muted"
          />
          {isSearchingServer && (
            <Loader2 size={16} className="text-tx-muted animate-spin shrink-0" />
          )}
          <div className="hidden md:flex items-center gap-1.5 text-[11px] text-tx-muted font-mono bg-canvas px-2 py-1 rounded border border-bd-subtle">
            <span>ESC</span>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-1 px-3 py-2 border-b border-bd-subtle bg-canvas overflow-x-auto no-scrollbar">
          {categories.map(cat => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-2.5 py-1 text-[12px] font-medium rounded-lg transition-colors whitespace-nowrap ${
                  isSelected
                    ? 'bg-tx-primary text-tx-inverse'
                    : 'text-tx-muted hover:text-tx-primary hover:bg-surface-neutral'
                }`}
              >
                {cat.label}
              </button>
            );
          })}

          {organization && (
            <span className="ml-auto text-[11px] text-tx-muted flex items-center gap-1 pl-2 shrink-0">
              <Shield size={12} className="text-emerald-500" />
              <span>Org Isolated</span>
            </span>
          )}
        </div>

        {/* Results List */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-2 no-scrollbar divide-y divide-bd-subtle/50">
          {results.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <Search size={28} className="mx-auto text-tx-muted/60 mb-2" />
              <div className="text-[14px] font-medium text-tx-primary">
                {query ? `No matching records found for "${query}"` : 'Type to search across company records'}
              </div>
              <p className="text-[12px] text-tx-muted mt-1 max-w-sm mx-auto">
                {query 
                  ? 'Check your query spelling or try searching within a different category.' 
                  : 'Instant unified search across authorized clients, project files, tasks, milestones, and shared library resources.'}
              </p>
            </div>
          ) : (
            Object.entries(groupedResults).map(([type, items]) => (
              <div key={type} className="py-1.5 first:pt-0 last:pb-0">
                <div className="px-3 py-1.5 text-[11px] font-semibold text-tx-muted uppercase tracking-wider">
                  {type} ({items.length})
                </div>
                <div className="flex flex-col gap-0.5">
                  {items.map((item) => {
                    const globalIndex = results.findIndex(r => r.id === item.id);
                    const isActive = globalIndex === activeIndex;
                    
                    return (
                      <button
                        key={item.id}
                        data-active={isActive}
                        onClick={item.onSelect}
                        onMouseEnter={() => setActiveIndex(globalIndex)}
                        className={`w-full text-left flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors ${
                          isActive 
                            ? 'bg-accent-primary/10 text-tx-primary' 
                            : 'hover:bg-surface-neutral/80 text-tx-primary'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                            isActive ? 'bg-canvas border-accent-primary/30' : 'bg-surface-neutral border-bd-subtle'
                          }`}>
                            {item.icon}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className={`text-[14px] font-medium leading-snug truncate ${
                                isActive ? 'text-accent-primary font-semibold' : 'text-tx-primary'
                              }`}>
                                {item.title}
                              </span>
                              {item.metadata?.status && (
                                <span className="text-[11px] text-tx-muted font-normal capitalize">
                                  • {item.metadata.status}
                                </span>
                              )}
                            </div>
                            {item.subtitle && (
                              <div className="text-[12px] text-tx-muted mt-0.5 truncate">
                                {item.subtitle}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-1 text-tx-muted pl-2">
                          {isActive ? (
                            <CornerDownLeft size={14} className="text-accent-primary" />
                          ) : (
                            <ArrowRight size={13} className="opacity-0 group-hover:opacity-100" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 border-t border-bd-subtle bg-surface-neutral/30 flex items-center justify-between text-[11px] text-tx-muted">
          <div className="flex items-center gap-3">
            <span><kbd className="font-mono bg-canvas px-1 py-0.5 rounded border border-bd-subtle">↑↓</kbd> Navigate</span>
            <span><kbd className="font-mono bg-canvas px-1 py-0.5 rounded border border-bd-subtle">↵</kbd> Select</span>
            <span><kbd className="font-mono bg-canvas px-1 py-0.5 rounded border border-bd-subtle">Esc</kbd> Dismiss</span>
          </div>
          <span>MenkR Unified Hub</span>
        </div>
      </div>
    </>
  );
}
