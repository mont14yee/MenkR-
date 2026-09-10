import re

with open('src/screens/Projects.tsx', 'r') as f:
    content = f.read()

# Add useNavigation correctly since it's already there but we need to grab the options
content = content.replace("  const { goToClient } = useNavigation();", "  const { goToClient, navigationOptions } = useNavigation();\n  const filterClientId = navigationOptions?.filterClientId || '';")

# Add filterClientId to filteredAndSortedProjects
filter_logic = """const filteredAndSortedProjects = useMemo(() => {
    let result = projects;
    if (filterClientId) {
      result = result.filter(p => p.clientId === filterClientId);
    }
    
    // Sort
    result = [...result].sort((a, b) => {"""
content = content.replace("const filteredAndSortedProjects = useMemo(() => {\n    // Sort\n    const sorted = [...projects].sort((a, b) => {", filter_logic)
content = content.replace("    return sorted;", "    return result;")

# If there's a filter, show it
filter_ui = """      {filterClientId && (
        <div className="px-5 py-2 bg-surface-neutral/30 border-b border-bd-subtle flex items-center justify-between">
          <div className="text-[13px] font-medium text-tx-primary flex items-center gap-2">
            Filtering by Client: {clients.find(c => c.id === filterClientId)?.name}
          </div>
          <button onClick={() => goToClient(filterClientId)} className="text-[13px] text-tx-muted hover:text-tx-primary">Clear Filter</button>
        </div>
      )}"""
content = content.replace("      <div className=\"px-5 mt-4 flex items-center justify-between mb-6\">", filter_ui + "\n      <div className=\"px-5 mt-4 flex items-center justify-between mb-6\">")

with open('src/screens/Projects.tsx', 'w') as f:
    f.write(content)
