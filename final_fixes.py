import re

with open('src/screens/Clients.tsx', 'r') as f:
    content = f.read()

content = content.replace("<Library size={18} />", "<FolderHeart size={18} />")

with open('src/screens/Clients.tsx', 'w') as f:
    f.write(content)

with open('src/screens/Finance.tsx', 'r') as f:
    content = f.read()

content = content.replace("const { navigationOptions, push } = useNavigation();", "const { navigationOptions, push, goToTab } = useNavigation();")

with open('src/screens/Finance.tsx', 'w') as f:
    f.write(content)

