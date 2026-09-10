import os

with open('src/screens/TimeTracker.tsx', 'r') as f:
    content = f.read()

# Currently TimeTracker.tsx has this: onChange={(id) => setActiveProjectId(id)}
# Let's change it so if they change project, we also clear activeTaskId, and maybe set activeClientId to the project's client if we know it.
# Actually it might be easier to just clear taskId.
# But wait, we don't have setActiveTaskId imported from useTimeTracker. Let's make sure it is.
if "setActiveTaskId" not in content:
    content = content.replace("    activeTaskId, activeClientId,", "    activeTaskId, setActiveTaskId, activeClientId, setActiveClientId,")

content = content.replace("onChange={(id) => setActiveProjectId(id)}", "onChange={(id) => { setActiveProjectId(id); setActiveTaskId(''); const p = projects.find(x => x.id === id); if(p?.clientId) setActiveClientId(p.clientId); else setActiveClientId(''); }}")

with open('src/screens/TimeTracker.tsx', 'w') as f:
    f.write(content)
