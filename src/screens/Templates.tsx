import React, { useState } from 'react';
import { Header } from '../components/Shared';
import { useTemplates } from '../context/TemplatesContext';
import { useNavigation } from '../context/NavigationContext';
import { EmptyState, Button, IconButton, Badge } from '../components/ui';
import { LayoutTemplate, Plus, ChevronLeft, MoreVertical, Play, Copy, Archive, Trash2, Edit, Search, Star, Sparkles, Loader2 } from 'lucide-react';
import { TemplateItem } from '../types';
import { TemplateBuilder } from './TemplateBuilder';
import { TemplateInstantiator } from './TemplateInstantiator';
import { BottomSheet, BottomSheetField } from '../components/BottomSheet';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { generateAIContent } from '../lib/ai';

export function Templates({ onDismiss }: { onDismiss: () => void }) {
  const { templates, addTemplate, updateTemplate, deleteTemplate } = useTemplates();
  const { push, goToTab } = useNavigation();

  const [builderTemplate, setBuilderTemplate] = useState<TemplateItem | null>(null);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);

  const [instantiatorTemplate, setInstantiatorTemplate] = useState<TemplateItem | null>(null);

  const [actionMenuTemplate, setActionMenuTemplate] = useState<TemplateItem | null>(null);
  const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // AI Generator state
  const [isAIGeneratorOpen, setIsAIGeneratorOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const handleOpenBuilder = (t?: TemplateItem) => {
    setBuilderTemplate(t || null);
    setIsBuilderOpen(true);
  };

  const handleSaveBuilder = (form: Omit<TemplateItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (builderTemplate) {
      updateTemplate(builderTemplate.id, form);
    } else {
      addTemplate(form);
    }
    setIsBuilderOpen(false);
  };

  const handleDuplicate = (t: TemplateItem) => {
    const { id, createdAt, updatedAt, ...rest } = t;
    addTemplate({
      ...rest,
      name: `${rest.name} (Copy)`
    });
    setActionMenuTemplate(null);
  };

  const handleArchive = (t: TemplateItem) => {
    updateTemplate(t.id, { isArchived: !t.isArchived });
    setActionMenuTemplate(null);
  };

  const handleDelete = () => {
    if (actionMenuTemplate) {
      deleteTemplate(actionMenuTemplate.id);
      setDeleteConfirmOpen(false);
      setActionMenuTemplate(null);
    }
  };

  const handleGenerateTemplate = async () => {
    if (!aiPrompt.trim()) return;
    
    setIsGenerating(true);
    setAiError(null);

    const schema = {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', description: 'A short, professional name for the template' },
        description: { type: 'STRING', description: 'A 1-2 sentence description' },
        type: { type: 'STRING', description: 'Type of template: project, checklist, campaign, or event' },
        projectPriority: { type: 'STRING', description: 'Default priority: high or low' },
        projectDurationDays: { type: 'INTEGER', description: 'Estimated total duration in days' },
        tasks: {
          type: 'ARRAY',
          description: 'A comprehensive list of tasks (5-15 tasks) required to complete this workflow',
          items: {
            type: 'OBJECT',
            properties: {
              title: { type: 'STRING', description: 'Clear, actionable task name' },
              priority: { type: 'STRING', description: 'Low, Medium, or High' },
              durationMinutes: { type: 'INTEGER', description: 'Estimated time in minutes (e.g. 30, 60)' },
              offsetDays: { type: 'INTEGER', description: 'Days after project start this task should begin (0 for day 1)' },
              notes: { type: 'STRING', description: 'Optional context or instruction for the task' }
            }
          }
        }
      }
    };

    const response = await generateAIContent<any>({
      prompt: aiPrompt,
      systemInstruction: 'You are an expert workflow designer and project manager. Generate a robust, realistic project template with well-sequenced tasks. Do not include ID fields.',
      responseSchema: schema
    });

    setIsGenerating(false);

    if (response.error) {
      setAiError(response.error);
    } else if (response.data) {
      const data = response.data;
      
      // Map AI data to our TemplateItem format
      addTemplate({
        name: data.name || 'AI Generated Template',
        description: data.description || '',
        type: data.type === 'project' || data.type === 'checklist' || data.type === 'campaign' || data.type === 'event' ? data.type : 'project',
        isFavorite: false,
        isArchived: false,
        projectPriority: data.projectPriority === 'high' ? 'high' : 'low',
        projectDurationDays: data.projectDurationDays || 7,
        tasks: (data.tasks || []).map((t: any, index: number) => ({
          id: `task-${Date.now()}-${index}`,
          title: t.title || 'Untitled Task',
          priority: ['Low', 'Medium', 'High'].includes(t.priority) ? t.priority : 'Medium',
          durationMinutes: t.durationMinutes || 60,
          offsetDays: t.offsetDays || 0,
          notes: t.notes || ''
        })),
        schedule: [],
        checklists: [],
        library: []
      });
      setIsAIGeneratorOpen(false);
      setAiPrompt('');
    }
  };

  return (
    <div className="flex flex-col h-full bg-canvas relative">
      <Header 
        title="Templates" 
        leftIcon={
          <IconButton variant="ghost" onClick={onDismiss} className="-ml-2">
            <ChevronLeft size={24} />
          </IconButton>
        } 
        rightIcon={
          <div className="flex items-center gap-2">
            <IconButton variant="outline" onClick={() => setIsAIGeneratorOpen(true)} className="text-blue-500 border-blue-500/20 hover:bg-blue-500/10">
              <Sparkles size={20} />
            </IconButton>
            <IconButton variant="primary" onClick={() => handleOpenBuilder()}>
              <Plus size={20} />
            </IconButton>
          </div>
        } 
      />
      
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        {templates.length === 0 ? (
          <EmptyState 
            icon={<LayoutTemplate size={32} />}
            title="No Templates Yet"
            description="Create reusable workflows, checklists, and project structures to save time."
            action={
              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={() => handleOpenBuilder()}>Create Template</Button>
                <Button variant="outline" onClick={() => setIsAIGeneratorOpen(true)} leftIcon={<Sparkles size={18} className="text-blue-500"/>}>
                  Generate with AI
                </Button>
              </div>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.filter(t => !t.isArchived).map(t => (
              <div key={t.id} className="p-4 bg-surface-neutral/30 rounded-2xl border border-bd-subtle hover:border-accent-primary/50 transition-colors flex flex-col h-full">
                <div className="flex justify-between items-start mb-2">
                  <Badge variant="outline" className="capitalize">{t.type}</Badge>
                  <IconButton variant="ghost" size="sm" className="-mt-1 -mr-1" onClick={() => setActionMenuTemplate(t)}>
                    <MoreVertical size={16} />
                  </IconButton>
                </div>
                
                <h3 className="font-semibold text-tx-primary line-clamp-1">{t.name}</h3>
                {t.description && <p className="text-sm text-tx-muted mt-1 line-clamp-2">{t.description}</p>}
                
                <div className="mt-4 pt-4 border-t border-bd-subtle flex flex-wrap gap-3 mt-auto">
                  {(t.tasks?.length > 0) && (
                    <span className="text-xs font-medium text-tx-muted">{t.tasks.length} Tasks</span>
                  )}
                  {(t.schedule?.length > 0) && (
                    <span className="text-xs font-medium text-tx-muted">{t.schedule.length} Events</span>
                  )}
                </div>

                <div className="mt-4 flex gap-2">
                  <Button variant="secondary" className="flex-1" onClick={() => handleOpenBuilder(t)}>Edit</Button>
                  <Button variant="primary" className="flex-1" onClick={() => setInstantiatorTemplate(t)}>Use</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isBuilderOpen && (
        <TemplateBuilder 
          initialTemplate={builderTemplate || undefined} 
          onSave={handleSaveBuilder} 
          onDismiss={() => setIsBuilderOpen(false)} 
        />
      )}

      {instantiatorTemplate && (
        <TemplateInstantiator 
          template={instantiatorTemplate}
          onDismiss={() => setInstantiatorTemplate(null)}
          onComplete={(projectId) => {
            setInstantiatorTemplate(null);
            onDismiss(); // Close templates view
            goToTab('projects'); // Might not work exactly this way if push is only for pushedScreen, but let's just close it.
            // In MenkiR, tabs are changed via goToTab, pushed screens are changed via push.
            // The cleanest is to dismiss Template screen.
          }}
        />
      )}

      {/* Action Menu Sheet */}
      <BottomSheet isOpen={!!actionMenuTemplate && !isDeleteConfirmOpen} onClose={() => setActionMenuTemplate(null)} title="Template Options">
        <div className="space-y-1 py-2">
          <button 
            onClick={() => { handleOpenBuilder(actionMenuTemplate!); setActionMenuTemplate(null); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-neutral active:bg-surface-neutral rounded-xl transition-colors"
          >
            <Edit size={18} className="text-tx-primary" />
            <span className="text-[15px] font-medium text-tx-primary">Edit Template</span>
          </button>
          <button 
            onClick={() => handleDuplicate(actionMenuTemplate!)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-neutral active:bg-surface-neutral rounded-xl transition-colors"
          >
            <Copy size={18} className="text-tx-primary" />
            <span className="text-[15px] font-medium text-tx-primary">Duplicate Template</span>
          </button>
          <button 
            onClick={() => handleArchive(actionMenuTemplate!)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-neutral active:bg-surface-neutral rounded-xl transition-colors"
          >
            <Archive size={18} className="text-tx-primary" />
            <span className="text-[15px] font-medium text-tx-primary">
              {actionMenuTemplate?.isArchived ? 'Unarchive Template' : 'Archive Template'}
            </span>
          </button>
          <button 
            onClick={() => setDeleteConfirmOpen(true)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-red-500/10 active:bg-red-500/20 rounded-xl transition-colors"
          >
            <Trash2 size={18} className="text-red-500" />
            <span className="text-[15px] font-medium text-red-500">Delete Template</span>
          </button>
        </div>
      </BottomSheet>

      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        onCancel={() => {
          setDeleteConfirmOpen(false);
          setActionMenuTemplate(null);
        }}
        onConfirm={handleDelete}
        title="Delete Template"
        body="Are you sure you want to delete this template? Any active projects created from it will remain intact."
        confirmLabel="Delete"
        danger
      />

      {/* AI Generator Bottom Sheet */}
      <BottomSheet
        isOpen={isAIGeneratorOpen}
        onClose={() => {
          if (!isGenerating) {
            setIsAIGeneratorOpen(false);
            setAiError(null);
          }
        }}
        title="Generate AI Template"
      >
        <div className="p-4 flex flex-col gap-4">
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex gap-3">
            <Sparkles className="text-blue-500 shrink-0 mt-0.5" size={20} />
            <p className="text-[14px] text-blue-600 leading-relaxed">
              Describe a workflow or project type, and the AI will generate a complete template with structured, sequenced tasks.
            </p>
          </div>

          <BottomSheetField label="What kind of template do you need?">
            <textarea
              className="w-full bg-surface-neutral/50 border border-bd-subtle rounded-xl p-3 text-[15px] text-tx-primary focus:border-blue-500 focus:outline-none transition-colors min-h-[120px] resize-none"
              placeholder="e.g., A comprehensive onboarding workflow for a new freelance design client..."
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              disabled={isGenerating}
            />
          </BottomSheetField>

          {aiError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <p className="text-red-500 text-[13px]">{aiError}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setIsAIGeneratorOpen(false)} disabled={isGenerating}>Cancel</Button>
            <Button className="flex-1" onClick={handleGenerateTemplate} disabled={!aiPrompt.trim() || isGenerating}>
              {isGenerating ? <Loader2 size={18} className="animate-spin" /> : 'Generate Template'}
            </Button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
