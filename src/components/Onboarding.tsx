import React, { useEffect, useState } from 'react';
import { LayoutDashboard, FolderKanban, Wrench, Users, ArrowRight } from 'lucide-react';
import { useClients } from '../context/ClientsContext';
import { useProjects } from '../context/ProjectsContext';
import { useNavigation } from '../context/NavigationContext';

export function Onboarding() {
  const { clients } = useClients();
  const { projects } = useProjects();
  const { goToTab } = useNavigation();
  
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const hasSeen = localStorage.getItem('menkir-seen-onboarding');
    // Only show if it's a fresh install (no clients, no projects) and hasn't been dismissed
    if (!hasSeen && clients.length === 0 && projects.length === 0) {
      setIsVisible(true);
    }
  }, [clients.length, projects.length]);

  const handleDismiss = () => {
    localStorage.setItem('menkir-seen-onboarding', 'true');
    setIsVisible(false);
  };

  const handleAddClient = () => {
    handleDismiss();
    goToTab('clients', { openCreate: true });
  };

  if (!isVisible) return null;

  const features = [
    { icon: LayoutDashboard, title: 'Dashboard', desc: 'Overview of your tasks, leads, and daily summary.' },
    { icon: FolderKanban, title: 'Projects', desc: 'Track ongoing work, tasks, and project stages.' },
    { icon: Wrench, title: 'Tools', desc: 'Time tracking, finance logging, and calendar.' },
    { icon: Users, title: 'Clients', desc: 'Manage client relationships, revenues, and activity.' },
  ];

  return (
    <div className="absolute inset-0 z-50 bg-canvas flex flex-col justify-between overflow-y-auto max-w-[430px] mx-auto animate-in fade-in zoom-in-95 duration-300">
      <div className="px-6 pt-16 pb-8">
        <div className="w-16 h-16 rounded-3xl bg-accent-primary text-tx-primary flex items-center justify-center mb-6">
          <Users size={32} />
        </div>
        <h1 className="text-[28px] font-bold text-tx-primary leading-tight mb-3">
          Welcome to MenkiR
        </h1>
        <p className="text-[16px] text-tx-muted mb-10 leading-relaxed">
          Your mobile-first CRM and business manager. Everything you need to track relationships, projects, and revenue.
        </p>

        <div className="flex flex-col gap-6">
          {features.map((feat, i) => {
            const Icon = feat.icon;
            return (
              <div key={i} className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-full bg-surface-neutral flex items-center justify-center shrink-0 text-tx-primary mt-1">
                  <Icon size={20} />
                </div>
                <div>
                  <h3 className="text-[16px] font-semibold text-tx-primary mb-1">{feat.title}</h3>
                  <p className="text-[14px] text-tx-muted leading-relaxed">{feat.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-6 bg-canvas border-t border-bd-subtle flex flex-col gap-3 sticky bottom-0">
        <button
          onClick={handleAddClient}
          className="w-full h-14 rounded-full bg-tx-primary text-tx-inverse text-[16px] font-medium flex items-center justify-center gap-2 active:opacity-80 transition-opacity"
        >
          Add Your First Client
          <ArrowRight size={18} />
        </button>
        <button
          onClick={handleDismiss}
          className="w-full h-12 rounded-full text-tx-muted hover:bg-surface-neutral text-[15px] font-medium active:opacity-80 transition-colors"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
