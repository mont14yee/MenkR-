import os

with open('src/screens/Tasks.tsx', 'r') as f:
    content = f.read()

# Make sure to import startTimerFor
if "useTimeTracker" not in content:
    content = content.replace("import { useNavigation } from '../context/NavigationContext';", "import { useNavigation } from '../context/NavigationContext';\nimport { useTimeTracker } from '../context/TimeTrackerContext';")

# Extract the context variables
content = content.replace("  const { preferences } = usePreferences();", "  const { preferences } = usePreferences();\n  const { startTimerFor } = useTimeTracker();")

# Add the button
btn = """
              <button onClick={() => { 
                setSheetOpen(false); 
                startTimerFor({ taskId: editingTask.id, projectId: editingTask.projectId, clientId: editingTask.clientId, note: editingTask.title });
                push('time-tracker');
              }} className="flex items-center gap-2 p-3 bg-accent-primary/10 rounded-xl border border-accent-primary/20 hover:border-accent-primary/50 transition-colors">
                <Clock size={16} className="text-accent-primary" />
                <span className="text-[14px] font-medium text-accent-primary">Start Timer</span>
              </button>
"""

content = content.replace("<span className=\"text-[14px] font-medium text-tx-primary\">Time Entries</span>\n              </button>", f"""<span className="text-[14px] font-medium text-tx-primary">Time Entries</span>
              </button>{btn}""")

with open('src/screens/Tasks.tsx', 'w') as f:
    f.write(content)
