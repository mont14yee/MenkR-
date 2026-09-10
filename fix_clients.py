import re

with open('src/screens/Clients.tsx', 'r') as f:
    content = f.read()

# 1. & 2. Fix Library Context and TimeTracker Context
content = content.replace(
    "const { items: libraryItems, addItem: addLibraryItem } = useLibrary();",
    "const { library: libraryItems, addLibraryItem } = useLibrary();"
)
content = content.replace(
    "const { entries: timeEntries } = useTimeTracker();",
    "const { timeEntries } = useTimeTracker();"
)

# 3. Fix Project creation
project_creation_old = """    addProject({
      ...projectForm,
      index: `PRJ-${Math.floor(1000 + Math.random()*9000)}`,
      completionPct: 0,
      clientId: selectedClientId,
      status: 'active'
    });"""
project_creation_new = """    addProject({
      ...projectForm,
      completionPct: 0,
      clientId: selectedClientId,
      status: 'active'
    });"""
content = content.replace(project_creation_old, project_creation_new)

# 4. Define removeTag
remove_tag_def = """  const removeTag = (t: string) => {
    setForm(prev => ({ ...prev, tags: prev.tags.filter(tag => tag !== t) }));
  };

  // Creation Handlers"""
content = content.replace("  // Creation Handlers", remove_tag_def)

with open('src/screens/Clients.tsx', 'w') as f:
    f.write(content)
