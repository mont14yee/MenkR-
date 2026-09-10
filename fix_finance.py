import re

with open('src/screens/Finance.tsx', 'r') as f:
    content = f.read()

# Add useNavigation and useProjects
if "useNavigation" not in content:
    content = content.replace("import { useRevenue } from '../context/RevenueContext';", "import { useRevenue } from '../context/RevenueContext';\nimport { useNavigation } from '../context/NavigationContext';\nimport { useProjects } from '../context/ProjectsContext';")

nav_logic = """  const { showToast } = useToast();
  const { revenues, yearlyGoal, addRevenue, updateRevenue, deleteRevenue, setYearlyGoal } = useRevenue();
  const { clients } = useClients();
  const { projects } = useProjects();
  const { navigationOptions, push, goToTab } = useNavigation();
  const filterProjectId = navigationOptions?.filterProjectId || '';
  const filterClientId = navigationOptions?.filterClientId || '';"""

content = re.sub(r'const { showToast } = useToast\(\);\s+const { revenues.*?useRevenue\(\);\s+const { clients } = useClients\(\);', nav_logic, content)

filter_logic = """  const displayEntries = useMemo(() => {
    return effectiveRevenues.filter(e => {
      const matchProject = filterProjectId ? e.projectId === filterProjectId : true;
      const matchClient = filterClientId ? e.clientId === filterClientId : true;
      return matchProject && matchClient;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [effectiveRevenues, filterProjectId, filterClientId]);"""

content = re.sub(r'const displayEntries = \[...effectiveRevenues\]\.sort\(\(a, b\) => new Date\(b\.date\)\.getTime\(\) - new Date\(a\.date\)\.getTime\(\)\);', filter_logic, content)

sheet_extras = """        {editingEntry && (
          <div className="pt-4 mt-4 border-t border-bd-subtle">
            <h4 className="text-[13px] font-bold text-tx-muted uppercase tracking-wider mb-3">Related</h4>
            <div className="grid grid-cols-2 gap-3">
              {editingEntry.projectId && (
                <button onClick={() => { setLogSheetOpen(false); goToTab('projects', { filterProjectId: editingEntry.projectId }); }} className="flex items-center gap-2 p-3 bg-surface-neutral/30 rounded-xl border border-bd-subtle hover:border-accent-primary/50 transition-colors">
                  <span className="text-[14px] font-medium text-tx-primary">View Project</span>
                </button>
              )}
            </div>
          </div>
        )}"""

if "goToTab('projects'" not in content:
    content = content.replace("      </BottomSheet>", sheet_extras + "\n      </BottomSheet>", 1)

with open('src/screens/Finance.tsx', 'w') as f:
    f.write(content)
