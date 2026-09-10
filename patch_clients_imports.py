import re

with open('src/screens/Clients.tsx', 'r') as f:
    content = f.read()

content = content.replace("Check\n} from 'lucide-react';", "Check,\n  FolderHeart\n} from 'lucide-react';")

with open('src/screens/Clients.tsx', 'w') as f:
    f.write(content)
