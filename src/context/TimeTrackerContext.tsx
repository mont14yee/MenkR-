import React, { createContext, useContext, ReactNode } from 'react';
import { TimeEntry } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { generateId } from '../utils/id';

interface TimeTrackerContextType {
  timeEntries: TimeEntry[];
  addTimeEntry: (entry: Omit<TimeEntry, 'id'>) => void;
  updateTimeEntry: (id: string, updates: Partial<TimeEntry>) => void;
  deleteTimeEntry: (id: string) => void;
  
  // Timer State
  timerState: 'idle' | 'running' | 'paused';
  startTimer: () => void;
  pauseTimer: () => void;
  stopTimer: () => void;
  resetTimer: () => void;
  
  timerStartedAt: string | null;
  elapsedSeconds: number; // dynamically computed
  
  activeProjectId: string;
  setActiveProjectId: (id: string) => void;
  activeTaskId: string;
  setActiveTaskId: (id: string) => void;
  activeClientId: string;
  setActiveClientId: (id: string) => void;
  startTimerFor: (params: { projectId?: string; taskId?: string; clientId?: string; note?: string }) => void;
  activeNote: string;
  setActiveNote: (note: string) => void;
  activeBillable: boolean;
  setActiveBillable: (billable: boolean) => void;
}

const TimeTrackerContext = createContext<TimeTrackerContextType | undefined>(undefined);

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

  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    if (timerState === 'running') {
      const interval = setInterval(() => setTick(t => t + 1), 1000);
      return () => clearInterval(interval);
    }
  }, [timerState]);

  React.useEffect(() => {
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
    const newEntry: TimeEntry = { ...entry, id: generateId(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setTimeEntries((prev) => [...prev, newEntry]);
  };

  const updateTimeEntry = (id: string, updates: Partial<TimeEntry>) => {
    setTimeEntries((prev) => prev.map((e) => (e.id === id ? { updatedAt: new Date().toISOString(), ...e, ...updates } : e)));
  };

  const deleteTimeEntry = (id: string) => {
    setTimeEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const startTimerFor = ({ projectId, taskId, clientId, note }: { projectId?: string; taskId?: string; clientId?: string; note?: string }) => {
    if (timerState === 'running') {
      stopTimer();
      // Wait for state to settle? No, stopTimer is synchronous enough for accumulated.
      // We will actually just save the current entry and reset.
      // Wait, stopTimer just pauses. The user has to save it manually?
      // No, in standard apps, starting a new timer when one is running usually stops and saves the old one, or just pauses it.
      // Let's just pause the current one.
      pauseTimer();
    }
    resetTimer(); // clears current active states
    if (projectId) setActiveProjectId(projectId);
    if (taskId) setActiveTaskId(taskId);
    if (clientId) setActiveClientId(clientId);
    if (note) setActiveNote(note);
    
    // Now start
    const now = Date.now();
    setTimerStartedAt(new Date(now).toISOString());
    setAccumulatedSeconds(0);
    setTimerResumedAt(now);
    setTimerState('running');
  };

  const startTimer = () => {
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
      setAccumulatedSeconds(prev => prev + Math.floor((now - timerResumedAt) / 1000));
      setTimerResumedAt(null);
    }
    setTimerState('paused');
  };

  const stopTimer = () => {
    pauseTimer(); // this updates accumulatedSeconds safely
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
  };

  let elapsedSeconds = accumulatedSeconds;
  if (timerState === 'running' && timerResumedAt) {
    elapsedSeconds += Math.floor((Date.now() - timerResumedAt) / 1000);
  }

  return (
    <TimeTrackerContext.Provider value={{ 
      timeEntries, addTimeEntry, updateTimeEntry, deleteTimeEntry,
      timerState, startTimer, pauseTimer, stopTimer, resetTimer,
      timerStartedAt, elapsedSeconds,
      activeProjectId, setActiveProjectId,
      activeTaskId, setActiveTaskId,
      activeClientId, setActiveClientId,
      startTimerFor,
      activeNote, setActiveNote,
      activeBillable, setActiveBillable
    }}>
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
