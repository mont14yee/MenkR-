import re

with open('src/screens/Clients.tsx', 'r') as f:
    content = f.read()

content = content.replace("import { useProjects } from '../context/ProjectsContext';", "import { useProjects } from '../context/ProjectsContext';\nimport { useFinance } from '../context/FinanceContext';")
content = content.replace("  const { projects } = useProjects();", "  const { projects } = useProjects();\n  const { revenueHistory } = useFinance();")

with open('src/screens/Clients.tsx', 'w') as f:
    f.write(content)
