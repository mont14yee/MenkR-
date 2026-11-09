import React, { useState, useRef, useEffect } from 'react';
import { 
  LayoutDashboard, FolderKanban, Users, CheckSquare, Calendar, DollarSign, 
  Clock, Settings, LayoutTemplate, FolderHeart, Search, ChevronDown, ChevronRight, 
  Plus, Check, Building2, LogOut, LogIn, Shield, PanelLeftClose, PanelLeft, Sparkles
} from 'lucide-react';
import { TabState, PushedScreenState } from '../types';
import { useCommandPalette } from '../context/CommandPaletteContext';
import { useAuth, OrgRole } from '../context/AuthContext';
import { useProfile } from '../context/ProfileContext';
import { useTasks } from '../context/TasksContext';
import { useCalendar } from '../context/CalendarContext';
import { useTimeTracker } from '../context/TimeTrackerContext';
import { useRevenue } from '../context/RevenueContext';
import { useToast } from '../context/ToastContext';
import { PWAInstallButton } from './PWAInstallButton';

interface SidebarProps {
  activeTab: TabState;
  pushedScreen: PushedScreenState;
  onChangeTab: (tab: TabState) => void;
  onPushScreen: (screen: PushedScreenState) => void;
  onDismissScreen: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({
  activeTab,
  pushedScreen,
  onChangeTab,
  onPushScreen,
  onDismissScreen,
  collapsed: controlledCollapsed,
  onToggleCollapse,
}: SidebarProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;
  const toggleCollapse = onToggleCollapse || (() => setInternalCollapsed(prev => !prev));

  const isPushed = pushedScreen !== 'none';
  const { openPalette } = useCommandPalette();
  const { user, organization, organizations, role, switchOrganization, createOrg, signInWithGoogle, signOut } = useAuth();
  const { profile } = useProfile();
  const { tasks } = useTasks();
  const { events } = useCalendar();
  const { timerState } = useTimeTracker();
  const { revenues } = useRevenue();
  const { showToast } = useToast();

  const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isCreateOrgOpen, setIsCreateOrgOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const orgDropdownRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (orgDropdownRef.current && !orgDropdownRef.current.contains(event.target as Node)) {
        setIsOrgDropdownOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute live badges
  const todayStr = new Date().toISOString().split('T')[0];
  const overdueTasksCount = tasks.filter(t => t.status !== 'done' && t.date && t.date.split('T')[0] < todayStr).length;
  const todayEventsCount = events.filter(e => e.date === todayStr).length;
  const hasOverdueRevenue = revenues.some(r => r.status === 'Overdue');

  const navGroups = [
    {
      group: 'Core',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, type: 'tab' as const },
        { id: 'clients', label: 'Clients', icon: Users, type: 'tab' as const },
        { id: 'projects', label: 'Projects', icon: FolderKanban, type: 'tab' as const },
      ]
    },
    {
      group: 'Operations',
      items: [
        { 
          id: 'tasks', 
          label: 'Tasks', 
          icon: CheckSquare, 
          type: 'push' as const, 
          badge: overdueTasksCount > 0 ? `${overdueTasksCount} overdue` : undefined,
          badgeColor: 'bg-orange-500/10 text-orange-600 border border-orange-500/20'
        },
        { 
          id: 'calendar', 
          label: 'Schedule', 
          icon: Calendar, 
          type: 'push' as const, 
          badge: todayEventsCount > 0 ? `${todayEventsCount} today` : undefined,
          badgeColor: 'bg-surface-neutral text-tx-secondary'
        },
        { 
          id: 'time-tracker', 
          label: 'Time Tracking', 
          icon: Clock, 
          type: 'push' as const,
          liveDot: timerState === 'running'
        },
        { 
          id: 'finance', 
          label: 'Finance', 
          icon: DollarSign, 
          type: 'push' as const,
          badge: hasOverdueRevenue ? 'Action' : undefined,
          badgeColor: 'bg-orange-500/10 text-orange-600 border border-orange-500/20'
        },
      ]
    },
    {
      group: 'Workflows & Assets',
      items: [
        { id: 'templates', label: 'Templates', icon: LayoutTemplate, type: 'push' as const },
        { id: 'library', label: 'Library', icon: FolderHeart, type: 'push' as const },
      ]
    },
    {
      group: 'System',
      items: [
        { id: 'settings', label: 'Settings', icon: Settings, type: 'push' as const },
      ]
    }
  ];

  const handleSelectNav = (item: { id: string; type: 'tab' | 'push' }) => {
    if (item.type === 'tab') {
      onDismissScreen();
      onChangeTab(item.id as TabState);
    } else {
      onPushScreen(item.id as PushedScreenState);
    }
  };

  const handleCreateOrgSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    const res = await createOrg(newOrgName.trim());
    if (res) {
      setNewOrgName('');
      setIsCreateOrgOpen(false);
      setIsOrgDropdownOpen(false);
      showToast({ message: `Created workspace "${res.name}"` });
    }
  };

  // Determine current active org name
  const currentOrgName = organization?.name || profile.businessName || 'MenkiR Workspace';
  const currentRole = role || organization?.role || 'owner';

  return (
    <aside 
      className={`hidden md:flex flex-col h-full border-r border-bd-subtle bg-surface-neutral/20 transition-all duration-200 select-none ${
        isCollapsed ? 'w-20 p-2.5' : 'w-64 p-3.5'
      }`}
    >
      {/* 1. ORGANIZATION / WORKSPACE SWITCHER */}
      <div className="relative mb-3 shrink-0" ref={orgDropdownRef}>
        <button
          onClick={() => setIsOrgDropdownOpen(prev => !prev)}
          className={`w-full flex items-center gap-2.5 p-2 rounded-xl border border-bd-subtle bg-canvas hover:bg-surface-neutral hover:border-bd-strong transition-all text-left shadow-2xs group ${
            isCollapsed ? 'justify-center p-2' : 'justify-between'
          }`}
          aria-label="Switch organization workspace"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-tx-primary text-canvas flex items-center justify-center font-bold text-sm shrink-0 border border-tx-primary/80">
              {currentOrgName.charAt(0).toUpperCase()}
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-xs text-tx-primary truncate leading-tight">
                  {currentOrgName}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-tx-muted font-bold">
                    {currentRole}
                  </span>
                  {organization && (
                    <span className="w-1 h-1 rounded-full bg-emerald-500" />
                  )}
                </div>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <ChevronDown size={14} className="text-tx-muted group-hover:text-tx-primary transition-colors shrink-0" />
          )}
        </button>

        {/* Workspace Dropdown */}
        {isOrgDropdownOpen && (
          <div className={`absolute top-full mt-1.5 z-50 bg-canvas border border-bd-subtle rounded-xl shadow-xl overflow-hidden p-1.5 ${
            isCollapsed ? 'left-0 w-64' : 'left-0 right-0'
          }`}>
            <div className="px-2.5 py-1.5 text-[10px] font-bold text-tx-muted uppercase tracking-wider border-b border-bd-subtle">
              Workspaces & Organizations
            </div>

            <div className="max-h-56 overflow-y-auto no-scrollbar py-1 space-y-0.5">
              {organizations.length > 0 ? (
                organizations.map(org => {
                  const isCurrent = organization?.id === org.id;
                  return (
                    <button
                      key={org.id}
                      onClick={async () => {
                        await switchOrganization(org.id);
                        setIsOrgDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                        isCurrent ? 'bg-surface-neutral text-tx-primary font-semibold' : 'text-tx-secondary hover:bg-surface-neutral/60 hover:text-tx-primary'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded bg-surface-neutral flex items-center justify-center font-bold text-[11px] text-tx-primary shrink-0 border border-bd-subtle">
                          {org.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="truncate">
                          <div className="truncate leading-tight">{org.name}</div>
                          <span className="text-[9px] uppercase font-mono text-tx-muted font-bold">{org.role}</span>
                        </div>
                      </div>
                      {isCurrent && <Check size={14} className="text-accent-primary shrink-0" />}
                    </button>
                  );
                })
              ) : (
                <div className="px-2.5 py-2 text-xs text-tx-muted">
                  Default Workspace
                </div>
              )}
            </div>

            <div className="border-t border-bd-subtle mt-1 pt-1 space-y-0.5">
              <button
                onClick={() => {
                  setIsCreateOrgOpen(true);
                  setIsOrgDropdownOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-tx-primary font-medium hover:bg-surface-neutral transition-colors text-left"
              >
                <Plus size={14} className="text-accent-primary" />
                <span>Create Workspace...</span>
              </button>
              <button
                onClick={() => {
                  setIsOrgDropdownOpen(false);
                  onPushScreen('settings');
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-tx-muted hover:text-tx-primary hover:bg-surface-neutral transition-colors text-left"
              >
                <Building2 size={14} />
                <span>Workspace Settings</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. GLOBAL SEARCH ENTRY POINT */}
      <div className="mb-3 shrink-0">
        <button
          onClick={openPalette}
          className={`w-full flex items-center gap-2 px-3 py-2 bg-canvas hover:bg-surface-neutral hover:border-bd-strong border border-bd-subtle rounded-xl text-tx-muted hover:text-tx-primary transition-all text-left shadow-2xs group ${
            isCollapsed ? 'justify-center px-2' : 'justify-between'
          }`}
          title="Search anything (⌘K)"
          aria-label="Global search and commands"
        >
          <div className="flex items-center gap-2">
            <Search size={15} className="text-tx-muted group-hover:text-tx-primary transition-colors" />
            {!isCollapsed && <span className="text-xs font-medium text-tx-secondary">Search...</span>}
          </div>
          {!isCollapsed && (
            <kbd className="inline-flex items-center gap-0.5 text-[10px] font-mono font-bold bg-surface-neutral text-tx-muted px-1.5 py-0.5 rounded border border-bd-subtle">
              <span>⌘K</span>
            </kbd>
          )}
        </button>
      </div>

      {/* 3. NAVIGATION ITEMS */}
      <nav className="flex-1 overflow-y-auto no-scrollbar space-y-4 pr-0.5">
        {navGroups.map((group, gIdx) => (
          <div key={gIdx} className="space-y-1">
            {!isCollapsed && (
              <div className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-tx-muted font-mono mb-1.5">
                {group.group}
              </div>
            )}
            {group.items.map((item) => {
              let isActive = false;
              if (item.type === 'tab' && !isPushed && activeTab === item.id) {
                isActive = true;
              } else if (item.type === 'push' && pushedScreen === item.id) {
                isActive = true;
              }

              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectNav(item)}
                  title={isCollapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium transition-all relative group text-left ${
                    isActive
                      ? 'bg-canvas text-tx-primary shadow-xs border border-bd-subtle font-semibold'
                      : 'text-tx-secondary hover:text-tx-primary hover:bg-surface-neutral/70'
                  } ${isCollapsed ? 'justify-center px-2' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {/* Active Indicator Bar */}
                  {isActive && (
                    <span className="absolute left-1 top-2 bottom-2 w-1 rounded-full bg-accent-primary" />
                  )}

                  <Icon
                    size={17}
                    className={`shrink-0 transition-colors ${
                      isActive ? 'text-tx-primary' : 'text-tx-muted group-hover:text-tx-primary'
                    }`}
                  />

                  {!isCollapsed && (
                    <span className="flex-1 truncate">{item.label}</span>
                  )}

                  {/* Badges & Live Status */}
                  {!isCollapsed && (
                    <>
                      {'liveDot' in item && item.liveDot && (
                        <span className="flex h-2 w-2 relative shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-primary opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-primary" />
                        </span>
                      )}
                      {'badge' in item && item.badge && (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono tabular-nums font-semibold shrink-0 ${item.badgeColor || 'bg-surface-neutral text-tx-muted'}`}>
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                  {isCollapsed && 'liveDot' in item && item.liveDot && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent-primary" />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* 4. USER PROFILE & COLLAPSE TOGGLE FOOTER */}
      <div className="pt-2 border-t border-bd-subtle shrink-0 space-y-1.5" ref={userMenuRef}>
        {/* User Card / Button */}
        <div className="relative">
          <button
            onClick={() => setIsUserMenuOpen(prev => !prev)}
            className={`w-full flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-surface-neutral transition-colors text-left group ${
              isCollapsed ? 'justify-center' : ''
            }`}
            aria-label="User account menu"
          >
            <img
              src={user?.photoURL || `https://api.dicebear.com/7.x/notionists/svg?seed=${profile.avatarSeed}`}
              alt={user?.displayName || profile.name}
              className="w-8 h-8 rounded-lg bg-surface-neutral object-cover shrink-0 border border-bd-subtle"
            />
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-tx-primary truncate leading-tight">
                  {user?.displayName || profile.name}
                </div>
                <div className="text-[11px] text-tx-muted truncate">
                  {user?.email || profile.email}
                </div>
              </div>
            )}
            {!isCollapsed && (
              <ChevronDown size={14} className="text-tx-muted group-hover:text-tx-primary transition-colors shrink-0" />
            )}
          </button>

          {/* User Popover Menu */}
          {isUserMenuOpen && (
            <div className={`absolute bottom-full mb-1.5 z-50 bg-canvas border border-bd-subtle rounded-xl shadow-xl overflow-hidden p-1.5 ${
              isCollapsed ? 'left-0 w-60' : 'left-0 right-0'
            }`}>
              <div className="px-2.5 py-2 border-b border-bd-subtle">
                <div className="text-xs font-bold text-tx-primary truncate">{user?.displayName || profile.name}</div>
                <div className="text-[11px] text-tx-muted truncate">{user?.email || profile.email}</div>
                <div className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider font-bold bg-surface-neutral text-tx-secondary">
                  Role: {currentRole}
                </div>
              </div>

              <div className="py-1 space-y-0.5">
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    onPushScreen('settings');
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-tx-secondary hover:text-tx-primary hover:bg-surface-neutral transition-colors text-left"
                >
                  <Settings size={14} />
                  <span>Account & Preferences</span>
                </button>
                {user ? (
                  <button
                    onClick={async () => {
                      setIsUserMenuOpen(false);
                      await signOut();
                      showToast({ message: 'Signed out successfully' });
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-red-600 hover:bg-red-500/10 transition-colors text-left"
                  >
                    <LogOut size={14} />
                    <span>Sign Out</span>
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      setIsUserMenuOpen(false);
                      await signInWithGoogle();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold text-tx-primary bg-accent-primary/20 hover:bg-accent-primary/30 transition-colors text-left"
                  >
                    <LogIn size={14} />
                    <span>Sign In with Google</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* PWA Desktop Install */}
        <div className="mb-1">
          <PWAInstallButton 
            className="w-full text-xs justify-start px-2.5 py-1.5" 
            variant="subtle" 
            showLabel={!isCollapsed} 
          />
        </div>

        {/* Collapse Toggle */}
        <button
          onClick={toggleCollapse}
          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-tx-muted hover:text-tx-primary hover:bg-surface-neutral transition-colors ${
            isCollapsed ? 'justify-center' : 'justify-between'
          }`}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {!isCollapsed && <span className="text-[11px] font-medium">Collapse</span>}
          {isCollapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      {/* Quick Create Organization Modal */}
      {isCreateOrgOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-tx-primary/40 backdrop-blur-xs">
          <div className="bg-canvas border border-bd-subtle rounded-2xl shadow-2xl max-w-sm w-full p-5">
            <h3 className="text-base font-bold text-tx-primary mb-1">Create New Workspace</h3>
            <p className="text-xs text-tx-muted mb-4">Set up an isolated workspace for your team or organization.</p>
            <form onSubmit={handleCreateOrgSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-tx-primary block mb-1">Workspace Name</label>
                <input
                  type="text"
                  autoFocus
                  required
                  placeholder="Acme Engineering"
                  value={newOrgName}
                  onChange={e => setNewOrgName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-neutral border border-bd-subtle text-sm text-tx-primary focus:outline-none focus:ring-1 focus:ring-tx-primary"
                />
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setIsCreateOrgOpen(false)}
                  className="px-3 py-2 rounded-xl text-xs font-medium text-tx-muted hover:text-tx-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-tx-primary text-canvas text-xs font-semibold hover:opacity-90"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </aside>
  );
}
