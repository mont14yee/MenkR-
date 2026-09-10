import { useState, useMemo } from 'react';
import { X, MoreVertical, Edit2, ChevronDown, Trash2 } from 'lucide-react';
import { Header, TabPill, ProgressBar } from '../components/Shared';
import { BottomSheet, BottomSheetField } from '../components/BottomSheet';
import { usePreferences } from '../context/PreferencesContext';
import { useToast } from '../context/ToastContext';
import { useRevenue } from '../context/RevenueContext';
import { useNavigation } from '../context/NavigationContext';
import { useProjects } from '../context/ProjectsContext';
import { useClients } from '../context/ClientsContext';
import { getRecentMonths, getMonthsForYear, getTodayDateStr } from '../utils/date';
import { formatCurrency, formatCurrencyCompact, getCurrencySymbol } from '../utils/currency';
import { SearchPicker } from '../components/SearchPicker';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { RevenueEntry } from '../types';

export function Finance({ onDismiss }: { onDismiss: () => void }) {
  const [tab, setTab] = useState<'Monthly' | 'Yearly'>('Monthly');
  
  const [isLogSheetOpen, setLogSheetOpen] = useState(false);
  const [isGoalSheetOpen, setGoalSheetOpen] = useState(false);
  const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  
  const [editingEntry, setEditingEntry] = useState<RevenueEntry | null>(null);

  const { preferences } = usePreferences();
    const { showToast } = useToast();
  const { revenues, yearlyGoal, addRevenue, updateRevenue, deleteRevenue, setYearlyGoal } = useRevenue();
  const { clients } = useClients();
  const { projects } = useProjects();
  const { navigationOptions, push, goToTab } = useNavigation();
  const filterProjectId = navigationOptions?.filterProjectId || '';
  const filterClientId = navigationOptions?.filterClientId || '';

  const [logForm, setLogForm] = useState({
    amount: '',
    clientOrProject: '',
    clientId: '',
    status: 'Paid' as 'Paid' | 'Pending' | 'Overdue',
    date: getTodayDateStr(),
  });

  const [goalForm, setGoalForm] = useState({
    amount: yearlyGoal.toString(),
    period: 'Yearly',
  });

  const overdueThresholdDays = preferences.overdueThresholdDays || 14;

  const effectiveRevenues = useMemo(() => {
    const today = new Date(getTodayDateStr());
    return revenues.map(r => {
      let status = r.status;
      if (status === 'Pending') {
        const entryDate = new Date(r.date);
        const diffTime = today.getTime() - entryDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > overdueThresholdDays) {
          status = 'Overdue';
        }
      }
      return { ...r, status };
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [revenues, overdueThresholdDays]);

  const handleOpenLogSheet = (entry?: RevenueEntry) => {
    if (entry) {
      setEditingEntry(entry);
      setLogForm({
        amount: entry.amount.toString(),
        clientOrProject: entry.clientOrProject,
        clientId: entry.clientId || '',
        status: entry.status,
        date: entry.date,
      });
    } else {
      setEditingEntry(null);
      setLogForm({
        amount: '',
        clientOrProject: '',
        clientId: '',
        status: 'Paid',
        date: getTodayDateStr(),
      });
    }
    setLogSheetOpen(true);
  };

  const handleSaveLog = () => {
    if (!logForm.amount) return;
    
    const entryData = {
      amount: Number(logForm.amount),
      clientOrProject: logForm.clientOrProject || 'General',
      clientId: logForm.clientId || undefined,
      status: logForm.status,
      date: logForm.date,
    };

    if (editingEntry) {
      updateRevenue(editingEntry.id, entryData);
      showToast({ message: 'Revenue updated' });
    } else {
      addRevenue(entryData);
      showToast({
        message: 'Revenue logged',
        actionLabel: 'Log another',
        onAction: () => {
          handleOpenLogSheet();
        },
      });
    }
    setLogSheetOpen(false);
  };

  const handleDeleteEntry = () => {
    if (editingEntry) {
      deleteRevenue(editingEntry.id);
      setDeleteConfirmOpen(false);
      setLogSheetOpen(false);
      showToast({ message: 'Revenue entry deleted' });
    }
  };

  const handleSaveGoal = () => {
    if (goalForm.amount) {
      setYearlyGoal(Number(goalForm.amount));
    }
    setGoalSheetOpen(false);
    showToast({ message: 'Goal updated' });
  };

  // Compute Revenue Stats
  const totalRevenue = useMemo(() => {
    return effectiveRevenues.filter(r => r.status === 'Paid').reduce((sum, r) => sum + r.amount, 0);
  }, [effectiveRevenues]);

  const earnedPct = Math.min(100, Math.round((totalRevenue / (yearlyGoal || 1)) * 100));
  const remainingPct = 100 - earnedPct;

  // Compute months
  const displayMonths = useMemo(() => {
    if (tab === 'Monthly') {
      return getRecentMonths(3).reverse();
    } else {
      return getMonthsForYear(new Date().getFullYear());
    }
  }, [tab]);

  const monthlyStats = useMemo(() => {
    const stats: Record<string, { total: number; overdue: number }> = {};
    
    effectiveRevenues.forEach(r => {
      const [y, m] = r.date.split('-');
      const key = `${parseInt(y, 10)}-${parseInt(m, 10) - 1}`;
      if (!stats[key]) stats[key] = { total: 0, overdue: 0 };
      if (r.status === 'Paid') stats[key].total += r.amount;
      if (r.status === 'Overdue') stats[key].overdue += r.amount;
    });

    return displayMonths.map(m => {
      const key = `${m.year}-${m.month}`;
      const stat = stats[key] || { total: 0, overdue: 0 };
      const pct = stat.total > 0 ? Math.round((stat.overdue / (stat.total + stat.overdue)) * 100) : 0;
      return { 
        month: m.label, 
        total: stat.total, 
        overduePct: pct,
        isCurrent: m.isCurrent
      };
    });
  }, [effectiveRevenues, displayMonths]);

  const maxMonthly = Math.max(...monthlyStats.map(m => m.total), 1);

  return (
    <div className="absolute inset-0 bg-canvas z-50 flex flex-col overflow-y-auto no-scrollbar pb-10">
      <Header
        leftIcon={
          <button onClick={onDismiss} className="w-11 h-11 rounded-full bg-surface-neutral flex items-center justify-center text-tx-primary active:opacity-80" aria-label="Close">
            <X size={20} />
          </button>
        }
        title="Finance Overview"
      />

      <div className="px-5 mt-2 mb-6">
        <div className="flex bg-surface-neutral rounded-full p-1 w-full max-w-[240px]">
          {['Monthly', 'Yearly'].map((opt) => (
            <button
              key={opt}
              onClick={() => setTab(opt as 'Monthly' | 'Yearly')}
              className={`flex-1 py-2 text-center text-[14px] font-medium rounded-full transition-colors ${
                tab === opt ? 'bg-canvas text-tx-primary shadow-sm' : 'text-tx-muted'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 flex flex-col gap-4 mb-8">
        <div className="bg-tx-primary rounded-[24px] p-6 text-tx-inverse">
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="text-[14px] text-tx-inverse/70 mb-1">MenkiR Revenue</div>
              <div className="text-[36px] font-light leading-none">{formatCurrencyCompact(totalRevenue, preferences.currency)}</div>
            </div>
            <button onClick={() => handleOpenLogSheet()} className="w-10 h-10 rounded-full bg-tx-inverse/10 flex items-center justify-center active:opacity-80" aria-label="Log revenue">
              <Edit2 size={18} />
            </button>
          </div>

          <div className="flex flex-col gap-4">
            {monthlyStats.map((mStat, idx) => {
              const widthPct = Math.max(10, Math.round((mStat.total / maxMonthly) * 100));
              
              return (
                <div key={idx} className="flex items-center gap-4">
                  <div className={`w-12 text-[13px] ${mStat.isCurrent ? 'font-medium' : 'text-tx-inverse/70'}`}>{mStat.month}</div>
                  <div 
                    className={`h-10 rounded-r-lg flex items-center justify-between px-3 text-[14px] font-medium transition-all ${
                      mStat.isCurrent ? 'bg-accent-primary text-tx-primary' : 'bg-surface-muted text-tx-primary'
                    }`}
                    style={{ width: `${widthPct}%`, minWidth: '80px' }}
                  >
                    <span>{mStat.isCurrent && 'Rev '}{formatCurrencyCompact(mStat.total, preferences.currency)}</span>
                    {mStat.overduePct > 0 && <span className="text-[12px] opacity-80 pl-2">Overdue {mStat.overduePct}%</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {tab === 'Yearly' && (
          <div className="bg-surface-neutral rounded-[24px] p-6">
            <div className="flex justify-between items-center mb-1">
              <div className="text-[14px] text-tx-muted">Yearly Revenue Goal</div>
              <button onClick={() => { setGoalForm({ ...goalForm, amount: yearlyGoal.toString() }); setGoalSheetOpen(true); }} className="active:opacity-80" aria-label="Set yearly goal">
                <ChevronDown size={20} className="text-tx-muted" />
              </button>
            </div>
            <div className="text-[36px] font-light text-tx-primary leading-none mb-6">{formatCurrencyCompact(yearlyGoal, preferences.currency)}</div>
            
            <ProgressBar progress={earnedPct} tone="lime" />
            
            <div className="flex justify-between items-center mt-3 text-[13px]">
              <span className="text-tx-primary font-medium text-[13px]">Revenue goal {earnedPct >= 100 ? 'Achieved' : 'not Achieved'}</span>
              <span className="text-tx-muted">{remainingPct}%</span>
            </div>
            
            <div className="mt-8">
              <div className="text-[13px] text-tx-muted mb-2">Earned {earnedPct}%</div>
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: 40 }).map((_, i) => (
                  <div key={i} className={`w-2 h-2 rounded-full ${i < Math.floor((earnedPct/100) * 40) ? 'bg-accent-primary' : 'bg-canvas'}`} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="px-5">
        <h3 className="text-[17px] font-medium text-tx-primary mb-4">Recent Entries</h3>
        <div className="flex flex-col gap-3">
          {effectiveRevenues.map(r => (
            <button 
              key={r.id} 
              onClick={() => handleOpenLogSheet(r)}
              className="bg-surface-neutral rounded-xl px-4 py-3 flex items-center justify-between active:opacity-80 transition-opacity text-left"
            >
              <div>
                <div className="text-[15px] font-medium text-tx-primary mb-0.5">{formatCurrency(r.amount, preferences.currency)}</div>
                <div className="text-[13px] text-tx-muted flex items-center gap-1.5">
                  {r.clientOrProject || 'General'}
                  <span className="w-1 h-1 rounded-full bg-bd-subtle" />
                  {new Date(r.date + 'T00:00:00').toLocaleDateString()}
                </div>
              </div>
              <div className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${
                r.status === 'Paid' ? 'bg-accent-primary/20 text-tx-primary' :
                r.status === 'Overdue' ? 'bg-red-500/10 text-red-500' :
                'bg-surface-muted text-tx-muted'
              }`}>
                {r.status}
              </div>
            </button>
          ))}
          {effectiveRevenues.length === 0 && (
            <div className="text-center text-[14px] text-tx-muted py-6">No revenue logged yet.</div>
          )}
        </div>
      </div>

      <BottomSheet
        isOpen={isLogSheetOpen}
        onClose={() => setLogSheetOpen(false)}
        title={editingEntry ? 'Edit Revenue' : 'Log Revenue'}
        onSave={handleSaveLog}
      >
        <BottomSheetField>
          <div className="flex items-center text-[28px] font-light text-tx-primary">
            <span className="text-tx-muted mr-1">{getCurrencySymbol(preferences.currency)}</span>
            <input
              type="number"
              placeholder="0.00"
              value={logForm.amount}
              onChange={(e) => setLogForm({ ...logForm, amount: e.target.value })}
              className="w-full bg-transparent outline-none py-2"
              autoFocus
            />
          </div>
        </BottomSheetField>
        
        <BottomSheetField label="Client (Optional)">
          <SearchPicker
            items={clients.map(c => ({ id: c.id, label: c.name }))}
            value={logForm.clientId}
            onChange={(id) => setLogForm(f => ({ ...f, clientId: id }))}
            
          />
        </BottomSheetField>

        <BottomSheetField label="Description / Project">
          <input 
            type="text" 
            placeholder="What is this for?" 
            value={logForm.clientOrProject}
            onChange={e => setLogForm({ ...logForm, clientOrProject: e.target.value })}
            className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none text-[15px] outline-none" 
          />
        </BottomSheetField>

        <BottomSheetField label="Status">
          <div className="flex bg-surface-neutral rounded-full p-1 w-full">
            {['Paid', 'Pending', 'Overdue'].map((opt) => (
              <button
                key={opt}
                onClick={() => setLogForm({ ...logForm, status: opt as any })}
                className={`flex-1 py-2 text-center text-[14px] font-medium rounded-full transition-colors ${
                  logForm.status === opt ? 'bg-canvas text-tx-primary shadow-sm' : 'text-tx-muted'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </BottomSheetField>
        
        <BottomSheetField label="Date">
          <input 
            type="date" 
            value={logForm.date}
            onChange={e => setLogForm({ ...logForm, date: e.target.value })}
            className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none text-[15px] outline-none" 
          />
        </BottomSheetField>

        {editingEntry && (
          <button 
            onClick={() => setDeleteConfirmOpen(true)}
            className="w-full py-3 mt-4 rounded-xl border border-red-500/20 text-red-500 font-medium text-[15px] flex justify-center items-center gap-2"
          >
            <Trash2 size={18} />
            Delete Entry
          </button>
        )}
        {editingEntry && (
          <div className="pt-4 mt-4 border-t border-bd-subtle">
            <h4 className="text-[13px] font-bold text-tx-muted uppercase tracking-wider mb-3">Related</h4>
            <div className="grid grid-cols-2 gap-3">
              {editingEntry.projectId && (
                <button onClick={() => { setLogSheetOpen(false); goToTab('projects', { filterProjectId: editingEntry.projectId }); }} className="flex items-center gap-2 p-3 bg-surface-neutral/30 rounded-xl border border-bd-subtle hover:border-accent-primary/50 transition-colors">
                  <span className="text-[14px] font-medium text-tx-primary">View Project</span>
                </button>
              )}
            </div>
          </div>
        )}
      </BottomSheet>

      <BottomSheet
        isOpen={isGoalSheetOpen}
        onClose={() => setGoalSheetOpen(false)}
        title="Edit Goal"
        onSave={handleSaveGoal}
      >
        <BottomSheetField>
          <div className="flex items-center text-[28px] font-light text-tx-primary">
            <span className="text-tx-muted mr-1">{getCurrencySymbol(preferences.currency)}</span>
            <input
              type="number"
              placeholder="0"
              value={goalForm.amount}
              onChange={(e) => setGoalForm({ ...goalForm, amount: e.target.value })}
              className="w-full bg-transparent outline-none py-2"
              autoFocus
            />
          </div>
        </BottomSheetField>
        
        <BottomSheetField label="Period">
          <select 
            value={goalForm.period}
            onChange={(e) => setGoalForm({ ...goalForm, period: e.target.value })}
            className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none text-[15px] outline-none"
          >
            <option>Monthly</option>
            <option>Yearly</option>
            <option>Custom</option>
          </select>
        </BottomSheetField>
        {editingEntry && (
          <div className="pt-4 mt-4 border-t border-bd-subtle">
            <h4 className="text-[13px] font-bold text-tx-muted uppercase tracking-wider mb-3">Related</h4>
            <div className="grid grid-cols-2 gap-3">
              {editingEntry.projectId && (
                <button onClick={() => { setLogSheetOpen(false); goToTab('projects', { filterProjectId: editingEntry.projectId }); }} className="flex items-center gap-2 p-3 bg-surface-neutral/30 rounded-xl border border-bd-subtle hover:border-accent-primary/50 transition-colors">
                  <span className="text-[14px] font-medium text-tx-primary">View Project</span>
                </button>
              )}
            </div>
          </div>
        )}
      </BottomSheet>

      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteEntry}
        title="Delete Revenue Entry"
        body="Are you sure you want to delete this revenue record? This cannot be undone."
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}

