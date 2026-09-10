import os

for file_name in ['src/screens/Calendar.tsx', 'src/screens/Tasks.tsx']:
    with open(file_name, 'r') as f:
        content = f.read()
    
    if "const { startTimerFor } = useTimeTracker();" not in content:
        content = content.replace("  const { showToast } = useToast();", "  const { showToast } = useToast();\n  const { startTimerFor } = useTimeTracker();")
        
    with open(file_name, 'w') as f:
        f.write(content)

