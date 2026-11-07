import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Sparkles, 
  CheckCircle, 
  AlertTriangle, 
  FileText, 
  ListPlus, 
  FileCheck, 
  ShieldAlert, 
  Calendar, 
  Briefcase, 
  Copy, 
  RefreshCw, 
  Check, 
  ArrowRight, 
  Plus, 
  Info,
  ChevronRight,
  Loader2,
  Lock
} from 'lucide-react';
import { useProjects } from '../context/ProjectsContext';
import { useTasks } from '../context/TasksContext';
import { useClients } from '../context/ClientsContext';
import { useLibrary } from '../context/LibraryContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';
import { usePreferences } from '../context/PreferencesContext';
import { formatCurrency } from '../utils/currency';
import { getTodayDateStr } from '../utils/date';
import { runAIWorkflow, getAIStatus, AIWorkflowType, AIStatusInfo } from '../lib/ai';

export interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialWorkflow?: AIWorkflowType;
  initialProjectId?: string;
}

export function AIAssistantModal({
  isOpen,
  onClose,
  initialWorkflow = 'project-summary',
  initialProjectId,
}: AIAssistantModalProps) {
  const { projects, addProject } = useProjects();
  const { tasks, addTask } = useTasks();
  const { clients } = useClients();
  const { addLibraryItem } = useLibrary();
  const { showToast } = useToast();
  const { role } = useAuth();
  const { goToTab } = useNavigation();
  const { preferences } = usePreferences();

  const isViewer = role === 'viewer';

  const [activeWorkflow, setActiveWorkflow] = useState<AIWorkflowType>(initialWorkflow);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId || '');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [meetingNotesInput, setMeetingNotesInput] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // AI Execution State
  const [statusInfo, setStatusInfo] = useState<AIStatusInfo | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [missingKey, setMissingKey] = useState<boolean>(false);
  const [resultText, setResultText] = useState<string>('');
  const [resultData, setResultData] = useState<any>(null);

  // Interactive Selection State for Suggestions
  const [selectedTaskIndices, setSelectedTaskIndices] = useState<Set<number>>(new Set());
  const [selectedActionItemIndices, setSelectedActionItemIndices] = useState<Set<number>>(new Set());

  // Check server-side AI configuration when opening modal
  useEffect(() => {
    if (isOpen) {
      getAIStatus().then((info) => {
        setStatusInfo(info);
        if (!info.configured) {
          setMissingKey(true);
        }
      }).catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialWorkflow) setActiveWorkflow(initialWorkflow);
    if (initialProjectId) setSelectedProjectId(initialProjectId);
  }, [initialWorkflow, initialProjectId]);

  // Reset state when changing workflows
  const handleSelectWorkflow = (wf: AIWorkflowType) => {
    setActiveWorkflow(wf);
    setErrorMessage(null);
    setResultText('');
    setResultData(null);
    setSelectedTaskIndices(new Set());
    setSelectedActionItemIndices(new Set());
  };

  const selectedProject = useMemo(() => {
    return projects.find((p) => p.id === selectedProjectId) || projects[0] || null;
  }, [projects, selectedProjectId]);

  // Build context payload tailored to the chosen workflow
  const buildPayload = (): Record<string, any> => {
    const proj = selectedProject;
    const projTasks = proj ? tasks.filter((t) => t.projectId === proj.id) : [];
    const client = proj && proj.clientId ? clients.find((c) => c.id === proj.clientId) : null;

    if (activeWorkflow === 'meeting-notes') {
      return {
        notes: meetingNotesInput.trim(),
        projectName: proj?.name || 'General Project',
        clientName: client?.name || 'Internal',
      };
    }

    if (activeWorkflow === 'draft-project-plan') {
      return {
        brief: customPrompt.trim() || proj?.notes || 'New business venture or client deliverable',
        clientName: client?.name || 'Client',
        targetBudget: proj?.budget || 10000,
        currency: preferences.currency,
      };
    }

    // Default project-centric payloads (summary, task-breakdown, risk-identification, status-report)
    return {
      projectName: proj?.name || 'Workspace Project',
      status: proj?.status || 'active',
      completionPct: proj?.completionPct || 0,
      dueDate: proj?.dueDate || 'Not specified',
      budget: proj?.budget ? formatCurrency(proj.budget, preferences.currency) : 'None set',
      clientName: client?.name || 'Direct / Internal',
      tasksCount: projTasks.length,
      openTasks: projTasks.filter((t) => t.status !== 'done').map((t) => ({ title: t.title, priority: t.priority })),
      completedTasks: projTasks.filter((t) => t.status === 'done').map((t) => t.title),
      notes: proj?.notes || '',
    };
  };

  const handleExecuteWorkflow = async () => {
    if (activeWorkflow === 'meeting-notes' && !meetingNotesInput.trim()) {
      showToast({ message: 'Please enter notes or a meeting transcript first' });
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setMissingKey(false);
    setResultText('');
    setResultData(null);

    const payload = buildPayload();
    const result = await runAIWorkflow({
      workflow: activeWorkflow,
      payload,
      customPrompt: customPrompt.trim() || undefined,
    });

    setIsLoading(false);

    if (result.missingKey) {
      setMissingKey(true);
      setErrorMessage(result.error || 'Gemini API key is not configured.');
      return;
    }

    if (result.error) {
      setErrorMessage(result.error);
      return;
    }

    setResultText(result.text || '');
    setResultData(result.data || null);

    // Pre-select all suggested tasks
    if (result.data?.suggestedTasks && Array.isArray(result.data.suggestedTasks)) {
      setSelectedTaskIndices(new Set(result.data.suggestedTasks.map((_: any, i: number) => i)));
    }
    if (result.data?.actionItems && Array.isArray(result.data.actionItems)) {
      setSelectedActionItemIndices(new Set(result.data.actionItems.map((_: any, i: number) => i)));
    }
  };

  // User Confirmation Action 1: Apply Selected Tasks to Project
  const handleApplyTasks = () => {
    if (isViewer) {
      showToast({ message: 'Viewer role has read-only access. Cannot create tasks.' });
      return;
    }
    if (!selectedProject) {
      showToast({ message: 'Please select a project to attach tasks to' });
      return;
    }

    const suggested = resultData?.suggestedTasks || [];
    const tasksToAdd = suggested.filter((_: any, i: number) => selectedTaskIndices.has(i));

    if (tasksToAdd.length === 0) {
      showToast({ message: 'No tasks selected' });
      return;
    }

    let addedCount = 0;
    const today = new Date();

    for (const t of tasksToAdd) {
      let targetDueDate: string | undefined = undefined;
      if (typeof t.dueDateOffsetDays === 'number' && t.dueDateOffsetDays > 0) {
        const d = new Date(today.getTime() + t.dueDateOffsetDays * 86400000);
        targetDueDate = d.toISOString().split('T')[0];
      }

      addTask({
        title: t.title,
        priority: t.priority || 'Medium',
        notes: t.description || undefined,
        status: 'active',
        projectId: selectedProject.id,
        clientId: selectedProject.clientId,
        dueDate: targetDueDate,
        categoryId: preferences.categories.find((c) => c.scope === 'task')?.id || 'general',
      });
      addedCount++;
    }

    showToast({ message: `Successfully added ${addedCount} tasks to "${selectedProject.name}"` });
    onClose();
  };

  // User Confirmation Action 2: Apply Action Items from Meeting
  const handleApplyActionItems = () => {
    if (isViewer) {
      showToast({ message: 'Viewer role has read-only access' });
      return;
    }

    const actionItems = resultData?.actionItems || [];
    const itemsToAdd = actionItems.filter((_: any, i: number) => selectedActionItemIndices.has(i));

    if (itemsToAdd.length === 0) {
      showToast({ message: 'No action items selected' });
      return;
    }

    let count = 0;
    for (const item of itemsToAdd) {
      addTask({
        title: item.task,
        priority: item.priority || 'Medium',
        notes: item.suggestedAssignee ? `Suggested Assignee: ${item.suggestedAssignee}` : undefined,
        status: 'active',
        projectId: selectedProject?.id,
        clientId: selectedProject?.clientId,
        categoryId: preferences.categories.find((c) => c.scope === 'task')?.id || 'general',
      });
      count++;
    }

    showToast({ message: `Added ${count} action items as project tasks` });
    onClose();
  };

  // User Confirmation Action 3: Create Project from Draft Plan
  const handleCreateProjectFromPlan = () => {
    if (isViewer) {
      showToast({ message: 'Viewer role has read-only access' });
      return;
    }

    const plan = resultData;
    if (!plan || !plan.planName) return;

    const newProjectId = addProject({
      name: plan.planName,
      priority: 'high',
      completionPct: 0,
      tone: 'lime',
      status: 'active',
      notes: plan.overview || '',
    });

    let taskCount = 0;
    if (Array.isArray(plan.phases)) {
      for (const phase of plan.phases) {
        if (Array.isArray(phase.tasks)) {
          for (const t of phase.tasks) {
            addTask({
              title: `${phase.phaseName}: ${t.title}`,
              priority: t.priority || 'Medium',
              status: 'active',
              projectId: newProjectId,
              categoryId: preferences.categories.find((c) => c.scope === 'task')?.id || 'general',
            });
            taskCount++;
          }
        }
      }
    }

    showToast({ message: `Created project "${plan.planName}" with ${taskCount} tasks` });
    onClose();
    goToTab('projects', { filterProjectId: newProjectId });
  };

  // User Action 4: Save Report / Document to Library
  const handleSaveToLibrary = () => {
    if (isViewer) {
      showToast({ message: 'Viewer role has read-only access' });
      return;
    }

    const title =
      activeWorkflow === 'status-report'
        ? `Status Report - ${selectedProject?.name || 'Project'} (${getTodayDateStr()})`
        : activeWorkflow === 'risk-identification'
        ? `Risk Matrix - ${selectedProject?.name || 'Project'} (${getTodayDateStr()})`
        : `Executive Summary - ${selectedProject?.name || 'Project'}`;

    const content = resultText || JSON.stringify(resultData, null, 2);

    addLibraryItem({
      name: title,
      type: 'note',
      category: 'Reports',
      urlOrReference: content,
      projectId: selectedProject?.id,
      clientId: selectedProject?.clientId,
      tags: ['AI-Generated', 'Report'],
      description: `Generated by MenkR- AI on ${new Date().toLocaleDateString()}`,
    });

    showToast({ message: 'Saved to Library under Reports' });
  };

  const handleCopyText = () => {
    const textToCopy = resultText || (resultData ? JSON.stringify(resultData, null, 2) : '');
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      showToast({ message: 'Copied to clipboard' });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-tx-primary/60 backdrop-blur-xs">
      <div className="relative w-full max-w-4xl max-h-[92vh] bg-canvas border border-bd-subtle rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-bd-subtle bg-surface-neutral/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-accent-primary/20 text-tx-primary flex items-center justify-center border border-accent-primary/40">
              <Sparkles size={18} className="text-tx-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-tx-primary tracking-tight">AI Productivity Assistant</h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-accent-primary text-tx-primary">
                  Gemini 3.8 Flash
                </span>
              </div>
              <p className="text-xs text-tx-muted">Secure, suggestion-only workflows with explicit user confirmation</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-surface-neutral hover:bg-surface-hover flex items-center justify-center text-tx-muted hover:text-tx-primary transition-colors"
            aria-label="Close Assistant"
          >
            <X size={18} />
          </button>
        </div>

        {/* Suggestion & Safety Principle Banner */}
        <div className="px-6 py-2 bg-accent-primary/10 border-b border-accent-primary/20 flex items-center gap-2 text-xs text-tx-secondary">
          <Info size={14} className="text-accent-primary shrink-0" />
          <span>
            <strong className="font-semibold text-tx-primary">Safety boundary:</strong> AI output is advisory. No tasks, projects, or documents will be created or altered without your explicit review and confirmation.
          </span>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Workflow Picker Tabs */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-tx-muted block mb-2.5">
              Select AI Workflow
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
              {[
                { id: 'project-summary', title: 'Executive Summary', icon: <FileCheck size={16} />, desc: 'Overall health & next steps' },
                { id: 'task-breakdown', title: 'Task Breakdown', icon: <ListPlus size={16} />, desc: 'Decompose scope into tasks' },
                { id: 'meeting-notes', title: 'Meeting Notes', icon: <Calendar size={16} />, desc: 'Extract decisions & action items' },
                { id: 'draft-project-plan', title: 'Draft Project Plan', icon: <Briefcase size={16} />, desc: 'Phased schedule & deliverables' },
                { id: 'risk-identification', title: 'Risk & Blockers', icon: <ShieldAlert size={16} />, desc: 'Identify delivery/budget risks' },
                { id: 'status-report', title: 'Status Report', icon: <FileText size={16} />, desc: 'Formatted stakeholder brief' },
              ].map((wf) => (
                <button
                  key={wf.id}
                  type="button"
                  onClick={() => handleSelectWorkflow(wf.id as AIWorkflowType)}
                  className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                    activeWorkflow === wf.id
                      ? 'bg-tx-primary text-tx-inverse border-tx-primary shadow-xs'
                      : 'bg-canvas-card hover:bg-surface-neutral/60 text-tx-primary border-bd-subtle'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`p-1.5 rounded-lg ${activeWorkflow === wf.id ? 'bg-tx-inverse/10 text-accent-primary' : 'bg-surface-neutral text-tx-muted'}`}>
                      {wf.icon}
                    </span>
                    {activeWorkflow === wf.id && <Check size={14} className="text-accent-primary" />}
                  </div>
                  <div>
                    <div className="text-xs font-bold">{wf.title}</div>
                    <div className={`text-[11px] mt-0.5 ${activeWorkflow === wf.id ? 'text-tx-inverse/70' : 'text-tx-muted'}`}>
                      {wf.desc}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Workflow Context Form */}
          <div className="bg-canvas-card border border-bd-subtle rounded-2xl p-4.5 space-y-3.5">
            {/* Target Project (for project-specific workflows) */}
            {activeWorkflow !== 'meeting-notes' && (
              <div>
                <label className="text-xs font-semibold text-tx-primary block mb-1">Target Project</label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full bg-surface-neutral border border-bd-subtle rounded-xl px-3.5 py-2.5 text-xs text-tx-primary outline-none font-medium"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.completionPct}% complete)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Meeting Notes Input */}
            {activeWorkflow === 'meeting-notes' && (
              <div>
                <label className="text-xs font-semibold text-tx-primary block mb-1">
                  Raw Meeting Notes or Transcript *
                </label>
                <textarea
                  value={meetingNotesInput}
                  onChange={(e) => setMeetingNotesInput(e.target.value)}
                  placeholder="Paste rough notes, discussion points, or call transcripts here..."
                  className="w-full h-28 bg-surface-neutral border border-bd-subtle rounded-xl p-3 text-xs text-tx-primary outline-none resize-none placeholder:text-tx-muted font-mono leading-relaxed"
                />
              </div>
            )}

            {/* Optional Custom Instructions */}
            <div>
              <label className="text-xs font-semibold text-tx-primary block mb-1">
                {activeWorkflow === 'draft-project-plan'
                  ? 'Project Scope & Brief Requirements'
                  : 'Additional Focus / Custom Instructions (Optional)'}
              </label>
              <input
                type="text"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder={
                  activeWorkflow === 'task-breakdown'
                    ? 'e.g., Focus on backend APIs and Postgres migrations...'
                    : activeWorkflow === 'draft-project-plan'
                    ? 'e.g., Mobile client redesign with 3 milestones over 6 weeks...'
                    : 'e.g., Keep recommendations focused on upcoming deadlines...'
                }
                className="w-full bg-surface-neutral border border-bd-subtle rounded-xl px-3.5 py-2.5 text-xs text-tx-primary outline-none placeholder:text-tx-muted"
              />
            </div>

            {/* Generate Action Button */}
            <div className="pt-2 flex items-center justify-between">
              <span className="text-[11px] text-tx-muted">
                Model: <span className="font-mono font-medium text-tx-secondary">gemini-3.8-flash</span> • Proxied via server
              </span>

              <button
                type="button"
                onClick={handleExecuteWorkflow}
                disabled={isLoading}
                className="px-5 py-2.5 bg-tx-primary text-tx-inverse rounded-xl text-xs font-semibold hover:opacity-90 active:scale-95 transition-all flex items-center gap-2 shadow-xs disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={14} className="animate-spin text-accent-primary" />
                    <span>Analyzing with Gemini...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={14} className="text-accent-primary" />
                    <span>Generate Suggestions</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Missing Key State */}
          {missingKey && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/25 rounded-2xl flex items-start gap-3">
              <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed text-amber-950 dark:text-amber-200">
                <div className="font-bold text-amber-900 dark:text-amber-100 mb-1">Gemini API Key Required</div>
                <p>
                  AI features require a valid <code className="font-mono px-1 py-0.5 bg-amber-500/20 rounded">GEMINI_API_KEY</code>.
                  In AI Studio, configure this in the <strong>Settings &gt; Secrets</strong> panel. In self-hosted environments, add it to your server <code className="font-mono">.env</code> file.
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && !missingKey && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-between gap-3 text-xs text-red-600">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} />
                <span>{errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={handleExecuteWorkflow}
                className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 rounded-lg font-semibold flex items-center gap-1 transition-colors"
              >
                <RefreshCw size={12} /> Retry
              </button>
            </div>
          )}

          {/* Results Display & Confirmation Panes */}
          {(resultText || resultData) && (
            <div className="bg-canvas border border-bd-subtle rounded-2xl p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-bd-subtle">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-tx-primary">
                    AI Proposed Output (Suggestion Only)
                  </h4>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyText}
                    className="px-3 py-1 bg-surface-neutral hover:bg-surface-hover border border-bd-subtle rounded-lg text-xs font-medium text-tx-secondary flex items-center gap-1.5 transition-colors"
                  >
                    {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                  {!isViewer && (
                    <button
                      type="button"
                      onClick={handleSaveToLibrary}
                      className="px-3 py-1 bg-surface-neutral hover:bg-surface-hover border border-bd-subtle rounded-lg text-xs font-medium text-tx-secondary flex items-center gap-1.5 transition-colors"
                    >
                      <FileText size={12} />
                      <span>Save as Report</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Workflow 1 & 6: Plain Text Reports (Project Summary & Status Report) */}
              {(activeWorkflow === 'project-summary' || activeWorkflow === 'status-report') && (
                <div className="text-xs text-tx-secondary font-sans leading-relaxed whitespace-pre-wrap p-3 bg-surface-neutral/30 rounded-xl border border-bd-subtle/50">
                  {resultText}
                </div>
              )}

              {/* Workflow 2: Structured Task Breakdown with Confirmation */}
              {activeWorkflow === 'task-breakdown' && resultData?.suggestedTasks && (
                <div className="space-y-3">
                  <div className="text-xs text-tx-muted">
                    {resultData.objectiveSummary && (
                      <p className="mb-2 italic font-medium text-tx-primary">"{resultData.objectiveSummary}"</p>
                    )}
                    Review proposed tasks and check those you want to import into <span className="font-semibold text-tx-primary">{selectedProject?.name}</span>:
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {resultData.suggestedTasks.map((t: any, index: number) => {
                      const isSelected = selectedTaskIndices.has(index);
                      return (
                        <div
                          key={index}
                          onClick={() => {
                            const next = new Set(selectedTaskIndices);
                            if (isSelected) next.delete(index);
                            else next.add(index);
                            setSelectedTaskIndices(next);
                          }}
                          className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-colors ${
                            isSelected ? 'bg-accent-primary/10 border-accent-primary/60' : 'bg-surface-neutral/30 border-bd-subtle'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="mt-0.5 rounded text-tx-primary"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-tx-primary">{t.title}</span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                  t.priority === 'High'
                                    ? 'bg-orange-500/10 text-orange-600'
                                    : 'bg-surface-neutral text-tx-muted'
                                }`}
                              >
                                {t.priority}
                              </span>
                              {t.estimatedHours && (
                                <span className="text-[11px] font-mono text-tx-muted">
                                  ~{t.estimatedHours} hrs
                                </span>
                              )}
                            </div>
                            {t.description && (
                              <p className="text-[11px] text-tx-muted mt-1 leading-snug">{t.description}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Confirmation Action Button */}
                  <div className="pt-2 flex items-center justify-between border-t border-bd-subtle">
                    <span className="text-xs font-mono text-tx-muted">
                      {selectedTaskIndices.size} of {resultData.suggestedTasks.length} tasks selected
                    </span>

                    <button
                      type="button"
                      onClick={handleApplyTasks}
                      disabled={isViewer || selectedTaskIndices.size === 0}
                      className={`px-4 py-2 bg-accent-primary text-tx-primary font-bold text-xs rounded-xl shadow-xs transition-transform active:scale-95 flex items-center gap-1.5 ${
                        isViewer || selectedTaskIndices.size === 0 ? 'opacity-40 cursor-not-allowed' : 'hover:opacity-95'
                      }`}
                    >
                      {isViewer ? <Lock size={12} /> : <CheckCircle size={14} />}
                      <span>Apply Selected Tasks ({selectedTaskIndices.size})</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Workflow 3: Meeting Notes & Action Items with Confirmation */}
              {activeWorkflow === 'meeting-notes' && resultData && (
                <div className="space-y-4">
                  {resultData.keyDecisions && (
                    <div>
                      <h5 className="text-[11px] font-bold uppercase tracking-wider text-tx-muted mb-1.5">
                        Key Decisions Made
                      </h5>
                      <ul className="list-disc list-inside text-xs text-tx-primary space-y-1 bg-surface-neutral/30 p-2.5 rounded-xl border border-bd-subtle">
                        {resultData.keyDecisions.map((d: string, i: number) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {resultData.actionItems && (
                    <div>
                      <h5 className="text-[11px] font-bold uppercase tracking-wider text-tx-muted mb-1.5">
                        Action Items (Select to convert into project tasks)
                      </h5>
                      <div className="space-y-2">
                        {resultData.actionItems.map((item: any, i: number) => {
                          const isSelected = selectedActionItemIndices.has(i);
                          return (
                            <div
                              key={i}
                              onClick={() => {
                                const next = new Set(selectedActionItemIndices);
                                if (isSelected) next.delete(i);
                                else next.add(i);
                                setSelectedActionItemIndices(next);
                              }}
                              className={`p-2.5 rounded-xl border flex items-center gap-3 cursor-pointer text-xs ${
                                isSelected ? 'bg-accent-primary/10 border-accent-primary/60' : 'bg-surface-neutral/30 border-bd-subtle'
                              }`}
                            >
                              <input type="checkbox" checked={isSelected} onChange={() => {}} />
                              <div className="flex-1 font-medium text-tx-primary">{item.task}</div>
                              {item.suggestedAssignee && (
                                <span className="text-[11px] px-2 py-0.5 rounded bg-surface-neutral text-tx-secondary">
                                  {item.suggestedAssignee}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div className="pt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={handleApplyActionItems}
                          disabled={isViewer || selectedActionItemIndices.size === 0}
                          className={`px-4 py-2 bg-accent-primary text-tx-primary font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 ${
                            isViewer || selectedActionItemIndices.size === 0 ? 'opacity-40 cursor-not-allowed' : 'hover:opacity-95'
                          }`}
                        >
                          <Plus size={14} />
                          <span>Convert to Tasks ({selectedActionItemIndices.size})</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Workflow 4: Draft Project Plan with Confirmation */}
              {activeWorkflow === 'draft-project-plan' && resultData && (
                <div className="space-y-3">
                  <div className="p-3 bg-surface-neutral/30 rounded-xl border border-bd-subtle">
                    <h5 className="text-sm font-bold text-tx-primary">{resultData.planName}</h5>
                    <p className="text-xs text-tx-muted mt-1">{resultData.overview}</p>
                  </div>

                  {Array.isArray(resultData.phases) && (
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {resultData.phases.map((ph: any, i: number) => (
                        <div key={i} className="p-3 bg-canvas border border-bd-subtle rounded-xl text-xs">
                          <div className="font-bold text-tx-primary mb-1">{ph.phaseName} • Milestone: {ph.milestone}</div>
                          <div className="text-tx-muted">
                            Tasks ({ph.tasks?.length || 0}): {ph.tasks?.map((t: any) => t.title).join(', ')}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleCreateProjectFromPlan}
                      disabled={isViewer}
                      className={`px-5 py-2.5 bg-tx-primary text-tx-inverse font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 ${
                        isViewer ? 'opacity-40 cursor-not-allowed' : 'hover:opacity-90'
                      }`}
                    >
                      <Briefcase size={14} className="text-accent-primary" />
                      <span>Instantiate Project from Plan</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Workflow 5: Risk Matrix */}
              {activeWorkflow === 'risk-identification' && resultData && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-surface-neutral/40 rounded-xl border border-bd-subtle text-xs">
                    <div>
                      <span className="text-tx-muted block">Overall Risk Rating</span>
                      <span className={`font-bold uppercase tracking-wider ${
                        resultData.overallRiskLevel === 'Critical' ? 'text-red-500' :
                        resultData.overallRiskLevel === 'Elevated' ? 'text-orange-500' : 'text-emerald-600'
                      }`}>
                        {resultData.overallRiskLevel}
                      </span>
                    </div>
                    <div>
                      <span className="text-tx-muted block">Health Score</span>
                      <span className="font-mono font-bold text-base text-tx-primary">{resultData.healthScore}/100</span>
                    </div>
                  </div>

                  {Array.isArray(resultData.identifiedRisks) && (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {resultData.identifiedRisks.map((risk: any, i: number) => (
                        <div key={i} className="p-3 bg-canvas border border-bd-subtle rounded-xl text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-tx-primary flex items-center gap-1.5">
                              <ShieldAlert size={14} className={risk.severity === 'High' ? 'text-red-500' : 'text-orange-500'} />
                              {risk.category} Risk
                            </span>
                            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              risk.severity === 'High' ? 'bg-red-500/10 text-red-600' : 'bg-orange-500/10 text-orange-600'
                            }`}>
                              {risk.severity} Severity
                            </span>
                          </div>
                          <p className="text-tx-primary font-medium">{risk.riskDescription}</p>
                          <p className="text-tx-muted text-[11px]"><strong className="text-tx-secondary">Mitigation:</strong> {risk.recommendedMitigation}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

        </div>

      </div>
    </div>
  );
}
