import { getTodayDateStr } from "../utils/date";
import React, { useState, useRef } from 'react';
import { X, MoreVertical, Sparkles, User, Signal, Palette, Landmark, Settings2, ChevronLeft, Trash2, Download, Upload, AlertCircle } from 'lucide-react';
import { Header, ListRow, CircularProgress } from '../components/Shared';
import { usePreferences } from '../context/PreferencesContext';
import { useProfile } from '../context/ProfileContext';
import { BottomSheet, BottomSheetField } from '../components/BottomSheet';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { generateId } from '../utils/id';
import { useToast } from '../context/ToastContext';

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
    if (!newCategoryName.trim()) return;
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
          <h3 className="text-[13px] font-medium text-tx-muted mb-3 uppercase tracking-wider">Defaults</h3>
          <div className="flex flex-col gap-4">
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
  
  const [activeScreen, setActiveScreen] = useState<'main' | 'preferences'>('main');
  const [isComingSoonOpen, setIsComingSoonOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isClearDataOpen, setIsClearDataOpen] = useState(false);
  const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false);
  const [importDataContent, setImportDataContent] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profileForm, setProfileForm] = useState({ name, email, businessName });

  const handleSaveProfile = () => {
    updateProfile(profileForm);
    setIsProfileOpen(false);
  };

  const handleExportData = () => {
    const data: Record<string, any> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('menkir-')) {
        data[key] = localStorage.getItem(key);
      }
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `menkir-backup-${getTodayDateStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast({ message: 'Data exported successfully' });
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

  const settings = [
    { icon: <Sparkles size={20} className="text-tx-primary" />, title: 'MenkiR AI', subtitle: 'Manage AI settings', onClick: () => setIsComingSoonOpen(true) },
    { icon: <User size={20} className="text-tx-primary" />, title: 'Account Details', subtitle: 'Update info, website, description', onClick: () => { setProfileForm({ name, email, businessName }); setIsProfileOpen(true); } },
    { icon: <Signal size={20} className="text-tx-primary" />, title: 'Subscription Plan', subtitle: 'Get the right plan for your business', onClick: () => setIsComingSoonOpen(true) },
    { icon: <Palette size={20} className="text-tx-primary" />, title: 'Brand Elements', subtitle: 'Add your brand to invoice, emails', onClick: () => setIsComingSoonOpen(true) },
    { icon: <Landmark size={20} className="text-tx-primary" />, title: 'Bank Account', subtitle: 'Add an account to receive payments', onClick: () => setIsComingSoonOpen(true) },
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
          <button className="w-11 h-11 rounded-full bg-surface-neutral flex items-center justify-center text-tx-primary" aria-label="More options">
            <MoreVertical size={20} />
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

        <div className="mt-4 pt-6 border-t border-bd-subtle">
          <h3 className="text-[13px] font-medium text-tx-muted mb-4 uppercase tracking-wider">Data Management</h3>
          <div className="flex flex-col gap-2">
            <button onClick={handleExportData} className="flex items-center gap-3 p-3 bg-surface-neutral rounded-xl hover:opacity-80 transition-opacity">
              <Download size={18} className="text-tx-primary" />
              <div className="flex flex-col text-left">
                <span className="text-[15px] font-medium text-tx-primary">Export Data</span>
                <span className="text-[12px] text-tx-muted">Download all app data as a JSON backup</span>
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

      <BottomSheet
        isOpen={isComingSoonOpen}
        onClose={() => setIsComingSoonOpen(false)}
        title="Coming Soon"
      >
        <div className="py-6 text-center text-tx-muted text-[15px]">
          This feature is currently under development. Stay tuned for future updates!
        </div>
        <button onClick={() => setIsComingSoonOpen(false)} className="w-full py-4 rounded-full bg-accent-primary text-tx-primary text-[15px] font-medium mt-4">
          Got it
        </button>
      </BottomSheet>

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

