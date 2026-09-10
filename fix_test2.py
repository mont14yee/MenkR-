import re

with open('src/screens/Clients.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    '<button onClick={() => setIsMenuOpen(!isMenuOpen)} className="w-10 h-10 flex items-center justify-center -mr-2 rounded-full hover:bg-surface-neutral text-tx-primary">',
    '<button onClick={() => setIsMenuOpen(!isMenuOpen)} className="w-10 h-10 flex items-center justify-center -mr-2 rounded-full hover:bg-surface-neutral text-tx-primary" aria-label="More options">'
)

with open('src/screens/Clients.tsx', 'w') as f:
    f.write(content)
