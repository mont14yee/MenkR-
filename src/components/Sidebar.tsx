import { LayoutDashboard, FolderKanban, Wrench, Users, CheckSquare, Calendar, DollarSign, Clock, Settings, FileText, Component, Search } from 'lucide-react';
import { TabState, PushedScreenState } from '../types';
import { useCommandPalette } from '../context/CommandPaletteContext';

export function Sidebar({
  activeTab,
  pushedScreen,
  onChangeTab,
  onPushScreen,
  onDismissScreen,
}: {
  activeTab: TabState;
  pushedScreen: PushedScreenState;
  onChangeTab: (tab: TabState) => void;
  onPushScreen: (screen: PushedScreenState) => void;
  onDismissScreen: () => void;
}) {
  const isPushed = pushedScreen !== 'none';
  const { openPalette } = useCommandPalette();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, type: 'tab' },
    { id: 'projects', label: 'Projects', icon: FolderKanban, type: 'tab' },
    { id: 'clients', label: 'Clients', icon: Users, type: 'tab' },
    { id: 'divider1', type: 'divider' },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare, type: 'push' },
    { id: 'calendar', label: 'Calendar', icon: Calendar, type: 'push' },
    { id: 'time-tracker', label: 'Time Tracker', icon: Clock, type: 'push' },
    { id: 'finance', label: 'Finance', icon: DollarSign, type: 'push' },
    { id: 'divider2', type: 'divider' },
    { id: 'productivity', label: 'Productivity', icon: Component, type: 'tab' },
    { id: 'settings', label: 'Settings', icon: Settings, type: 'push' },
  ] as const;

  return (
    <aside className="hidden md:flex flex-col w-64 h-full border-r border-bd-subtle bg-surface-neutral/30 p-4">
      <div className="flex items-center gap-2 mb-6 px-2">
        <div className="w-8 h-8 rounded-lg bg-tx-primary text-canvas flex items-center justify-center font-bold text-lg">C</div>
        <span className="font-semibold text-lg text-tx-primary tracking-tight">MenkiR</span>
      </div>

      <button onClick={openPalette} className="flex items-center gap-2 px-3 py-2 mb-6 mx-1 bg-surface-neutral hover:bg-bd-subtle border border-bd-subtle rounded-xl text-tx-muted transition-colors">
        <Search size={16} />
        <span className="text-sm font-medium flex-1 text-left">Search...</span>
        <div className="flex items-center gap-1 text-[10px] font-bold bg-canvas px-1.5 py-0.5 rounded shadow-sm">
          <span>⌘K</span>
        </div>
      </button>

      <nav className="flex-1 overflow-y-auto space-y-1">
        {navItems.map((item) => {
          if (item.type === 'divider') {
            return <div key={item.id} className="h-px bg-bd-subtle/50 my-4 mx-2" />;
          }
          
          let isActive = false;
          if (item.type === 'tab' && !isPushed && activeTab === item.id) {
            isActive = true;
          } else if (item.type === 'push' && pushedScreen === item.id) {
            isActive = true;
          }

          const Icon = item.icon!;
          
          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.type === 'tab') {
                  onDismissScreen();
                  onChangeTab(item.id as TabState);
                } else if (item.type === 'push') {
                  onPushScreen(item.id as PushedScreenState);
                }
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-canvas text-tx-primary shadow-sm border border-bd-subtle'
                  : 'text-tx-muted hover:text-tx-primary hover:bg-surface-neutral'
              }`}
            >
              <Icon size={18} className={isActive ? 'text-tx-primary' : 'text-tx-muted'} />
              {item.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
