import React from 'react';
import { ProjectItem } from '../types';
import { useClients } from '../context/ClientsContext';
import { useNavigation } from '../context/NavigationContext';
import { Header } from './Shared';
import { IconButton, Badge } from './ui';
import { Tone } from '../types';
import { ChevronLeft, Edit, CheckSquare, Calendar, FolderHeart, Clock, DollarSign } from 'lucide-react';

export function ProjectDetail({ 
  project, 
  onBack, 
  onEdit 
}: { 
  project: ProjectItem, 
  onBack: () => void,
  onEdit: () => void
}) {
  const { clients } = useClients();
  const { push, goToTab } = useNavigation();
  const client = clients.find(c => c.id === project.clientId);

  return (
    <div className="absolute inset-0 bg-canvas z-40 flex flex-col h-full animate-in slide-in-from-right-8">
      <Header 
        title={project.index} 
        leftIcon={<IconButton variant="ghost" onClick={onBack} className="-ml-2"><ChevronLeft size={24} /></IconButton>}
        rightIcon={<IconButton variant="ghost" onClick={onEdit}><Edit size={20} /></IconButton>}
      />
      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-tx-primary mb-2">{project.name}</h1>
          <div className="flex items-center gap-3">
             <Badge variant={project.priority === 'high' ? 'destructive' : 'outline'}>{project.priority === 'high' ? 'High Priority' : 'Low Priority'}</Badge>
             <Badge variant="outline">{project.status || 'active'}</Badge>
             <span className="text-[13px] font-medium text-tx-muted">{project.completionPct}% Complete</span>
          </div>
        </div>

        {client && (
          <div className="p-4 bg-surface-neutral/30 rounded-2xl border border-bd-subtle flex items-center gap-4">
             <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${client.avatarSeed}`} alt="client" className="w-12 h-12 rounded-full bg-canvas" />
             <div>
               <p className="text-[13px] text-tx-muted font-medium uppercase tracking-wider mb-0.5">Client</p>
               <p className="text-[16px] font-semibold text-tx-primary">{client.name}</p>
             </div>
          </div>
        )}

        <div>
          <h3 className="text-[13px] font-bold text-tx-muted uppercase tracking-wider mb-3">Project Hub</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
             <button onClick={() => push('tasks', { filterProjectId: project.id })} className="flex flex-col items-center gap-2 p-4 bg-surface-neutral/50 rounded-xl border border-bd-subtle hover:border-accent-primary/50 transition-colors">
               <div className="w-10 h-10 rounded-full bg-canvas flex items-center justify-center text-tx-primary shadow-sm"><CheckSquare size={20} /></div>
               <span className="text-[14px] font-medium text-tx-primary">Tasks</span>
             </button>
             <button onClick={() => push('calendar', { filterProjectId: project.id })} className="flex flex-col items-center gap-2 p-4 bg-surface-neutral/50 rounded-xl border border-bd-subtle hover:border-accent-primary/50 transition-colors">
               <div className="w-10 h-10 rounded-full bg-canvas flex items-center justify-center text-tx-primary shadow-sm"><Calendar size={20} /></div>
               <span className="text-[14px] font-medium text-tx-primary">Schedule</span>
             </button>
             <button onClick={() => push('library', { filterProjectId: project.id })} className="flex flex-col items-center gap-2 p-4 bg-surface-neutral/50 rounded-xl border border-bd-subtle hover:border-accent-primary/50 transition-colors">
               <div className="w-10 h-10 rounded-full bg-canvas flex items-center justify-center text-tx-primary shadow-sm"><FolderHeart size={20} /></div>
               <span className="text-[14px] font-medium text-tx-primary">Library</span>
             </button>
             <button onClick={() => push('time-tracker', { filterProjectId: project.id })} className="flex flex-col items-center gap-2 p-4 bg-surface-neutral/50 rounded-xl border border-bd-subtle hover:border-accent-primary/50 transition-colors">
               <div className="w-10 h-10 rounded-full bg-canvas flex items-center justify-center text-tx-primary shadow-sm"><Clock size={20} /></div>
               <span className="text-[14px] font-medium text-tx-primary">Time</span>
             </button>
             <button onClick={() => push('finance', { filterProjectId: project.id })} className="flex flex-col items-center gap-2 p-4 bg-surface-neutral/50 rounded-xl border border-bd-subtle hover:border-accent-primary/50 transition-colors">
               <div className="w-10 h-10 rounded-full bg-canvas flex items-center justify-center text-tx-primary shadow-sm"><DollarSign size={20} /></div>
               <span className="text-[14px] font-medium text-tx-primary">Finance</span>
             </button>
          </div>
        </div>

        {project.notes && (
          <div>
            <h3 className="text-[13px] font-bold text-tx-muted uppercase tracking-wider mb-2">Notes</h3>
            <div className="p-4 bg-surface-neutral/30 rounded-2xl border border-bd-subtle text-[15px] text-tx-primary whitespace-pre-wrap">
              {project.notes}
            </div>
          </div>
        )}
        
        <div className="pt-4">
          <ProgressBar progress={project.completionPct} tone={project.tone} />
        </div>
      </div>
    </div>
  );
}


function ProgressBar({ progress, tone }: { progress: number, tone: Tone }) {
  const getColors = () => {
    switch (tone) {
      case 'lime': return 'bg-[#a3e635] text-[#3f6212]';
      case 'olive': return 'bg-[#a3b18a] text-[#344e41]';
      case 'neutral': return 'bg-tx-primary text-canvas';
      default: return 'bg-tx-primary text-canvas';
    }
  };
  return (
    <div className="w-full h-2 bg-surface-neutral rounded-full overflow-hidden">
      <div className={`h-full transition-all duration-500 ease-out ${getColors()}`} style={{ width: `${progress}%` }} />
    </div>
  );
}
