import React, { useState, useMemo } from 'react';
import { 
  Search, Bell, Plus, Briefcase, Users, Calendar, AlertCircle, 
  CheckSquare, Clock, DollarSign, Target, FileText, ChevronRight, X, 
  Play, Pause, Activity, TrendingUp, ArrowUpRight, CheckCircle2, 
  Building2, ShieldCheck, Filter, ArrowRight, Zap, Check, Sparkles
} from 'lucide-react';
import { Header, ProgressBar } from '../components/Shared';
import { MetricCard, MetricBarChart, Badge, Button, Card } from '../components/ui';
import { PushedScreenState } from '../types';
import { useTasks } from '../context/TasksContext';
import { useRevenue } from '../context/RevenueContext';
import { useCalendar } from '../context/CalendarContext';
import { useProfile } from '../context/ProfileContext';
import { usePreferences } from '../context/PreferencesContext';
import { useClients } from '../context/ClientsContext';
import { useProjects } from '../context/ProjectsContext';
import { useTimeTracker } from '../context/TimeTrackerContext';
import { useAuth } from '../context/AuthContext';
import { useAIAssistant } from '../context/AIAssistantContext';
import { formatCurrencyCompact, formatCurrency } from '../utils/currency';
import { getTodayDateStr } from '../utils/date';
import { useNavigation } from '../context/NavigationContext';
import { useCommandPalette } from '../context/CommandPaletteContext';

type DateRange = 'month' | 'quarter' | 'year' | 'all';

export function Dashboard({ onPush }: { onPush: (screen: PushedScreenState) => void }) {
  const { profile } = useProfile();
  const { preferences } = usePreferences();
  const { tasks, completeTask } = useTasks();
  const { revenues, yearlyGoal } = useRevenue();
  const { events } = useCalendar();
  const { clients } = useClients();
  const { projects } = useProjects();
  const { 
    timeEntries, timerState, elapsedSeconds, 
    startTimer, stopTimer, activeNote, activeProjectId 
  } = useTimeTracker();
  const { goToTab, goToClient, push } = useNavigation();
  const { openPalette } = useCommandPalette();
  const { organization, role, user } = useAuth();
  const { openAssistant } = useAIAssistant();

  const [dateRange, setDateRange] = useState<DateRange>('month');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);

  const todayDateStr = getTodayDateStr();
  const todayDate = new Date(todayDateStr);

  // Compute date range start boundary
  const rangeStartDate = useMemo(() => {
    const now = new Date();
    if (dateRange === 'month') {
      return new Date(now.getFullYear(), now.getMonth(), 1);
    }
    if (dateRange === 'quarter') {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      return new Date(now.getFullYear(), currentQuarter * 3, 1);
    }
    if (dateRange === 'year') {
      return new Date(now.getFullYear(), 0, 1);
    }
    return new Date(0); // all time
  }, [dateRange]);

  // Format timer duration seconds
  const formatTimerDuration = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // 1. FILTERED METRICS (CALCULATED FROM ACTUAL AUTHORIZED DATA)
  const rangeStats = useMemo(() => {
    // Revenue in selected range
    const rangeRevenues = revenues.filter(r => {
      if (!r.date) return false;
      const rDate = new Date(r.date + 'T00:00:00');
      return rDate >= rangeStartDate;
    });

    const paidRevenue = rangeRevenues
      .filter(r => r.type !== 'expense' && r.status === 'Paid')
      .reduce((sum, r) => sum + r.amount, 0);

    const pendingRevenue = revenues
      .filter(r => r.type !== 'expense' && r.status === 'Pending')
      .reduce((sum, r) => sum + r.amount, 0);

    const overdueRevenue = revenues
      .filter(r => r.type !== 'expense' && r.status === 'Overdue')
      .reduce((sum, r) => sum + r.amount, 0);

    // Time entries in selected range
    const rangeTimeEntries = timeEntries.filter(t => {
      const tDate = new Date(t.startedAt);
      return !isNaN(tDate.getTime()) && tDate >= rangeStartDate;
    });

    const totalSeconds = rangeTimeEntries.reduce((sum, t) => sum + t.durationSeconds, 0);
    const totalHours = (totalSeconds / 3600).toFixed(1);

    const billableSeconds = rangeTimeEntries
      .filter(t => t.billable !== false)
      .reduce((sum, t) => sum + t.durationSeconds, 0);
    const billablePct = totalSeconds > 0 ? Math.round((billableSeconds / totalSeconds) * 100) : 100;

    // Completed tasks in range
    const completedTasksCount = tasks.filter(t => t.status === 'done').length;

    return {
      paidRevenue,
      pendingRevenue,
      overdueRevenue,
      totalHours,
      billablePct,
      completedTasksCount,
    };
  }, [revenues, timeEntries, tasks, rangeStartDate]);

  // 2. PROJECT HEALTH MATRIX
  const projectHealth = useMemo(() => {
    const active = projects.filter(p => p.status === 'active' || !p.status);
    const onHold = projects.filter(p => p.status === 'on-hold');
    const completed = projects.filter(p => p.status === 'completed');
    const highPriority = projects.filter(p => p.priority === 'high');

    return {
      activeCount: active.length,
      onHoldCount: onHold.length,
      completedCount: completed.length,
      highPriorityCount: highPriority.length,
      topProjects: projects.slice(0, 5),
    };
  }, [projects]);

  // 3. CLIENT PIPELINE
  const clientStats = useMemo(() => {
    const leads = clients.filter(c => c.status === 'lead');
    const active = clients.filter(c => c.status === 'active');
    const past = clients.filter(c => c.status === 'past');
    return {
      leadsCount: leads.length,
      activeCount: active.length,
      pastCount: past.length,
      totalCount: clients.length,
    };
  }, [clients]);

  // 4. OVERDUE TASKS & HIGH PRIORITY
  const overdueTasks = useMemo(() => {
    return tasks.filter(t => {
      if (t.status === 'done' || !t.date) return false;
      const tDate = t.date.split('T')[0];
      return tDate < todayDateStr;
    }).slice(0, 4);
  }, [tasks, todayDateStr]);

  const todayTasks = useMemo(() => {
    return tasks.filter(t => t.date && t.date.startsWith(todayDateStr) && t.status !== 'done').slice(0, 4);
  }, [tasks, todayDateStr]);

  // 5. UPCOMING DEADLINES & MILESTONES
  const upcomingDeadlines = useMemo(() => {
    return events
      .filter(e => e.date >= todayDateStr && (e.type === 'Deadline' || e.type === 'Milestone'))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 4);
  }, [events, todayDateStr]);

  const todayEvents = useMemo(() => {
    return events
      .filter(e => e.date === todayDateStr)
      .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))
      .slice(0, 4);
  }, [events, todayDateStr]);

  // 6. WEEKLY WORK VELOCITY CHART
  const weeklyVelocity = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const now = new Date();
    // Monday of this week
    const dayOfWeek = (now.getDay() + 6) % 7; // Mon = 0
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek);
    monday.setHours(0, 0, 0, 0);

    return days.map((dayLabel, idx) => {
      const targetDay = new Date(monday);
      targetDay.setDate(monday.getDate() + idx);
      const targetStr = `${targetDay.getFullYear()}-${String(targetDay.getMonth() + 1).padStart(2, '0')}-${String(targetDay.getDate()).padStart(2, '0')}`;

      // Sum minutes logged on targetDay from actual time entries
      const daySecs = timeEntries
        .filter(t => t.startedAt && t.startedAt.startsWith(targetStr))
        .reduce((sum, t) => sum + t.durationSeconds, 0);
      const minutes = Math.round(daySecs / 60);

      return {
        label: dayLabel,
        value: minutes,
        active: idx === dayOfWeek,
      };
    });
  }, [timeEntries]);

  // 7. CONSOLIDATED RECENT ACTIVITY STREAM (ACTUAL AUTHORIZED DATA)
  const recentActivities = useMemo(() => {
    type ActivityItem = {
      id: string;
      title: string;
      subtitle: string;
      timestamp: Date;
      type: 'task' | 'time' | 'revenue' | 'event';
      navAction: () => void;
    };

    const items: ActivityItem[] = [];

    // Completed tasks
    tasks.filter(t => t.status === 'done').slice(0, 4).forEach(t => {
      items.push({
        id: `t-${t.id}`,
        title: `Task Completed: ${t.title}`,
        subtitle: t.projectId ? (projects.find(p => p.id === t.projectId)?.name || 'Project') : 'General task',
        timestamp: new Date(t.updatedAt || t.createdAt || todayDateStr),
        type: 'task',
        navAction: () => push('tasks'),
      });
    });

    // Time entries
    timeEntries.slice(0, 4).forEach(te => {
      const p = projects.find(x => x.id === te.projectId);
      items.push({
        id: `te-${te.id}`,
        title: `Time Logged: ${(te.durationSeconds / 3600).toFixed(1)} hrs`,
        subtitle: te.note || p?.name || 'General execution',
        timestamp: new Date(te.startedAt),
        type: 'time',
        navAction: () => push('time-tracker'),
      });
    });

    // Revenue entries
    revenues.slice(0, 4).forEach(r => {
      items.push({
        id: `r-${r.id}`,
        title: `${r.status} Payment: ${formatCurrency(r.amount, preferences.currency)}`,
        subtitle: r.clientOrProject || 'Revenue entry',
        timestamp: new Date(r.date + 'T00:00:00'),
        type: 'revenue',
        navAction: () => push('finance'),
      });
    });

    return items
      .filter(item => !isNaN(item.timestamp.getTime()))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 6);
  }, [tasks, timeEntries, revenues, projects, preferences.currency, push, todayDateStr]);

  // 8. NOTIFICATIONS
  const notifications = useMemo(() => {
    const list = [];
    if (overdueTasks.length > 0) {
      list.push({
        id: 'notif-overdue-tasks',
        title: `${overdueTasks.length} Overdue Tasks`,
        subtitle: 'Tasks requiring immediate review',
        type: 'task',
        action: () => push('tasks'),
      });
    }
    todayEvents.forEach(e => {
      list.push({
        id: `notif-event-${e.id}`,
        title: `Scheduled Today: ${e.title}`,
        subtitle: e.startTime ? `${e.startTime} - ${e.type}` : e.type,
        type: 'event',
        action: () => push('calendar'),
      });
    });
    if (rangeStats.overdueRevenue > 0) {
      list.push({
        id: 'notif-overdue-rev',
        title: `Overdue Receivables: ${formatCurrency(rangeStats.overdueRevenue, preferences.currency)}`,
        subtitle: 'Outstanding invoices passed due date',
        type: 'revenue',
        action: () => push('finance'),
      });
    }
    return list;
  }, [overdueTasks, todayEvents, rangeStats.overdueRevenue, preferences.currency, push]);

  // Format days countdown
  const getDaysCountdown = (targetDateStr: string) => {
    const target = new Date(targetDateStr + 'T00:00:00');
    const diffTime = target.getTime() - todayDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
    return `In ${diffDays}d`;
  };

  // Annual target pacing
  const totalPaidAllTime = revenues.filter(r => r.status === 'Paid').reduce((s, r) => s + r.amount, 0);
  const goalTarget = yearlyGoal || 100000;
  const goalEarnedPct = Math.min(100, Math.round((totalPaidAllTime / goalTarget) * 100));

  const workspaceDisplayName = organization?.name || profile.businessName || 'MenkiR Workspace';

  return (
    <div className="flex flex-col h-full bg-canvas relative pb-[88px] md:pb-6 overflow-hidden">
      
      {/* TOP APPLICATION SHELL HEADER */}
      <Header
        title={
          <div className="flex items-center gap-2.5">
            <span className="text-base md:text-lg font-bold text-tx-primary tracking-tight">
              Dashboard
            </span>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-wider font-bold bg-surface-neutral text-tx-muted border border-bd-subtle">
              {workspaceDisplayName}
            </span>
          </div>
        }
        rightIcon={
          <div className="flex items-center gap-1.5 md:gap-2">
            {/* Global Search Button */}
            <button
              onClick={openPalette}
              className="w-9 h-9 flex items-center justify-center rounded-xl border border-bd-subtle bg-canvas hover:bg-surface-neutral text-tx-primary transition-colors shadow-2xs"
              title="Search and command palette (⌘K)"
              aria-label="Search"
            >
              <Search size={16} />
            </button>

            {/* Notifications Bell */}
            <div className="relative">
              <button
                onClick={() => setIsNotificationsOpen(prev => !prev)}
                className="w-9 h-9 flex items-center justify-center rounded-xl border border-bd-subtle bg-canvas hover:bg-surface-neutral text-tx-primary transition-colors shadow-2xs relative"
                aria-label="Notifications"
              >
                <Bell size={16} />
                {notifications.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-orange-500" />
                )}
              </button>

              {isNotificationsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsNotificationsOpen(false)} />
                  <div className="absolute top-full right-0 mt-2 w-[320px] max-h-[380px] overflow-y-auto bg-canvas border border-bd-subtle shadow-xl rounded-2xl z-50 p-2.5 no-scrollbar">
                    <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-bd-subtle mb-1">
                      <span className="text-xs font-bold uppercase tracking-wider text-tx-primary font-mono">
                        Notifications
                      </span>
                      <span className="text-[11px] font-mono tabular-nums text-tx-muted">
                        {notifications.length} alerts
                      </span>
                    </div>
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center text-xs text-tx-muted">All clear. No urgent notices.</div>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {notifications.map(n => (
                          <button
                            key={n.id}
                            onClick={() => {
                              setIsNotificationsOpen(false);
                              n.action();
                            }}
                            className="p-2.5 rounded-xl hover:bg-surface-neutral flex items-start gap-2.5 transition-colors text-left group border border-bd-subtle/50"
                          >
                            <div className="w-7 h-7 rounded-lg bg-surface-neutral flex items-center justify-center shrink-0 mt-0.5 border border-bd-subtle">
                              {n.type === 'task' && <CheckSquare size={13} className="text-orange-500" />}
                              {n.type === 'event' && <Calendar size={13} className="text-tx-primary" />}
                              {n.type === 'revenue' && <DollarSign size={13} className="text-emerald-500" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold text-tx-primary truncate">{n.title}</div>
                              <div className="text-[11px] text-tx-muted truncate mt-0.5">{n.subtitle}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Contextual Quick Actions Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsQuickActionsOpen(prev => !prev)}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-tx-primary text-canvas hover:bg-tx-primary/90 transition-all shadow-xs active:scale-95"
                title="Quick creation"
                aria-label="Quick Actions"
              >
                <Plus size={18} />
              </button>

              {isQuickActionsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsQuickActionsOpen(false)} />
                  <div className="absolute top-full right-0 mt-2 w-48 bg-canvas border border-bd-subtle shadow-xl rounded-2xl z-50 p-1.5 no-scrollbar">
                    <div className="px-2.5 py-1 text-[10px] font-bold text-tx-muted uppercase tracking-wider font-mono border-b border-bd-subtle mb-1">
                      New Record
                    </div>
                    <button
                      onClick={() => { setIsQuickActionsOpen(false); goToTab('projects', { openCreate: true }); }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-tx-primary hover:bg-surface-neutral transition-colors text-left"
                    >
                      <Briefcase size={14} className="text-tx-secondary" />
                      <span>New Project</span>
                    </button>
                    <button
                      onClick={() => { setIsQuickActionsOpen(false); goToTab('clients', { openCreate: true }); }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-tx-primary hover:bg-surface-neutral transition-colors text-left"
                    >
                      <Users size={14} className="text-tx-secondary" />
                      <span>New Client</span>
                    </button>
                    <button
                      onClick={() => { setIsQuickActionsOpen(false); push('tasks'); }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-tx-primary hover:bg-surface-neutral transition-colors text-left"
                    >
                      <CheckSquare size={14} className="text-orange-500" />
                      <span>New Task</span>
                    </button>
                    <button
                      onClick={() => { setIsQuickActionsOpen(false); push('calendar'); }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-tx-primary hover:bg-surface-neutral transition-colors text-left"
                    >
                      <Calendar size={14} className="text-tx-primary" />
                      <span>Schedule Event</span>
                    </button>
                    <button
                      onClick={() => { setIsQuickActionsOpen(false); push('time-tracker'); }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-tx-primary hover:bg-surface-neutral transition-colors text-left"
                    >
                      <Clock size={14} className="text-accent-primary" />
                      <span>Track Time</span>
                    </button>
                    <button
                      onClick={() => { setIsQuickActionsOpen(false); push('finance'); }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-tx-primary hover:bg-surface-neutral transition-colors text-left border-t border-bd-subtle mt-1 pt-1"
                    >
                      <DollarSign size={14} className="text-emerald-500" />
                      <span>Log Revenue</span>
                    </button>
                    <div className="px-2.5 py-1 text-[10px] font-bold text-tx-muted uppercase tracking-wider font-mono border-t border-bd-subtle mt-1 pt-1 mb-0.5">
                      AI Assistant
                    </div>
                    <button
                      onClick={() => { setIsQuickActionsOpen(false); openAssistant('status-report'); }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-tx-primary hover:bg-surface-neutral transition-colors text-left"
                    >
                      <Sparkles size={14} className="text-accent-primary" />
                      <span>Status Report</span>
                    </button>
                    <button
                      onClick={() => { setIsQuickActionsOpen(false); openAssistant('draft-project-plan'); }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-tx-primary hover:bg-surface-neutral transition-colors text-left"
                    >
                      <Sparkles size={14} className="text-accent-secondary" />
                      <span>Draft Project Plan</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        }
      />

      {/* DASHBOARD CONTENT BODY */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 md:px-6 py-4 space-y-5 max-w-7xl mx-auto w-full">

        {/* 1. WELCOME & DATE RANGE SELECTOR BAR */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-bd-subtle/60">
          <div>
            <h1 className="text-lg md:text-xl font-bold text-tx-primary tracking-tight">
              Executive Overview
            </h1>
            <p className="text-xs text-tx-muted mt-0.5">
              Operations, delivery health, and company metrics for {workspaceDisplayName}.
            </p>
          </div>

          {/* Date Range Selector & AI Report Button */}
          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <button
              onClick={() => openAssistant('status-report')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-surface-neutral hover:bg-surface-hover text-tx-primary border border-bd-subtle transition-colors shadow-2xs"
              title="Generate executive status report with AI"
            >
              <Sparkles size={14} className="text-accent-primary" />
              <span>AI Report</span>
            </button>

            <div className="inline-flex bg-surface-neutral p-1 rounded-xl border border-bd-subtle shadow-2xs">
              {(['month', 'quarter', 'year', 'all'] as const).map(opt => (
                <button
                  key={opt}
                  onClick={() => setDateRange(opt)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    dateRange === opt
                      ? 'bg-canvas text-tx-primary shadow-xs font-semibold border border-bd-subtle/50'
                      : 'text-tx-muted hover:text-tx-primary'
                  }`}
                >
                  {opt === 'month' ? 'This Month' : opt === 'quarter' ? 'Quarter' : opt === 'year' ? 'Year' : 'All Time'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 2. ATTENTION & OVERDUE ALERT BANNER (Conditional) */}
        {(overdueTasks.length > 0 || rangeStats.overdueRevenue > 0) && (
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-tx-primary shadow-2xs">
            <div className="flex items-center gap-2.5">
              <AlertCircle size={16} className="text-orange-600 shrink-0" />
              <div>
                <span className="font-semibold text-orange-700">Action Required: </span>
                <span>
                  {overdueTasks.length > 0 && `${overdueTasks.length} overdue task(s)`}
                  {overdueTasks.length > 0 && rangeStats.overdueRevenue > 0 && ' and '}
                  {rangeStats.overdueRevenue > 0 && `${formatCurrency(rangeStats.overdueRevenue, preferences.currency)} in overdue receivables`}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {overdueTasks.length > 0 && (
                <button
                  onClick={() => push('tasks')}
                  className="px-2.5 py-1 rounded-lg bg-orange-600 text-canvas font-semibold hover:opacity-90 transition-opacity text-[11px]"
                >
                  Review Tasks
                </button>
              )}
              {rangeStats.overdueRevenue > 0 && (
                <button
                  onClick={() => push('finance')}
                  className="px-2.5 py-1 rounded-lg bg-canvas border border-orange-500/30 text-orange-700 font-semibold hover:bg-surface-neutral transition-colors text-[11px]"
                >
                  View Invoices
                </button>
              )}
            </div>
          </div>
        )}

        {/* 3. EXECUTIVE KPI METRICS STRIP (4 CARDS) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div 
            onClick={() => push('finance')} 
            className="cursor-pointer group focus-visible:outline-none"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') push('finance'); }}
          >
            <MetricCard
              label={dateRange === 'month' ? 'Realized Revenue (MTD)' : dateRange === 'quarter' ? 'Revenue (QTD)' : 'Realized Revenue'}
              value={formatCurrencyCompact(rangeStats.paidRevenue, preferences.currency)}
              delta={rangeStats.pendingRevenue > 0 ? `${formatCurrencyCompact(rangeStats.pendingRevenue, preferences.currency)} pending` : 'All cleared'}
              deltaType="positive"
              subtext="Actual received payments"
              accent="lime"
            />
          </div>

          <div 
            onClick={() => goToTab('projects')} 
            className="cursor-pointer group focus-visible:outline-none"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') goToTab('projects'); }}
          >
            <MetricCard
              label="Active Projects"
              value={projectHealth.activeCount}
              delta={`${projectHealth.highPriorityCount} high priority`}
              deltaType="neutral"
              subtext={`${projectHealth.completedCount} completed total`}
              accent="charcoal"
            />
          </div>

          <div 
            onClick={() => push('time-tracker')} 
            className="cursor-pointer group focus-visible:outline-none"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') push('time-tracker'); }}
          >
            <MetricCard
              label="Tracked Work"
              value={`${rangeStats.totalHours}h`}
              delta={`${rangeStats.billablePct}% billable`}
              deltaType="positive"
              subtext="Recorded team execution"
              accent="warm"
            />
          </div>

          <div 
            onClick={() => goToTab('clients')} 
            className="cursor-pointer group focus-visible:outline-none"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') goToTab('clients'); }}
          >
            <MetricCard
              label="Client Relationships"
              value={clientStats.totalCount}
              delta={`${clientStats.leadsCount} pipeline leads`}
              deltaType="neutral"
              subtext={`${clientStats.activeCount} active client accounts`}
            />
          </div>
        </div>

        {/* 4. LIVE STOPWATCH / ACTIVE TIMER BANNER */}
        <div className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          timerState === 'running'
            ? 'bg-accent-primary/10 border-accent-primary/40 shadow-xs'
            : 'bg-canvas-card border-bd-subtle'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
              timerState === 'running' 
                ? 'bg-accent-primary text-tx-primary border-accent-primary-hover' 
                : 'bg-surface-neutral text-tx-muted border-bd-subtle'
            }`}>
              <Clock size={18} className={timerState === 'running' ? 'animate-spin' : ''} />
            </div>
            <div>
              <div className="text-xs font-semibold text-tx-primary flex items-center gap-2">
                <span>{timerState === 'running' ? 'Active Stopwatch Running' : 'Time Tracker Stopwatch'}</span>
                {timerState === 'running' && (
                  <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-mono font-bold uppercase bg-accent-primary text-tx-primary">
                    Live
                  </span>
                )}
              </div>
              <div className="text-[11px] text-tx-muted mt-0.5">
                {timerState === 'running' 
                  ? (activeNote || (projects.find(p => p.id === activeProjectId)?.name) || 'General execution time') 
                  : 'Start tracking billable project time with one click.'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-auto">
            {timerState === 'running' ? (
              <>
                <span className="font-mono tabular-nums text-sm font-bold text-tx-primary mr-1">
                  {formatTimerDuration(elapsedSeconds)}
                </span>
                <button
                  onClick={() => stopTimer()}
                  className="px-3 py-1.5 rounded-lg bg-tx-primary text-canvas text-xs font-semibold hover:opacity-90 transition-opacity shadow-xs"
                >
                  Stop & Save
                </button>
                <button
                  onClick={() => push('time-tracker')}
                  className="px-2.5 py-1.5 rounded-lg border border-bd-subtle bg-canvas text-xs font-medium text-tx-secondary hover:text-tx-primary"
                >
                  Open
                </button>
              </>
            ) : (
              <button
                onClick={() => push('time-tracker')}
                className="px-3.5 py-1.5 rounded-lg bg-surface-neutral hover:bg-surface-hover border border-bd-subtle text-xs font-semibold text-tx-primary transition-all shadow-2xs flex items-center gap-1.5"
              >
                <Play size={13} className="ml-0.5" />
                <span>Track Time</span>
              </button>
            )}
          </div>
        </div>

        {/* 5. TWO-COLUMN DASHBOARD GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* LEFT 8 COLUMNS: Delivery, Projects & Velocity */}
          <div className="lg:col-span-8 space-y-5">
            
            {/* PROJECT HEALTH MATRIX */}
            <div className="bg-canvas-card border border-bd-subtle rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between mb-3.5 pb-2 border-b border-bd-subtle/60">
                <div className="flex items-center gap-2">
                  <Briefcase size={16} className="text-tx-primary" />
                  <h2 className="text-xs font-bold text-tx-primary uppercase tracking-wider font-mono">
                    Project Health & Milestones
                  </h2>
                </div>
                <button
                  onClick={() => goToTab('projects')}
                  className="text-xs font-semibold text-tx-muted hover:text-tx-primary flex items-center gap-1 transition-colors"
                >
                  <span>View All Projects</span>
                  <ChevronRight size={14} />
                </button>
              </div>

              {projectHealth.topProjects.length === 0 ? (
                <div className="text-center py-8">
                  <Briefcase size={28} className="text-tx-muted mx-auto mb-2 opacity-50" />
                  <p className="text-xs font-semibold text-tx-primary">No active projects registered</p>
                  <p className="text-[11px] text-tx-muted mt-0.5 mb-3">Create your first project to track execution and milestones.</p>
                  <button
                    onClick={() => goToTab('projects', { openCreate: true })}
                    className="px-3 py-1.5 rounded-lg bg-tx-primary text-canvas text-xs font-semibold"
                  >
                    Create Project
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {projectHealth.topProjects.map(proj => {
                    const client = clients.find(c => c.id === proj.clientId);
                    return (
                      <button
                        key={proj.id}
                        onClick={() => goToTab('projects', { filterProjectId: proj.id })}
                        className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl bg-surface-neutral/30 hover:bg-surface-neutral/70 border border-bd-subtle/70 transition-all text-left group"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span className="font-mono text-xs font-bold text-tx-muted uppercase px-1.5 py-0.5 rounded bg-surface-neutral border border-bd-subtle shrink-0">
                            {proj.index}
                          </span>
                          <div className="truncate">
                            <div className="text-xs font-bold text-tx-primary truncate group-hover:text-tx-primary">
                              {proj.name}
                            </div>
                            <div className="text-[11px] text-tx-muted flex items-center gap-1.5 mt-0.5">
                              <span>{client?.name || 'Internal Workspace'}</span>
                              {proj.priority === 'high' && (
                                <>
                                  <span className="w-1 h-1 rounded-full bg-orange-500" />
                                  <span className="text-orange-600 font-semibold">High Priority</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                          <div className="w-24 sm:w-28">
                            <div className="flex justify-between text-[10px] font-mono tabular-nums text-tx-muted mb-1">
                              <span>Progress</span>
                              <span>{proj.completionPct}%</span>
                            </div>
                            <ProgressBar progress={proj.completionPct} tone={proj.tone || 'lime'} />
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono border ${
                            proj.status === 'completed' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' :
                            proj.status === 'on-hold' ? 'bg-orange-500/10 text-orange-600 border-orange-500/20' :
                            'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                          }`}>
                            {proj.status || 'active'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* WEEKLY ACTIVITY VELOCITY SVG CHART */}
            <div className="bg-canvas-card border border-bd-subtle rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-bd-subtle/60">
                <div>
                  <h3 className="text-xs font-bold text-tx-primary uppercase tracking-wider font-mono">
                    Weekly Execution Velocity
                  </h3>
                  <p className="text-[11px] text-tx-muted">Focused minutes recorded daily across the current work week</p>
                </div>
                <span className="text-xs font-mono font-semibold text-accent-primary bg-tx-primary px-2 py-0.5 rounded">
                  {rangeStats.totalHours} hrs this cycle
                </span>
              </div>
              <MetricBarChart data={weeklyVelocity} height={90} />
            </div>

            {/* RECENT COMPANY ACTIVITY STREAM */}
            <div className="bg-canvas-card border border-bd-subtle rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-bd-subtle/60">
                <div className="flex items-center gap-2">
                  <Activity size={16} className="text-tx-primary" />
                  <h3 className="text-xs font-bold text-tx-primary uppercase tracking-wider font-mono">
                    Recent Company Activity
                  </h3>
                </div>
                <span className="text-[11px] text-tx-muted font-mono">{recentActivities.length} events logged</span>
              </div>

              {recentActivities.length === 0 ? (
                <div className="py-6 text-center text-xs text-tx-muted">No activity records logged yet.</div>
              ) : (
                <div className="space-y-2">
                  {recentActivities.map(act => (
                    <button
                      key={act.id}
                      onClick={act.navAction}
                      className="w-full flex items-center justify-between gap-3 p-2.5 rounded-xl hover:bg-surface-neutral/60 transition-colors text-left group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-surface-neutral flex items-center justify-center shrink-0 border border-bd-subtle">
                          {act.type === 'task' && <CheckCircle2 size={13} className="text-emerald-600" />}
                          {act.type === 'time' && <Clock size={13} className="text-tx-primary" />}
                          {act.type === 'revenue' && <DollarSign size={13} className="text-emerald-600" />}
                          {act.type === 'event' && <Calendar size={13} className="text-tx-secondary" />}
                        </div>
                        <div className="truncate">
                          <div className="text-xs font-semibold text-tx-primary truncate group-hover:text-tx-primary">
                            {act.title}
                          </div>
                          <div className="text-[11px] text-tx-muted truncate">{act.subtitle}</div>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono tabular-nums text-tx-muted shrink-0">
                        {act.timestamp.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* RIGHT 4 COLUMNS: Deadlines, Overdue Tasks, Financial Targets */}
          <div className="lg:col-span-4 space-y-5">
            
            {/* UPCOMING DEADLINES & COMMITMENTS */}
            <div className="bg-canvas-card border border-bd-subtle rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-bd-subtle/60">
                <div className="flex items-center gap-2">
                  <Target size={15} className="text-orange-600" />
                  <h3 className="text-xs font-bold text-tx-primary uppercase tracking-wider font-mono">
                    Upcoming Deadlines
                  </h3>
                </div>
                <button
                  onClick={() => push('calendar')}
                  className="text-xs font-semibold text-tx-muted hover:text-tx-primary transition-colors"
                >
                  Schedule
                </button>
              </div>

              {upcomingDeadlines.length === 0 ? (
                <div className="py-6 text-center text-xs text-tx-muted">No upcoming deadlines logged.</div>
              ) : (
                <div className="space-y-2">
                  {upcomingDeadlines.map(d => {
                    const countdown = getDaysCountdown(d.date);
                    const isUrgent = countdown === 'Today' || countdown === 'Tomorrow';
                    return (
                      <button
                        key={d.id}
                        onClick={() => push('calendar')}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl bg-surface-neutral/30 hover:bg-surface-neutral/70 border border-bd-subtle/60 transition-colors text-left group"
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="text-xs font-semibold text-tx-primary truncate group-hover:text-tx-primary">
                            {d.title}
                          </div>
                          <div className="text-[10px] font-mono tabular-nums text-tx-muted mt-0.5">
                            {new Date(d.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short' })}
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 ${
                          isUrgent ? 'bg-orange-500/10 text-orange-600 border border-orange-500/20' : 'bg-surface-neutral text-tx-muted'
                        }`}>
                          {countdown}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* OVERDUE & TODAY TASKS */}
            <div className="bg-canvas-card border border-bd-subtle rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-bd-subtle/60">
                <div className="flex items-center gap-2">
                  <CheckSquare size={15} className="text-tx-primary" />
                  <h3 className="text-xs font-bold text-tx-primary uppercase tracking-wider font-mono">
                    Priority Checklist
                  </h3>
                </div>
                <button
                  onClick={() => push('tasks')}
                  className="text-xs font-semibold text-tx-muted hover:text-tx-primary transition-colors"
                >
                  All Tasks
                </button>
              </div>

              {overdueTasks.length === 0 && todayTasks.length === 0 ? (
                <div className="py-6 text-center text-xs text-tx-muted">No pending tasks due today.</div>
              ) : (
                <div className="space-y-2">
                  {overdueTasks.map(t => (
                    <div
                      key={t.id}
                      className="flex items-center gap-2.5 p-2 rounded-xl bg-orange-500/5 border border-orange-500/20"
                    >
                      <button
                        onClick={() => completeTask(t.id)}
                        className="w-4 h-4 rounded border border-orange-500/40 hover:border-orange-500 flex items-center justify-center shrink-0 transition-colors"
                        aria-label={`Complete ${t.title}`}
                      />
                      <button
                        onClick={() => push('tasks')}
                        className="text-xs font-medium text-tx-primary truncate flex-1 text-left hover:underline"
                      >
                        {t.title}
                      </button>
                      <span className="text-[10px] font-mono font-bold text-orange-600 uppercase shrink-0">
                        Overdue
                      </span>
                    </div>
                  ))}
                  {todayTasks.map(t => (
                    <div
                      key={t.id}
                      className="flex items-center gap-2.5 p-2 rounded-xl bg-surface-neutral/30 border border-bd-subtle/50"
                    >
                      <button
                        onClick={() => completeTask(t.id)}
                        className="w-4 h-4 rounded border border-bd-subtle hover:border-tx-primary flex items-center justify-center shrink-0 transition-colors"
                        aria-label={`Complete ${t.title}`}
                      />
                      <button
                        onClick={() => push('tasks')}
                        className="text-xs font-medium text-tx-primary truncate flex-1 text-left hover:underline"
                      >
                        {t.title}
                      </button>
                      <span className="text-[10px] font-mono font-medium text-tx-muted shrink-0">
                        Today
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* FINANCIAL TARGET PACING CARD */}
            <div 
              onClick={() => push('finance')}
              className="bg-canvas-card border border-bd-subtle rounded-2xl p-4 shadow-xs cursor-pointer hover:border-bd-strong transition-all"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') push('finance'); }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-tx-muted uppercase tracking-wider font-mono">
                  Annual Target Pacing
                </span>
                <span className="text-xs font-mono font-bold text-tx-primary">
                  {goalEarnedPct}%
                </span>
              </div>
              
              <div className="text-2xl font-light font-mono tabular-nums text-tx-primary leading-none mb-3">
                {formatCurrency(totalPaidAllTime, preferences.currency)}
                <span className="text-xs text-tx-muted font-normal ml-1.5">
                  / {formatCurrencyCompact(goalTarget, preferences.currency)}
                </span>
              </div>

              <ProgressBar progress={goalEarnedPct} tone="lime" />

              <div className="flex justify-between items-center text-[11px] font-mono tabular-nums text-tx-muted mt-2.5">
                <span>Total Collected</span>
                <span>{formatCurrencyCompact(Math.max(0, goalTarget - totalPaidAllTime), preferences.currency)} to target</span>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
