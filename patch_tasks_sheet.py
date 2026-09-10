import re

with open('src/screens/Tasks.tsx', 'r') as f:
    content = f.read()

# Add icons to import
content = content.replace("import { Plus, CheckSquare, Search, MoreVertical, Layout, PlusCircle } from 'lucide-react';", "import { Plus, CheckSquare, Search, MoreVertical, Layout, PlusCircle, FolderHeart, Calendar, DollarSign, Clock, File } from 'lucide-react';")

# Find the bottom of the sheet inside Tasks.tsx
# The sheet ends near </BottomSheet>
sheet_extras = """        {editingTask && (
          <div className="pt-4 mt-4 border-t border-bd-subtle">
            <h4 className="text-[13px] font-bold text-tx-muted uppercase tracking-wider mb-3">Related</h4>
            <div className="grid grid-cols-2 gap-3">
              {form.projectId && (
                <button onClick={() => { setSheetOpen(false); push('projects', { filterProjectId: form.projectId }); }} className="flex items-center gap-2 p-3 bg-surface-neutral/30 rounded-xl border border-bd-subtle hover:border-accent-primary/50 transition-colors">
                  <Layout size={16} className="text-tx-primary" />
                  <span className="text-[14px] font-medium text-tx-primary">Project</span>
                </button>
              )}
              <button onClick={() => { setSheetOpen(false); push('library', { filterTaskId: editingTask.id }); }} className="flex items-center gap-2 p-3 bg-surface-neutral/30 rounded-xl border border-bd-subtle hover:border-accent-primary/50 transition-colors">
                <FolderHeart size={16} className="text-tx-primary" />
                <span className="text-[14px] font-medium text-tx-primary">Library Files</span>
              </button>
              <button onClick={() => { setSheetOpen(false); push('calendar', { filterTaskId: editingTask.id }); }} className="flex items-center gap-2 p-3 bg-surface-neutral/30 rounded-xl border border-bd-subtle hover:border-accent-primary/50 transition-colors">
                <Calendar size={16} className="text-tx-primary" />
                <span className="text-[14px] font-medium text-tx-primary">Schedule</span>
              </button>
              <button onClick={() => { setSheetOpen(false); push('time-tracker', { filterTaskId: editingTask.id }); }} className="flex items-center gap-2 p-3 bg-surface-neutral/30 rounded-xl border border-bd-subtle hover:border-accent-primary/50 transition-colors">
                <Clock size={16} className="text-tx-primary" />
                <span className="text-[14px] font-medium text-tx-primary">Time Entries</span>
              </button>
            </div>
          </div>
        )}
"""

content = content.replace("      </BottomSheet>", sheet_extras + "\n      </BottomSheet>")

with open('src/screens/Tasks.tsx', 'w') as f:
    f.write(content)
