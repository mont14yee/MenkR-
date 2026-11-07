import React, { useState } from 'react';
import { 
  LayoutDashboard, FolderKanban, Wrench, Users, Grid, X, 
  CheckSquare, Calendar, DollarSign, Clock, Settings, LayoutTemplate, FolderHeart, ChevronRight 
} from 'lucide-react';
import { TabState, PushedScreenState } from '../types';

export function Navigation({
  activeTab,
  onChange,
  onPushScreen,
}: {
  activeTab: TabState;
  onChange: (tab: TabState) => void;
  onPushScreen?: (screen: PushedScreenState) => void;
}) {
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'projects', label: 'Projects', icon: FolderKanban },
    { id: 'productivity', label: 'Productivity', icon: Wrench },
    { id: 'clients', label: 'Clients', icon: Users },
  ] as const;

  const moreItems = [
    { id: 'tasks', label: 'Tasks', icon: CheckSquare, desc: 'Execution & checklist' },
    { id: 'calendar', label: 'Schedule', icon: Calendar, desc: 'Meetings & milestones' },
    { id: 'time-tracker', label: 'Time Tracking', icon: Clock, desc: 'Live stopwatch & logs' },
    { id: 'finance', label: 'Finance', icon: DollarSign, desc: 'Ledger & targets' },
    { id: 'templates', label: 'Templates', icon: LayoutTemplate, desc: 'Reusable blueprints' },
    { id: 'library', label: 'Library', icon: FolderHeart, desc: 'Documents & assets' },
    { id: 'settings', label: 'Settings', icon: Settings, desc: 'Preferences & team' },
  ] as const;

  const handleSelectMore = (screen: PushedScreenState) => {
    setIsMoreOpen(false);
    if (onPushScreen) {
      onPushScreen(screen);
    }
  };

  return (
    <>
      <nav 
        className="md:hidden fixed bottom-0 left-0 right-0 bg-canvas/95 backdrop-blur-md border-t border-bd-subtle pb-safe pt-2 px-4 flex items-center justify-between z-40" 
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1.25rem)' }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id as TabState)}
              className="flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all relative group"
              aria-label={`Go to ${tab.id} tab`}
            >
              <div
                className={`absolute inset-0 rounded-xl transition-all ${
                  isActive ? 'bg-accent-primary text-tx-primary shadow-xs ring-1 ring-accent-primary/50' : 'bg-transparent group-hover:bg-surface-neutral'
                }`}
              />
              <Icon size={21} className={`relative z-10 transition-colors ${isActive ? 'text-tx-primary' : 'text-tx-muted'}`} />
            </button>
          );
        })}

        {/* More Tools Button */}
        <button
          onClick={() => setIsMoreOpen(true)}
          className="flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all relative group hover:bg-surface-neutral text-tx-muted hover:text-tx-primary"
          aria-label="Open more tools navigation"
        >
          <Grid size={21} className="relative z-10" />
        </button>
      </nav>

      {/* Mobile More Sheet */}
      {isMoreOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end bg-tx-primary/30 backdrop-blur-xs">
          <div className="fixed inset-0" onClick={() => setIsMoreOpen(false)} />
          <div className="relative bg-canvas border-t border-bd-subtle rounded-t-3xl max-h-[80vh] overflow-y-auto p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-bd-subtle">
              <h3 className="text-base font-bold text-tx-primary">MenkiR Modules</h3>
              <button
                onClick={() => setIsMoreOpen(false)}
                className="w-8 h-8 rounded-full bg-surface-neutral flex items-center justify-center text-tx-muted hover:text-tx-primary"
                aria-label="Close more menu"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 pb-6">
              {moreItems.map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectMore(item.id as PushedScreenState)}
                    className="flex items-center justify-between p-3 rounded-xl bg-surface-neutral/40 hover:bg-surface-neutral border border-bd-subtle/70 transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-canvas flex items-center justify-center text-tx-primary border border-bd-subtle">
                        <Icon size={18} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-tx-primary">{item.label}</div>
                        <div className="text-xs text-tx-muted">{item.desc}</div>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-tx-muted" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
