import os

with open('src/components/CommandPalette.tsx', 'r') as f:
    content = f.read()

# Fix ProjectItem.description to ProjectItem.status
content = content.replace("projects.filter(p => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q))", "projects.filter(p => p.name.toLowerCase().includes(q) || p.status?.toLowerCase().includes(q))")

# Fix LibraryItem.title to LibraryItem.name and TemplateItem.title to TemplateItem.name
content = content.replace("library.filter(l => l.title.toLowerCase().includes(q))", "library.filter(l => l.name.toLowerCase().includes(q))")
content = content.replace("items.push({ id: `library-${l.id}`, type: 'Library', title: l.title,", "items.push({ id: `library-${l.id}`, type: 'Library', title: l.name,")

content = content.replace("templates.filter(t => t.title.toLowerCase().includes(q))", "templates.filter(t => t.name.toLowerCase().includes(q))")
content = content.replace("items.push({ id: `template-${t.id}`, type: 'Template', title: t.title, subtitle: t.category", "items.push({ id: `template-${t.id}`, type: 'Template', title: t.name, subtitle: 'Template'")

# Fix RevenueEntry.description to RevenueEntry.title or similar (Finance usually has title or notes)
# I will check RevenueContext to see what RevenueEntry has. For now let's just use notes or amount
content = content.replace("revenues.filter(r => r.description?.toLowerCase().includes(q))", "revenues.filter(r => r.notes?.toLowerCase().includes(q) || r.projectName?.toLowerCase().includes(q) || r.clientName?.toLowerCase().includes(q))")
content = content.replace("title: r.description || 'Revenue Entry'", "title: `${r.clientName || 'Finance'} - ${r.amount}`")

with open('src/components/CommandPalette.tsx', 'w') as f:
    f.write(content)
