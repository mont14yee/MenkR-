import React, { useState, useMemo } from 'react';
import { TemplateItem } from '../types';
import { Header } from '../components/Shared';
import { 
  ChevronLeft, CheckCircle2, Loader2, ArrowRight, Layout, Calendar, 
  CheckSquare, FileText, Check 
} from 'lucide-react';
import { Button, IconButton, Badge } from '../components/ui';
import { useClients } from '../context/ClientsContext';
import { useProjects } from '../context/ProjectsContext';
import { useTasks } from '../context/TasksContext';
import { useCalendar } from '../context/CalendarContext';
import { useLibrary } from '../context/LibraryContext';
import { SearchPicker } from '../components/SearchPicker';
import { SaveActionButton } from '../components/BottomSheet';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

interface Props {
  template: TemplateItem;
  onDismiss: () => void;
  onComplete: (projectId: string, targetScreen?: 'projects' | 'calendar' | 'tasks' | 'library') => void;
}

export function TemplateInstantiator({ template, onDismiss, onComplete }: Props) {
  const { clients } = useClients();
  const { addProject } = useProjects();
  const { addTask } = useTasks();
  const { addEvent } = useCalendar();
  const { addLibraryItem } = useLibrary();
  const { role } = useAuth();
  const { showToast } = useToast();
  const isViewer = role === 'viewer';

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);

  // Form State
  const [clientId, setClientId] = useState('');
  const [projectName, setProjectName] = useState(template.name.replace(/Template/i, '').trim() || 'New Project');
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
    return (template.tasks || []).map(t => {
      const d = new Date(startDate);
      d.setDate(d.getDate() + (t.offsetDays || 0));
      return {
        ...t,
        title: resolveVariables(t.title),
        notes: resolveVariables(t.notes || ''),
        calculatedDate: d.toISOString().split('T')[0]
      };
    });
  }, [template.tasks, startDate, clientId, projectName, deadlineDate, projectManager]);

  const generatedEvents = useMemo(() => {
    return (template.schedule || []).map(s => {
      const d = new Date(startDate);
      d.setDate(d.getDate() + (s.offsetDays || 0));
      return {
        ...s,
        title: resolveVariables(s.title),
        notes: resolveVariables(s.notes || ''),
        calculatedDate: d.toISOString().split('T')[0]
      };
    });
  }, [template.schedule, startDate, clientId, projectName, deadlineDate, projectManager]);

  const generatedLibrary = useMemo(() => {
    return (template.library || []).map(l => ({
      ...l,
      name: resolveVariables(l.name)
    }));
  }, [template.library, startDate, clientId, projectName, deadlineDate, projectManager]);

  const handleCreate = async () => {
    if (isGenerating) return;
    if (isViewer) {
      const msg = 'Viewer role has read-only access.';
      showToast({ message: msg });
      throw new Error(msg);
    }
    if (!projectName.trim()) {
      const msg = 'Project name is required.';
      showToast({ message: msg });
      throw new Error(msg);
    }

    setIsGenerating(true);
    setCreateError(null);
    try {
      // 1. Create Project
      const projectId = addProject({
        name: projectName.trim(),
        priority: template.projectPriority || 'low',
        completionPct: 0,
        tone: 'lime',
        clientId: clientId || undefined,
        status: 'active',
        dueDate: deadlineDate,
        notes: resolveVariables(template.projectNotes || ''),
      });

      // Small async yield for responsive UI
      await new Promise(r => setTimeout(r, 300));

      // 2. Create Tasks linked to Project & Client
      for (const gt of generatedTasks) {
        addTask({
          title: gt.title,
          categoryId: 'workflow',
          priority: gt.priority || 'Medium',
          date: gt.calculatedDate,
          dueDate: gt.calculatedDate,
          notes: gt.notes,
          status: 'upcoming',
          projectId,
          clientId: clientId || undefined,
        });
      }

      // 3. Create Schedule Events
      for (const ge of generatedEvents) {
        addEvent({
          title: ge.title,
          date: ge.calculatedDate,
          startTime: ge.startTime || '09:00',
          endTime: ge.startTime ? `${parseInt(ge.startTime.split(':')[0]) + 1}:00` : '10:00',
          duration: ge.durationMinutes || 60,
          allDay: !ge.startTime,
          type: ge.type || 'Milestone',
          status: 'scheduled',
          notes: ge.notes,
          projectId,
          clientId: clientId || undefined,
          categoryId: '',
          repeat: 'none'
        });
      }

      // 4. Create Library Items (Starter specifications, checklists, or document templates)
      for (const gl of generatedLibrary) {
        addLibraryItem({
          name: gl.name,
          type: gl.type || 'file',
          tags: gl.tags || ['template-generated'],
          urlOrReference: '',
          category: gl.category || 'Documents',
          projectId,
          clientId: clientId || undefined,
          description: `Starter document instantiated from template: ${template.name}`,
          isFavorite: false,
        });
      }

      setCreatedProjectId(projectId);
      showToast({ message: `Created project "${projectName.trim()}" from template.` });
      onComplete(projectId);
    } catch (err: any) {
      const msg = err?.message || 'Unable to instantiate template. Please try again.';
      showToast({ message: msg });
      throw err instanceof Error ? err : new Error(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="absolute inset-0 bg-canvas z-50 flex flex-col h-full animate-in slide-in-from-bottom-4">
      <Header 
        title="Use Template"
        leftIcon={
          <IconButton variant="ghost" onClick={onDismiss} className="-ml-2">
            <ChevronLeft size={24} />
          </IconButton>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 no-scrollbar flex flex-col max-w-2xl mx-auto w-full">
        {step === 1 && (
          <div className="space-y-5 flex-1">
            <div>
              <h2 className="text-xl font-bold text-tx-primary">Configure Template Variables</h2>
              <p className="text-xs text-tx-muted mt-0.5">Customize your project scope and schedule parameters.</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-tx-muted mb-1.5">
                  1. Link Client (Optional)
                </label>
                <SearchPicker
                  items={clients.map(c => ({ id: c.id, label: c.name }))}
                  value={clientId}
                  onChange={setClientId}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-tx-muted mb-1.5">
                  2. Project Name
                </label>
                <input 
                  type="text" 
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-surface-neutral border border-bd-subtle outline-none text-sm font-semibold text-tx-primary"
                  placeholder="e.g. Apex Headquarters Phase 2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-tx-muted mb-1.5">
                    3. Start Date
                  </label>
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-neutral border border-bd-subtle outline-none text-xs text-tx-primary font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-tx-muted mb-1.5">
                    4. Target Deadline
                  </label>
                  <input 
                    type="date" 
                    value={deadlineDate}
                    onChange={e => setDeadlineDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-neutral border border-bd-subtle outline-none text-xs text-tx-primary font-medium"
                  />
                </div>
              </div>
            </div>

            <Button 
              className="w-full mt-6" 
              onClick={() => setStep(2)} 
              disabled={!projectName.trim()}
            >
              Next: Review Generated Plan
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5 flex-1 flex flex-col">
            <div>
              <h2 className="text-xl font-bold text-tx-primary">Review Generated Structure</h2>
              <p className="text-xs text-tx-muted mt-0.5">Applying this template will create records across MenkR- while preserving the template intact.</p>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-4 border border-bd-subtle rounded-2xl p-4 bg-surface-neutral/10">
              {/* Project summary */}
              <div className="p-3 bg-card border border-bd-subtle rounded-xl">
                <h3 className="text-xs font-bold text-tx-muted uppercase tracking-wider mb-1.5">Project Entity</h3>
                <div className="text-xs text-tx-primary space-y-0.5">
                  <div><strong>Name:</strong> {projectName}</div>
                  <div><strong>Client:</strong> {selectedClient?.name || 'Unassigned'}</div>
                  <div><strong>Timeline:</strong> {startDate} &rarr; {deadlineDate}</div>
                </div>
              </div>

              {/* Tasks list */}
              <div>
                <h3 className="text-xs font-bold text-tx-muted uppercase tracking-wider mb-2">
                  Tasks to Schedule ({generatedTasks.length})
                </h3>
                <div className="space-y-1.5">
                  {generatedTasks.map((t, i) => (
                    <div key={i} className="text-xs bg-card p-2 rounded-xl border border-bd-subtle flex justify-between items-center">
                      <span className="font-semibold text-tx-primary truncate pr-2">{t.title}</span>
                      <span className="text-[11px] text-tx-muted shrink-0">{t.calculatedDate}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Schedule events */}
              {generatedEvents.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-tx-muted uppercase tracking-wider mb-2">
                    Schedule Milestones & Meetings ({generatedEvents.length})
                  </h3>
                  <div className="space-y-1.5">
                    {generatedEvents.map((e, i) => (
                      <div key={i} className="text-xs bg-card p-2 rounded-xl border border-bd-subtle flex justify-between items-center">
                        <span className="font-semibold text-tx-primary truncate pr-2">{e.title}</span>
                        <span className="text-[11px] text-tx-muted shrink-0">{e.calculatedDate} {e.startTime || ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Library files */}
              {generatedLibrary.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-tx-muted uppercase tracking-wider mb-2">
                    Starter Documents in Library ({generatedLibrary.length})
                  </h3>
                  <div className="space-y-1.5">
                    {generatedLibrary.map((l, i) => (
                      <div key={i} className="text-xs bg-card p-2 rounded-xl border border-bd-subtle flex justify-between items-center">
                        <span className="font-semibold text-tx-primary truncate pr-2">{l.name}</span>
                        <span className="text-[10px] text-tx-muted shrink-0 uppercase">{l.type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {createError && (
              <div role="alert" className="px-3.5 py-2.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-600 text-[13px] font-medium">
                {createError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mt-3 shrink-0">
              <Button variant="secondary" onClick={() => setStep(1)} disabled={isGenerating}>
                Back
              </Button>
              <SaveActionButton
                variant="compact"
                onSave={handleCreate}
                label="6. Confirm & Create"
                savingLabel="Creating..."
                isSaving={isGenerating}
                disabled={isViewer || !projectName.trim()}
                onError={setCreateError}
                className="w-full h-11 rounded-full"
              />
            </div>
          </div>
        )}

        {/* Step 3: Success & Connected Workflows */}
        {step === 3 && createdProjectId && (
          <div className="space-y-6 flex-1 flex flex-col justify-center text-center animate-in fade-in-50 duration-300 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-full bg-accent-secondary/20 text-accent-secondary flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 size={36} />
            </div>

            <div>
              <h2 className="text-xl font-bold text-tx-primary">Template Instantiated!</h2>
              <p className="text-xs text-tx-muted mt-1 leading-relaxed">
                <strong>{projectName}</strong> has been successfully initialized with {generatedTasks.length} tasks, {generatedEvents.length} calendar events, and {generatedLibrary.length} starter documents.
              </p>
            </div>

            <div className="space-y-2 text-left pt-2">
              <span className="text-xs font-bold text-tx-muted uppercase tracking-wider block mb-2">
                Continue to Module:
              </span>

              <button
                onClick={() => onComplete(createdProjectId, 'projects')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-card border border-bd-subtle hover:border-tx-primary transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <Layout size={16} className="text-accent-primary" />
                  <span className="text-xs font-semibold text-tx-primary">Open Project Workspace</span>
                </div>
                <ArrowRight size={14} className="text-tx-muted group-hover:text-tx-primary transition-transform group-hover:translate-x-0.5" />
              </button>

              <button
                onClick={() => onComplete(createdProjectId, 'calendar')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-card border border-bd-subtle hover:border-tx-primary transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <Calendar size={16} className="text-accent-secondary" />
                  <span className="text-xs font-semibold text-tx-primary">View Scheduled Milestones</span>
                </div>
                <ArrowRight size={14} className="text-tx-muted group-hover:text-tx-primary transition-transform group-hover:translate-x-0.5" />
              </button>

              <button
                onClick={() => onComplete(createdProjectId, 'tasks')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-card border border-bd-subtle hover:border-tx-primary transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <CheckSquare size={16} className="text-tx-primary" />
                  <span className="text-xs font-semibold text-tx-primary">Manage Generated Tasks</span>
                </div>
                <ArrowRight size={14} className="text-tx-muted group-hover:text-tx-primary transition-transform group-hover:translate-x-0.5" />
              </button>

              <button
                onClick={() => onComplete(createdProjectId, 'library')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-card border border-bd-subtle hover:border-tx-primary transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <FileText size={16} className="text-tx-primary" />
                  <span className="text-xs font-semibold text-tx-primary">Access Documents in Library</span>
                </div>
                <ArrowRight size={14} className="text-tx-muted group-hover:text-tx-primary transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>

            <Button variant="secondary" onClick={onDismiss} className="w-full mt-4">
              Back to Templates
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
