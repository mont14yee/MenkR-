import os

with open('src/screens/Dashboard.tsx', 'r') as f:
    content = f.read()

# Replace any occurrence of the duplicated lines
content = content.replace("  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);\n  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);\n  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);\n  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);\n", "  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);\n  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);\n")

# Specifically look for lines 36-39
lines = content.split('\n')
deduped_lines = []
for line in lines:
    if line.strip() == "const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);":
        if "const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);" not in [l.strip() for l in deduped_lines]:
            deduped_lines.append(line)
    elif line.strip() == "const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);":
        if "const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);" not in [l.strip() for l in deduped_lines]:
            deduped_lines.append(line)
    else:
        deduped_lines.append(line)

with open('src/screens/Dashboard.tsx', 'w') as f:
    f.write('\n'.join(deduped_lines))

