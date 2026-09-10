import os
import re

def fix_file(filename):
    with open(filename, 'r') as f:
        content = f.read()

    # Add goToTab to useNavigation destructuring if not there
    if "const { navigationOptions, push } = useNavigation();" in content:
        content = content.replace("const { navigationOptions, push } = useNavigation();", "const { navigationOptions, push, goToTab } = useNavigation();")
    
    if "const { navigationOptions, push, goToClient } = useNavigation();" in content:
        content = content.replace("const { navigationOptions, push, goToClient } = useNavigation();", "const { navigationOptions, push, goToClient, goToTab } = useNavigation();")

    if "const { push } = useNavigation();" in content:
        content = content.replace("const { push } = useNavigation();", "const { push, goToTab } = useNavigation();")

    content = content.replace("push('projects'", "goToTab('projects'")
    content = content.replace("push('clients'", "goToTab('clients'")
    
    # Also fix the 'form' variable errors in Finance and TimeTracker
    # editingEntry has projectId, not form, if form is not defined.
    # In Finance.tsx and TimeTracker.tsx, the form state is actually not called `form` or maybe it is?
    
    with open(filename, 'w') as f:
        f.write(content)

fix_file('src/components/ProjectDetail.tsx')
fix_file('src/screens/Tasks.tsx')
fix_file('src/screens/Calendar.tsx')
fix_file('src/screens/Finance.tsx')
fix_file('src/screens/TimeTracker.tsx')
fix_file('src/screens/Clients.tsx')
