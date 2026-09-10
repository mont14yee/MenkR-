import re

with open('src/screens/Clients.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    'className="w-10 h-10 flex items-center justify-center rounded-full bg-tx-primary text-tx-inverse hover:opacity-90 transition-opacity">',
    'className="w-10 h-10 flex items-center justify-center rounded-full bg-tx-primary text-tx-inverse hover:opacity-90 transition-opacity" aria-label="Add client">'
)

with open('src/screens/Clients.tsx', 'w') as f:
    f.write(content)
