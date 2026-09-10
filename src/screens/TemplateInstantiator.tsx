import React, { useState, useMemo } from 'react';
import { TemplateItem } from '../types';
import { Header } from '../components/Shared';
import { ChevronLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { Button, IconButton } from '../components/ui';
import { useClients } from '../context/ClientsContext';
import { useProjects } from '../context/ProjectsContext';
import { useTasks } from '../context/TasksContext';
import { useCalendar } from '../context/CalendarContext';
import { useLibrary } from '../context/LibraryContext';
import { SearchPicker } from '../components/SearchPicker';

interface Props {
  template: TemplateItem;
  onDismiss: () => void;
  onComplete: (projectId: string) => void;
}

export function TemplateInstantiator({ template, onDismiss, onComplete }: Props) {
  const { clients } = useClients();
  const { addProject } = useProjects();
  const { addTask } = useTasks();
  const { addEvent } = useCalendar();
  const { addLibraryItem } = useLibrary();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isGenerating, setIsGenerating] = useState(false);

  // Form State
  const [clientId, setClientId] = useState('');
  const [projectName, setProjectName] = useState(template.name.replace('Template', '').trim());
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [deadlineDate, setDeadlineDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + (template.projectDurationDays || 30));
    return d.toISOString().split('T')[0];
  });
  const [projectManager, setProjectManager] = useState('Me');

  const selectedClient = clients.find(c => c.id === clientId);

  const resolveVariables = (text: string) => {
    if (!text) return '';
    return text
      .replace(/{{CLIENT_NAME}}/g, selectedClient?.name || 'Client')
      .replace(/{{PROJECT_NAME}}/g, projectName || 'Project')
      .replace(/{{START_DATE}}/g, startDate)
      .replace(/{{DEADLINE}}/g, deadlineDate)
      .replace(/{{PROJECT_MANAGER}}/g, projectManager);
  };

  const generatedTasks = useMemo(() => {
    return template.tasks.map(t => {
      const d = new Date(startDate);
      d.setDate(d.getDate() + t.offsetDays);
      return {
        ...t,
        title: resolveVariables(t.title),
        notes: resolveVariables(t.notes || ''),
        calculatedDate: d.toISOString().split('T')[0]
      };
    });
  }, [template.tasks, startDate, clientId, projectName, deadlineDate, projectManager]);

  const generatedEvents = useMemo(() => {
    return template.schedule.map(s => {
      const d = new Date(startDate);
      d.setDate(d.getDate() + s.offsetDays);
      return {
        ...s,
        title: resolveVariables(s.title),
        notes: resolveVariables(s.notes || ''),
        calculatedDate: d.toISOString().split('T')[0]
      };
    });
  }, [template.schedule, startDate, clientId, projectName, deadlineDate, projectManager]);

  
  const generatedLibrary = useMemo(() => {
    return template.library.map(l => ({
      ...l,
      name: resolveVariables(l.name)
    }));
  }, [template.library, startDate, clientId, projectName, deadlineDate, projectManager]);

  const handleCreate = async () => {
    setIsGenerating(true);
    
    // Create Project
    const projectId = addProject({
      name: projectName,
      priority: template.projectPriority || 'low',
      completionPct: 0,
      tone: 'neutral',
      clientId: clientId || undefined,
      status: 'active',
      notes: resolveVariables(template.projectNotes || ''),
    });

    // We simulate async for UX polish
    await new Promise(r => setTimeout(r, 600));

    // Create Tasks
    const taskMapping: Record<string, string> = {}; // map templateTaskID -> newTaskId
    
    for (const gt of generatedTasks) {
      const newTaskId = addTask({
        title: gt.title,
        categoryId: '', // default
        priority: gt.priority,
        date: gt.calculatedDate,
        notes: gt.notes,
        status: 'upcoming',
        projectId,
        clientId: clientId || undefined,
      });
      taskMapping[gt.id] = newTaskId;
    }

    // Create Schedule Events
    for (const ge of generatedEvents) {
      addEvent({
        title: ge.title,
        date: ge.calculatedDate,
        startTime: ge.startTime || '09:00',
        duration: ge.durationMinutes,
        allDay: !ge.startTime,
        type: ge.type,
        status: 'scheduled',
        notes: ge.notes,
        projectId,
        clientId: clientId || undefined,
        categoryId: '',
        repeat: 'None'
      });
    }

    
    // Create Library Items
    for (const gl of generatedLibrary) {
      addLibraryItem({
        name: gl.name,
        type: gl.type,
        tags: gl.tags,
        urlOrReference: '', // To be filled later
        category: gl.category,
        projectId,
        clientId: clientId || undefined
      });
    }

    setIsGenerating(false);
    onComplete(projectId);
  };

  return (
    <div className="absolute inset-0 bg-canvas z-50 flex flex-col h-full animate-in slide-in-from-bottom-4">
      <Header 
        title="Use Template"
        leftIcon={<IconButton variant="ghost" onClick={onDismiss} className="-ml-2"><ChevronLeft size={24} /></IconButton>}
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 no-scrollbar flex flex-col max-w-2xl mx-auto w-full">
        {step === 1 && (
          <div className="space-y-6 flex-1">
            <h2 className="text-xl font-bold text-tx-primary">Configure Variables</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-tx-primary mb-1.5">1. Select Client (Optional)</label>
                <SearchPicker
                  items={clients.map(c => ({ id: c.id, label: c.name }))}
                  value={clientId}
                  onChange={setClientId}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-tx-primary mb-1.5">2. Project Name</label>
                <input 
                  type="text" 
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none outline-none text-tx-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-tx-primary mb-1.5">3. Start Date</label>
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none outline-none text-tx-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-tx-primary mb-1.5">4. Deadline</label>
                  <input 
                    type="date" 
                    value={deadlineDate}
                    onChange={e => setDeadlineDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none outline-none text-tx-primary"
                  />
                </div>
              </div>
            </div>

            <Button className="w-full mt-8" onClick={() => setStep(2)} disabled={!projectName.trim()}>
              Next: Review Generated Plan
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 flex-1 flex flex-col">
            <div>
              <h2 className="text-xl font-bold text-tx-primary">5. Review Generated Structure</h2>
              <p className="text-sm text-tx-muted mt-1">Check the resolved dates and titles.</p>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-6 border border-bd-subtle rounded-2xl p-4 bg-surface-neutral/10">
               <div>
                 <h3 className="text-sm font-bold text-tx-primary uppercase tracking-wider mb-3">Project Details</h3>
                 <div className="text-sm text-tx-primary">
                   <strong>Name:</strong> {projectName}<br />
                   <strong>Client:</strong> {selectedClient?.name || 'None'}<br />
                   <strong>Timeline:</strong> {startDate} to {deadlineDate}
                 </div>
               </div>

               <div>
                 <h3 className="text-sm font-bold text-tx-primary uppercase tracking-wider mb-3">Tasks ({generatedTasks.length})</h3>
                 <div className="space-y-2">
                   {generatedTasks.map((t, i) => (
                     <div key={i} className="text-[13px] bg-canvas p-2 rounded-lg border border-bd-subtle flex justify-between">
                       <span className="font-medium text-tx-primary truncate pr-2">{t.title}</span>
                       <span className="text-tx-muted shrink-0">{t.calculatedDate}</span>
                     </div>
                   ))}
                 </div>
               </div>

               <div>
                 <h3 className="text-sm font-bold text-tx-primary uppercase tracking-wider mb-3">Schedule ({generatedEvents.length})</h3>
                 <div className="space-y-2">
                   {generatedEvents.map((e, i) => (
                     <div key={i} className="text-[13px] bg-canvas p-2 rounded-lg border border-bd-subtle flex justify-between">
                       <span className="font-medium text-tx-primary truncate pr-2">{e.title}</span>
                       <span className="text-tx-muted shrink-0">{e.calculatedDate} {e.startTime || ''}</span>
                     </div>
                   ))}
                 </div>
               
               <div>
                 <h3 className="text-sm font-bold text-tx-primary uppercase tracking-wider mb-3">Library ({generatedLibrary.length})</h3>
                 <div className="space-y-2">
                   {generatedLibrary.map((l, i) => (
                     <div key={i} className="text-[13px] bg-canvas p-2 rounded-lg border border-bd-subtle flex justify-between">
                       <span className="font-medium text-tx-primary truncate pr-2">{l.name}</span>
                       <span className="text-tx-muted shrink-0 capitalize">{l.type}</span>
                     </div>
                   ))}
                 </div>
               </div>

            </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4 shrink-0">
              <Button variant="secondary" onClick={() => setStep(1)} disabled={isGenerating}>Back</Button>
              <Button onClick={handleCreate} disabled={isGenerating}>
                {isGenerating ? <Loader2 size={20} className="animate-spin mx-auto" /> : '6. Confirm & Create'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
