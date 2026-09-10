import re

with open('src/screens/Projects.tsx', 'r') as f:
    content = f.read()

content = content.replace("goToClient(filterClientId)", "goToTab('projects')")
content = content.replace("const { goToClient, navigationOptions } = useNavigation();", "const { goToClient, goToTab, navigationOptions } = useNavigation();")

with open('src/screens/Projects.tsx', 'w') as f:
    f.write(content)
