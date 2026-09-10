import re

with open('src/screens/Clients.tsx', 'r') as f:
    content = f.read()

content = content.replace("  const { dismiss } = useNavigation(); // to clear if needed", "  const { dismiss, push, goToTab } = useNavigation(); // to clear if needed")

with open('src/screens/Clients.tsx', 'w') as f:
    f.write(content)
