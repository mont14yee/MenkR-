import os

with open('src/screens/Dashboard.tsx', 'r') as f:
    content = f.read()

# Fix duplicates in Dashboard
content = content.replace("  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);\n  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);\n  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);\n  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);\n", 
"  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);\n  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);\n")

with open('src/screens/Dashboard.tsx', 'w') as f:
    f.write(content)
