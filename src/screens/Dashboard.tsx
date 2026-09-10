import { useState, useMemo } from 'react';
import { 
  Search, Bell, Plus, Briefcase, Users, Calendar, AlertCircle, 
  CheckSquare, Clock, DollarSign, Target, FileText, ChevronRight, X, UserPlus, Play, Activity
} from 'lucide-react';
import { Header } from '../components/Shared';
import { BottomSheet, BottomSheetField } from '../components/BottomSheet';
import { PushedScreenState } from '../types';
import { useTasks } from '../context/TasksContext';
import { useRevenue } from '../context/RevenueContext';
import { useCalendar } from '../context/CalendarContext';
import { useProfile } from '../context/ProfileContext';
import { usePreferences } from '../context/PreferencesContext';
import { useClients } from '../context/ClientsContext';
import { useProjects } from '../context/ProjectsContext';
import { useTimeTracker } from '../context/TimeTrackerContext';
import { formatCurrencyCompact, formatCurrency } from '../utils/currency';
import { getTodayDateStr } from '../utils/date';
import { useNavigation } from '../context/NavigationContext';
import { useCommandPalette } from '../context/CommandPaletteContext';

export function Dashboard({ onPush: _onPush }: { onPush: (screen: PushedScreenState) => void }) {
  const { profile } = useProfile();
  const { name } = profile;
  const { preferences } = usePreferences();
  const { tasks } = useTasks();
  const { revenues } = useRevenue();
  const { events } = useCalendar();
  const { clients } = useClients();
  const { projects } = useProjects();
  const { timeEntries, startTimer, timerState } = useTimeTracker();
  const { goToTab, goToClient, push } = useNavigation();
  const { openPalette } = useCommandPalette();

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);


  const todayDateStr = getTodayDateStr();

  // Calculations for Command Center Sections
  
  // 1. TODAY
  const todayTasks = useMemo(() => tasks.filter(t => t.date && t.date.startsWith(todayDateStr) && t.status !== 'done'), [tasks, todayDateStr]);
  const todayEvents = useMemo(() => events.filter(e => e.date === todayDateStr).sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '')), [events, todayDateStr]);
  const todayDeadlines = useMemo(() => events.filter(e => e.date === todayDateStr && (e.type === 'Deadline' || e.type === 'Milestone')), [events, todayDateStr]);
  const todayFocusTime = useMemo(() => {
    const todayEntries = timeEntries.filter(t => new Date(t.startedAt).toISOString().startsWith(todayDateStr));
    const totalSecs = todayEntries.reduce((sum, t) => sum + t.durationSeconds, 0);
    return Math.round(totalSecs / 60); // minutes
  }, [timeEntries, todayDateStr]);

  // 2. BUSINESS
  const businessStats = useMemo(() => {
    const activeProjs = projects.filter(p => p.status === 'active');
    const openLeads = clients.filter(c => c.status === 'lead');
    
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const thisMonthRevenue = revenues.reduce((sum, r) => {
      if (!r.date) return sum;
      const [y, mStr] = r.date.split('-');
      if (parseInt(mStr, 10) - 1 === currentMonth && parseInt(y, 10) === currentYear && r.status === 'Paid') {
        return sum + r.amount;
      }
      return sum;
    }, 0);

    const outstandingWork = tasks.filter(t => t.status !== 'done').length;

    return {
      activeProjects: activeProjs.length,
      leads: openLeads.length,
      revenue: thisMonthRevenue,
      outstandingWork
    };
  }, [projects, clients, revenues, tasks]);

  // 3. PRODUCTIVITY
  const productivityStats = useMemo(() => {
    const completedTasks = tasks.filter(t => t.status === 'done').length;
    
    const totalTimeSecs = timeEntries.reduce((sum, t) => sum + t.durationSeconds, 0);
    const totalTimeHrs = (totalTimeSecs / 3600).toFixed(1);

    const upcomingDeadlines = events.filter(e => e.date >= todayDateStr && (e.type === 'Deadline' || e.type === 'Milestone')).length;

    return {
      completedTasks,
      trackedTime: totalTimeHrs,
      upcomingDeadlines
    };
  }, [tasks, timeEntries, events, todayDateStr]);

  // 4. UPCOMING
  const upcomingSchedule = useMemo(() => {
    const futureEvents = events.filter(e => e.date > todayDateStr).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return {
      meetings: futureEvents.filter(e => e.type === 'Meeting').slice(0, 3),
      taskBlocks: futureEvents.filter(e => e.type === 'Task Block').slice(0, 3),
      milestones: futureEvents.filter(e => e.type === 'Milestone' || e.type === 'Deadline').slice(0, 3)
    };
  }, [events, todayDateStr]);


  // Notifications
  const notifications = useMemo(() => {
    const notifs = [];
    todayTasks.forEach(t => notifs.push({ id: `ts-${t.id}`, type: 'task', title: 'Task Due Today', subtitle: t.title }));
    todayEvents.forEach(e => notifs.push({ id: `ev-${e.id}`, type: 'event', title: 'Event Today', subtitle: `${e.startTime || 'All Day'} - ${e.title}` }));
    
    revenues.filter(r => r.status === 'Overdue' || (r.status === 'Pending' && r.date && r.date <= todayDateStr)).forEach(r => {
      notifs.push({ 
        id: `rev-${r.id}`, type: 'revenue', 
        title: r.status === 'Overdue' ? 'Overdue Invoice' : 'Invoice Due Soon', 
        subtitle: `${formatCurrency(r.amount, preferences.currency)}` 
      });
    });
    return notifs;
  }, [todayTasks, todayEvents, revenues, todayDateStr, preferences.currency]);


  const handleQuickAction = (action: string) => {
    setIsQuickActionsOpen(false);
    switch(action) {
      case 'client': goToTab('clients', { openCreate: true }); break;
      case 'project': goToTab('projects', { openCreate: true }); break;
      case 'task': push('tasks'); break; // Assumes tasks screen has quick add
      case 'schedule': push('calendar'); break;
      case 'template': push('templates'); break;
      case 'library': push('library'); break;
    }
  };

  return (
    <div className="flex flex-col h-full bg-canvas relative pb-[88px] overflow-hidden">
      <Header 
        title={<span className="text-xl md:text-2xl font-bold bg-gradient-to-r from-tx-primary to-tx-secondary bg-clip-text text-transparent tracking-tight">Command Center</span>}
        rightIcon={
          <div className="flex items-center gap-1 md:gap-2">
            <button onClick={openPalette} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-neutral text-tx-primary transition-colors">
              <Search size={20} />
            </button>
            <div className="relative">
              <button onClick={() => setIsNotificationsOpen(!isNotificationsOpen)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-neutral text-tx-primary transition-colors">
                <Bell size={20} />
                {notifications.length > 0 && <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-red-500 border-2 border-canvas" />}
              </button>
              
              {isNotificationsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsNotificationsOpen(false)} />
                  <div className="absolute top-full right-0 mt-2 w-[320px] max-h-[400px] overflow-y-auto bg-canvas border border-bd-subtle shadow-xl rounded-2xl z-50 p-2 no-scrollbar">
                    <h3 className="px-3 py-2 text-[14px] font-bold text-tx-primary tracking-wide">Notifications</h3>
                    {notifications.length === 0 ? (
                      <div className="px-3 py-6 text-center text-[14px] text-tx-muted">All caught up!</div>
                    ) : (
                      <div className="flex flex-col gap-1 mt-1">
                        {notifications.map(n => (
                          <div key={n.id} className="p-3 rounded-xl hover:bg-surface-neutral flex items-start gap-3 transition-colors cursor-default">
                            <div className="w-8 h-8 rounded-full bg-surface-neutral flex items-center justify-center shrink-0 mt-0.5">
                              {n.type === 'task' && <CheckSquare size={14} className="text-orange-500"/>}
                              {n.type === 'event' && <Calendar size={14} className="text-purple-500"/>}
                              {n.type === 'revenue' && <DollarSign size={14} className="text-emerald-500"/>}
                            </div>
                            <div>
                              <div className="text-[14px] font-medium text-tx-primary leading-tight">{n.title}</div>
                              <div className="text-[13px] text-tx-secondary mt-0.5">{n.subtitle}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            <button onClick={() => setIsQuickActionsOpen(true)} className="w-10 h-10 flex items-center justify-center rounded-full bg-tx-primary text-tx-inverse hover:opacity-90 transition-opacity ml-1 shadow-sm">
              <Plus size={22} />
            </button>
          </div>
        } 
      />

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 md:px-6 py-6 space-y-10 md:space-y-12 max-w-7xl mx-auto w-full">
        
        {/* Welcome Section */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-medium text-tx-primary leading-tight">Good morning, {name.split(' ')[0]}</h1>
            <p className="text-tx-secondary mt-1">Here is your command center for today.</p>
          </div>
          <div className="hidden md:flex items-center gap-3">
             <button onClick={() => push('time-tracker')} className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-colors ${timerState === 'running' ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20' : 'bg-surface-neutral text-tx-primary hover:bg-surface-hover'}`}>
               <Clock size={18} className={timerState === 'running' ? 'animate-pulse' : ''} />
               <span>{timerState === 'running' ? 'Tracking Time' : 'Time Tracker'}</span>
             </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Main Column */}
          <div className="lg:col-span-8 space-y-10">
            
            {/* TODAY SECTION */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[18px] font-bold text-tx-primary flex items-center gap-2">
                  <Target size={20} className="text-orange-500" /> Today's Focus
                </h2>
                <span className="text-[13px] font-medium text-tx-muted">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric'})}</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-canvas border border-bd-subtle rounded-2xl p-5 shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-[15px] font-bold text-tx-primary">Agenda</h3>
                    <button onClick={() => push('calendar')} className="text-tx-muted hover:text-tx-primary"><ChevronRight size={18}/></button>
                  </div>
                  <div className="space-y-3">
                    {todayEvents.length === 0 ? (
                      <p className="text-[14px] text-tx-muted">No events scheduled today.</p>
                    ) : (
                      todayEvents.slice(0, 4).map(e => (
                        <div key={e.id} className="flex gap-3 items-start group">
                          <div className="w-12 text-[12px] font-medium text-tx-muted text-right shrink-0 mt-0.5">{e.startTime || 'All'}</div>
                          <div className={`flex-1 px-3 py-2 rounded-xl text-[14px] font-medium border-l-2 ${e.type === 'Meeting' ? 'bg-blue-500/5 border-blue-500 text-blue-700' : e.type === 'Deadline' ? 'bg-orange-500/5 border-orange-500 text-orange-700' : 'bg-surface-neutral border-tx-muted text-tx-primary'}`}>
                            {e.title}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="bg-canvas border border-bd-subtle rounded-2xl p-5 shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-[15px] font-bold text-tx-primary">Open Tasks</h3>
                    <button onClick={() => push('tasks')} className="text-tx-muted hover:text-tx-primary"><ChevronRight size={18}/></button>
                  </div>
                  <div className="space-y-3">
                    {todayTasks.length === 0 ? (
                      <p className="text-[14px] text-tx-muted">All caught up for today.</p>
                    ) : (
                      todayTasks.slice(0, 4).map(t => (
                        <div key={t.id} className="flex gap-3 items-center">
                           <div className="w-5 h-5 rounded border border-bd-subtle shrink-0" />
                           <div className="text-[14px] text-tx-primary font-medium truncate">{t.title}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* UPCOMING SECTION */}
            <section>
              <h2 className="text-[18px] font-bold text-tx-primary flex items-center gap-2 mb-4">
                <Calendar size={20} className="text-purple-500" /> Looking Ahead
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-canvas border border-bd-subtle rounded-xl p-4">
                  <h3 className="text-[12px] font-bold text-tx-muted uppercase tracking-wider mb-3">Meetings</h3>
                  <div className="space-y-2">
                    {upcomingSchedule.meetings.length === 0 ? <span className="text-sm text-tx-muted">None scheduled</span> : 
                      upcomingSchedule.meetings.map(m => (
                        <div key={m.id} className="text-[14px]">
                          <div className="font-medium text-tx-primary truncate">{m.title}</div>
                          <div className="text-[12px] text-tx-muted">{new Date(m.date + 'T00:00:00').toLocaleDateString(undefined, {month:'short', day:'numeric'})}</div>
                        </div>
                      ))
                    }
                  </div>
                </div>

                <div className="bg-canvas border border-bd-subtle rounded-xl p-4">
                  <h3 className="text-[12px] font-bold text-tx-muted uppercase tracking-wider mb-3">Milestones</h3>
                  <div className="space-y-2">
                    {upcomingSchedule.milestones.length === 0 ? <span className="text-sm text-tx-muted">No upcoming deadlines</span> : 
                      upcomingSchedule.milestones.map(m => (
                        <div key={m.id} className="text-[14px]">
                          <div className="font-medium text-tx-primary truncate">{m.title}</div>
                          <div className="text-[12px] text-orange-600 font-medium">{new Date(m.date + 'T00:00:00').toLocaleDateString(undefined, {month:'short', day:'numeric'})}</div>
                        </div>
                      ))
                    }
                  </div>
                </div>

                <div className="bg-canvas border border-bd-subtle rounded-xl p-4">
                  <h3 className="text-[12px] font-bold text-tx-muted uppercase tracking-wider mb-3">Task Blocks</h3>
                  <div className="space-y-2">
                    {upcomingSchedule.taskBlocks.length === 0 ? <span className="text-sm text-tx-muted">None blocked</span> : 
                      upcomingSchedule.taskBlocks.map(m => (
                        <div key={m.id} className="text-[14px]">
                          <div className="font-medium text-tx-primary truncate">{m.title}</div>
                          <div className="text-[12px] text-tx-muted">{new Date(m.date + 'T00:00:00').toLocaleDateString(undefined, {month:'short', day:'numeric'})}</div>
                        </div>
                      ))
                    }
                  </div>
                </div>
              </div>
            </section>

          </div>

          {/* Sidebar Column */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* BUSINESS SECTION */}
            <section className="bg-surface-neutral/30 border border-bd-subtle rounded-2xl p-5">
              <h2 className="text-[15px] font-bold text-tx-primary flex items-center gap-2 mb-4">
                <Briefcase size={18} className="text-blue-500" /> Business Overview
              </h2>
              
              <div className="grid grid-cols-2 gap-3 mb-3">
                 <div className="bg-canvas border border-bd-subtle rounded-xl p-4">
                    <div className="text-[12px] font-medium text-tx-muted mb-1">MTD Revenue</div>
                    <div className="text-xl font-bold text-tx-primary">{formatCurrencyCompact(businessStats.revenue, preferences.currency)}</div>
                 </div>
                 <div className="bg-canvas border border-bd-subtle rounded-xl p-4">
                    <div className="text-[12px] font-medium text-tx-muted mb-1">Active Projects</div>
                    <div className="text-xl font-bold text-tx-primary">{businessStats.activeProjects}</div>
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                 <button onClick={() => goToTab('clients')} className="bg-canvas border border-bd-subtle rounded-xl p-4 text-left hover:border-accent-primary/50 transition-colors">
                    <div className="text-[12px] font-medium text-tx-muted mb-1">Open Leads</div>
                    <div className="text-xl font-bold text-tx-primary">{businessStats.leads}</div>
                 </button>
                 <button onClick={() => push('tasks')} className="bg-canvas border border-bd-subtle rounded-xl p-4 text-left hover:border-accent-primary/50 transition-colors">
                    <div className="text-[12px] font-medium text-tx-muted mb-1">Outstanding Tasks</div>
                    <div className="text-xl font-bold text-tx-primary">{businessStats.outstandingWork}</div>
                 </button>
              </div>
            </section>

            {/* PRODUCTIVITY SECTION */}
            <section className="bg-surface-neutral/30 border border-bd-subtle rounded-2xl p-5">
              <h2 className="text-[15px] font-bold text-tx-primary flex items-center gap-2 mb-4">
                <Activity size={18} className="text-emerald-500" /> Productivity
              </h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center"><CheckSquare size={18}/></div>
                     <div>
                       <div className="text-[14px] font-bold text-tx-primary">{productivityStats.completedTasks}</div>
                       <div className="text-[12px] text-tx-muted">Completed Tasks</div>
                     </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center"><Clock size={18}/></div>
                     <div>
                       <div className="text-[14px] font-bold text-tx-primary">{productivityStats.trackedTime} hrs</div>
                       <div className="text-[12px] text-tx-muted">Total Tracked Time</div>
                     </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-full bg-orange-500/10 text-orange-600 flex items-center justify-center"><Target size={18}/></div>
                     <div>
                       <div className="text-[14px] font-bold text-tx-primary">{productivityStats.upcomingDeadlines}</div>
                       <div className="text-[12px] text-tx-muted">Upcoming Deadlines</div>
                     </div>
                  </div>
                </div>
              </div>
            </section>

          </div>
        </div>
      </div>

      {/* Quick Actions Sheet */}
      <BottomSheet 
        isOpen={isQuickActionsOpen} 
        onClose={() => setIsQuickActionsOpen(false)} 
        title="Quick Actions"
      >
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-1 pb-4">
          <button onClick={() => handleQuickAction('client')} className="bg-surface-neutral hover:bg-surface-hover border border-bd-subtle p-4 rounded-2xl flex flex-col items-center justify-center gap-2 transition-colors">
            <div className="w-12 h-12 rounded-full bg-canvas flex items-center justify-center text-tx-primary shadow-sm"><UserPlus size={20} /></div>
            <span className="text-[14px] font-medium text-tx-primary">New Client</span>
          </button>
          
          <button onClick={() => handleQuickAction('project')} className="bg-surface-neutral hover:bg-surface-hover border border-bd-subtle p-4 rounded-2xl flex flex-col items-center justify-center gap-2 transition-colors">
            <div className="w-12 h-12 rounded-full bg-canvas flex items-center justify-center text-tx-primary shadow-sm"><Briefcase size={20} /></div>
            <span className="text-[14px] font-medium text-tx-primary">New Project</span>
          </button>

          <button onClick={() => handleQuickAction('task')} className="bg-surface-neutral hover:bg-surface-hover border border-bd-subtle p-4 rounded-2xl flex flex-col items-center justify-center gap-2 transition-colors">
            <div className="w-12 h-12 rounded-full bg-canvas flex items-center justify-center text-orange-500 shadow-sm"><CheckSquare size={20} /></div>
            <span className="text-[14px] font-medium text-tx-primary">New Task</span>
          </button>

          <button onClick={() => handleQuickAction('schedule')} className="bg-surface-neutral hover:bg-surface-hover border border-bd-subtle p-4 rounded-2xl flex flex-col items-center justify-center gap-2 transition-colors">
            <div className="w-12 h-12 rounded-full bg-canvas flex items-center justify-center text-purple-500 shadow-sm"><Calendar size={20} /></div>
            <span className="text-[14px] font-medium text-tx-primary">Schedule</span>
          </button>

          <button onClick={() => handleQuickAction('template')} className="bg-surface-neutral hover:bg-surface-hover border border-bd-subtle p-4 rounded-2xl flex flex-col items-center justify-center gap-2 transition-colors">
            <div className="w-12 h-12 rounded-full bg-canvas flex items-center justify-center text-emerald-500 shadow-sm"><Target size={20} /></div>
            <span className="text-[14px] font-medium text-tx-primary">Use Template</span>
          </button>

          <button onClick={() => handleQuickAction('library')} className="bg-surface-neutral hover:bg-surface-hover border border-bd-subtle p-4 rounded-2xl flex flex-col items-center justify-center gap-2 transition-colors">
            <div className="w-12 h-12 rounded-full bg-canvas flex items-center justify-center text-blue-500 shadow-sm"><FileText size={20} /></div>
            <span className="text-[14px] font-medium text-tx-primary">Add to Library</span>
          </button>
        </div>
      </BottomSheet>

    </div>
  );
}
