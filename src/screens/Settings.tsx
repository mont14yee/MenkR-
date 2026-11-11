import { getTodayDateStr } from "../utils/date";
import React, { useState, useRef } from 'react';
import { 
  X, MoreVertical, Sparkles, User, Signal, Palette, Landmark, Settings2, 
  ChevronLeft, Trash2, Download, Upload, AlertCircle, Database, ShieldCheck, 
  RefreshCw, Building2, LogIn, LogOut, CheckCircle2, Users2, Mail, UserPlus, 
  Shield, KeyRound, ChevronRight, Copy, Check, Activity, Bell, Smartphone 
} from 'lucide-react';
import { Header, ListRow, CircularProgress } from '../components/Shared';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { usePreferences } from '../context/PreferencesContext';
import { useProfile } from '../context/ProfileContext';
import { useAuth, OrgRole, OrgMember, OrgInvitation } from '../context/AuthContext';
import { pushDataToPostgres } from '../services/syncService';
import { BottomSheet, BottomSheetField } from '../components/BottomSheet';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { generateId } from '../utils/id';
import { useToast } from '../context/ToastContext';
import { validateRequired, validateEmail } from '../utils/validation';
import { DataMigrationModal } from '../components/DataMigrationModal';
import { sanitizeDataPayload } from '../utils/migrationValidator';
import { OperationalHealthModal } from '../components/OperationalHealthModal';
import { AuditLogModal } from '../components/AuditLogModal';

function PreferencesScreen({ onBack }: { onBack: () => void }) {
  const { preferences, updatePreferences } = usePreferences();
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#3b82f6');
  const [newCategoryScope, setNewCategoryScope] = useState<'task' | 'event' | 'revenue'>('task');
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null);

  const handleDeleteCategory = () => {
    if (deleteCategoryId) {
      updatePreferences({ categories: preferences.categories.filter(c => c.id !== deleteCategoryId) });
      setDeleteCategoryId(null);
    }
  };

  const handleSaveCategory = () => {
    if (!validateRequired(newCategoryName)) {
      return;
    }
    updatePreferences({
      categories: [
        ...preferences.categories,
        { id: generateId(), label: newCategoryName.trim(), color: newCategoryColor, scope: newCategoryScope }
      ]
    });
    setNewCategoryName('');
    setIsAddCategoryOpen(false);
  };

  return (
    <div className="absolute inset-0 bg-canvas z-50 flex flex-col overflow-y-auto no-scrollbar">
      <Header
        leftIcon={
          <button onClick={onBack} className="w-11 h-11 rounded-full bg-surface-neutral flex items-center justify-center text-tx-primary" aria-label="Back">
            <ChevronLeft size={20} />
          </button>
        }
        title="Preferences"
      />
      
      <div className="px-5 py-4 flex flex-col gap-8 pb-20">
        <section>
          <h3 className="text-[13px] font-medium text-tx-muted mb-3 uppercase tracking-wider">General</h3>
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <span className="text-[15px] text-tx-primary">Currency</span>
              <select 
                value={preferences.currency}
                onChange={(e) => updatePreferences({ currency: e.target.value })}
                className="bg-surface-neutral px-3 py-1.5 rounded-lg outline-none text-[14px]"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="ETB">Ethiopian Birr (ETB)</option>
              </select>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-[15px] text-tx-primary">First day of week</span>
              <select 
                value={preferences.firstDayOfWeek}
                onChange={(e) => updatePreferences({ firstDayOfWeek: e.target.value as 'sun' | 'mon' })}
                className="bg-surface-neutral px-3 py-1.5 rounded-lg outline-none text-[14px]"
              >
                <option value="sun">Sunday</option>
                <option value="mon">Monday</option>
              </select>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-[13px] font-medium text-tx-muted mb-3 uppercase tracking-wider">Operational Defaults</h3>
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <span className="text-[15px] text-tx-primary">Default task priority</span>
              <select 
                value={preferences.defaultTaskPriority || 'Medium'}
                onChange={(e) => updatePreferences({ defaultTaskPriority: e.target.value as 'Low' | 'Medium' | 'High' })}
                className="bg-surface-neutral px-3 py-1.5 rounded-lg outline-none text-[14px]"
              >
                <option value="Low">Low Priority</option>
                <option value="Medium">Medium Priority</option>
                <option value="High">High Priority</option>
              </select>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-[15px] text-tx-primary">Reminder lead time</span>
              <select 
                value={preferences.defaultReminderMinutes}
                onChange={(e) => updatePreferences({ defaultReminderMinutes: parseInt(e.target.value) })}
                className="bg-surface-neutral px-3 py-1.5 rounded-lg outline-none text-[14px]"
              >
                <option value={0}>At time of event</option>
                <option value={5}>5 mins before</option>
                <option value={15}>15 mins before</option>
                <option value={30}>30 mins before</option>
              </select>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-[15px] text-tx-primary">Time tracking increment</span>
              <select 
                value={preferences.roundingIncrementMinutes}
                onChange={(e) => updatePreferences({ roundingIncrementMinutes: parseInt(e.target.value) })}
                className="bg-surface-neutral px-3 py-1.5 rounded-lg outline-none text-[14px]"
              >
                <option value={1}>1 minute</option>
                <option value={5}>5 minutes</option>
                <option value={15}>15 minutes</option>
              </select>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-[15px] text-tx-primary">Audit log retention</span>
              <select 
                value={preferences.auditRetentionDays || 90}
                onChange={(e) => updatePreferences({ auditRetentionDays: parseInt(e.target.value) })}
                className="bg-surface-neutral px-3 py-1.5 rounded-lg outline-none text-[14px]"
              >
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
                <option value={90}>90 days (Standard)</option>
                <option value={180}>180 days</option>
                <option value={365}>1 year (Extended)</option>
              </select>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-[13px] font-medium text-tx-muted mb-3 uppercase tracking-wider">Notification Options</h3>
          <div className="flex flex-col gap-3">
            <label className="flex items-center justify-between p-3 rounded-xl bg-surface-neutral cursor-pointer hover:bg-surface-neutral/80 transition-colors">
              <div>
                <div className="text-[15px] font-medium text-tx-primary">Milestone & Deadline Alerts</div>
                <div className="text-[12px] text-tx-muted">Notify when task or project deadlines are within 24 hours</div>
              </div>
              <input
                type="checkbox"
                checked={preferences.notifyOnMilestoneDeadline ?? true}
                onChange={(e) => updatePreferences({ notifyOnMilestoneDeadline: e.target.checked })}
                className="w-4 h-4 rounded text-accent-primary"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-surface-neutral cursor-pointer hover:bg-surface-neutral/80 transition-colors">
              <div>
                <div className="text-[15px] font-medium text-tx-primary">Security & Role Change Alerts</div>
                <div className="text-[12px] text-tx-muted">Notify when team roles or access permissions are modified</div>
              </div>
              <input
                type="checkbox"
                checked={preferences.notifyOnRoleChange ?? true}
                onChange={(e) => updatePreferences({ notifyOnRoleChange: e.target.checked })}
                className="w-4 h-4 rounded text-accent-primary"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-surface-neutral cursor-pointer hover:bg-surface-neutral/80 transition-colors">
              <div>
                <div className="text-[15px] font-medium text-tx-primary">Data Export Notifications</div>
                <div className="text-[12px] text-tx-muted">Notify whenever a full organization snapshot is downloaded</div>
              </div>
              <input
                type="checkbox"
                checked={preferences.notifyOnDataExport ?? true}
                onChange={(e) => updatePreferences({ notifyOnDataExport: e.target.checked })}
                className="w-4 h-4 rounded text-accent-primary"
              />
            </label>
          </div>
        </section>

        <section>
          <h3 className="text-[13px] font-medium text-tx-muted mb-3 uppercase tracking-wider">Categories</h3>
          <div className="flex flex-col gap-3">
            {preferences.categories.map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-xl bg-surface-neutral">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: c.color }} />
                  <div>
                    <div className="text-[15px] font-medium text-tx-primary">{c.label}</div>
                    <div className="text-[12px] text-tx-muted capitalize">{c.scope}</div>
                  </div>
                </div>
                <button onClick={() => setDeleteCategoryId(c.id)} className="text-tx-muted hover:text-red-500 transition-colors p-2" aria-label="Delete category">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button onClick={() => setIsAddCategoryOpen(true)} className="py-3 rounded-xl border border-bd-subtle border-dashed text-[14px] font-medium text-tx-muted text-center active:bg-surface-neutral transition-colors">
              + Add Category
            </button>
          </div>
        </section>
      </div>

      <BottomSheet
        isOpen={isAddCategoryOpen}
        onClose={() => setIsAddCategoryOpen(false)}
        title="New Category"
        onSave={handleSaveCategory}
        saveLabel="Create"
      >
        <BottomSheetField label="Category Name">
          <input 
            type="text" 
            placeholder="e.g. Design" 
            value={newCategoryName}
            onChange={e => setNewCategoryName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none text-[15px] outline-none text-tx-primary" 
          />
        </BottomSheetField>
        <div className="flex gap-4">
          <BottomSheetField label="Color" className="flex-1">
            <input 
              type="color" 
              value={newCategoryColor}
              onChange={e => setNewCategoryColor(e.target.value)}
              className="w-full h-12 rounded-xl bg-surface-neutral border-none outline-none cursor-pointer" 
            />
          </BottomSheetField>
          <BottomSheetField label="Scope" className="flex-1">
            <select 
              value={newCategoryScope}
              onChange={e => setNewCategoryScope(e.target.value as any)}
              className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none text-[15px] outline-none text-tx-primary h-12"
            >
              <option value="task">Task</option>
              <option value="event">Event</option>
              <option value="revenue">Revenue</option>
            </select>
          </BottomSheetField>
        </div>
      </BottomSheet>

      <ConfirmDialog
        isOpen={!!deleteCategoryId}
        onCancel={() => setDeleteCategoryId(null)}
        onConfirm={handleDeleteCategory}
        title="Delete Category?"
        body="Are you sure you want to delete this category?"
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}

export function Settings({ onDismiss }: { onDismiss: () => void }) {
  const { profile, updateProfile } = useProfile();
  const { name, email, businessName, avatarSeed } = profile;
  const { showToast } = useToast();
  
  const { 
    user, idToken, organization, organizations, role, 
    signInWithGoogle, signOut, refreshToken, switchOrganization, 
    createOrg, fetchMembers, fetchInvitations, inviteUser, 
    revokeInvite, acceptInvite, changeMemberRole, removeMember 
  } = useAuth();
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStats, setSyncStats] = useState<Record<string, number> | null>(null);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  // Multi-organization state
  const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgCurrency, setNewOrgCurrency] = useState('USD');

  // Team & RBAC state
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState<OrgMember[]>([]);
  const [teamInvitations, setTeamInvitations] = useState<OrgInvitation[]>([]);
  const [isLoadingTeam, setIsLoadingTeam] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<OrgRole>('member');
  const [inviteTokenInput, setInviteTokenInput] = useState('');
  const [isAcceptingInvite, setIsAcceptingInvite] = useState(false);

  const [activeScreen, setActiveScreen] = useState<'main' | 'preferences'>('main');
  const [isAiInfoOpen, setIsAiInfoOpen] = useState(false);
  const [isComingSoonOpen, setIsComingSoonOpen] = useState(false);
  const [comingSoonDetails, setComingSoonDetails] = useState({ title: '', desc: '' });
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isClearDataOpen, setIsClearDataOpen] = useState(false);
  const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false);
  const [importDataContent, setImportDataContent] = useState<string | null>(null);
  const [isMigrationModalOpen, setIsMigrationModalOpen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profileForm, setProfileForm] = useState({ name, email, businessName });

  const loadTeamData = async () => {
    setIsLoadingTeam(true);
    try {
      const [members, invites] = await Promise.all([
        fetchMembers(),
        fetchInvitations(),
      ]);
      setTeamMembers(members);
      setTeamInvitations(invites);
    } catch (err) {
      console.error('Error loading team data:', err);
    } finally {
      setIsLoadingTeam(false);
    }
  };

  const handleOpenTeamModal = async () => {
    if (!user) {
      showToast({ message: "Please sign in with Google to manage team access." });
      await signInWithGoogle();
      return;
    }
    setIsTeamModalOpen(true);
    await loadTeamData();
  };

  const handleCreateNewOrg = async () => {
    if (!newOrgName.trim()) {
      showToast({ message: "Organization name is required." });
      return;
    }
    const created = await createOrg(newOrgName.trim(), newOrgCurrency);
    if (created) {
      setNewOrgName('');
      setIsOrgModalOpen(false);
    }
  };

  const handleSendInvite = async () => {
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
      showToast({ message: "Please enter a valid email address." });
      return;
    }
    const success = await inviteUser(inviteEmail.trim(), inviteRole);
    if (success) {
      setInviteEmail('');
      await loadTeamData();
    }
  };

  const handleAcceptInviteSubmit = async () => {
    if (!inviteTokenInput.trim()) {
      showToast({ message: "Please enter an invitation token." });
      return;
    }
    setIsAcceptingInvite(true);
    const success = await acceptInvite(inviteTokenInput.trim());
    setIsAcceptingInvite(false);
    if (success) {
      setInviteTokenInput('');
      await loadTeamData();
    }
  };

  const handleSyncToPostgres = async () => {
    let token = idToken;
    if (!token && user) {
      token = await refreshToken();
    }
    if (!token) {
      showToast({ message: "Please sign in with Google to sync to Cloud SQL." });
      await signInWithGoogle();
      return;
    }

    setIsSyncing(true);
    try {
      const getLocalJson = (key: string, fallback: any) => {
        try {
          const val = localStorage.getItem(`menkir-${key}`);
          return val ? JSON.parse(val) : fallback;
        } catch {
          return fallback;
        }
      };

      const payload = {
        clients: getLocalJson('clients', []),
        projects: getLocalJson('projects', []),
        tasks: getLocalJson('tasks', []),
        messages: getLocalJson('messages', []),
        events: getLocalJson('events', []),
        timeEntries: getLocalJson('time-entries', []),
        revenues: getLocalJson('revenues', []),
        templates: getLocalJson('templates', []),
        library: getLocalJson('library', []),
        preferences: getLocalJson('preferences', {}),
      };

      if (role === 'viewer') {
        showToast({ message: "Permission denied: Viewers have read-only access and cannot push data changes." });
        return;
      }

      const result = await pushDataToPostgres(token, profile, payload, organization?.id);
      setSyncStats(result.stats);
      showToast({ message: "Successfully synced all data to Cloud SQL PostgreSQL!" });
    } catch (err: any) {
      console.error("Postgres sync error:", err);
      showToast({ message: `Sync failed: ${err.message || 'Database error'}` });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleOpenAuditLog = async () => {
    let token = idToken;
    if (!token && user) {
      token = await refreshToken();
    }
    if (!token) {
      showToast({ message: "Sign in with Google to view audit logs." });
      return;
    }

    setIsLoadingAudit(true);
    setIsAuditModalOpen(true);
    try {
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      if (organization?.id) {
        headers['X-Organization-Id'] = organization.id;
      }
      const res = await fetch('/api/audit-events', { headers });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data);
      } else {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to load audit events');
      }
    } catch (err: any) {
      console.error(err);
      showToast({ message: err.message || "Failed to load audit logs" });
    } finally {
      setIsLoadingAudit(false);
    }
  };

  const handleSaveProfile = () => {
    if (!validateRequired(profileForm.name)) {
      showToast({ message: "Full Name is required." });
      return;
    }
    if (profileForm.email && !validateEmail(profileForm.email)) {
      showToast({ message: "Please enter a valid email address." });
      return;
    }
    updateProfile(profileForm);
    setIsProfileOpen(false);
    showToast({ message: "Profile details updated successfully." });
  };

  const handleExportData = () => {
    const rawData: Record<string, any> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('menkir-')) {
        try {
          rawData[key] = JSON.parse(localStorage.getItem(key) || 'null');
        } catch {
          rawData[key] = localStorage.getItem(key);
        }
      }
    }

    // Exclude any secrets, API keys, or private auth credentials
    const cleanData = sanitizeDataPayload(rawData);

    const blob = new Blob([JSON.stringify(cleanData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `menkir-backup-${getTodayDateStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast({ message: 'Data exported successfully (secrets excluded)' });
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setImportDataContent(e.target?.result as string);
      setIsImportConfirmOpen(true);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const confirmImport = () => {
    if (!importDataContent) return;
    
    // 1. Create a backup of current data before making any changes
    const currentDataBackup: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('menkir-')) {
        currentDataBackup[key] = localStorage.getItem(key) || '';
      }
    }

    try {
      // 2. Parse and validate new data
      const importedData = JSON.parse(importDataContent);
      if (typeof importedData !== 'object' || importedData === null || Array.isArray(importedData)) {
        throw new Error('Invalid backup format: root must be an object.');
      }

      const keysToImport = Object.keys(importedData).filter(key => key.startsWith('menkir-'));
      if (keysToImport.length === 0) {
        throw new Error('No valid MenkiR data found in the backup file.');
      }

      // Pre-flight check: ensure all values are valid JSON strings
      for (const key of keysToImport) {
        const value = importedData[key];
        if (typeof value !== 'string') {
           throw new Error(`Invalid data format for key ${key}: value must be a stringified JSON.`);
        }
        JSON.parse(value); // Throws if not valid JSON
      }

      // 3. Clear existing data
      for (const key of Object.keys(currentDataBackup)) {
        localStorage.removeItem(key);
      }

      // 4. Apply new data
      for (const key of keysToImport) {
        localStorage.setItem(key, importedData[key]);
        
        // Verification (partial write check)
        if (localStorage.getItem(key) !== importedData[key]) {
          throw new Error(`Failed to write data for ${key}. Storage limit may be reached.`);
        }
      }

      showToast({ message: 'Data imported successfully' });
      setTimeout(() => window.location.reload(), 1000);
      
    } catch (err: any) {
      console.error('Import failed, rolling back...', err);
      
      // Safe recovery behavior: Rollback
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('menkir-')) {
          localStorage.removeItem(key);
        }
      }
      for (const [key, value] of Object.entries(currentDataBackup)) {
        try {
           localStorage.setItem(key, value);
        } catch (e) {
           console.error('Failed to rollback key:', key, e);
        }
      }

      showToast({ message: `Import failed: ${err.message || 'Invalid format'}. Reverted to previous state.` });
    } finally {
      setIsImportConfirmOpen(false);
      setImportDataContent(null);
    }
  };

  const handleClearData = () => {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('menkir-')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    window.location.reload();
  };

  const openFeaturePreview = (title: string, desc: string) => {
    setComingSoonDetails({ title, desc });
    setIsComingSoonOpen(true);
  };

  const settings = [
    { 
      icon: <Sparkles size={20} className="text-tx-primary" />, 
      title: 'MenkiR AI', 
      subtitle: 'Gemini 3.8 Flash • Executive Summaries & Workflow Generator', 
      onClick: () => setIsAiInfoOpen(true) 
    },
    { 
      icon: <User size={20} className="text-tx-primary" />, 
      title: 'Account Details', 
      subtitle: 'Update info, website, business name', 
      onClick: () => { setProfileForm({ name, email, businessName }); setIsProfileOpen(true); } 
    },
    { 
      icon: <Signal size={20} className="text-tx-primary" />, 
      title: 'Subscription Plan', 
      subtitle: 'Individual Pro plan with local privacy and cloud AI', 
      onClick: () => openFeaturePreview('Subscription Plan', 'Your current MenkiR build includes full offline-first capabilities, local encrypted persistence, and Gemini-powered automation.') 
    },
    { 
      icon: <Palette size={20} className="text-tx-primary" />, 
      title: 'Brand Elements', 
      subtitle: 'Custom invoices, colors, and document headers', 
      onClick: () => openFeaturePreview('Brand Elements', 'Custom invoice letterheads, logo embedding, and palette styling are slated for the upcoming release.') 
    },
    { 
      icon: <Landmark size={20} className="text-tx-primary" />, 
      title: 'Bank Account', 
      subtitle: 'Payout integrations and payment gateways', 
      onClick: () => openFeaturePreview('Bank Account & Payouts', 'Stripe Connect and automated banking feeds are preparing for upcoming integration.') 
    },
    { 
      icon: <Settings2 size={20} className="text-tx-primary" />, 
      title: 'Preferences', 
      subtitle: 'Customize formats, defaults, categories',
      onClick: () => setActiveScreen('preferences')
    },
  ];

  if (activeScreen === 'preferences') {
    return <PreferencesScreen onBack={() => setActiveScreen('main')} />;
  }

  return (
    <div className="absolute inset-0 bg-canvas z-50 flex flex-col overflow-y-auto no-scrollbar">
      <Header
        leftIcon={
          <button onClick={onDismiss} className="w-11 h-11 rounded-full bg-surface-neutral flex items-center justify-center text-tx-primary" aria-label="Close">
            <X size={20} />
          </button>
        }
        title="Settings"
        rightIcon={
          <button onClick={() => setActiveScreen('preferences')} className="w-11 h-11 rounded-full bg-surface-neutral flex items-center justify-center text-tx-primary hover:opacity-80 transition-opacity" aria-label="Open Preferences">
            <Settings2 size={20} />
          </button>
        }
      />

      <div className="px-5 flex flex-col gap-6 mt-2 pb-12">
        <div className="flex items-center gap-4">
          <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${avatarSeed}`} alt="Avatar" className="w-16 h-16 rounded-full object-cover bg-surface-neutral" />
          <div>
            <div className="text-[20px] font-semibold text-tx-primary">{name}</div>
            <div className="text-[14px] text-tx-muted mt-0.5">{email}</div>
          </div>
        </div>

        <div className="mt-2 flex flex-col gap-2">
          {settings.map((s, idx) => (
            <ListRow
              key={idx}
              icon={<div className="w-10 h-10 rounded-full bg-surface-neutral flex items-center justify-center">{s.icon}</div>}
              title={s.title}
              subtitle={s.subtitle}
              onClick={s.onClick}
            />
          ))}
        </div>

        {/* PWA & Mobile Installation */}
        <div className="p-4 bg-surface-neutral/50 rounded-2xl border border-bd-subtle flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img 
              src="/icon-192.png" 
              alt="MenkiR Icon" 
              className="w-10 h-10 rounded-xl shadow-2xs border border-bd-subtle object-cover shrink-0" 
            />
            <div className="min-w-0">
              <div className="text-[15px] font-semibold text-tx-primary truncate">Install MenkiR</div>
              <div className="text-[12px] text-tx-muted truncate">Add to Home Screen for fast offline app access</div>
            </div>
          </div>
          <PWAInstallButton variant="primary" size="sm" />
        </div>

        {/* Enterprise Database & Organization */}
        <div className="mt-4 pt-6 border-t border-bd-subtle">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[13px] font-medium text-tx-muted uppercase tracking-wider">
              Cloud SQL & Organization
            </h3>
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              PostgreSQL Active
            </span>
          </div>

          <div className="p-4 bg-surface-neutral/40 rounded-2xl border border-bd-subtle space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[15px] font-semibold text-tx-primary flex items-center gap-2">
                  <Database size={16} className="text-blue-500" />
                  {organization ? organization.name : 'Personal Workspace'}
                </div>
                <div className="text-[12px] text-tx-muted mt-0.5">
                  Region: europe-west1 • Multi-tenant Isolation
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {role && (
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border capitalize ${
                    role === 'owner' ? 'bg-amber-500/10 text-amber-600 border-amber-500/30' :
                    role === 'admin' ? 'bg-purple-500/10 text-purple-600 border-purple-500/30' :
                    role === 'manager' ? 'bg-blue-500/10 text-blue-600 border-blue-500/30' :
                    role === 'member' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' :
                    'bg-slate-500/10 text-slate-600 border-slate-500/30'
                  }`}>
                    {role}
                  </span>
                )}
                {user && (
                  <button 
                    onClick={() => setIsOrgModalOpen(true)}
                    className="p-1 hover:bg-surface-neutral rounded-lg text-tx-muted hover:text-tx-primary transition-colors text-[11px] font-medium underline"
                  >
                    Switch
                  </button>
                )}
              </div>
            </div>

            {role === 'viewer' && (
              <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-[12px] text-blue-600 flex items-center gap-2">
                <Shield size={14} className="shrink-0" />
                <span>You have <strong>Viewer</strong> access (read-only). Creating and editing data is restricted.</span>
              </div>
            )}

            {user ? (
              <div className="pt-2 border-t border-bd-subtle flex flex-col gap-2">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-tx-muted truncate">Connected: {user.email}</span>
                  <button 
                    onClick={signOut}
                    className="text-[12px] text-red-500 hover:underline flex items-center gap-1 shrink-0 ml-2"
                  >
                    <LogOut size={12} /> Sign out
                  </button>
                </div>

                <div className={`grid ${role === 'owner' || role === 'admin' ? 'grid-cols-3' : 'grid-cols-2'} gap-2 pt-1`}>
                  <button
                    onClick={handleOpenTeamModal}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-2 bg-canvas border border-bd-subtle rounded-xl text-[12px] font-medium text-tx-primary hover:bg-surface-neutral transition-colors"
                  >
                    <Users2 size={13} className="text-blue-500" />
                    Team & RBAC
                  </button>

                  <button
                    onClick={() => setIsAuditModalOpen(true)}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-2 bg-canvas border border-bd-subtle rounded-xl text-[12px] font-medium text-tx-primary hover:bg-surface-neutral transition-colors"
                  >
                    <ShieldCheck size={13} className="text-emerald-500" />
                    Audit Logs
                  </button>

                  {(role === 'owner' || role === 'admin') && (
                    <button
                      onClick={() => setIsHealthModalOpen(true)}
                      className="flex items-center justify-center gap-1.5 py-2.5 px-2 bg-canvas border border-bd-subtle rounded-xl text-[12px] font-medium text-tx-primary hover:bg-surface-neutral transition-colors"
                    >
                      <Activity size={13} className="text-amber-500" />
                      Health
                    </button>
                  )}
                </div>

                <button
                  onClick={handleSyncToPostgres}
                  disabled={isSyncing || role === 'viewer'}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-tx-primary text-tx-inverse rounded-xl text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50 mt-1"
                >
                  <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                  {isSyncing ? 'Syncing...' : 'Sync All Data to PostgreSQL'}
                </button>

                {syncStats && (
                  <div className="text-[11px] text-emerald-600 bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20 flex items-center gap-1.5 mt-1">
                    <CheckCircle2 size={13} className="shrink-0" />
                    <span>Synchronized: {syncStats.clients || 0} clients, {syncStats.projects || 0} projects, {syncStats.tasks || 0} tasks, {syncStats.revenues || 0} financial records</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="pt-2 border-t border-bd-subtle">
                <p className="text-[12px] text-tx-muted mb-3 leading-relaxed">
                  Sign in with Google to enable multi-tenant organization access, cloud PostgreSQL persistence, and automatic audit logging.
                </p>
                <button
                  onClick={signInWithGoogle}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-tx-primary text-tx-inverse rounded-xl text-[13px] font-medium hover:opacity-90 transition-opacity"
                >
                  <LogIn size={15} />
                  Sign In with Google
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 pt-6 border-t border-bd-subtle">
          <h3 className="text-[13px] font-medium text-tx-muted mb-4 uppercase tracking-wider">Data Management & Recovery</h3>
          <div className="flex flex-col gap-2">
            <button 
              onClick={() => setIsMigrationModalOpen(true)} 
              className="flex items-center gap-3 p-3 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/50 rounded-xl hover:opacity-90 transition-opacity"
            >
              <Database size={18} className="text-blue-600 dark:text-blue-400" />
              <div className="flex flex-col text-left">
                <span className="text-[15px] font-semibold text-blue-950 dark:text-blue-100 flex items-center gap-1.5">
                  Controlled Migration & Cloud Recovery
                  <span className="px-1.5 py-0.2 bg-blue-600 text-white text-[10px] rounded-md font-bold">NEW</span>
                </span>
                <span className="text-[12px] text-blue-800/80 dark:text-blue-300/80">
                  Inspect schemas, validate duplicates, safely migrate to Cloud SQL or manage cloud backups
                </span>
              </div>
            </button>

            <button onClick={handleExportData} className="flex items-center gap-3 p-3 bg-surface-neutral rounded-xl hover:opacity-80 transition-opacity">
              <Download size={18} className="text-tx-primary" />
              <div className="flex flex-col text-left">
                <span className="text-[15px] font-medium text-tx-primary">Export Data Snapshot</span>
                <span className="text-[12px] text-tx-muted">Download all app data as sanitized JSON (credentials excluded)</span>
              </div>
            </button>
            
            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-3 p-3 bg-surface-neutral rounded-xl hover:opacity-80 transition-opacity">
              <Upload size={18} className="text-tx-primary" />
              <div className="flex flex-col text-left">
                <span className="text-[15px] font-medium text-tx-primary">Import Data</span>
                <span className="text-[12px] text-tx-muted">Restore app data from a JSON backup</span>
              </div>
            </button>
            <input type="file" accept=".json" ref={fileInputRef} onChange={handleImportData} className="hidden" />

            <button onClick={() => setIsClearDataOpen(true)} className="flex items-center gap-3 p-3 bg-red-500/10 rounded-xl hover:opacity-80 transition-opacity mt-2">
              <AlertCircle size={18} className="text-red-500" />
              <div className="flex flex-col text-left">
                <span className="text-[15px] font-medium text-red-500">Clear All Data</span>
                <span className="text-[12px] text-red-500/70">Permanently delete all local app data</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      <BottomSheet
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        title="Account Details"
        onSave={handleSaveProfile}
        saveLabel="Save Changes"
      >
        <BottomSheetField label="Full Name">
          <input 
            type="text" 
            value={profileForm.name}
            onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
            className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none text-[15px] outline-none text-tx-primary" 
          />
        </BottomSheetField>
        <BottomSheetField label="Email Address">
          <input 
            type="email" 
            value={profileForm.email}
            onChange={e => setProfileForm({ ...profileForm, email: e.target.value })}
            className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none text-[15px] outline-none text-tx-primary" 
          />
        </BottomSheetField>
        <BottomSheetField label="Business Name">
          <input 
            type="text" 
            value={profileForm.businessName}
            onChange={e => setProfileForm({ ...profileForm, businessName: e.target.value })}
            className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none text-[15px] outline-none text-tx-primary" 
          />
        </BottomSheetField>
      </BottomSheet>

      {/* MenkiR AI Overview Sheet */}
      <BottomSheet
        isOpen={isAiInfoOpen}
        onClose={() => setIsAiInfoOpen(false)}
        title="MenkiR AI Capabilities"
      >
        <div className="flex flex-col gap-4 py-2">
          <div className="flex items-center gap-3 p-3 bg-surface-neutral/40 rounded-2xl border border-bd-subtle">
            <div className="w-10 h-10 rounded-full bg-accent-primary/20 flex items-center justify-center text-tx-primary shrink-0">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="text-[14px] font-semibold text-tx-primary">Gemini 3.8 Flash Engine</div>
              <div className="text-[12px] text-tx-muted">Secured via server-side proxy</div>
            </div>
            <span className="ml-auto px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              Active
            </span>
          </div>

          <div className="space-y-3">
            <div className="p-3 bg-surface-neutral/20 rounded-xl border border-bd-subtle/50">
              <div className="text-[13px] font-semibold text-tx-primary mb-1">Project Executive Summaries</div>
              <p className="text-[12px] text-tx-muted leading-relaxed">
                Generates instant health reports, completion projections, and key next steps directly from your project hub.
              </p>
            </div>

            <div className="p-3 bg-surface-neutral/20 rounded-xl border border-bd-subtle/50">
              <div className="text-[13px] font-semibold text-tx-primary mb-1">AI Template Generation</div>
              <p className="text-[12px] text-tx-muted leading-relaxed">
                Describe your project scope or deliverable in plain English to automatically construct structured phases, milestones, and task checklists.
              </p>
            </div>

            <div className="p-3 bg-surface-neutral/20 rounded-xl border border-bd-subtle/50">
              <div className="text-[13px] font-semibold text-tx-primary mb-1">Zero Client Exposure</div>
              <p className="text-[12px] text-tx-muted leading-relaxed">
                Your API secrets never touch the browser client, ensuring strict enterprise security.
              </p>
            </div>
          </div>

          <button onClick={() => setIsAiInfoOpen(false)} className="w-full py-3.5 rounded-full bg-tx-primary text-tx-inverse text-[15px] font-medium mt-2">
            Got it
          </button>
        </div>
      </BottomSheet>

      <BottomSheet
        isOpen={isComingSoonOpen}
        onClose={() => setIsComingSoonOpen(false)}
        title={comingSoonDetails.title || "Coming Soon"}
      >
        <div className="py-6 text-center text-tx-muted text-[15px] leading-relaxed px-2">
          {comingSoonDetails.desc || "This feature is currently under active development. Stay tuned for future updates!"}
        </div>
        <button onClick={() => setIsComingSoonOpen(false)} className="w-full py-4 rounded-full bg-accent-primary text-tx-primary text-[15px] font-medium mt-2">
          Got it
        </button>
      </BottomSheet>

      {/* Enterprise Audit & Activity Log Modal */}
      <AuditLogModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
      />

      {/* Operational Health & System Diagnostics Modal */}
      <OperationalHealthModal
        isOpen={isHealthModalOpen}
        onClose={() => setIsHealthModalOpen(false)}
      />

      {/* Organization Switcher & Creation Sheet */}
      <BottomSheet
        isOpen={isOrgModalOpen}
        onClose={() => setIsOrgModalOpen(false)}
        title="Organizations & Workspaces"
      >
        <div className="py-2 space-y-4">
          <div>
            <h4 className="text-[13px] font-semibold text-tx-primary mb-2">Your Organizations</h4>
            {organizations.length === 0 ? (
              <p className="text-[13px] text-tx-muted py-2">No organizations found.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto no-scrollbar">
                {organizations.map((org) => {
                  const isActive = organization?.id === org.id;
                  return (
                    <div
                      key={org.id}
                      onClick={() => {
                        switchOrganization(org.id);
                        setIsOrgModalOpen(false);
                      }}
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                        isActive 
                          ? 'bg-accent-primary/10 border-accent-primary' 
                          : 'bg-surface-neutral/50 border-bd-subtle hover:border-accent-primary/50'
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-[14px] text-tx-primary flex items-center gap-2">
                          <Building2 size={16} className="text-tx-secondary" />
                          {org.name}
                        </div>
                        <div className="text-[12px] text-tx-muted mt-0.5">{org.slug} • {org.currency}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-canvas border border-bd-subtle capitalize">
                          {org.role}
                        </span>
                        {isActive && <Check size={16} className="text-accent-primary" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Create New Organization */}
          <div className="pt-3 border-t border-bd-subtle space-y-2">
            <h4 className="text-[13px] font-semibold text-tx-primary">Create New Organization</h4>
            <input
              type="text"
              placeholder="e.g. Acme Studio"
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-surface-neutral border border-bd-subtle text-[14px] text-tx-primary outline-none focus:border-tx-primary"
            />
            <div className="flex gap-2">
              <select
                value={newOrgCurrency}
                onChange={(e) => setNewOrgCurrency(e.target.value)}
                className="px-3 py-2 rounded-xl bg-surface-neutral border border-bd-subtle text-[13px] text-tx-primary outline-none"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="ETB">Ethiopian Birr (ETB)</option>
              </select>
              <button
                onClick={handleCreateNewOrg}
                disabled={!newOrgName.trim()}
                className="flex-1 py-2 px-4 rounded-xl bg-tx-primary text-tx-inverse text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                Create Workspace
              </button>
            </div>
          </div>

          {/* Join Organization via Invitation Token */}
          <div className="pt-3 border-t border-bd-subtle space-y-2">
            <h4 className="text-[13px] font-semibold text-tx-primary">Join with Invitation Token</h4>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Paste invitation token here"
                value={inviteTokenInput}
                onChange={(e) => setInviteTokenInput(e.target.value)}
                className="flex-1 px-3 py-2.5 rounded-xl bg-surface-neutral border border-bd-subtle text-[13px] text-tx-primary outline-none focus:border-tx-primary font-mono"
              />
              <button
                onClick={handleAcceptInviteSubmit}
                disabled={isAcceptingInvite || !inviteTokenInput.trim()}
                className="py-2.5 px-4 rounded-xl bg-surface-neutral border border-bd-subtle text-tx-primary text-[13px] font-medium hover:bg-bd-subtle transition-colors disabled:opacity-50"
              >
                {isAcceptingInvite ? 'Joining...' : 'Join'}
              </button>
            </div>
          </div>
        </div>
      </BottomSheet>

      {/* Team Management & RBAC Sheet */}
      <BottomSheet
        isOpen={isTeamModalOpen}
        onClose={() => setIsTeamModalOpen(false)}
        title="Team & Access Control (RBAC)"
      >
        <div className="py-2 space-y-5">
          {/* Header Info */}
          <div className="flex items-center justify-between p-3 bg-surface-neutral/40 rounded-xl border border-bd-subtle">
            <div>
              <span className="text-[14px] font-semibold text-tx-primary">{organization?.name}</span>
              <p className="text-[12px] text-tx-muted mt-0.5">{teamMembers.length} active member(s)</p>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-canvas border border-bd-subtle capitalize">
              Your Role: {role}
            </span>
          </div>

          {/* Members List */}
          <div>
            <h4 className="text-[13px] font-semibold text-tx-primary mb-2">Organization Members</h4>
            {isLoadingTeam ? (
              <div className="py-6 text-center text-tx-muted text-sm flex items-center justify-center gap-2">
                <RefreshCw size={14} className="animate-spin" /> Loading members...
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto no-scrollbar">
                {teamMembers.map((member) => {
                  const isCurrent = member.userId === user?.uid || member.email === user?.email;
                  const canEdit = (role === 'owner' || role === 'admin') && !isCurrent;
                  return (
                    <div
                      key={member.membershipId}
                      className="p-3 bg-surface-neutral/50 rounded-xl border border-bd-subtle flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <img 
                          src={`https://api.dicebear.com/7.x/notionists/svg?seed=${member.avatarSeed || member.userId}`} 
                          alt="Avatar" 
                          className="w-9 h-9 rounded-full bg-surface-neutral"
                        />
                        <div>
                          <div className="text-[13px] font-semibold text-tx-primary flex items-center gap-1.5">
                            {member.name || member.email.split('@')[0]}
                            {isCurrent && <span className="text-[10px] text-tx-muted font-normal">(You)</span>}
                          </div>
                          <div className="text-[12px] text-tx-muted">{member.email}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {canEdit ? (
                          <select
                            value={member.role}
                            onChange={async (e) => {
                              const newRole = e.target.value as OrgRole;
                              await changeMemberRole(member.membershipId, newRole);
                              await loadTeamData();
                            }}
                            className="bg-canvas border border-bd-subtle rounded-lg px-2 py-1 text-[12px] text-tx-primary outline-none"
                          >
                            {role === 'owner' && <option value="owner">Owner</option>}
                            <option value="admin">Admin</option>
                            <option value="manager">Manager</option>
                            <option value="member">Member</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        ) : (
                          <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium border capitalize ${
                            member.role === 'owner' ? 'bg-amber-500/10 text-amber-600 border-amber-500/30' :
                            member.role === 'admin' ? 'bg-purple-500/10 text-purple-600 border-purple-500/30' :
                            member.role === 'manager' ? 'bg-blue-500/10 text-blue-600 border-blue-500/30' :
                            member.role === 'member' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' :
                            'bg-slate-500/10 text-slate-600 border-slate-500/30'
                          }`}>
                            {member.role}
                          </span>
                        )}

                        {canEdit && (
                          <button
                            onClick={async () => {
                              await removeMember(member.membershipId);
                              await loadTeamData();
                            }}
                            className="p-1.5 text-tx-muted hover:text-red-500 transition-colors"
                            title="Remove Member"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Invite New Team Member (Admins & Owners) */}
          {(role === 'owner' || role === 'admin') && (
            <div className="pt-3 border-t border-bd-subtle space-y-2">
              <h4 className="text-[13px] font-semibold text-tx-primary">Invite Team Member</h4>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="collaborator@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl bg-surface-neutral border border-bd-subtle text-[13px] text-tx-primary outline-none focus:border-tx-primary"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as OrgRole)}
                  className="px-2 py-2 rounded-xl bg-surface-neutral border border-bd-subtle text-[13px] text-tx-primary outline-none"
                >
                  {role === 'owner' && <option value="owner">Owner</option>}
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button
                  onClick={handleSendInvite}
                  disabled={!inviteEmail.trim()}
                  className="py-2 px-3 rounded-xl bg-tx-primary text-tx-inverse text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50 shrink-0 flex items-center gap-1.5"
                >
                  <UserPlus size={14} /> Invite
                </button>
              </div>

              {/* Pending Invitations */}
              {teamInvitations.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <span className="text-[12px] font-medium text-tx-muted">Pending Invitations ({teamInvitations.length})</span>
                  {teamInvitations.map((inv) => (
                    <div
                      key={inv.id}
                      className="p-2.5 bg-surface-neutral/40 rounded-xl border border-bd-subtle flex items-center justify-between text-[12px]"
                    >
                      <div>
                        <div className="font-medium text-tx-primary">{inv.email}</div>
                        <div className="text-tx-muted text-[11px]">Role: {inv.role} • Token: <span className="font-mono">{inv.token.slice(0, 10)}...</span></div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(inv.token);
                            showToast({ message: "Invitation token copied to clipboard" });
                          }}
                          className="p-1 text-tx-muted hover:text-tx-primary transition-colors"
                          title="Copy Token"
                        >
                          <Copy size={13} />
                        </button>
                        <button
                          onClick={async () => {
                            await revokeInvite(inv.id);
                            await loadTeamData();
                          }}
                          className="p-1 text-tx-muted hover:text-red-500 transition-colors"
                          title="Revoke Invitation"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* RBAC Role Matrix Guide */}
          <div className="p-3 bg-surface-neutral/30 rounded-xl border border-bd-subtle text-[11px] text-tx-muted space-y-1">
            <div className="font-semibold text-tx-primary text-[12px] mb-1">Role Permissions Matrix:</div>
            <div>• <strong className="text-tx-primary">Owner:</strong> Full ownership, billing, transfer, all settings.</div>
            <div>• <strong className="text-tx-primary">Admin:</strong> Team invitations, member role updates, organization settings.</div>
            <div>• <strong className="text-tx-primary">Manager:</strong> Client & project management, templates, task delegation.</div>
            <div>• <strong className="text-tx-primary">Member:</strong> Daily execution, tasks, time entries, notes, schedules.</div>
            <div>• <strong className="text-tx-primary">Viewer:</strong> Strict read-only access (no modifications permitted).</div>
          </div>
        </div>
      </BottomSheet>

      <DataMigrationModal
        isOpen={isMigrationModalOpen}
        onClose={() => setIsMigrationModalOpen(false)}
      />

      <ConfirmDialog
        isOpen={isClearDataOpen}
        onCancel={() => setIsClearDataOpen(false)}
        title="Clear All Data?"
        body="This will permanently delete all your clients, projects, tasks, and settings from this browser. This action cannot be undone."
        confirmLabel="Yes, delete everything"
        cancelLabel="Cancel"
        danger
        onConfirm={handleClearData}
      />
      
      <ConfirmDialog
        isOpen={isImportConfirmOpen}
        onCancel={() => {
          setIsImportConfirmOpen(false);
          setImportDataContent(null);
        }}
        title="Import Data?"
        body="This will overwrite your existing data. Are you sure you want to proceed?"
        confirmLabel="Yes, import data"
        cancelLabel="Cancel"
        danger
        onConfirm={confirmImport}
      />
    </div>
  );
}

