import { useState, useMemo, useEffect } from 'react';
import { X, Pause, Play, Edit2, Trash2, Download, Clock, User, Briefcase, CheckSquare, AlertCircle, Plus, Info } from 'lucide-react';
import { Header } from '../components/Shared';
import { BottomSheet, BottomSheetField } from '../components/BottomSheet';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { SearchPicker } from '../components/SearchPicker';
import { useToast } from '../context/ToastContext';
import { useTimeTracker } from '../context/TimeTrackerContext';
import { useProjects } from '../context/ProjectsContext';
import { useTasks } from '../context/TasksContext';
import { useClients } from '../context/ClientsContext';
import { useNavigation } from '../context/NavigationContext';
import { usePreferences } from '../context/PreferencesContext';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/currency';
import { getTodayDateStr } from '../utils/date';
import { TimeEntry } from '../types';

export function TimeTracker({ onDismiss }: { onDismiss: () => void }) {
  const { showToast } = useToast();
  const { preferences } = usePreferences();
  const { projects } = useProjects();
  const { tasks } = useTasks();
  const { clients } = useClients();
  const { role, user, fetchMembers } = useAuth();
  const [members, setMembers] = useState<any[]>([]);
  const { navigationOptions, goToTab } = useNavigation();

  useEffect(() => {
    fetchMembers().then(setMembers).catch(() => {});
  }, [fetchMembers]);

  const filterProjectId = navigationOptions?.filterProjectId || '';
  const filterTaskId = navigationOptions?.filterTaskId || '';
  const filterClientId = navigationOptions?.filterClientId || '';

  const {
    timeEntries,
    addTimeEntry,
    updateTimeEntry,
    deleteTimeEntry,
    timerState,
    startTimer,
    pauseTimer,
    stopTimer,
    resetTimer,
    timerStartedAt,
    elapsedSeconds,
    activeProjectId,
    setActiveProjectId,
    activeTaskId,
    setActiveTaskId,
    activeClientId,
    setActiveClientId,
    activeNote,
    setActiveNote,
    activeBillable,
    setActiveBillable,
    activeHourlyRate,
    setActiveHourlyRate,
    activeUserId,
    setActiveUserId,
    activeUserName,
    setActiveUserName,
    exportTimeEntriesCSV,
    simultaneousTimerPolicy,
  } = useTimeTracker();

  const [isStartSheetOpen, setStartSheetOpen] = useState(false);
  const [isSaveSheetOpen, setSaveSheetOpen] = useState(false);
  const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);

  // Manual / Edit Form State
  const [manualDuration, setManualDuration] = useState('00:00:00');
  const [entryDate, setEntryDate] = useState(getTodayDateStr());
  const [entryHourlyRate, setEntryHourlyRate] = useState<string>('');
  const [entryAssigneeId, setEntryAssigneeId] = useState<string>('');
  const [entryAssigneeName, setEntryAssigneeName] = useState<string>('');
  const [selectedFilterProject, setSelectedFilterProject] = useState<string>(filterProjectId);
  const [policyInfoVisible, setPolicyInfoVisible] = useState(false);

  const isViewer = role === 'viewer';

  const formatTime = (totalSeconds: number) => {
    const safeSecs = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(safeSecs / 3600);
    const m = Math.floor((safeSecs % 3600) / 60);
    const s = safeSecs % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const parseDurationStringToSeconds = (str: string): number => {
    const trimmed = str.trim();
    if (!trimmed) return 0;

    // Check for HH:MM:SS or MM:SS
    const parts = trimmed.split(':').map((p) => Number(p));
    if (parts.some((p) => isNaN(p) || p < 0)) return -1;

    if (parts.length === 3) {
      return Math.round(parts[0] * 3600 + parts[1] * 60 + parts[2]);
    }
    if (parts.length === 2) {
      return Math.round(parts[0] * 3600 + parts[1] * 60);
    }
    // Support decimal hours, e.g. "2.5"
    const decimal = parseFloat(trimmed);
    if (!isNaN(decimal) && decimal > 0) {
      return Math.round(decimal * 3600);
    }
    return -1;
  };

  const handleStartButton = () => {
    if (isViewer) {
      showToast({ message: 'Viewer role has read-only access. Cannot start timers.' });
      return;
    }
    if (timerState === 'paused') {
      startTimer();
    } else {
      // Prepopulate active project/task if filter is set
      if (filterProjectId && !activeProjectId) {
        setActiveProjectId(filterProjectId);
        const p = projects.find((x) => x.id === filterProjectId);
        if (p?.clientId) setActiveClientId(p.clientId);
        if (p?.hourlyRate != null) setActiveHourlyRate(p.hourlyRate);
      }
      if (filterTaskId && !activeTaskId) {
        setActiveTaskId(filterTaskId);
      }
      if (!activeUserName) {
        setActiveUserId(user?.uid || '');
        setActiveUserName(user?.displayName || user?.email || 'Self');
      }
      setStartSheetOpen(true);
    }
  };

  const handleConfirmStart = () => {
    setStartSheetOpen(false);
    startTimer();
  };

  const handleStopButton = () => {
    stopTimer();

    // Apply rounding increment if configured
    const incrementSeconds = (preferences.roundingIncrementMinutes || 1) * 60;
    let roundedSeconds = elapsedSeconds;
    if (incrementSeconds > 0) {
      roundedSeconds = Math.ceil(elapsedSeconds / incrementSeconds) * incrementSeconds;
    }

    setManualDuration(formatTime(roundedSeconds));
    setEntryDate(getTodayDateStr());
    setEntryHourlyRate(activeHourlyRate != null ? String(activeHourlyRate) : '');
    setEntryAssigneeId(activeUserId || user?.uid || '');
    setEntryAssigneeName(activeUserName || user?.displayName || user?.email || 'Self');
    setSaveSheetOpen(true);
  };

  const handleSave = () => {
    if (isViewer) {
      showToast({ message: 'Viewer role has read-only access' });
      return;
    }

    const totalSecs = parseDurationStringToSeconds(manualDuration);
    if (totalSecs <= 0) {
      showToast({ message: 'Duration must be greater than 00:00:00' });
      return;
    }
    if (totalSecs > 86400) {
      showToast({ message: 'Duration cannot exceed 24 hours per time entry.' });
      return;
    }

    const rateNum = entryHourlyRate ? parseFloat(entryHourlyRate) : activeHourlyRate;

    if (editingEntry) {
      const res = updateTimeEntry(editingEntry.id, {
        projectId: activeProjectId || undefined,
        taskId: activeTaskId || undefined,
        clientId: activeClientId || undefined,
        durationSeconds: totalSecs,
        startedAt: entryDate ? `${entryDate}T09:00:00.000Z` : editingEntry.startedAt,
        note: activeNote,
        billable: activeBillable,
        hourlyRate: activeBillable && rateNum != null && rateNum >= 0 ? rateNum : undefined,
        userId: entryAssigneeId || undefined,
        userName: entryAssigneeName || undefined,
      });

      if (!res.success) {
        showToast({ message: res.error || 'Failed to update entry' });
        return;
      }
      showToast({ message: 'Time entry updated successfully' });
    } else {
      const res = addTimeEntry({
        projectId: activeProjectId || undefined,
        taskId: activeTaskId || undefined,
        clientId: activeClientId || undefined,
        durationSeconds: totalSecs,
        startedAt: timerStartedAt || (entryDate ? `${entryDate}T09:00:00.000Z` : new Date().toISOString()),
        note: activeNote,
        billable: activeBillable,
        hourlyRate: activeBillable && rateNum != null && rateNum >= 0 ? rateNum : undefined,
        userId: entryAssigneeId || user?.uid || undefined,
        userName: entryAssigneeName || user?.displayName || user?.email || 'Self',
      });

      if (!res.success) {
        showToast({ message: res.error || 'Failed to save time entry' });
        return;
      }
      showToast({ message: 'Time logged successfully' });
      resetTimer();
    }

    setSaveSheetOpen(false);
    setEditingEntry(null);
  };

  const handleManualEntry = () => {
    if (isViewer) {
      showToast({ message: 'Viewer role has read-only access' });
      return;
    }
    resetTimer();
    setEditingEntry(null);
    setManualDuration('01:00:00');
    setEntryDate(getTodayDateStr());
    if (filterProjectId) {
      setActiveProjectId(filterProjectId);
      const p = projects.find((x) => x.id === filterProjectId);
      if (p?.clientId) setActiveClientId(p.clientId);
      if (p?.hourlyRate != null) {
        setActiveHourlyRate(p.hourlyRate);
        setEntryHourlyRate(String(p.hourlyRate));
      }
    }
    setEntryAssigneeId(user?.uid || '');
    setEntryAssigneeName(user?.displayName || user?.email || 'Self');
    setSaveSheetOpen(true);
  };

  const handleEditEntry = (entry: TimeEntry) => {
    if (isViewer) {
      showToast({ message: 'Viewer role has read-only access' });
      return;
    }
    setEditingEntry(entry);
    setActiveProjectId(entry.projectId || '');
    setActiveTaskId(entry.taskId || '');
    setActiveClientId(entry.clientId || '');
    setActiveNote(entry.note || '');
    setActiveBillable(entry.billable);
    setEntryHourlyRate(entry.hourlyRate != null ? String(entry.hourlyRate) : '');
    setEntryAssigneeId(entry.userId || '');
    setEntryAssigneeName(entry.userName || '');
    setManualDuration(formatTime(entry.durationSeconds));
    const d = new Date(entry.startedAt);
    setEntryDate(!isNaN(d.getTime()) ? d.toISOString().split('T')[0] : getTodayDateStr());
    setSaveSheetOpen(true);
  };

  const handleDeleteEntry = (id: string) => {
    if (isViewer) {
      showToast({ message: 'Viewer role has read-only access' });
      return;
    }
    setEntryToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteEntry = () => {
    if (entryToDelete) {
      deleteTimeEntry(entryToDelete);
      showToast({ message: 'Entry deleted' });
      setEntryToDelete(null);
    }
    setDeleteConfirmOpen(false);
  };

  const handleExportCSV = () => {
    const clientsMap: Record<string, string> = {};
    clients.forEach((c) => (clientsMap[c.id] = c.name));
    const projectsMap: Record<string, string> = {};
    projects.forEach((p) => (projectsMap[p.id] = p.name));
    const tasksMap: Record<string, string> = {};
    tasks.forEach((t) => (tasksMap[t.id] = t.title));

    const csvContent = exportTimeEntriesCSV(clientsMap, projectsMap, tasksMap);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `menkir-time-entries-${getTodayDateStr()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast({ message: 'Time tracking CSV exported' });
  };

  // Filtered entries
  const filteredEntries = useMemo(() => {
    return timeEntries.filter((e) => {
      if (selectedFilterProject && e.projectId !== selectedFilterProject) return false;
      return true;
    });
  }, [timeEntries, selectedFilterProject]);

  // Group history by date
  const groupedEntries = useMemo(() => {
    const map = new Map<string, { label: string; entries: TimeEntry[] }>();
    filteredEntries.forEach((entry) => {
      const d = new Date(entry.startedAt);
      const isoKey = isNaN(d.getTime()) ? '1970-01-01' : d.toISOString().split('T')[0];
      const label = isNaN(d.getTime())
        ? 'Recent'
        : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      if (!map.has(isoKey)) {
        map.set(isoKey, { label, entries: [] });
      }
      map.get(isoKey)!.entries.push(entry);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([_, group]) => [group.label, group.entries] as [string, TimeEntry[]]);
  }, [filteredEntries]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let totalSecs = 0;
    let billableSecs = 0;
    let billableValue = 0;

    for (const e of filteredEntries) {
      totalSecs += e.durationSeconds;
      if (e.billable) {
        billableSecs += e.durationSeconds;
        const project = projects.find((p) => p.id === e.projectId);
        const rate = e.hourlyRate != null ? e.hourlyRate : project?.hourlyRate || 0;
        if (rate > 0) {
          billableValue += (e.durationSeconds / 3600) * rate;
        }
      }
    }

    return {
      totalHours: (totalSecs / 3600).toFixed(1),
      billableHours: (billableSecs / 3600).toFixed(1),
      billableValue: Math.round(billableValue * 100) / 100,
    };
  }, [filteredEntries, projects]);

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const activeTask = tasks.find((t) => t.id === activeTaskId);

  return (
    <div className="absolute inset-0 bg-tx-primary z-50 flex flex-col overflow-y-auto no-scrollbar">
      <Header
        leftIcon={
          <button
            onClick={onDismiss}
            className="w-11 h-11 rounded-full bg-tx-inverse/10 flex items-center justify-center text-tx-inverse hover:bg-tx-inverse/20 transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        }
        title={<span className="text-tx-inverse">Time Tracker</span>}
        rightIcon={
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="w-11 h-11 rounded-full bg-tx-inverse/10 flex items-center justify-center text-tx-inverse hover:bg-tx-inverse/20 transition-colors"
              aria-label="Export CSV"
              title="Export Time Entries to CSV"
            >
              <Download size={18} />
            </button>
            <button
              onClick={handleManualEntry}
              disabled={isViewer}
              className={`w-11 h-11 rounded-full bg-tx-inverse/10 flex items-center justify-center text-tx-inverse hover:bg-tx-inverse/20 transition-colors ${
                isViewer ? 'opacity-40 cursor-not-allowed' : ''
              }`}
              aria-label="Manual entry"
              title="Add Manual Time Entry"
            >
              <Plus size={20} />
            </button>
          </div>
        }
      />

      {/* Main Timer Display */}
      <div className="flex flex-col items-center justify-center px-5 py-6">
        {/* Policy Notice Callout */}
        <div className="flex items-center gap-1.5 px-3 py-1 bg-tx-inverse/10 rounded-full border border-tx-inverse/10 text-[11px] text-tx-inverse/70 mb-4 max-w-sm text-center">
          <Info size={12} className="text-accent-primary shrink-0" />
          <span>Single active timer policy enforced</span>
          <button
            onClick={() => setPolicyInfoVisible(!policyInfoVisible)}
            className="underline ml-1 text-tx-inverse hover:text-accent-primary"
          >
            details
          </button>
        </div>

        {policyInfoVisible && (
          <div className="mb-6 p-3 bg-tx-inverse/10 border border-tx-inverse/20 rounded-xl text-xs text-tx-inverse/90 max-w-md text-left">
            <div className="font-semibold text-accent-primary mb-1">Simultaneous Timer Policy</div>
            <p className="leading-relaxed">{simultaneousTimerPolicy}</p>
          </div>
        )}

        {/* Live Timer / Manual Entry Toggle Buttons */}
        <div className="inline-flex bg-tx-inverse/10 p-1 rounded-xl mb-6 border border-tx-inverse/10">
          <button className="px-5 py-1.5 rounded-lg bg-canvas text-tx-primary text-xs font-semibold shadow-xs">
            Live Timer
          </button>
          <button
            onClick={handleManualEntry}
            disabled={isViewer}
            className={`px-5 py-1.5 rounded-lg text-tx-inverse/60 text-xs font-medium hover:text-tx-inverse transition-colors ${
              isViewer ? 'opacity-40 cursor-not-allowed' : ''
            }`}
          >
            Manual Entry
          </button>
        </div>

        {/* Circular Clock Animation */}
        <div className="relative w-64 h-64 mb-8">
          <div className="absolute inset-0">
            {Array.from({ length: 60 }).map((_, i) => (
              <div
                key={i}
                className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-64"
                style={{ transform: `translateX(-50%) rotate(${i * 6}deg)` }}
              >
                <div
                  className={`w-0.5 ${i % 5 === 0 ? 'h-3 bg-tx-inverse/40' : 'h-1.5 bg-tx-inverse/20'}`}
                />
              </div>
            ))}
          </div>

          <svg className="absolute inset-0 transform -rotate-90 w-full h-full">
            <circle
              cx="128"
              cy="128"
              r="114"
              fill="none"
              stroke="var(--color-accent-primary)"
              strokeWidth="4"
              strokeDasharray="716"
              strokeDashoffset={timerState === 'running' ? 716 - ((elapsedSeconds % 60) / 60) * 716 : 716}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-linear"
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
            <div
              className={`text-4xl md:text-5xl font-light font-mono tabular-nums tracking-tight transition-colors ${
                timerState === 'paused' ? 'text-tx-inverse/50' : 'text-tx-inverse'
              }`}
            >
              {formatTime(elapsedSeconds)}
            </div>

            {timerState !== 'idle' ? (
              <div className="flex flex-col items-center gap-1 mt-2 text-center max-w-[200px]">
                {activeProject && (
                  <span className="text-xs font-semibold text-accent-primary truncate">
                    {activeProject.name}
                  </span>
                )}
                {activeTask && (
                  <span className="text-[11px] text-tx-inverse/70 truncate flex items-center gap-1">
                    <CheckSquare size={10} />
                    {activeTask.title}
                  </span>
                )}
                {activeNote && (
                  <span className="text-[11px] text-tx-inverse/60 italic truncate">
                    "{activeNote}"
                  </span>
                )}
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      activeBillable
                        ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary/30'
                        : 'bg-tx-inverse/10 text-tx-inverse/60'
                    }`}
                  >
                    {activeBillable ? 'Billable' : 'Non-billable'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-tx-inverse/40 mt-2 font-mono">Ready to track</div>
            )}
          </div>
        </div>

        {/* Timer Control Buttons */}
        {timerState === 'idle' ? (
          <button
            onClick={handleStartButton}
            disabled={isViewer}
            className={`px-12 h-13 rounded-xl bg-accent-primary text-tx-primary text-sm font-semibold flex items-center justify-center active:scale-95 hover:opacity-95 transition-all shadow-xs ${
              isViewer ? 'opacity-40 cursor-not-allowed' : ''
            }`}
          >
            Start
          </button>
        ) : (
          <div className="flex items-center gap-3">
            {timerState === 'running' ? (
              <button
                onClick={pauseTimer}
                disabled={isViewer}
                className="w-13 h-13 rounded-xl bg-tx-inverse/10 hover:bg-tx-inverse/20 flex items-center justify-center text-tx-inverse active:scale-95 transition-all border border-tx-inverse/10"
                aria-label="Pause timer"
                title="Pause Timer"
              >
                <Pause size={20} fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={handleStartButton}
                disabled={isViewer}
                className="w-13 h-13 rounded-xl bg-tx-inverse/10 hover:bg-tx-inverse/20 flex items-center justify-center text-tx-inverse active:scale-95 transition-all border border-tx-inverse/10"
                aria-label="Resume timer"
                title="Resume Timer"
              >
                <Play size={20} fill="currentColor" />
              </button>
            )}
            <button
              onClick={handleStopButton}
              disabled={isViewer}
              className={`px-8 h-13 rounded-xl bg-accent-primary text-tx-primary text-sm font-semibold flex items-center justify-center active:scale-95 hover:opacity-95 transition-all shadow-xs ${
                isViewer ? 'opacity-40 cursor-not-allowed' : ''
              }`}
            >
              Stop & Save
            </button>
          </div>
        )}
      </div>

      {/* Recent Logs & Overview Section */}
      <div className="flex-1 bg-canvas rounded-t-3xl px-5 py-6 border-t border-bd-subtle">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-canvas-card border border-bd-subtle rounded-xl p-3 shadow-xs">
            <div className="text-[11px] font-semibold text-tx-muted uppercase tracking-wider">Total Time</div>
            <div className="text-xl font-light font-mono tabular-nums text-tx-primary mt-1">
              {metrics.totalHours} <span className="text-xs text-tx-muted font-normal">hrs</span>
            </div>
          </div>
          <div className="bg-canvas-card border border-bd-subtle rounded-xl p-3 shadow-xs">
            <div className="text-[11px] font-semibold text-tx-muted uppercase tracking-wider">Billable Time</div>
            <div className="text-xl font-light font-mono tabular-nums text-tx-primary mt-1">
              {metrics.billableHours} <span className="text-xs text-tx-muted font-normal">hrs</span>
            </div>
          </div>
          <div className="bg-canvas-card border border-bd-subtle rounded-xl p-3 shadow-xs">
            <div className="text-[11px] font-semibold text-tx-muted uppercase tracking-wider">Billable Value</div>
            <div className="text-xl font-light font-mono tabular-nums text-tx-primary mt-1 text-emerald-600">
              {formatCurrency(metrics.billableValue, preferences.currency)}
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2 flex-1 max-w-xs">
            <select
              value={selectedFilterProject}
              onChange={(e) => setSelectedFilterProject(e.target.value)}
              className="w-full bg-surface-neutral border border-bd-subtle rounded-xl px-3 py-2 text-xs text-tx-primary outline-none font-medium"
            >
              <option value="">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <span className="text-xs font-mono tabular-nums text-tx-muted">
            {filteredEntries.length} logs
          </span>
        </div>

        {/* Grouped Logs */}
        {groupedEntries.map(([date, entries]) => (
          <div key={date} className="mb-6 last:mb-0">
            <div className="text-xs font-semibold text-tx-muted mb-2.5 font-mono uppercase tracking-wider">
              {date}
            </div>
            <div className="flex flex-col gap-2.5">
              {entries.map((entry) => {
                const p = projects.find((x) => x.id === entry.projectId);
                const t = tasks.find((x) => x.id === entry.taskId);
                const c = clients.find((x) => x.id === (entry.clientId || p?.clientId));
                const rate = entry.hourlyRate != null ? entry.hourlyRate : p?.hourlyRate || 0;
                const billableAmount =
                  entry.billable && rate > 0
                    ? Math.round(((entry.durationSeconds / 3600) * rate) * 100) / 100
                    : 0;

                return (
                  <div
                    key={entry.id}
                    className="bg-canvas-card hover:bg-surface-hover border border-bd-subtle rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 group transition-all shadow-xs"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-semibold font-mono tabular-nums text-tx-primary">
                          {formatTime(entry.durationSeconds)}
                        </span>
                        <span className="text-xs text-tx-muted font-mono">
                          ({(entry.durationSeconds / 3600).toFixed(2)}h)
                        </span>

                        {entry.billable ? (
                          <span className="text-[11px] px-2 py-0.5 rounded-md font-semibold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 flex items-center gap-1">
                            {rate > 0 ? (
                              <>
                                <span>{formatCurrency(billableAmount, preferences.currency)}</span>
                                <span className="opacity-75">(@{formatCurrency(rate, preferences.currency)}/h)</span>
                              </>
                            ) : (
                              'Billable (No rate configured)'
                            )}
                          </span>
                        ) : (
                          <span className="text-[11px] px-2 py-0.5 rounded-md font-medium bg-surface-neutral text-tx-muted border border-bd-subtle">
                            Non-billable
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap text-xs text-tx-muted mt-1.5">
                        {p && (
                          <span className="font-medium text-tx-secondary flex items-center gap-1">
                            <Briefcase size={12} />
                            {p.name}
                          </span>
                        )}
                        {t && (
                          <span className="text-tx-muted flex items-center gap-1">
                            <CheckSquare size={12} />
                            {t.title}
                          </span>
                        )}
                        {c && <span className="text-tx-muted opacity-80">• {c.name}</span>}
                        {entry.userName && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-surface-neutral border border-bd-subtle text-tx-secondary flex items-center gap-1">
                            <User size={10} />
                            {entry.userName}
                          </span>
                        )}
                      </div>

                      {entry.note && (
                        <p className="text-xs text-tx-primary/80 mt-1.5 line-clamp-2">
                          {entry.note}
                        </p>
                      )}
                    </div>

                    {!isViewer && (
                      <div className="flex items-center gap-1 self-end md:self-center shrink-0">
                        <button
                          onClick={() => handleEditEntry(entry)}
                          className="p-2 text-tx-muted hover:text-tx-primary rounded-lg hover:bg-surface-neutral transition-colors"
                          aria-label="Edit time entry"
                          title="Edit"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => handleDeleteEntry(entry.id)}
                          className="p-2 text-tx-muted hover:text-red-500 rounded-lg hover:bg-red-500/10 transition-colors"
                          aria-label="Delete time entry"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {groupedEntries.length === 0 && (
          <div className="text-center py-12 bg-canvas-card rounded-2xl border border-dashed border-bd-subtle p-6">
            <Clock size={32} className="mx-auto text-tx-muted mb-2 opacity-50" />
            <div className="text-sm font-semibold text-tx-primary mb-1">No time entries recorded</div>
            <p className="text-xs text-tx-muted max-w-xs mx-auto">
              Start the live timer above or tap the '+' icon to log time manually.
            </p>
          </div>
        )}
      </div>

      {/* Start Sheet */}
      <BottomSheet
        isOpen={isStartSheetOpen}
        onClose={() => setStartSheetOpen(false)}
        title="Start Timer"
        onSave={handleConfirmStart}
        saveLabel="Start"
      >
        <BottomSheetField label="Project (Optional)">
          <SearchPicker
            items={projects.map((p) => ({ id: p.id, label: p.name }))}
            value={activeProjectId}
            onChange={(id) => {
              setActiveProjectId(id);
              setActiveTaskId('');
              const p = projects.find((x) => x.id === id);
              if (p?.clientId) setActiveClientId(p.clientId);
              else setActiveClientId('');
              if (p?.hourlyRate != null) setActiveHourlyRate(p.hourlyRate);
            }}
          />
        </BottomSheetField>

        {activeProjectId && (
          <BottomSheetField label="Linked Task (Optional)">
            <select
              value={activeTaskId}
              onChange={(e) => setActiveTaskId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none text-[15px] outline-none"
            >
              <option value="">No specific task</option>
              {tasks
                .filter((t) => t.projectId === activeProjectId)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
            </select>
          </BottomSheetField>
        )}

        <BottomSheetField label="Description / Note">
          <input
            type="text"
            placeholder="What are you working on?"
            value={activeNote}
            onChange={(e) => setActiveNote(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none text-[15px] outline-none"
          />
        </BottomSheetField>

        <BottomSheetField>
          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-surface-neutral mt-1">
            <div>
              <span className="text-[15px] font-medium text-tx-primary block">Billable Work</span>
              <span className="text-xs text-tx-muted">Eligible for client invoicing</span>
            </div>
            <button
              onClick={() => setActiveBillable(!activeBillable)}
              className={`w-12 h-6 rounded-full transition-colors flex items-center p-1 ${
                activeBillable ? 'bg-tx-primary' : 'bg-canvas border border-bd-subtle'
              }`}
              aria-label={activeBillable ? 'Disable billable' : 'Enable billable'}
            >
              <div
                className={`w-4 h-4 rounded-full bg-canvas transition-transform ${
                  activeBillable ? 'translate-x-6' : 'translate-x-0 bg-tx-muted'
                }`}
              />
            </button>
          </div>
        </BottomSheetField>
      </BottomSheet>

      {/* Save Summary / Manual Entry Sheet */}
      <BottomSheet
        isOpen={isSaveSheetOpen}
        onClose={() => {
          setSaveSheetOpen(false);
          setEditingEntry(null);
        }}
        title={editingEntry ? 'Edit Time Entry' : 'Save Time Record'}
        onSave={handleSave}
        saveLabel="Save"
        secondaryAction={
          !editingEntry ? (
            <button
              onClick={() => {
                setSaveSheetOpen(false);
                resetTimer();
              }}
              className="w-full py-3 rounded-xl text-tx-muted text-[14px] font-medium hover:text-red-500 transition-colors"
            >
              Discard Session
            </button>
          ) : undefined
        }
      >
        <BottomSheetField label="Duration (HH:MM:SS or hours)">
          <div className="flex items-center text-[32px] font-light text-tx-primary">
            <input
              type="text"
              value={manualDuration}
              onChange={(e) => setManualDuration(e.target.value)}
              placeholder="01:00:00"
              className="w-full bg-transparent outline-none py-2 tabular-nums"
              autoFocus
            />
          </div>
        </BottomSheetField>

        <BottomSheetField label="Date">
          <input
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none text-[15px] outline-none"
          />
        </BottomSheetField>

        <BottomSheetField label="Project (Optional)">
          <SearchPicker
            items={projects.map((p) => ({ id: p.id, label: p.name }))}
            value={activeProjectId}
            onChange={(id) => {
              setActiveProjectId(id);
              setActiveTaskId('');
              const p = projects.find((x) => x.id === id);
              if (p?.clientId) setActiveClientId(p.clientId);
              else setActiveClientId('');
              if (p?.hourlyRate != null && !entryHourlyRate) {
                setEntryHourlyRate(String(p.hourlyRate));
              }
            }}
          />
        </BottomSheetField>

        {activeProjectId && (
          <BottomSheetField label="Linked Task (Optional)">
            <select
              value={activeTaskId}
              onChange={(e) => setActiveTaskId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none text-[15px] outline-none"
            >
              <option value="">No specific task</option>
              {tasks
                .filter((t) => t.projectId === activeProjectId)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
            </select>
          </BottomSheetField>
        )}

        {members && members.length > 0 && (
          <BottomSheetField label="Assigned Member">
            <select
              value={entryAssigneeId}
              onChange={(e) => {
                const target = members.find((m) => m.userId === e.target.value);
                setEntryAssigneeId(e.target.value);
                setEntryAssigneeName(target ? target.name || target.email : '');
              }}
              className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none text-[15px] outline-none"
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name || m.email} ({m.role})
                </option>
              ))}
            </select>
          </BottomSheetField>
        )}

        <BottomSheetField label="Description / Notes">
          <textarea
            placeholder="Work completed..."
            value={activeNote}
            onChange={(e) => setActiveNote(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none text-[15px] outline-none h-20 resize-none"
          />
        </BottomSheetField>

        <BottomSheetField>
          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-surface-neutral">
            <div>
              <span className="text-[15px] font-medium text-tx-primary block">Billable</span>
              <span className="text-xs text-tx-muted">Count towards project billable hours</span>
            </div>
            <button
              onClick={() => setActiveBillable(!activeBillable)}
              className={`w-12 h-6 rounded-full transition-colors flex items-center p-1 ${
                activeBillable ? 'bg-tx-primary' : 'bg-canvas border border-bd-subtle'
              }`}
              aria-label={activeBillable ? 'Disable billable' : 'Enable billable'}
            >
              <div
                className={`w-4 h-4 rounded-full bg-canvas transition-transform ${
                  activeBillable ? 'translate-x-6' : 'translate-x-0 bg-tx-muted'
                }`}
              />
            </button>
          </div>
        </BottomSheetField>

        {activeBillable && (
          <BottomSheetField label={`Hourly Rate (${preferences.currency}/h)`}>
            <input
              type="number"
              min="0"
              step="5"
              placeholder="e.g. 125"
              value={entryHourlyRate}
              onChange={(e) => setEntryHourlyRate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none text-[15px] outline-none"
            />
          </BottomSheetField>
        )}

        {editingEntry && editingEntry.projectId && (
          <div className="pt-4 mt-2 border-t border-bd-subtle">
            <button
              onClick={() => {
                setSaveSheetOpen(false);
                goToTab('projects', { filterProjectId: editingEntry.projectId });
              }}
              className="w-full py-2.5 px-3 bg-surface-neutral rounded-xl border border-bd-subtle text-xs font-semibold text-tx-primary hover:border-accent-primary/50 transition-colors"
            >
              View Linked Project
            </button>
          </div>
        )}
      </BottomSheet>

      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={confirmDeleteEntry}
        title="Delete Time Entry"
        body="Are you sure you want to delete this recorded time entry? This cannot be undone."
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
