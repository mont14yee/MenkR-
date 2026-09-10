import os

with open('src/screens/Calendar.tsx', 'r') as f:
    content = f.read()

content = content.replace("  const { events, addEvent, updateEvent, deleteEvent } = useCalendar();", "  const { events, addEvent, updateEvent, deleteEvent } = useCalendar();\n  const { startTimerFor } = useTimeTracker();")

with open('src/screens/Calendar.tsx', 'w') as f:
    f.write(content)
