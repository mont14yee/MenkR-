import os

with open('src/screens/Projects.tsx', 'r') as f:
    content = f.read()

# Make sure to import startTimerFor
if "useTimeTracker" not in content:
    content = content.replace("import { useNavigation } from '../context/NavigationContext';", "import { useNavigation } from '../context/NavigationContext';\nimport { useTimeTracker } from '../context/TimeTrackerContext';")

content = content.replace("import { Layout, Calendar, Trash2, Edit2, Search, CheckCircle2, ChevronRight, Briefcase, Plus, FolderKanban } from 'lucide-react';", "import { Layout, Calendar, Trash2, Edit2, Search, CheckCircle2, ChevronRight, Briefcase, Plus, FolderKanban, Clock } from 'lucide-react';")

# Extract the context variables
content = content.replace("  const { preferences } = usePreferences();", "  const { preferences } = usePreferences();\n  const { startTimerFor } = useTimeTracker();")

btn = """
                  <button onClick={() => { 
                    startTimerFor({ projectId: selectedProject.id, clientId: selectedProject.clientId, note: selectedProject.name });
                    push('time-tracker');
                  }} className="w-8 h-8 rounded-full bg-surface-neutral flex items-center justify-center text-accent-primary hover:bg-accent-primary/10 transition-colors" title="Start Timer">
                    <Clock size={16} />
                  </button>
"""

content = content.replace('                  <button onClick={() => { setEditingProjectId(selectedProjectId); setIsSheetOpen(true); }} className="w-8 h-8 rounded-full bg-surface-neutral flex items-center justify-center text-tx-muted hover:text-tx-primary transition-colors">', btn + '                  <button onClick={() => { setEditingProjectId(selectedProjectId); setIsSheetOpen(true); }} className="w-8 h-8 rounded-full bg-surface-neutral flex items-center justify-center text-tx-muted hover:text-tx-primary transition-colors">')

with open('src/screens/Projects.tsx', 'w') as f:
    f.write(content)
