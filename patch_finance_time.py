import re

with open('src/screens/Finance.tsx', 'r') as f:
    content = f.read()

content = content.replace("form.projectId", "editingEntry.projectId")

with open('src/screens/Finance.tsx', 'w') as f:
    f.write(content)

with open('src/screens/TimeTracker.tsx', 'r') as f:
    content = f.read()

content = content.replace("form.projectId", "editingEntry.projectId")
content = content.replace("setSheetOpen", "setSaveSheetOpen")

with open('src/screens/TimeTracker.tsx', 'w') as f:
    f.write(content)

