import re

with open('src/screens/TimeTracker.tsx', 'r') as f:
    content = f.read()

content = content.replace("import { useProjects } from '../context/ProjectsContext';", "import { useProjects } from '../context/ProjectsContext';\nimport { useNavigation } from '../context/NavigationContext';")

nav_logic = """  const { projects } = useProjects();
  const { navigationOptions, push } = useNavigation();
  const filterProjectId = navigationOptions?.filterProjectId || '';
  const filterTaskId = navigationOptions?.filterTaskId || '';
  const filterClientId = navigationOptions?.filterClientId || '';"""
content = content.replace("  const { projects } = useProjects();", nav_logic)

filter_logic = """  const filteredEntries = useMemo(() => {
    return timeEntries.filter(e => {
      const matchProject = filterProjectId ? e.projectId === filterProjectId : true;
      const matchTask = filterTaskId ? e.taskId === filterTaskId : true;
      const matchClient = filterClientId ? e.clientId === filterClientId : true;
      return matchProject && matchTask && matchClient;
    }).sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }, [timeEntries, filterProjectId, filterTaskId, filterClientId]);"""

content = re.sub(r'const sortedEntries = \[...timeEntries\]\.sort\(\(a, b\) => new Date\(b\.startedAt\)\.getTime\(\) - new Date\(a\.startedAt\)\.getTime\(\)\);', filter_logic, content)
content = content.replace("sortedEntries.map((entry)", "filteredEntries.map((entry)")
content = content.replace("sortedEntries.length === 0", "filteredEntries.length === 0")
content = content.replace("reduce((acc, entry)", "filteredEntries.reduce((acc, entry)")

sheet_extras = """        {editingEntry && (
          <div className="pt-4 mt-4 border-t border-bd-subtle">
            <h4 className="text-[13px] font-bold text-tx-muted uppercase tracking-wider mb-3">Related</h4>
            <div className="grid grid-cols-2 gap-3">
              {form.projectId && (
                <button onClick={() => { setSheetOpen(false); push('projects', { filterProjectId: form.projectId }); }} className="flex items-center gap-2 p-3 bg-surface-neutral/30 rounded-xl border border-bd-subtle hover:border-accent-primary/50 transition-colors">
                  <span className="text-[14px] font-medium text-tx-primary">View Project</span>
                </button>
              )}
            </div>
          </div>
        )}"""
content = content.replace("      </BottomSheet>", sheet_extras + "\n      </BottomSheet>")

with open('src/screens/TimeTracker.tsx', 'w') as f:
    f.write(content)
