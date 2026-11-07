import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { TimeEntry } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { generateId } from '../utils/id';

interface TimeTrackerContextType {
  timeEntries: TimeEntry[];
  addTimeEntry: (entry: Omit<TimeEntry, 'id'>) => { success: boolean; id?: string; error?: string };
  updateTimeEntry: (id: string, updates: Partial<TimeEntry>) => { success: boolean; error?: string };
  deleteTimeEntry: (id: string) => void;

  // Timer State & Control
  timerState: 'idle' | 'running' | 'paused';
  startTimer: () => void;
  pauseTimer: () => void;
  stopTimer: () => void;
  resetTimer: () => void;

  timerStartedAt: string | null;
  elapsedSeconds: number; // dynamically computed

  // Active Timer Context
  activeProjectId: string;
  setActiveProjectId: (id: string) => void;
  activeTaskId: string;
  setActiveTaskId: (id: string) => void;
  activeClientId: string;
  setActiveClientId: (id: string) => void;
  activeNote: string;
  setActiveNote: (note: string) => void;
  activeBillable: boolean;
  setActiveBillable: (billable: boolean) => void;
  activeHourlyRate: number | undefined;
  setActiveHourlyRate: (rate: number | undefined) => void;
  activeUserId: string;
  setActiveUserId: (userId: string) => void;
  activeUserName: string;
  setActiveUserName: (name: string) => void;

  startTimerFor: (params: {
    projectId?: string;
    taskId?: string;
    clientId?: string;
    note?: string;
    userId?: string;
    userName?: string;
    hourlyRate?: number;
  }) => void;

  exportTimeEntriesCSV: (
    clientsMap?: Record<string, string>,
    projectsMap?: Record<string, string>,
    tasksMap?: Record<string, string>
  ) => string;

  simultaneousTimerPolicy: string;
}

const TimeTrackerContext = createContext<TimeTrackerContextType | undefined>(undefined);

export const SIMULTANEOUS_TIMER_POLICY =
  'Single Active Timer Policy: Only one active timer can run at any moment. Starting a new timer automatically safe-pauses the existing session to prevent duplicate billable hours.';

export function TimeTrackerProvider({ children }: { children: ReactNode }) {
  const [timeEntries, setTimeEntries] = useLocalStorage<TimeEntry[]>('menkir-time-entries', []);
  const [timerState, setTimerState] = useLocalStorage<'idle' | 'running' | 'paused'>('menkir-timer-state', 'idle');
  const [timerStartedAt, setTimerStartedAt] = useLocalStorage<string | null>('menkir-timer-started-at', null);
  const [timerResumedAt, setTimerResumedAt] = useLocalStorage<number | null>('menkir-timer-resumed-at', null);
  const [accumulatedSeconds, setAccumulatedSeconds] = useLocalStorage<number>('menkir-timer-accumulated', 0);

  const [activeProjectId, setActiveProjectId] = useLocalStorage<string>('menkir-timer-project', '');
  const [activeTaskId, setActiveTaskId] = useLocalStorage<string>('menkir-timer-task', '');
  const [activeClientId, setActiveClientId] = useLocalStorage<string>('menkir-timer-client', '');
  const [activeNote, setActiveNote] = useLocalStorage<string>('menkir-timer-note', '');
  const [activeBillable, setActiveBillable] = useLocalStorage<boolean>('menkir-timer-billable', true);
  const [activeHourlyRate, setActiveHourlyRate] = useLocalStorage<number | undefined>('menkir-timer-rate', undefined);
  const [activeUserId, setActiveUserId] = useLocalStorage<string>('menkir-timer-user-id', '');
  const [activeUserName, setActiveUserName] = useLocalStorage<string>('menkir-timer-user-name', '');

  const [, setTick] = useState(0);

  useEffect(() => {
    if (timerState === 'running') {
      const interval = setInterval(() => setTick((t) => t + 1), 1000);
      return () => clearInterval(interval);
    }
  }, [timerState]);

  // Backward-compatibility schema migration
  useEffect(() => {
    let migrated = false;
    const migratedEntries = timeEntries.map((e: any) => {
      let changed = false;
      const newE = { ...e };
      if (newE.date && !newE.startedAt) {
        newE.startedAt = newE.date;
        delete newE.date;
        changed = true;
      }
      if (newE.notes !== undefined && newE.note === undefined) {
        newE.note = newE.notes;
        delete newE.notes;
        changed = true;
      }
      if (changed) migrated = true;
      return newE;
    });
    if (migrated) {
      setTimeEntries(migratedEntries);
    }
  }, [timeEntries, setTimeEntries]);

  const addTimeEntry = (entry: Omit<TimeEntry, 'id'>) => {
    const duration = Math.round(Number(entry.durationSeconds));
    if (isNaN(duration) || duration <= 0) {
      return { success: false, error: 'Duration must be greater than 0 seconds.' };
    }
    if (duration > 86400) {
      return { success: false, error: 'Duration cannot exceed 24 hours per time entry.' };
    }
    if (!entry.startedAt || isNaN(Date.parse(entry.startedAt))) {
      return { success: false, error: 'A valid start date is required.' };
    }

    const id = generateId();
    const newEntry: TimeEntry = {
      ...entry,
      id,
      durationSeconds: duration,
      billable: Boolean(entry.billable),
      hourlyRate: entry.hourlyRate != null && entry.hourlyRate >= 0 ? Number(entry.hourlyRate) : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setTimeEntries((prev) => [newEntry, ...prev]);

    // Asynchronously log audit event
    try {
      const token = localStorage.getItem('menkir-auth-token') || sessionStorage.getItem('menkir-auth-token');
      const orgId = localStorage.getItem('menkir-active-org-id');
      if (token && orgId) {
        fetch('/api/audit-events', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            'x-organization-id': orgId,
          },
          body: JSON.stringify({
            action: 'time_entry.created',
            entityType: 'time_entry',
            entityId: id,
            metadata: {
              projectId: newEntry.projectId,
              taskId: newEntry.taskId,
              durationSeconds: newEntry.durationSeconds,
              billable: newEntry.billable,
            },
          }),
        }).catch(() => {});
      }
    } catch {
      // ignore
    }

    return { success: true, id };
  };

  const updateTimeEntry = (id: string, updates: Partial<TimeEntry>) => {
    if (updates.durationSeconds !== undefined) {
      const duration = Math.round(Number(updates.durationSeconds));
      if (isNaN(duration) || duration <= 0) {
        return { success: false, error: 'Duration must be greater than 0 seconds.' };
      }
      if (duration > 86400) {
        return { success: false, error: 'Duration cannot exceed 24 hours per time entry.' };
      }
      updates.durationSeconds = duration;
    }
    if (updates.hourlyRate !== undefined && updates.hourlyRate !== null) {
      const rate = Number(updates.hourlyRate);
      if (isNaN(rate) || rate < 0) {
        return { success: false, error: 'Hourly rate must be a valid non-negative number.' };
      }
      updates.hourlyRate = rate;
    }

    setTimeEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...updates, updatedAt: new Date().toISOString() } : e))
    );
    return { success: true };
  };

  const deleteTimeEntry = (id: string) => {
    setTimeEntries((prev) => prev.filter((e) => e.id !== id));
  };

  // Enforces Single Active Timer Policy
  const startTimer = () => {
    if (timerState === 'running') {
      // Idempotent: already running, do nothing to avoid duplicate timer states
      return;
    }
    const now = Date.now();
    if (timerState === 'idle') {
      setTimerStartedAt(new Date(now).toISOString());
      setAccumulatedSeconds(0);
    }
    setTimerResumedAt(now);
    setTimerState('running');
  };

  const pauseTimer = () => {
    if (timerState === 'running' && timerResumedAt) {
      const now = Date.now();
      const additional = Math.floor((now - timerResumedAt) / 1000);
      setAccumulatedSeconds((prev) => prev + additional);
      setTimerResumedAt(null);
    }
    setTimerState('paused');
  };

  const stopTimer = () => {
    pauseTimer();
  };

  const resetTimer = () => {
    setTimerState('idle');
    setTimerStartedAt(null);
    setTimerResumedAt(null);
    setAccumulatedSeconds(0);
    setActiveProjectId('');
    setActiveTaskId('');
    setActiveClientId('');
    setActiveNote('');
    setActiveBillable(true);
    setActiveHourlyRate(undefined);
  };

  const startTimerFor = ({
    projectId,
    taskId,
    clientId,
    note,
    userId,
    userName,
    hourlyRate,
  }: {
    projectId?: string;
    taskId?: string;
    clientId?: string;
    note?: string;
    userId?: string;
    userName?: string;
    hourlyRate?: number;
  }) => {
    // Single Active Timer Policy:
    // If currently running, check if it's identical or needs switching
    if (timerState === 'running') {
      const sameProject = (projectId || '') === activeProjectId;
      const sameTask = (taskId || '') === activeTaskId;
      if (sameProject && sameTask) {
        // Already active for this task, do not reset or duplicate
        return;
      }
      // Pause prior running timer to safely capture accumulated seconds
      pauseTimer();
    }

    resetTimer();
    if (projectId) setActiveProjectId(projectId);
    if (taskId) setActiveTaskId(taskId);
    if (clientId) setActiveClientId(clientId);
    if (note) setActiveNote(note);
    if (userId) setActiveUserId(userId);
    if (userName) setActiveUserName(userName);
    if (hourlyRate != null) setActiveHourlyRate(hourlyRate);

    const now = Date.now();
    setTimerStartedAt(new Date(now).toISOString());
    setAccumulatedSeconds(0);
    setTimerResumedAt(now);
    setTimerState('running');
  };

  let elapsedSeconds = accumulatedSeconds;
  if (timerState === 'running' && timerResumedAt) {
    elapsedSeconds += Math.floor((Date.now() - timerResumedAt) / 1000);
  }

  const exportTimeEntriesCSV = (
    clientsMap: Record<string, string> = {},
    projectsMap: Record<string, string> = {},
    tasksMap: Record<string, string> = {}
  ): string => {
    const headers = [
      'Date',
      'Client',
      'Project',
      'Task',
      'Assignee',
      'Duration (Hours)',
      'Duration (Formatted)',
      'Billable',
      'Hourly Rate',
      'Billable Amount',
      'Notes'
    ];

    const rows = timeEntries.map((e) => {
      const d = new Date(e.startedAt);
      const dateStr = isNaN(d.getTime()) ? e.startedAt : d.toISOString().split('T')[0];
      const clientName = (e.clientId && clientsMap[e.clientId]) || '—';
      const projectName = (e.projectId && projectsMap[e.projectId]) || '—';
      const taskTitle = (e.taskId && tasksMap[e.taskId]) || '—';
      const hours = (e.durationSeconds / 3600).toFixed(2);
      const h = Math.floor(e.durationSeconds / 3600);
      const m = Math.floor((e.durationSeconds % 3600) / 60);
      const s = e.durationSeconds % 60;
      const formatted = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
      const billableStr = e.billable ? 'Yes' : 'No';
      const rate = e.hourlyRate != null && e.hourlyRate > 0 ? e.hourlyRate.toFixed(2) : '0.00';
      const amount =
        e.billable && e.hourlyRate != null && e.hourlyRate > 0
          ? ((e.durationSeconds / 3600) * e.hourlyRate).toFixed(2)
          : '0.00';
      const notes = (e.note || '').replace(/"/g, '""');

      return [
        `"${dateStr}"`,
        `"${clientName}"`,
        `"${projectName}"`,
        `"${taskTitle}"`,
        `"${e.userName || 'Unassigned'}"`,
        hours,
        `"${formatted}"`,
        billableStr,
        rate,
        amount,
        `"${notes}"`
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  };

  return (
    <TimeTrackerContext.Provider
      value={{
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
        startTimerFor,
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
        simultaneousTimerPolicy: SIMULTANEOUS_TIMER_POLICY,
      }}
    >
      {children}
    </TimeTrackerContext.Provider>
  );
}

export function useTimeTracker() {
  const context = useContext(TimeTrackerContext);
  if (!context) {
    throw new Error('useTimeTracker must be used within a TimeTrackerProvider');
  }
  return context;
}
