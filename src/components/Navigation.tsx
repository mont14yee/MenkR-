import { LayoutDashboard, FolderKanban, Wrench, Users } from 'lucide-react';
import { TabState } from '../types';

export function Navigation({
  activeTab,
  onChange,
}: {
  activeTab: TabState;
  onChange: (tab: TabState) => void;
}) {
  const tabs = [
    { id: 'dashboard', icon: LayoutDashboard },
    { id: 'projects', icon: FolderKanban },
    { id: 'productivity', icon: Wrench }, // Replacing tools
    { id: 'clients', icon: Users },
  ] as const;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-canvas border-t border-bd-subtle pb-safe pt-2 px-6 flex items-center justify-between z-40" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1.5rem)' }}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id as TabState)}
            className="flex flex-col items-center justify-center w-14 h-14 rounded-full transition-colors relative"
            aria-label={`Go to ${tab.id} tab`}
          >
            <div
              className={`absolute inset-0 rounded-full transition-opacity ${
                isActive ? 'bg-accent-primary opacity-100' : 'opacity-0'
              }`}
            />
            <Icon size={24} className={`relative z-10 transition-colors ${isActive ? 'text-tx-primary' : 'text-tx-muted'}`} />
          </button>
        );
      })}
    </nav>
  );
}
