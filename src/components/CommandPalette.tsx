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
import { 
  Search, Users, Briefcase, CheckSquare, Calendar as CalendarIcon, 
  FileText, Target, DollarSign, CornerDownLeft, Plus, FolderKanban
} from 'lucide-react';

interface ResultItem {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  onSelect: () => void;
}

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

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        togglePalette();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePalette]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  const results = useMemo(() => {
    const items: ResultItem[] = [];
    const q = query.toLowerCase().trim();

    const addActions = () => {
      items.push({
        id: 'action-new-task', type: 'Action', title: 'Create Task', icon: <Plus size={16} className="text-orange-500" />,
        onSelect: () => { push('tasks'); closePalette(); }
      });
      items.push({
        id: 'action-new-project', type: 'Action', title: 'Create Project', icon: <Plus size={16} className="text-blue-500" />,
        onSelect: () => { goToTab('projects', { openCreate: true }); closePalette(); }
      });
      items.push({
        id: 'action-schedule', type: 'Action', title: 'Schedule Event', icon: <Plus size={16} className="text-purple-500" />,
        onSelect: () => { push('calendar'); closePalette(); }
      });
      items.push({
        id: 'action-use-template', type: 'Action', title: 'Use Template', icon: <Target size={16} className="text-emerald-500" />,
        onSelect: () => { push('templates'); closePalette(); }
      });
      items.push({
        id: 'action-open-library', type: 'Action', title: 'Open Library', icon: <FileText size={16} className="text-tx-secondary" />,
        onSelect: () => { push('library'); closePalette(); }
      });
    };

    if (!q) {
      addActions();
    } else {
      // Actions matching search
      if ('create task'.includes(q) || 'new task'.includes(q)) items.push({ id: 'action-new-task', type: 'Action', title: 'Create Task', icon: <Plus size={16} className="text-orange-500" />, onSelect: () => { push('tasks'); closePalette(); } });
      if ('create project'.includes(q) || 'new project'.includes(q)) items.push({ id: 'action-new-project', type: 'Action', title: 'Create Project', icon: <Plus size={16} className="text-blue-500" />, onSelect: () => { goToTab('projects', { openCreate: true }); closePalette(); } });
      if ('schedule event'.includes(q) || 'new event'.includes(q)) items.push({ id: 'action-schedule', type: 'Action', title: 'Schedule Event', icon: <Plus size={16} className="text-purple-500" />, onSelect: () => { push('calendar'); closePalette(); } });
      if ('use template'.includes(q)) items.push({ id: 'action-use-template', type: 'Action', title: 'Use Template', icon: <Target size={16} className="text-emerald-500" />, onSelect: () => { push('templates'); closePalette(); } });
      
      // Clients
      clients.filter(c => c.name.toLowerCase().includes(q) || c.company?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q)).forEach(c => {
        items.push({ id: `client-${c.id}`, type: 'Client', title: c.name, subtitle: c.company, icon: <Users size={16} className="text-blue-500" />, onSelect: () => { goToClient(c.id); closePalette(); } });
      });

      // Projects
      projects.filter(p => p.name.toLowerCase().includes(q) || p.status?.toLowerCase().includes(q)).forEach(p => {
        items.push({ id: `project-${p.id}`, type: 'Project', title: p.name, subtitle: p.status, icon: <FolderKanban size={16} className="text-tx-secondary" />, onSelect: () => { goToTab('projects', { projectId: p.id }); closePalette(); } });
      });

      // Tasks
      tasks.filter(t => t.title.toLowerCase().includes(q)).forEach(t => {
        items.push({ id: `task-${t.id}`, type: 'Task', title: t.title, subtitle: t.status, icon: <CheckSquare size={16} className="text-orange-500" />, onSelect: () => { push('tasks'); closePalette(); } });
      });

      // Events
      events.filter(e => e.title.toLowerCase().includes(q)).forEach(e => {
        items.push({ id: `event-${e.id}`, type: 'Schedule', title: e.title, subtitle: e.date, icon: <CalendarIcon size={16} className="text-purple-500" />, onSelect: () => { push('calendar'); closePalette(); } });
      });

      // Library
      library.filter(l => l.name.toLowerCase().includes(q)).forEach(l => {
        items.push({ id: `library-${l.id}`, type: 'Library', title: l.name, subtitle: l.category, icon: <FileText size={16} className="text-tx-secondary" />, onSelect: () => { push('library'); closePalette(); } });
      });
      
      // Templates
      templates.filter(t => t.name.toLowerCase().includes(q)).forEach(t => {
        items.push({ id: `template-${t.id}`, type: 'Template', title: t.name, subtitle: 'Template', icon: <Target size={16} className="text-emerald-500" />, onSelect: () => { push('templates'); closePalette(); } });
      });
      
      // Finance
      revenues.filter(r => r.notes?.toLowerCase().includes(q)).forEach(r => {
        items.push({ id: `revenue-${r.id}`, type: 'Finance', title: `Finance Entry - ${r.amount}`, subtitle: r.status, icon: <DollarSign size={16} className="text-emerald-600" />, onSelect: () => { push('finance'); closePalette(); } });
      });
    }

    return items;
  }, [query, clients, projects, tasks, events, library, templates, revenues, push, goToTab, goToClient, closePalette]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Scroll active item into view
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
      setActiveIndex(prev => (prev > 0 ? prev - 1 : results.length - 1));
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

  // Group results for display
  const groupedResults = results.reduce((acc, item) => {
    if (!acc[item.type]) acc[item.type] = [];
    acc[item.type].push(item);
    return acc;
  }, {} as Record<string, ResultItem[]>);

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[100] backdrop-blur-sm" onClick={closePalette} aria-hidden="true" />
      <div 
        className="fixed top-[10%] md:top-[20%] left-1/2 -translate-x-1/2 w-full max-w-2xl bg-canvas rounded-2xl shadow-2xl z-[101] overflow-hidden flex flex-col max-h-[70vh] border border-bd-subtle"
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
      >
        
        <div className="flex items-center px-4 py-4 border-b border-bd-subtle gap-3">
          <Search size={20} className="text-tx-muted shrink-0" />
          <input 
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search or type a command..."
            className="flex-1 bg-transparent border-none outline-none text-[16px] text-tx-primary placeholder:text-tx-muted"
          />
          <div className="hidden md:flex items-center gap-1 text-[12px] text-tx-muted font-medium bg-surface-neutral px-2 py-1 rounded">
            <span>ESC</span>
          </div>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto p-2 no-scrollbar">
          {results.length === 0 ? (
            <div className="p-8 text-center text-tx-muted text-[14px]">
              No results found for "{query}"
            </div>
          ) : (
            Object.entries(groupedResults).map(([type, items], groupIndex) => (
              <div key={type} className="mb-2 last:mb-0">
                <div className="px-3 py-2 text-[12px] font-bold text-tx-muted uppercase tracking-wider">
                  {type}
                </div>
                <div className="flex flex-col gap-1">
                  {items.map((item) => {
                    const globalIndex = results.findIndex(r => r.id === item.id);
                    const isActive = globalIndex === activeIndex;
                    
                    return (
                      <button
                        key={item.id}
                        data-active={isActive}
                        onClick={item.onSelect}
                        onMouseEnter={() => setActiveIndex(globalIndex)}
                        className={`w-full text-left flex items-center justify-between px-3 py-3 rounded-xl transition-colors ${
                          isActive ? 'bg-accent-primary/10' : 'hover:bg-surface-neutral'
                        }`}
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isActive ? 'bg-canvas shadow-sm' : 'bg-surface-neutral'}`}>
                            {item.icon}
                          </div>
                          <div className="overflow-hidden">
                            <div className={`text-[14px] font-medium leading-tight truncate ${isActive ? 'text-accent-primary' : 'text-tx-primary'}`}>
                              {item.title}
                            </div>
                            {item.subtitle && (
                              <div className="text-[12px] text-tx-muted mt-0.5 truncate">
                                {item.subtitle}
                              </div>
                            )}
                          </div>
                        </div>
                        {isActive && (
                          <div className="shrink-0 text-accent-primary hidden md:block">
                            <CornerDownLeft size={16} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
