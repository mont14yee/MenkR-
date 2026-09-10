import os

with open('src/context/TimeTrackerContext.tsx', 'r') as f:
    content = f.read()

# Add activeTaskId, activeClientId to interface
content = content.replace("  activeProjectId: string;\n  setActiveProjectId: (id: string) => void;", 
"""  activeProjectId: string;
  setActiveProjectId: (id: string) => void;
  activeTaskId: string;
  setActiveTaskId: (id: string) => void;
  activeClientId: string;
  setActiveClientId: (id: string) => void;
  startTimerFor: (params: { projectId?: string; taskId?: string; clientId?: string; note?: string }) => void;""")

# Add useLocalStorage hooks for them
content = content.replace("  const [activeProjectId, setActiveProjectId] = useLocalStorage<string>('conneq-timer-project', '');",
"""  const [activeProjectId, setActiveProjectId] = useLocalStorage<string>('conneq-timer-project', '');
  const [activeTaskId, setActiveTaskId] = useLocalStorage<string>('conneq-timer-task', '');
  const [activeClientId, setActiveClientId] = useLocalStorage<string>('conneq-timer-client', '');""")

# Add startTimerFor implementation and update resetTimer
content = content.replace("  const startTimer = () => {",
"""  const startTimerFor = ({ projectId, taskId, clientId, note }: { projectId?: string; taskId?: string; clientId?: string; note?: string }) => {
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

  const startTimer = () => {""")

content = content.replace("    setActiveProjectId('');\n    setActiveNote('');\n    setActiveBillable(true);\n  };",
"""    setActiveProjectId('');
    setActiveTaskId('');
    setActiveClientId('');
    setActiveNote('');
    setActiveBillable(true);
  };""")

content = content.replace("      activeProjectId, setActiveProjectId,",
"""      activeProjectId, setActiveProjectId,
      activeTaskId, setActiveTaskId,
      activeClientId, setActiveClientId,
      startTimerFor,""")

with open('src/context/TimeTrackerContext.tsx', 'w') as f:
    f.write(content)
