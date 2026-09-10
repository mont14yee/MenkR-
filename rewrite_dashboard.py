import os

with open('src/screens/Dashboard.tsx', 'r') as f:
    content = f.read()

# Replace local search imports and context
content = content.replace("import { useNavigation } from '../context/NavigationContext';", 
"import { useNavigation } from '../context/NavigationContext';\nimport { useCommandPalette } from '../context/CommandPaletteContext';")

content = content.replace("const { goToTab, goToClient, push } = useNavigation();\n\n  const [isSearchOpen, setIsSearchOpen] = useState(false);\n  const [searchQuery, setSearchQuery] = useState('');", 
"const { goToTab, goToClient, push } = useNavigation();\n  const { openPalette } = useCommandPalette();\n\n  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);\n  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);\n")
# Clean up duplicate state declarations if they exist
content = content.replace("  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);\n  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);\n  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);\n  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);\n", 
"  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);\n  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);\n")

# Search results logic - we can just strip it out 
start_idx = content.find("  // Search")
end_idx = content.find("  // Calculations for Command Center Sections")
if start_idx != -1 and end_idx != -1:
    content = content[:start_idx] + content[end_idx:]

# The search icon button
content = content.replace("onClick={() => setIsSearchOpen(!isSearchOpen)}", "onClick={openPalette}")

# The inline search dropdown
dropdown_start = content.find("      {isSearchOpen && (")
dropdown_end = content.find("      <div className=\"flex-1 overflow-y-auto no-scrollbar")
if dropdown_start != -1 and dropdown_end != -1:
    content = content[:dropdown_start] + content[dropdown_end:]

with open('src/screens/Dashboard.tsx', 'w') as f:
    f.write(content)
