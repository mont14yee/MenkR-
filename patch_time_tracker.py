import os

with open('src/screens/TimeTracker.tsx', 'r') as f:
    content = f.read()

# Make sure we import activeTaskId, activeClientId
content = content.replace("    activeProjectId, setActiveProjectId,", "    activeProjectId, setActiveProjectId,\n    activeTaskId, activeClientId,")

# When saving an entry, include taskId and clientId
# Look for handleSave
content = content.replace("""    if (editingEntry) {
      updateTimeEntry(editingEntry.id, {
        projectId: activeProjectId,
        durationSeconds: parseDuration(manualDuration),
        note: activeNote,
        billable: activeBillable
      });""", """    if (editingEntry) {
      updateTimeEntry(editingEntry.id, {
        projectId: activeProjectId,
        taskId: activeTaskId,
        clientId: activeClientId,
        durationSeconds: parseDuration(manualDuration),
        note: activeNote,
        billable: activeBillable
      });""")

content = content.replace("""    } else {
      addTimeEntry({
        projectId: activeProjectId,
        startedAt: timerStartedAt || new Date().toISOString(),
        durationSeconds: parseDuration(manualDuration),
        note: activeNote,
        billable: activeBillable
      });
      resetTimer();
    }""", """    } else {
      addTimeEntry({
        projectId: activeProjectId,
        taskId: activeTaskId,
        clientId: activeClientId,
        startedAt: timerStartedAt || new Date().toISOString(),
        durationSeconds: parseDuration(manualDuration),
        note: activeNote,
        billable: activeBillable
      });
      resetTimer();
    }""")

with open('src/screens/TimeTracker.tsx', 'w') as f:
    f.write(content)

