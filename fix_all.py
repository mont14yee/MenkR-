import re

# 1. Clients.tsx
with open('src/screens/Clients.tsx', 'r') as f:
    content = f.read()
content = content.replace("import { useFinance } from '../context/FinanceContext';\n", "")
content = content.replace("  const { revenueHistory } = useFinance();\n", "")
content = content.replace("revenueHistory.filter(", "revenues.filter(")
content = content.replace("FolderHeart", "Library")  # wait, I should import FolderHeart
if "FolderHeart" not in content[:500]:
    content = content.replace("import { Search, Plus, ", "import { Search, Plus, FolderHeart, ")
with open('src/screens/Clients.tsx', 'w') as f:
    f.write(content)

# 2. Finance.tsx
with open('src/screens/Finance.tsx', 'r') as f:
    content = f.read()
if "goToTab" not in content[:300]:
    content = content.replace("const { navigationOptions, push }", "const { navigationOptions, push, goToTab }")
with open('src/screens/Finance.tsx', 'w') as f:
    f.write(content)

# 3. Projects.tsx
with open('src/screens/Projects.tsx', 'r') as f:
    content = f.read()
# Removing duplicate states
duplicates = """  const [isSheetOpen, setSheetOpen] = useState(false);
  const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDiscardConfirmOpen, setDiscardConfirmOpen] = useState(false);
"""
# Count and replace if double
if content.count(duplicates) > 1:
    content = content.replace(duplicates, "", 1)
with open('src/screens/Projects.tsx', 'w') as f:
    f.write(content)

# 4. Tasks.tsx
with open('src/screens/Tasks.tsx', 'r') as f:
    content = f.read()
if "FolderHeart" not in content[:300]:
    content = content.replace("import { Plus, CheckSquare, Search, MoreVertical }", "import { Plus, CheckSquare, Search, MoreVertical, Layout, FolderHeart, Calendar, Clock }")
with open('src/screens/Tasks.tsx', 'w') as f:
    f.write(content)

