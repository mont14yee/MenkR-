import { useState, useMemo } from 'react';
import { X, MoreVertical, Plus, ChevronDown, Layout, FolderHeart, Calendar, Clock, CheckSquare } from 'lucide-react';
import { Header, StatCard, ListRow } from '../components/Shared';
import { BottomSheet, BottomSheetField, CategoryPicker } from '../components/BottomSheet';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { usePreferences } from '../context/PreferencesContext';
import { useToast } from '../context/ToastContext';
import { useTasks } from '../context/TasksContext';
import { useNavigation } from '../context/NavigationContext';
import { useTimeTracker } from '../context/TimeTrackerContext';
import { useProjects } from '../context/ProjectsContext';
import { TaskItem } from '../types';

export function Tasks({ onDismiss }: { onDismiss: () => void }) {
  const [tab, setTab] = useState('Today');
  const [isSheetOpen, setSheetOpen] = useState(false);
  const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [showMoreDetails, setShowMoreDetails] = useState(false);

  const { preferences, addCategory } = usePreferences();
  const { showToast } = useToast();
  const { startTimerFor } = useTimeTracker();
  const { tasks, addTask, updateTask, deleteTask, completeTask } = useTasks();
  const { projects } = useProjects();
  const { navigationOptions, push, goToTab } = useNavigation();
  
  const initialProjectId = navigationOptions?.filterProjectId || '';
  const [filterProjectId, setFilterProjectId] = useState(initialProjectId);

  const [form, setForm] = useState({
    title: '',
    category: '',
    priority: 'Medium' as 'Low' | 'Medium' | 'High',
    date: '',
    notes: '',
  });

  const handleOpenSheet = (task?: TaskItem) => {
    if (task) {
      setEditingTask(task);
      setForm({ 
        title: task.title, 
        category: task.categoryId, 
        priority: task.priority,
        date: task.date || '',
        notes: task.notes || ''
      });
    } else {
      setEditingTask(null);
      setForm({ title: '', category: '', priority: 'Medium', date: '', notes: '' });
    }
    setShowMoreDetails(false);
    setSheetOpen(true);
  };

  const handleSave = () => {
    if (!form.title.trim()) {
      showToast({ message: 'Task title is required' });
      return;
    }
    if (editingTask) {
      updateTask(editingTask.id, {
        title: form.title,
        categoryId: form.category,
        priority: form.priority,
        date: form.date,
        notes: form.notes,
      });
    } else {
      addTask({
        title: form.title,
        categoryId: form.category,
        priority: form.priority,
        date: form.date,
        notes: form.notes,
        status: 'active',
      });
    }
    setSheetOpen(false);
    showToast({
      message: 'Task saved successfully',
      actionLabel: 'Add another',
      onAction: () => handleOpenSheet(),
    });
  };

  const handleDelete = (id: string) => {
    setTaskToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteTask = () => {
    if (taskToDelete) {
      deleteTask(taskToDelete);
      showToast({ message: 'Task deleted' });
      setTaskToDelete(null);
    }
    setDeleteConfirmOpen(false);
  };

  const handleComplete = (id: string) => {
    completeTask(id);
    showToast({ message: 'Task status updated' });
  };

  const completedTasks = tasks.filter(t => t.status === 'done').length;
  const totalTasks = tasks.length;
  
  // Fake calculation for avg per day for now, based on total / something
  // Just to make it dynamic
  const uniqueDays = new Set(tasks.map(t => t.date ? t.date.split('T')[0] : '')).size || 1;
  const avgPerDay = Math.round(totalTasks / uniqueDays) + 'h'; 

  const displayTasks = tab === 'Today' ? tasks.filter(t => t.status !== 'done') : tasks;

  return (
    <div className="absolute inset-0 bg-canvas z-50 flex flex-col overflow-y-auto no-scrollbar">
      <Header
        leftIcon={
          <button onClick={onDismiss} className="w-11 h-11 rounded-full bg-surface-neutral flex items-center justify-center text-tx-primary" aria-label="Close">
            <X size={20} />
          </button>
        }
        title="Tasks"
        rightIcon={
          <button className="w-11 h-11 rounded-full bg-surface-neutral flex items-center justify-center text-tx-primary" aria-label="More options">
            <MoreVertical size={20} />
          </button>
        }
      />

      <div className="flex items-center justify-between px-5 mt-2 mb-6">
        <div className="flex bg-surface-neutral rounded-full p-1 w-64">
          {['Today', 'Calendar'].map((opt) => (
            <button
              key={opt}
              onClick={() => setTab(opt)}
              className={`flex-1 py-2.5 text-center text-[15px] font-medium rounded-full transition-colors ${
                tab === opt ? 'bg-canvas text-tx-primary shadow-sm' : 'text-tx-muted'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
        <button onClick={() => handleOpenSheet()} className="w-11 h-11 rounded-full bg-tx-primary text-tx-inverse flex items-center justify-center shrink-0" aria-label="Add task">
          <Plus size={20} />
        </button>
      </div>

      <div className="px-5 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[17px] font-medium text-tx-primary">All-Time Completed</h2>
          <ChevronDown size={20} className="text-tx-muted" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-1">
            <StatCard value={completedTasks.toString()} label="Total Completed" tone="olive" />
          </div>
          <div className="col-span-1 flex flex-col gap-3">
            <div className="flex-1 rounded-[20px] bg-accent-primary p-4 flex flex-col justify-center">
              <div className="text-[28px] font-light text-tx-primary leading-tight">{avgPerDay}</div>
              <div className="text-[13px] font-medium text-tx-primary mt-0.5">Avg Per Day</div>
            </div>
            <div className="flex-1 rounded-[20px] bg-surface-neutral p-4 flex flex-col justify-center">
              <div className="text-[28px] font-light text-tx-primary leading-tight">{totalTasks}</div>
              <div className="text-[13px] font-medium text-tx-muted mt-0.5">Total Tasks</div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[17px] font-medium text-tx-primary">{tab === 'Today' ? 'Today Tasks' : 'All Tasks'}</h2>
          <button onClick={() => handleOpenSheet()} className="text-[20px] text-tx-primary" aria-label="Add task">
            +
          </button>
        </div>
        {displayTasks.length === 0 ? (
          <div className="text-center text-tx-muted py-8 text-[15px]">No tasks found.</div>
        ) : (
          displayTasks.map((t) => {
            let dotColor = 'bg-surface-neutral';
            if (t.status === 'active') dotColor = 'bg-accent-primary';
            else if (t.status === 'upcoming') dotColor = 'bg-surface-muted';
            
            return (
              <ListRow
                key={t.id}
                icon={<div className={`w-3 h-3 rounded-full ${dotColor}`} />}
                title={t.title}
                subtitle={t.date ? new Date(t.date).toLocaleString() : t.priority}
                onClick={() => handleOpenSheet(t)}
                swipeable={true}
                onComplete={() => handleComplete(t.id)}
                onDelete={() => handleDelete(t.id)}
              />
            );
          })
        )}
      </div>

      <BottomSheet
        isOpen={isSheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editingTask ? 'Edit Task' : 'New Task'}
        onSave={handleSave}
      >
        <BottomSheetField>
          <input
            type="text"
            placeholder="Task Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full text-[20px] font-medium text-tx-primary placeholder:text-tx-muted/50 bg-transparent outline-none py-2"
            autoFocus
          />
        </BottomSheetField>
        
        <BottomSheetField label="Category">
          <CategoryPicker
            value={form.category}
            onChange={(c) => setForm({ ...form, category: c })}
            scope="task"
            categories={preferences.categories}
            onAddCategory={addCategory}
          />
        </BottomSheetField>

        <BottomSheetField label="Priority">
          <div className="flex bg-surface-neutral rounded-full p-1 w-full">
            {['Low', 'Medium', 'High'].map((opt) => (
              <button
                key={opt}
                onClick={() => setForm({ ...form, priority: opt as any })}
                className={`flex-1 py-2 text-center text-[14px] font-medium rounded-full transition-colors ${
                  form.priority === opt ? 'bg-canvas text-tx-primary shadow-sm' : 'text-tx-muted'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </BottomSheetField>

        {!showMoreDetails ? (
          <button onClick={() => setShowMoreDetails(true)} className="text-[14px] font-medium text-tx-muted py-2 text-left w-full">
            More details...
          </button>
        ) : (
          <>
            <BottomSheetField label="Date & Time">
              <input 
                type="datetime-local" 
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none text-[15px] outline-none" 
              />
            </BottomSheetField>
            
            <BottomSheetField label="Notes">
              <textarea 
                placeholder="Add optional notes..." 
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none text-[15px] outline-none h-24 resize-none" 
              />
            </BottomSheetField>
          </>
        )}
        {editingTask && (
          <div className="pt-4 mt-4 border-t border-bd-subtle">
            <h4 className="text-[13px] font-bold text-tx-muted uppercase tracking-wider mb-3">Related</h4>
            <div className="grid grid-cols-2 gap-3">
              {editingTask.projectId && (
                <button onClick={() => { setSheetOpen(false); goToTab('projects', { filterProjectId: editingTask.projectId }); }} className="flex items-center gap-2 p-3 bg-surface-neutral/30 rounded-xl border border-bd-subtle hover:border-accent-primary/50 transition-colors">
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
              <button onClick={() => { 
                setSheetOpen(false); 
                startTimerFor({ taskId: editingTask.id, projectId: editingTask.projectId, clientId: editingTask.clientId, note: editingTask.title });
                push('time-tracker');
              }} className="flex items-center gap-2 p-3 bg-accent-primary/10 rounded-xl border border-accent-primary/20 hover:border-accent-primary/50 transition-colors">
                <Clock size={16} className="text-accent-primary" />
                <span className="text-[14px] font-medium text-accent-primary">Start Timer</span>
              </button>

            </div>
          </div>
        )}

      </BottomSheet>

      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={confirmDeleteTask}
        title="Delete Task"
        body="Are you sure you want to delete this task? This action cannot be undone."
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}


