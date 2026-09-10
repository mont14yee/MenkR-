import React, { useState } from 'react';
import { TemplateItem, TemplateType, TemplateTaskDef, TemplateScheduleDef, TemplateChecklistDef, TemplateLibraryDef, EventType } from '../types';
import { Header } from '../components/Shared';
import { ChevronLeft, Plus, Trash2, GripVertical, Settings2, CheckSquare, Calendar as CalendarIcon, Folder, MoreVertical } from 'lucide-react';
import { Button, IconButton, Tabs, Badge } from '../components/ui';
import { BottomSheet, BottomSheetField } from '../components/BottomSheet';
import { generateId } from '../utils/id';

interface Props {
  initialTemplate?: TemplateItem;
  onSave: (template: Omit<TemplateItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onDismiss: () => void;
}

export function TemplateBuilder({ initialTemplate, onSave, onDismiss }: Props) {
  const [form, setForm] = useState<Omit<TemplateItem, 'id' | 'createdAt' | 'updatedAt'>>(
    initialTemplate ? {
      name: initialTemplate.name,
      type: initialTemplate.type,
      description: initialTemplate.description || '',
      isFavorite: initialTemplate.isFavorite,
      isArchived: initialTemplate.isArchived,
      projectPriority: initialTemplate.projectPriority || 'high',
      projectDurationDays: initialTemplate.projectDurationDays || 30,
      projectNotes: initialTemplate.projectNotes || '',
      projectTags: initialTemplate.projectTags || [],
      tasks: initialTemplate.tasks || [],
      schedule: initialTemplate.schedule || [],
      checklists: initialTemplate.checklists || [],
      library: initialTemplate.library || []
    } : {
      name: '',
      type: 'project',
      description: '',
      isFavorite: false,
      isArchived: false,
      projectPriority: 'high',
      projectDurationDays: 30,
      projectNotes: '',
      projectTags: [],
      tasks: [],
      schedule: [],
      checklists: [],
      library: []
    }
  );

  const [activeTab, setActiveTab] = useState<'details' | 'tasks' | 'schedule' | 'library'>('details');

  const [isTaskSheetOpen, setTaskSheetOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TemplateTaskDef | null>(null);

  const defaultTask: TemplateTaskDef = { id: '', title: '', priority: 'Medium', offsetDays: 0, durationMinutes: 60, notes: '', dependencies: [] };
  const [taskForm, setTaskForm] = useState<TemplateTaskDef>(defaultTask);

  const handleOpenTask = (t?: TemplateTaskDef) => {
    if (t) {
      setEditingTask(t);
      setTaskForm({ ...t });
    } else {
      setEditingTask(null);
      setTaskForm({ ...defaultTask, id: generateId() });
    }
    setTaskSheetOpen(true);
  };

  const handleSaveTask = () => {
    if (!taskForm.title.trim()) return;
    if (editingTask) {
      setForm(f => ({ ...f, tasks: f.tasks.map(x => x.id === editingTask.id ? taskForm : x) }));
    } else {
      setForm(f => ({ ...f, tasks: [...f.tasks, taskForm] }));
    }
    setTaskSheetOpen(false);
  };

  const handleDeleteTask = (id: string) => {
    setForm(f => ({ ...f, tasks: f.tasks.filter(x => x.id !== id) }));
  };

  // Same for schedule
  const [isScheduleSheetOpen, setScheduleSheetOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<TemplateScheduleDef | null>(null);
  
  const defaultSchedule: TemplateScheduleDef = { id: '', title: '', type: 'Meeting', durationMinutes: 60, offsetDays: 0, startTime: '09:00', notes: '' };
  const [scheduleForm, setScheduleForm] = useState<TemplateScheduleDef>(defaultSchedule);

  const handleOpenSchedule = (s?: TemplateScheduleDef) => {
    if (s) {
      setEditingSchedule(s);
      setScheduleForm({ ...s });
    } else {
      setEditingSchedule(null);
      setScheduleForm({ ...defaultSchedule, id: generateId() });
    }
    setScheduleSheetOpen(true);
  };

  const handleSaveSchedule = () => {
    if (!scheduleForm.title.trim()) return;
    if (editingSchedule) {
      setForm(f => ({ ...f, schedule: f.schedule.map(x => x.id === editingSchedule.id ? scheduleForm : x) }));
    } else {
      setForm(f => ({ ...f, schedule: [...f.schedule, scheduleForm] }));
    }
    setScheduleSheetOpen(false);
  };

  const handleDeleteSchedule = (id: string) => {
    setForm(f => ({ ...f, schedule: f.schedule.filter(x => x.id !== id) }));
  };

    const [isLibrarySheetOpen, setLibrarySheetOpen] = useState(false);
  const [editingLibrary, setEditingLibrary] = useState<TemplateLibraryDef | null>(null);
  const defaultLibrary: TemplateLibraryDef = { id: '', name: '', type: 'file', category: 'Documents', tags: [] };
  const [libraryForm, setLibraryForm] = useState<TemplateLibraryDef>(defaultLibrary);

  const handleOpenLibrary = (l?: TemplateLibraryDef) => {
    if (l) {
      setEditingLibrary(l);
      setLibraryForm({ ...l });
    } else {
      setEditingLibrary(null);
      setLibraryForm({ ...defaultLibrary, id: generateId() });
    }
    setLibrarySheetOpen(true);
  };

  const handleSaveLibrary = () => {
    if (!libraryForm.name.trim()) return;
    if (editingLibrary) {
      setForm(f => ({ ...f, library: f.library.map(x => x.id === editingLibrary.id ? libraryForm : x) }));
    } else {
      setForm(f => ({ ...f, library: [...f.library, libraryForm] }));
    }
    setLibrarySheetOpen(false);
  };

  const handleDeleteLibrary = (id: string) => {
    setForm(f => ({ ...f, library: f.library.filter(x => x.id !== id) }));
  };

  return (
    <div className="absolute inset-0 bg-canvas z-50 flex flex-col h-full animate-in slide-in-from-right-4">
       <Header 
         title={initialTemplate ? "Edit Template" : "New Template"}
         leftIcon={
           <IconButton variant="ghost" onClick={onDismiss} className="-ml-2">
             <ChevronLeft size={24} />
           </IconButton>
         }
         rightIcon={
           <Button onClick={() => onSave(form)} disabled={!form.name.trim()}>Save</Button>
         }
       />
       
       <div className="px-4 py-2 border-b border-bd-subtle">
         <Tabs 
           tabs={[
             { id: 'details', label: 'Details' },
             { id: 'tasks', label: `Tasks (${form.tasks.length})` },
             { id: 'schedule', label: `Schedule (${form.schedule.length})` },
                        { id: 'library', label: `Library (${form.library.length})` }
           ]}
           activeTab={activeTab} 
           onChange={(t) => setActiveTab(t as any)} 
         />
       </div>

       <div className="flex-1 overflow-y-auto p-4 md:p-6 no-scrollbar">
         {activeTab === 'details' && (
           <div className="space-y-6 max-w-2xl mx-auto">
             <div className="space-y-4">
               <div>
                 <label className="block text-sm font-semibold text-tx-primary mb-1.5">Template Name</label>
                 <input 
                   type="text" 
                   value={form.name}
                   onChange={e => setForm({...form, name: e.target.value})}
                   className="w-full px-4 py-3 rounded-xl bg-surface-neutral border border-transparent focus:border-bd-subtle outline-none text-tx-primary"
                   placeholder="e.g., New Client Onboarding"
                 />
               </div>
               
               <div>
                 <label className="block text-sm font-semibold text-tx-primary mb-1.5">Template Type</label>
                 <select 
                   value={form.type}
                   onChange={e => setForm({...form, type: e.target.value as TemplateType})}
                   className="w-full px-4 py-3 rounded-xl bg-surface-neutral border border-transparent focus:border-bd-subtle outline-none text-tx-primary"
                 >
                   <option value="project">Project Template</option>
                   <option value="workflow">Workflow Template</option>
                   <option value="task">Task Template</option>
                   <option value="meeting">Meeting Template</option>
                   <option value="checklist">Checklist Template</option>
                 </select>
               </div>

               <div>
                 <label className="block text-sm font-semibold text-tx-primary mb-1.5">Description</label>
                 <textarea 
                   value={form.description}
                   onChange={e => setForm({...form, description: e.target.value})}
                   className="w-full px-4 py-3 rounded-xl bg-surface-neutral border border-transparent focus:border-bd-subtle outline-none text-tx-primary h-24 resize-none"
                   placeholder="What is this template used for? Variables supported: {{CLIENT_NAME}}, {{PROJECT_NAME}}"
                 />
                 <p className="text-xs text-tx-muted mt-2 leading-relaxed">
                   <strong>Available variables:</strong> {'{{CLIENT_NAME}}'}, {'{{PROJECT_NAME}}'}, {'{{START_DATE}}'}, {'{{DEADLINE}}'}, {'{{PROJECT_MANAGER}}'}.
                   These will be replaced when you use the template.
                 </p>
               </div>
             </div>

             {(form.type === 'project' || form.type === 'workflow') && (
               <div className="pt-6 border-t border-bd-subtle space-y-4">
                 <h3 className="text-lg font-semibold text-tx-primary">Project Defaults</h3>
                 
                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <label className="block text-sm font-semibold text-tx-primary mb-1.5">Default Priority</label>
                     <select 
                       value={form.projectPriority}
                       onChange={e => setForm({...form, projectPriority: e.target.value as any})}
                       className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none outline-none text-tx-primary"
                     >
                       <option value="high">High</option>
                       <option value="low">Normal</option>
                     </select>
                   </div>
                   <div>
                     <label className="block text-sm font-semibold text-tx-primary mb-1.5">Est. Duration (Days)</label>
                     <input 
                       type="number" 
                       value={form.projectDurationDays}
                       onChange={e => setForm({...form, projectDurationDays: parseInt(e.target.value) || 0})}
                       className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none outline-none text-tx-primary"
                     />
                   </div>
                 </div>
               </div>
             )}
           </div>
         )}

         {activeTab === 'tasks' && (
           <div className="space-y-4 max-w-2xl mx-auto">
             <div className="flex justify-between items-center mb-2">
               <h3 className="text-lg font-semibold text-tx-primary">Template Tasks</h3>
               <Button variant="secondary" onClick={() => handleOpenTask()}>
                 <Plus size={16} className="mr-1" /> Add Task
               </Button>
             </div>
             
             {form.tasks.length === 0 ? (
               <div className="text-center py-12 text-tx-muted border border-dashed border-bd-subtle rounded-2xl">
                 No tasks in this template yet.
               </div>
             ) : (
               <div className="space-y-2">
                 {form.tasks.sort((a,b) => a.offsetDays - b.offsetDays).map((t, idx) => (
                   <div key={t.id} onClick={() => handleOpenTask(t)} className="flex items-center gap-3 p-3 bg-surface-neutral/50 rounded-xl border border-bd-subtle cursor-pointer hover:border-accent-primary/50 transition-colors">
                     <div className="w-8 h-8 rounded-full bg-canvas flex items-center justify-center text-xs font-semibold text-tx-muted shrink-0">
                       D+{t.offsetDays}
                     </div>
                     <div className="flex-1 min-w-0">
                       <h4 className="font-medium text-tx-primary truncate">{t.title}</h4>
                       <div className="flex items-center gap-2 text-xs text-tx-muted mt-0.5">
                         <span>{t.priority}</span>
                         <span>•</span>
                         <span>{t.durationMinutes}m</span>
                         {t.dependencies && t.dependencies.length > 0 && (
                           <>
                             <span>•</span>
                             <span>{t.dependencies.length} deps</span>
                           </>
                         )}
                       </div>
                     </div>
                     <IconButton variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDeleteTask(t.id); }}>
                       <Trash2 size={16} className="text-red-500" />
                     </IconButton>
                   </div>
                 ))}
               </div>
             )}
           </div>
         )}
         
         {activeTab === 'schedule' && (
           <div className="space-y-4 max-w-2xl mx-auto">
             <div className="flex justify-between items-center mb-2">
               <h3 className="text-lg font-semibold text-tx-primary">Template Schedule / Meetings</h3>
               <Button variant="secondary" onClick={() => handleOpenSchedule()}>
                 <Plus size={16} className="mr-1" /> Add Event
               </Button>
             </div>
             
             {form.schedule.length === 0 ? (
               <div className="text-center py-12 text-tx-muted border border-dashed border-bd-subtle rounded-2xl">
                 No schedule items in this template yet.
               </div>
             ) : (
               <div className="space-y-2">
                 {form.schedule.sort((a,b) => a.offsetDays - b.offsetDays).map((s, idx) => (
                   <div key={s.id} onClick={() => handleOpenSchedule(s)} className="flex items-center gap-3 p-3 bg-surface-neutral/50 rounded-xl border border-bd-subtle cursor-pointer hover:border-accent-primary/50 transition-colors">
                     <div className="w-8 h-8 rounded-full bg-canvas flex flex-col items-center justify-center text-tx-primary shrink-0">
                       <span className="text-[10px] font-bold">D+{s.offsetDays}</span>
                     </div>
                     <div className="flex-1 min-w-0">
                       <h4 className="font-medium text-tx-primary truncate">{s.title}</h4>
                       <div className="flex items-center gap-2 text-xs text-tx-muted mt-0.5">
                         <span>{s.type}</span>
                         <span>•</span>
                         <span>{s.startTime || 'All day'}</span>
                         <span>•</span>
                         <span>{s.durationMinutes}m</span>
                       </div>
                     </div>
                     <IconButton variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDeleteSchedule(s.id); }}>
                       <Trash2 size={16} className="text-red-500" />
                     </IconButton>
                   </div>
                 ))}
               </div>
             )}
           </div>
         )}
       
         {activeTab === 'library' && (
           <div className="space-y-4 max-w-2xl mx-auto">
             <div className="flex justify-between items-center mb-2">
               <h3 className="text-lg font-semibold text-tx-primary">Template Library Structure</h3>
               <Button variant="secondary" onClick={() => handleOpenLibrary()}>
                 <Plus size={16} className="mr-1" /> Add Folder/Asset
               </Button>
             </div>
             
             {form.library.length === 0 ? (
               <div className="text-center py-12 text-tx-muted border border-dashed border-bd-subtle rounded-2xl">
                 No library structure in this template yet.
               </div>
             ) : (
               <div className="space-y-2">
                 {form.library.map((l, idx) => (
                   <div key={l.id} onClick={() => handleOpenLibrary(l)} className="flex items-center gap-3 p-3 bg-surface-neutral/50 rounded-xl border border-bd-subtle cursor-pointer hover:border-accent-primary/50 transition-colors">
                     <div className="w-8 h-8 rounded-full bg-canvas flex flex-col items-center justify-center text-tx-primary shrink-0">
                       <Folder size={16} />
                     </div>
                     <div className="flex-1 min-w-0">
                       <h4 className="font-medium text-tx-primary truncate">{l.name}</h4>
                       <div className="flex items-center gap-2 text-xs text-tx-muted mt-0.5">
                         <span>{l.type}</span>
                         {l.tags.length > 0 && (
                           <>
                             <span>•</span>
                             <span>{l.tags.join(', ')}</span>
                           </>
                         )}
                       </div>
                     </div>
                     <IconButton variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDeleteLibrary(l.id); }}>
                       <Trash2 size={16} className="text-red-500" />
                     </IconButton>
                   </div>
                 ))}
               </div>
             )}
           </div>
         )}

       </div>

       {/* Task Sheet */}
       <BottomSheet isOpen={isTaskSheetOpen} onClose={() => setTaskSheetOpen(false)} title={editingTask ? "Edit Template Task" : "New Template Task"} onSave={handleSaveTask}>
         <BottomSheetField>
           <input type="text" placeholder="Task Title (supports variables)" value={taskForm.title} onChange={e => setTaskForm({...taskForm, title: e.target.value})} className="w-full text-[20px] font-medium text-tx-primary placeholder:text-tx-muted/50 bg-transparent outline-none py-2" autoFocus />
         </BottomSheetField>
         
         <div className="grid grid-cols-2 gap-4">
           <BottomSheetField label="Priority">
             <select value={taskForm.priority} onChange={e => setTaskForm({...taskForm, priority: e.target.value as any})} className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none text-[15px] outline-none text-tx-primary">
               <option value="Low">Low</option>
               <option value="Medium">Medium</option>
               <option value="High">High</option>
             </select>
           </BottomSheetField>
           <BottomSheetField label="Offset (Days from start)">
             <input type="number" value={taskForm.offsetDays} onChange={e => setTaskForm({...taskForm, offsetDays: parseInt(e.target.value) || 0})} className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none text-[15px] outline-none text-tx-primary" />
           </BottomSheetField>
         </div>

         <BottomSheetField label="Duration (Minutes)">
           <input type="number" value={taskForm.durationMinutes || 60} onChange={e => setTaskForm({...taskForm, durationMinutes: parseInt(e.target.value) || 0})} className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none text-[15px] outline-none text-tx-primary" />
         </BottomSheetField>
         
         <BottomSheetField label="Notes / Description">
           <textarea placeholder="Instructions..." value={taskForm.notes || ''} onChange={e => setTaskForm({...taskForm, notes: e.target.value})} className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none text-[15px] outline-none text-tx-primary h-24 resize-none" />
         </BottomSheetField>
       </BottomSheet>

       {/* Schedule Sheet */}
       <BottomSheet isOpen={isScheduleSheetOpen} onClose={() => setScheduleSheetOpen(false)} title={editingSchedule ? "Edit Template Event" : "New Template Event"} onSave={handleSaveSchedule}>
         <BottomSheetField>
           <input type="text" placeholder="Event Title (supports variables)" value={scheduleForm.title} onChange={e => setScheduleForm({...scheduleForm, title: e.target.value})} className="w-full text-[20px] font-medium text-tx-primary placeholder:text-tx-muted/50 bg-transparent outline-none py-2" autoFocus />
         </BottomSheetField>
         
         <BottomSheetField label="Type">
           <select value={scheduleForm.type} onChange={e => setScheduleForm({...scheduleForm, type: e.target.value as EventType})} className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none text-[15px] outline-none text-tx-primary">
             {['Meeting', 'Client Call', 'Focus Time', 'Deadline', 'Milestone', 'Task Block'].map(t => (
               <option key={t} value={t}>{t}</option>
             ))}
           </select>
         </BottomSheetField>

         <div className="grid grid-cols-2 gap-4">
           <BottomSheetField label="Offset (Days from start)">
             <input type="number" value={scheduleForm.offsetDays} onChange={e => setScheduleForm({...scheduleForm, offsetDays: parseInt(e.target.value) || 0})} className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none text-[15px] outline-none text-tx-primary" />
           </BottomSheetField>
           <BottomSheetField label="Start Time (HH:mm)">
             <input type="time" value={scheduleForm.startTime || ''} onChange={e => setScheduleForm({...scheduleForm, startTime: e.target.value})} className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none text-[15px] outline-none text-tx-primary" />
           </BottomSheetField>
         </div>

         <BottomSheetField label="Duration (Minutes)">
           <input type="number" value={scheduleForm.durationMinutes || 60} onChange={e => setScheduleForm({...scheduleForm, durationMinutes: parseInt(e.target.value) || 0})} className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none text-[15px] outline-none text-tx-primary" />
         </BottomSheetField>
         
         <BottomSheetField label="Notes / Agenda">
           <textarea placeholder="Agenda..." value={scheduleForm.notes || ''} onChange={e => setScheduleForm({...scheduleForm, notes: e.target.value})} className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none text-[15px] outline-none text-tx-primary h-24 resize-none" />
         </BottomSheetField>
       </BottomSheet>


       {/* Library Sheet */}
       <BottomSheet isOpen={isLibrarySheetOpen} onClose={() => setLibrarySheetOpen(false)} title={editingLibrary ? "Edit Library Folder/Asset" : "New Library Folder/Asset"} onSave={handleSaveLibrary}>
         <BottomSheetField>
           <input type="text" placeholder="Folder/Asset Name (supports variables)" value={libraryForm.name} onChange={e => setLibraryForm({...libraryForm, name: e.target.value})} className="w-full text-[20px] font-medium text-tx-primary placeholder:text-tx-muted/50 bg-transparent outline-none py-2" autoFocus />
         </BottomSheetField>
         
         <BottomSheetField label="Type">
           <div className="flex gap-4">
             <select value={libraryForm.type} onChange={e => setLibraryForm({...libraryForm, type: e.target.value as any})} className="w-1/2 px-4 py-3 rounded-xl bg-surface-neutral border-none text-[15px] outline-none text-tx-primary">
               <option value="file">File Placeholder</option>
               <option value="link">Link</option>
               <option value="note">Note</option>
             </select>
             <select value={libraryForm.category} onChange={e => setLibraryForm({...libraryForm, category: e.target.value as any})} className="w-1/2 px-4 py-3 rounded-xl bg-surface-neutral border-none text-[15px] outline-none text-tx-primary">
               {['Documents', 'Project Files', 'Contracts', 'Proposals', 'Reports', 'Images', 'References', 'Templates', 'Design Assets', 'Notes'].map(c => (
                 <option key={c} value={c}>{c}</option>
               ))}
             </select>
           </div>
         </BottomSheetField>
         <BottomSheetField label="Tags (comma separated)">
           <input type="text" placeholder="e.g. contracts, signed" value={libraryForm.tags.join(', ')} onChange={e => setLibraryForm({...libraryForm, tags: e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})} className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none text-[15px] outline-none text-tx-primary" />
         </BottomSheetField>
       </BottomSheet>
    </div>

  )
}
