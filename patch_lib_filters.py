import re

with open('src/screens/Library.tsx', 'r') as f:
    content = f.read()

# Add filterTaskId to states
filter_states = """  const [filterType, setFilterType] = useState<'all' | 'file' | 'link' | 'note'>('all');
  const [filterClientId, setFilterClientId] = useState('');
  const [filterProjectId, setFilterProjectId] = useState(navigationOptions?.filterProjectId || '');
  const [filterTaskId, setFilterTaskId] = useState(navigationOptions?.filterTaskId || '');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');"""
content = re.sub(r'const \[filterType.*?setSortOrder.*?;\s*const \[isFilterPanelOpen', filter_states + "\n  const [isFilterPanelOpen", content, flags=re.DOTALL)

# Add useNavigation
content = content.replace("import { useProjects } from '../context/ProjectsContext';", "import { useProjects } from '../context/ProjectsContext';\nimport { useNavigation } from '../context/NavigationContext';")
content = content.replace("  const { projects } = useProjects();", "  const { projects } = useProjects();\n  const { navigationOptions } = useNavigation();")

# Update filtering logic
new_filter_logic = """const filteredLibrary = useMemo(() => {
    return library.filter(l => {
      const matchSearch = l.name.toLowerCase().includes(search.toLowerCase()) || 
                          (l.description || '').toLowerCase().includes(search.toLowerCase()) ||
                          l.tags.some(t => t.toLowerCase().includes(search.toLowerCase()));
      const matchCategory = filterCategory === 'All' || l.category === filterCategory;
      const matchType = filterType === 'all' || l.type === filterType;
      const matchClient = filterClientId ? l.clientId === filterClientId : true;
      const matchProject = filterProjectId ? l.projectId === filterProjectId : true;
      const matchTask = filterTaskId ? l.taskId === filterTaskId : true;
      
      return matchSearch && matchCategory && matchType && matchClient && matchProject && matchTask;
    }).sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
    });
  }, [library, search, filterCategory, filterType, filterClientId, filterProjectId, filterTaskId, sortOrder]);"""

content = re.sub(r'const filteredLibrary = useMemo\(\(\) => \{[\s\S]*?\}, \[.*?\]\);', new_filter_logic, content)

with open('src/screens/Library.tsx', 'w') as f:
    f.write(content)
