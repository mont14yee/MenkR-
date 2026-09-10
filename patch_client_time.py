import os

with open('src/screens/Clients.tsx', 'r') as f:
    content = f.read()

# Make sure we get project time entries as well
content = content.replace("time: timeEntries.filter(t => t.clientId === cid)", 
"time: timeEntries.filter(t => t.clientId === cid || projects.find(p => p.id === t.projectId)?.clientId === cid)")

with open('src/screens/Clients.tsx', 'w') as f:
    f.write(content)
