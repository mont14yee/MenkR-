import os

with open('src/screens/Dashboard.tsx', 'r') as f:
    content = f.read()

# Fix Activity import missing
if 'Activity' not in content[:content.find('}')]:
    content = content.replace("import { \n  Search, Bell, Plus, Briefcase, Users, Calendar, AlertCircle, \n  CheckSquare, Clock, DollarSign, Target, FileText, ChevronRight, X, UserPlus, Play\n} from 'lucide-react';", 
    "import { \n  Search, Bell, Plus, Briefcase, Users, Calendar, AlertCircle, \n  CheckSquare, Clock, DollarSign, Target, FileText, ChevronRight, X, UserPlus, Play, Activity\n} from 'lucide-react';")

# Fix onPush not being used by changing it to something that ignores the warning or uses it
content = content.replace('export function Dashboard({ onPush }: { onPush: (screen: PushedScreenState) => void }) {', 
                          'export function Dashboard({ onPush: _onPush }: { onPush: (screen: PushedScreenState) => void }) {')

with open('src/screens/Dashboard.tsx', 'w') as f:
    f.write(content)

