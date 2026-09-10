import os

with open('src/components/CommandPalette.tsx', 'r') as f:
    content = f.read()

# Fix RevenueEntry type issues by removing projectName and clientName calls (they don't exist apparently)
content = content.replace("revenues.filter(r => r.notes?.toLowerCase().includes(q) || r.projectName?.toLowerCase().includes(q) || r.clientName?.toLowerCase().includes(q))", "revenues.filter(r => r.notes?.toLowerCase().includes(q))")
content = content.replace("title: `${r.clientName || 'Finance'} - ${r.amount}`", "title: `Finance Entry - ${r.amount}`")

with open('src/components/CommandPalette.tsx', 'w') as f:
    f.write(content)
