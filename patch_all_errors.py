import re

with open('src/screens/Tasks.tsx', 'r') as f:
    content = f.read()

content = content.replace("form.projectId", "editingTask.projectId")

with open('src/screens/Tasks.tsx', 'w') as f:
    f.write(content)


with open('src/screens/Calendar.tsx', 'r') as f:
    content = f.read()

content = content.replace("import { ChevronLeft, ChevronRight, Plus, Search, MoreVertical, Calendar as CalendarIcon, Clock, CheckSquare, Users, FolderKanban, Link as LinkIcon, MapPin } from 'lucide-react';", "import { ChevronLeft, ChevronRight, Plus, Search, MoreVertical, Calendar as CalendarIcon, Clock, CheckSquare, Users, FolderKanban, Link as LinkIcon, MapPin, Layout } from 'lucide-react';")
content = content.replace("form.projectId", "editingEvent.projectId")
content = content.replace("form.taskId", "editingEvent.taskId")


with open('src/screens/Calendar.tsx', 'w') as f:
    f.write(content)
