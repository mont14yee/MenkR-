import { useState, useMemo } from 'react';
import { X, MoreVertical, Pause, Play, Edit2, Trash2 } from 'lucide-react';
import { Header } from '../components/Shared';
import { BottomSheet, BottomSheetField } from '../components/BottomSheet';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { SearchPicker } from '../components/SearchPicker';
import { useToast } from '../context/ToastContext';
import { useTimeTracker } from '../context/TimeTrackerContext';
import { useProjects } from '../context/ProjectsContext';
import { useNavigation } from '../context/NavigationContext';
import { usePreferences } from '../context/PreferencesContext';
import { TimeEntry } from '../types';

export function TimeTracker({ onDismiss }: { onDismiss: () => void }) {
  const { showToast } = useToast();
  const { preferences } = usePreferences();
  const { projects } = useProjects();
  const { navigationOptions, push, goToTab } = useNavigation();
  const filterProjectId = navigationOptions?.filterProjectId || '';
  const filterTaskId = navigationOptions?.filterTaskId || '';
  const filterClientId = navigationOptions?.filterClientId || '';
  const {
    timeEntries, addTimeEntry, updateTimeEntry, deleteTimeEntry,
    timerState, startTimer, pauseTimer, stopTimer, resetTimer,
    timerStartedAt, elapsedSeconds,
    activeProjectId, setActiveProjectId,
    activeTaskId, setActiveTaskId, activeClientId, setActiveClientId,
    activeNote, setActiveNote,
    activeBillable, setActiveBillable
  } = useTimeTracker();

  const [isStartSheetOpen, setStartSheetOpen] = useState(false);
  const [isSaveSheetOpen, setSaveSheetOpen] = useState(false);
  const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  
  const [manualDuration, setManualDuration] = useState('00:00:00');

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleStartButton = () => {
    if (timerState === 'paused') {
      startTimer();
    } else {
      setStartSheetOpen(true);
    }
  };

  const handleConfirmStart = () => {
    setStartSheetOpen(false);
    startTimer();
  };

  const handleStopButton = () => {
    stopTimer();
    
    // Apply rounding before showing save sheet
    const incrementSeconds = (preferences.roundingIncrementMinutes || 1) * 60;
    let roundedSeconds = elapsedSeconds;
    if (incrementSeconds > 0) {
      roundedSeconds = Math.ceil(elapsedSeconds / incrementSeconds) * incrementSeconds;
    }
    
    setManualDuration(formatTime(roundedSeconds));
    setSaveSheetOpen(true);
  };

  const handleSave = () => {
    const parts = manualDuration.split(':');
    let totalSecs = elapsedSeconds;
    if (parts.length === 3) {
      totalSecs = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
    }

    // Ensure rounding applies even if user manually typed an exact unrounded time
    const incrementSeconds = (preferences.roundingIncrementMinutes || 1) * 60;
    if (incrementSeconds > 0) {
      totalSecs = Math.ceil(totalSecs / incrementSeconds) * incrementSeconds;
    }

    if (editingEntry) {
      updateTimeEntry(editingEntry.id, {
        projectId: activeProjectId,
        durationSeconds: totalSecs,
        note: activeNote,
        billable: activeBillable,
      });
      showToast({ message: 'Time entry updated' });
    } else {
      addTimeEntry({
        projectId: activeProjectId,
        durationSeconds: totalSecs,
        startedAt: timerStartedAt || new Date().toISOString(),
        note: activeNote,
        billable: activeBillable,
      });
      showToast({ message: 'Time saved successfully' });
      resetTimer();
    }
    
    setSaveSheetOpen(false);
    setEditingEntry(null);
  };

  const handleManualEntry = () => {
    resetTimer();
    setManualDuration('01:00:00');
    setSaveSheetOpen(true);
  };
  
  const handleEditEntry = (entry: TimeEntry) => {
    setEditingEntry(entry);
    setActiveProjectId(entry.projectId);
    setActiveNote(entry.note || '');
    setActiveBillable(entry.billable);
    setManualDuration(formatTime(entry.durationSeconds));
    setSaveSheetOpen(true);
  };

  const handleDeleteEntry = (id: string) => {
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

  // Group history by date
  const groupedEntries = useMemo(() => {
    const map = new Map<string, TimeEntry[]>();
    timeEntries.forEach(entry => {
      const dateKey = new Date(entry.startedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      const arr = map.get(dateKey) || [];
      arr.push(entry);
      map.set(dateKey, arr);
    });
    return Array.from(map.entries()).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
  }, [timeEntries]);

  return (
    <div className="absolute inset-0 bg-tx-primary z-50 flex flex-col overflow-y-auto no-scrollbar">
      <Header
        leftIcon={
          <button onClick={onDismiss} className="w-11 h-11 rounded-full bg-tx-inverse/10 flex items-center justify-center text-tx-inverse" aria-label="Close">
            <X size={20} />
          </button>
        }
        title={<span className="text-tx-inverse">Time Tracker</span>}
        rightIcon={
          <button onClick={handleManualEntry} className="w-11 h-11 rounded-full bg-tx-inverse/10 flex items-center justify-center text-tx-inverse" aria-label="Manual entry">
            <MoreVertical size={20} />
          </button>
        }
      />

      <div className="flex flex-col items-center justify-center px-5 py-8">
        <div className="flex bg-tx-inverse/10 rounded-full p-1 mb-8">
          <button className="px-6 py-2 rounded-full bg-tx-inverse text-tx-primary text-[14px] font-medium">Timer</button>
          <button onClick={handleManualEntry} className="px-6 py-2 rounded-full text-tx-inverse/50 text-[14px] font-medium transition-colors">Manual</button>
        </div>

        <div className="relative w-64 h-64 mb-12">
          <div className="absolute inset-0">
             {Array.from({ length: 60 }).map((_, i) => (
               <div
                 key={i}
                 className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-64"
                 style={{ transform: `translateX(-50%) rotate(${i * 6}deg)` }}
               >
                 <div className={`w-0.5 ${i % 5 === 0 ? 'h-3 bg-tx-inverse/40' : 'h-1.5 bg-tx-inverse/20'}`} />
               </div>
             ))}
          </div>
          
          <svg className="absolute inset-0 transform -rotate-90 w-full h-full">
             <circle
               cx="128" cy="128" r="114"
               fill="none"
               stroke="var(--color-accent-primary)"
               strokeWidth="4"
               strokeDasharray="716"
               strokeDashoffset={timerState === 'running' ? 716 - ((elapsedSeconds % 60) / 60) * 716 : 716}
               strokeLinecap="round"
               className="transition-all duration-1000 ease-linear"
             />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className={`text-[36px] font-light tabular-nums tracking-tight transition-colors ${timerState === 'paused' ? 'text-tx-inverse/50' : 'text-tx-inverse'}`}>
              {formatTime(elapsedSeconds)}
            </div>
            {timerState !== 'idle' && (
              <div className="text-[13px] font-medium text-tx-inverse/50 mt-1 max-w-[150px] truncate">
                {activeNote || projects.find(p => p.id === activeProjectId)?.name || 'Tracking time...'}
              </div>
            )}
          </div>
        </div>

        {timerState === 'idle' ? (
          <button onClick={handleStartButton} className="px-12 h-16 rounded-full bg-accent-primary text-tx-primary text-[16px] font-medium flex items-center justify-center active:opacity-80 transition-opacity">
            Start
          </button>
        ) : (
          <div className="flex items-center gap-4">
            {timerState === 'running' ? (
              <button onClick={pauseTimer} className="w-16 h-16 rounded-full bg-tx-inverse/10 flex items-center justify-center text-tx-inverse active:opacity-80 transition-opacity" aria-label="Pause timer">
                <Pause size={24} fill="currentColor" />
              </button>
            ) : (
              <button onClick={handleStartButton} className="w-16 h-16 rounded-full bg-tx-inverse/10 flex items-center justify-center text-tx-inverse active:opacity-80 transition-opacity" aria-label="Resume timer">
                <Play size={24} fill="currentColor" />
              </button>
            )}
            <button onClick={handleStopButton} className="px-10 h-16 rounded-full bg-accent-primary text-tx-primary text-[16px] font-medium flex items-center justify-center active:opacity-80 transition-opacity">
              Stop
            </button>
          </div>
        )}
      </div>

      {timerState === 'idle' && (
        <div className="flex-1 bg-canvas rounded-t-[32px] px-5 py-6">
          <h3 className="text-[17px] font-medium text-tx-primary mb-4">Recent Entries</h3>
          {groupedEntries.map(([date, entries]) => (
            <div key={date} className="mb-6 last:mb-0">
              <div className="text-[13px] font-medium text-tx-muted mb-3 uppercase tracking-wider">{date}</div>
              <div className="flex flex-col gap-3">
                {entries.map(entry => {
                  const p = projects.find(x => x.id === entry.projectId);
                  return (
                    <div key={entry.id} className="bg-surface-neutral rounded-xl px-4 py-3 flex items-center justify-between group">
                      <div className="flex flex-col">
                        <div className="text-[15px] font-medium text-tx-primary">{formatTime(entry.durationSeconds)}</div>
                        <div className="text-[13px] text-tx-muted flex items-center gap-1.5 mt-0.5">
                          {p?.name || 'No Project'}
                          {entry.note && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-bd-subtle" />
                              <span className="truncate max-w-[120px]">{entry.note}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleEditEntry(entry)} className="p-2 text-tx-muted hover:text-tx-primary rounded-full transition-colors" aria-label="Edit time entry">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => handleDeleteEntry(entry.id)} className="p-2 text-tx-muted hover:text-red-500 rounded-full transition-colors" aria-label="Delete time entry">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {groupedEntries.length === 0 && (
            <div className="text-center text-[14px] text-tx-muted py-8">No past entries.</div>
          )}
        </div>
      )}

      <BottomSheet
        isOpen={isStartSheetOpen}
        onClose={() => setStartSheetOpen(false)}
        title="Start Timer"
        onSave={handleConfirmStart}
        saveLabel="Start"
      >
        <BottomSheetField label="Project / Task">
          <SearchPicker
            items={projects.map(p => ({ id: p.id, label: p.name }))}
            value={activeProjectId}
            onChange={(id) => { setActiveProjectId(id); setActiveTaskId(''); const p = projects.find(x => x.id === id); if(p?.clientId) setActiveClientId(p.clientId); else setActiveClientId(''); }}
            
          />
        </BottomSheetField>
        
        <BottomSheetField label="Note (optional)">
          <input 
            type="text" 
            placeholder="What are you working on?" 
            value={activeNote}
            onChange={e => setActiveNote(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none text-[15px] outline-none" 
          />
        </BottomSheetField>

        <BottomSheetField>
          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-surface-neutral mt-2">
            <span className="text-[15px] font-medium text-tx-primary">Billable</span>
            <button 
              onClick={() => setActiveBillable(!activeBillable)}
              className={`w-12 h-6 rounded-full transition-colors flex items-center p-1 ${activeBillable ? 'bg-tx-primary' : 'bg-canvas border border-bd-subtle'}`}
              aria-label={activeBillable ? "Disable billable" : "Enable billable"}
            >
              <div className={`w-4 h-4 rounded-full bg-canvas transition-transform ${activeBillable ? 'translate-x-6' : 'translate-x-0 bg-tx-muted'}`} />
            </button>
          </div>
        </BottomSheetField>
        {editingEntry && (
          <div className="pt-4 mt-4 border-t border-bd-subtle">
            <h4 className="text-[13px] font-bold text-tx-muted uppercase tracking-wider mb-3">Related</h4>
            <div className="grid grid-cols-2 gap-3">
              {editingEntry.projectId && (
                <button onClick={() => { setSaveSheetOpen(false); goToTab('projects', { filterProjectId: editingEntry.projectId }); }} className="flex items-center gap-2 p-3 bg-surface-neutral/30 rounded-xl border border-bd-subtle hover:border-accent-primary/50 transition-colors">
                  <span className="text-[14px] font-medium text-tx-primary">View Project</span>
                </button>
              )}
            </div>
          </div>
        )}
      </BottomSheet>

      <BottomSheet
        isOpen={isSaveSheetOpen}
        onClose={() => { setSaveSheetOpen(false); setEditingEntry(null); }}
        title={editingEntry ? "Edit Entry" : "Save Summary"}
        onSave={handleSave}
        saveLabel="Save"
        secondaryAction={
          !editingEntry ? (
            <button onClick={() => { setSaveSheetOpen(false); resetTimer(); }} className="w-full py-3.5 rounded-full text-tx-muted text-[15px] font-medium">
              Discard
            </button>
          ) : undefined
        }
      >
        <BottomSheetField>
          <div className="flex items-center text-[36px] font-light text-tx-primary">
            <input
              type="text"
              value={manualDuration}
              onChange={(e) => setManualDuration(e.target.value)}
              className="w-full bg-transparent outline-none py-2 tabular-nums"
            />
          </div>
        </BottomSheetField>

        <BottomSheetField label="Project / Task">
          <SearchPicker
            items={projects.map(p => ({ id: p.id, label: p.name }))}
            value={activeProjectId}
            onChange={(id) => { setActiveProjectId(id); setActiveTaskId(''); const p = projects.find(x => x.id === id); if(p?.clientId) setActiveClientId(p.clientId); else setActiveClientId(''); }}
            
          />
        </BottomSheetField>
        
        <BottomSheetField label="Note">
          <textarea 
            placeholder="Add notes..." 
            value={activeNote}
            onChange={e => setActiveNote(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none text-[15px] outline-none h-24 resize-none" 
          />
        </BottomSheetField>
        {editingEntry && (
          <div className="pt-4 mt-4 border-t border-bd-subtle">
            <h4 className="text-[13px] font-bold text-tx-muted uppercase tracking-wider mb-3">Related</h4>
            <div className="grid grid-cols-2 gap-3">
              {editingEntry.projectId && (
                <button onClick={() => { setSaveSheetOpen(false); goToTab('projects', { filterProjectId: editingEntry.projectId }); }} className="flex items-center gap-2 p-3 bg-surface-neutral/30 rounded-xl border border-bd-subtle hover:border-accent-primary/50 transition-colors">
                  <span className="text-[14px] font-medium text-tx-primary">View Project</span>
                </button>
              )}
            </div>
          </div>
        )}
      </BottomSheet>

      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={confirmDeleteEntry}
        title="Delete Entry"
        body="Are you sure you want to delete this time entry? This action cannot be undone."
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}


