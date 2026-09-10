import re

with open('src/screens/Tasks.tsx', 'r') as f:
    content = f.read()

content = content.replace("import { X, MoreVertical, Plus, ChevronDown } from 'lucide-react';", "import { X, MoreVertical, Plus, ChevronDown, Layout, FolderHeart, Calendar, Clock, CheckSquare } from 'lucide-react';")

with open('src/screens/Tasks.tsx', 'w') as f:
    f.write(content)
