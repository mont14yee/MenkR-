import { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  Edit2, 
  ChevronDown, 
  Trash2, 
  Download, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Briefcase, 
  User, 
  Calendar, 
  Clock, 
  ShieldAlert, 
  History, 
  Info, 
  Plus, 
  Filter, 
  Layers 
} from 'lucide-react';
import { Header, ProgressBar } from '../components/Shared';
import { BottomSheet, BottomSheetField } from '../components/BottomSheet';
import { usePreferences } from '../context/PreferencesContext';
import { useToast } from '../context/ToastContext';
import { useRevenue } from '../context/RevenueContext';
import { useNavigation } from '../context/NavigationContext';
import { useProjects } from '../context/ProjectsContext';
import { useClients } from '../context/ClientsContext';
import { useTimeTracker } from '../context/TimeTrackerContext';
import { useAuth } from '../context/AuthContext';
import { getRecentMonths, getMonthsForYear, getTodayDateStr } from '../utils/date';
import { formatCurrency, formatCurrencyCompact, getCurrencySymbol } from '../utils/currency';
import { SearchPicker } from '../components/SearchPicker';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { RevenueEntry, FinancialRecordType } from '../types';

export const INCOME_CATEGORIES = ['Services', 'Retainer', 'Milestone', 'Advisory', 'Consulting', 'Other'] as const;
export const EXPENSE_CATEGORIES = ['Software & SaaS', 'Contractors', 'Hardware', 'Office & Facilities', 'Travel', 'Subcontractor', 'Other'] as const;

type DateRangePreset = 'this-month' | 'last-month' | 'this-quarter' | 'this-year' | 'all' | 'custom';
type FinanceMainTab = 'ledger' | 'summary-project' | 'summary-client' | 'budgets-wip' | 'audit';

export function Finance({ onDismiss }: { onDismiss: () => void }) {
  const [tab, setTab] = useState<'Monthly' | 'Yearly'>('Monthly');
  const [mainView, setMainView] = useState<FinanceMainTab>('ledger');
  const [recordTypeFilter, setRecordTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const [isLogSheetOpen, setLogSheetOpen] = useState(false);
  const [isGoalSheetOpen, setGoalSheetOpen] = useState(false);
  const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<RevenueEntry | null>(null);

  const { preferences } = usePreferences();
  const { showToast } = useToast();
  const { revenues, yearlyGoal, addRevenue, updateRevenue, deleteRevenue, setYearlyGoal, exportLedgerCSV } = useRevenue();
  const { clients } = useClients();
  const { projects } = useProjects();
  const { timeEntries } = useTimeTracker();
  const { role, idToken, organization } = useAuth();
  const { navigationOptions, goToTab } = useNavigation();

  const filterProjectId = navigationOptions?.filterProjectId || '';
  const filterClientId = navigationOptions?.filterClientId || '';

  const isViewer = role === 'viewer';

  // Audit Events state
  const [auditEvents, setAuditEvents] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Form State
  const [logForm, setLogForm] = useState({
    type: 'income' as FinancialRecordType,
    amount: '',
    clientOrProject: '',
    category: 'Services',
    clientId: filterClientId,
    projectId: filterProjectId,
    status: 'Paid' as 'Paid' | 'Pending' | 'Overdue',
    date: getTodayDateStr(),
    invoiceNumber: '',
    receiptReference: '',
    notes: '',
  });

  const [goalForm, setGoalForm] = useState({
    amount: yearlyGoal.toString(),
    period: 'Yearly',
  });

  const overdueThresholdDays = preferences.overdueThresholdDays || 14;

  // Date Range Bounds calculation
  const { startDateStr, endDateStr, dateRangeLabel } = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    if (dateRangePreset === 'this-month') {
      const start = new Date(y, m, 1).toISOString().split('T')[0];
      const end = new Date(y, m + 1, 0).toISOString().split('T')[0];
      return { startDateStr: start, endDateStr: end, dateRangeLabel: `This Month (${start} – ${end})` };
    }
    if (dateRangePreset === 'last-month') {
      const start = new Date(y, m - 1, 1).toISOString().split('T')[0];
      const end = new Date(y, m, 0).toISOString().split('T')[0];
      return { startDateStr: start, endDateStr: end, dateRangeLabel: `Last Month (${start} – ${end})` };
    }
    if (dateRangePreset === 'this-quarter') {
      const qStartMonth = Math.floor(m / 3) * 3;
      const start = new Date(y, qStartMonth, 1).toISOString().split('T')[0];
      const end = new Date(y, qStartMonth + 3, 0).toISOString().split('T')[0];
      return { startDateStr: start, endDateStr: end, dateRangeLabel: `This Quarter (${start} – ${end})` };
    }
    if (dateRangePreset === 'this-year') {
      const start = `${y}-01-01`;
      const end = `${y}-12-31`;
      return { startDateStr: start, endDateStr: end, dateRangeLabel: `This Year (${y})` };
    }
    if (dateRangePreset === 'custom' && customStartDate && customEndDate) {
      return { startDateStr: customStartDate, endDateStr: customEndDate, dateRangeLabel: `${customStartDate} – ${customEndDate}` };
    }
    return { startDateStr: '', endDateStr: '', dateRangeLabel: 'All Recorded Time' };
  }, [dateRangePreset, customStartDate, customEndDate]);

  // Filtered & Status-Evaluated Revenues
  const effectiveRevenues = useMemo(() => {
    const today = new Date(getTodayDateStr());
    return revenues
      .map((r) => {
        let status = r.status;
        const isExpense = r.type === 'expense';
        if (!isExpense && status === 'Pending') {
          const entryDate = new Date(r.date);
          const diffTime = today.getTime() - entryDate.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays > overdueThresholdDays) {
            status = 'Overdue';
          }
        }
        return { ...r, status, type: r.type || 'income' };
      })
      .filter((r) => {
        if (recordTypeFilter !== 'all' && r.type !== recordTypeFilter) return false;
        if (startDateStr && r.date < startDateStr) return false;
        if (endDateStr && r.date > endDateStr) return false;
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [revenues, overdueThresholdDays, recordTypeFilter, startDateStr, endDateStr]);

  // Compute Separate Actual Ledger Stats
  const ledgerMetrics = useMemo(() => {
    let realizedIncome = 0;
    let pendingIncome = 0;
    let overdueIncome = 0;
    let realizedExpenses = 0;
    let pendingExpenses = 0;

    for (const r of effectiveRevenues) {
      const amt = Number(r.amount) || 0;
      if (r.type === 'expense') {
        if (r.status === 'Paid') realizedExpenses += amt;
        else pendingExpenses += amt;
      } else {
        if (r.status === 'Paid') realizedIncome += amt;
        else if (r.status === 'Overdue') overdueIncome += amt;
        else pendingIncome += amt;
      }
    }

    return {
      realizedIncome: Math.round(realizedIncome * 100) / 100,
      pendingIncome: Math.round(pendingIncome * 100) / 100,
      overdueIncome: Math.round(overdueIncome * 100) / 100,
      realizedExpenses: Math.round(realizedExpenses * 100) / 100,
      pendingExpenses: Math.round(pendingExpenses * 100) / 100,
      netOperatingMargin: Math.round((realizedIncome - realizedExpenses) * 100) / 100,
    };
  }, [effectiveRevenues]);

  // Project Time Tracking & WIP Projections (Strictly only when hourly rate > 0 and billable === true)
  const projectWIPProjections = useMemo(() => {
    const map: Record<string, { totalHours: number; billableHours: number; calculatedWIPAmount: number }> = {};
    for (const entry of timeEntries) {
      if (!entry.projectId) continue;
      if (!map[entry.projectId]) {
        map[entry.projectId] = { totalHours: 0, billableHours: 0, calculatedWIPAmount: 0 };
      }
      const hrs = entry.durationSeconds / 3600;
      map[entry.projectId].totalHours += hrs;

      if (entry.billable) {
        map[entry.projectId].billableHours += hrs;
        const project = projects.find((p) => p.id === entry.projectId);
        const effectiveRate = entry.hourlyRate != null ? entry.hourlyRate : (project?.hourlyRate || 0);
        if (effectiveRate > 0) {
          map[entry.projectId].calculatedWIPAmount += hrs * effectiveRate;
        }
      }
    }
    return map;
  }, [timeEntries, projects]);

  // Project Summaries Table
  const projectSummaries = useMemo(() => {
    return projects.map((p) => {
      const client = clients.find((c) => c.id === p.clientId);
      const wip = projectWIPProjections[p.id] || { totalHours: 0, billableHours: 0, calculatedWIPAmount: 0 };

      // Actual realized revenues for this project
      const projRevenues = effectiveRevenues.filter((r) => r.projectId === p.id);
      const paidIncome = projRevenues.filter((r) => r.type !== 'expense' && r.status === 'Paid').reduce((sum, r) => sum + r.amount, 0);
      const pendingIncome = projRevenues.filter((r) => r.type !== 'expense' && r.status !== 'Paid').reduce((sum, r) => sum + r.amount, 0);
      const paidExpenses = projRevenues.filter((r) => r.type === 'expense' && r.status === 'Paid').reduce((sum, r) => sum + r.amount, 0);

      const budget = p.budget || 0;
      const budgetVariance = budget > 0 ? Math.round((budget - (paidExpenses + wip.calculatedWIPAmount)) * 100) / 100 : null;
      const budgetUtilizationPct = budget > 0 ? Math.min(100, Math.round(((paidExpenses + wip.calculatedWIPAmount) / budget) * 100)) : null;

      return {
        project: p,
        clientName: client?.name || 'Internal / Unassigned',
        budget,
        hourlyRate: p.hourlyRate || 0,
        paidIncome: Math.round(paidIncome * 100) / 100,
        pendingIncome: Math.round(pendingIncome * 100) / 100,
        paidExpenses: Math.round(paidExpenses * 100) / 100,
        totalHours: Math.round(wip.totalHours * 10) / 10,
        billableHours: Math.round(wip.billableHours * 10) / 10,
        calculatedWIPAmount: Math.round(wip.calculatedWIPAmount * 100) / 100,
        budgetVariance,
        budgetUtilizationPct,
      };
    });
  }, [projects, clients, projectWIPProjections, effectiveRevenues]);

  // Client Summaries Table
  const clientSummaries = useMemo(() => {
    return clients.map((c) => {
      const clientProjects = projects.filter((p) => p.clientId === c.id);
      const projIds = new Set(clientProjects.map((p) => p.id));

      const clientRevs = effectiveRevenues.filter((r) => r.clientId === c.id || (r.projectId && projIds.has(r.projectId)));
      const paidIncome = clientRevs.filter((r) => r.type !== 'expense' && r.status === 'Paid').reduce((sum, r) => sum + r.amount, 0);
      const pendingIncome = clientRevs.filter((r) => r.type !== 'expense' && r.status !== 'Paid').reduce((sum, r) => sum + r.amount, 0);

      let trackedHours = 0;
      let wipValue = 0;
      projIds.forEach((pId) => {
        const wip = projectWIPProjections[pId];
        if (wip) {
          trackedHours += wip.totalHours;
          wipValue += wip.calculatedWIPAmount;
        }
      });

      return {
        client: c,
        projectsCount: clientProjects.length,
        paidIncome: Math.round(paidIncome * 100) / 100,
        pendingIncome: Math.round(pendingIncome * 100) / 100,
        trackedHours: Math.round(trackedHours * 10) / 10,
        wipValue: Math.round(wipValue * 100) / 100,
      };
    });
  }, [clients, projects, effectiveRevenues, projectWIPProjections]);

  // Category Breakdown
  const categoryBreakdown = useMemo(() => {
    const incomeCats: Record<string, number> = {};
    const expenseCats: Record<string, number> = {};

    effectiveRevenues.forEach((r) => {
      const cat = r.category || 'Other';
      if (r.type === 'expense') {
        expenseCats[cat] = (expenseCats[cat] || 0) + r.amount;
      } else {
        incomeCats[cat] = (incomeCats[cat] || 0) + r.amount;
      }
    });

    return { incomeCats, expenseCats };
  }, [effectiveRevenues]);

  // Monthly breakdown for bar chart
  const displayMonths = useMemo(() => {
    if (tab === 'Monthly') {
      return getRecentMonths(3).reverse();
    } else {
      return getMonthsForYear(new Date().getFullYear());
    }
  }, [tab]);

  const monthlyStats = useMemo(() => {
    const stats: Record<string, { income: number; expense: number; overdue: number }> = {};

    effectiveRevenues.forEach((r) => {
      const [y, m] = r.date.split('-');
      if (!y || !m) return;
      const key = `${parseInt(y, 10)}-${parseInt(m, 10) - 1}`;
      if (!stats[key]) stats[key] = { income: 0, expense: 0, overdue: 0 };
      if (r.type === 'expense') {
        if (r.status === 'Paid') stats[key].expense += r.amount;
      } else {
        if (r.status === 'Paid') stats[key].income += r.amount;
        if (r.status === 'Overdue') stats[key].overdue += r.amount;
      }
    });

    return displayMonths.map((m) => {
      const key = `${m.year}-${m.month}`;
      const stat = stats[key] || { income: 0, expense: 0, overdue: 0 };
      const pct = stat.income > 0 ? Math.round((stat.overdue / (stat.income + stat.overdue)) * 100) : 0;
      return {
        month: m.label,
        total: stat.income,
        expense: stat.expense,
        overduePct: pct,
        isCurrent: m.isCurrent,
      };
    });
  }, [effectiveRevenues, displayMonths]);

  const maxMonthly = Math.max(...monthlyStats.map((m) => Math.max(m.total, m.expense)), 1);

  // Fetch Audit History
  useEffect(() => {
    if (mainView === 'audit' && organization?.id) {
      setLoadingAudit(true);
      const token = idToken || localStorage.getItem('menkir-auth-token') || '';
      fetch(`/api/audit-events?entityType=financial_record&limit=50`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-organization-id': organization.id,
        },
      })
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          setAuditEvents(Array.isArray(data) ? data : []);
          setLoadingAudit(false);
        })
        .catch(() => {
          setLoadingAudit(false);
        });
    }
  }, [mainView, organization?.id, idToken]);

  // Form Handlers
  const handleOpenLogSheet = (entry?: RevenueEntry, defaultType: FinancialRecordType = 'income') => {
    if (isViewer) {
      showToast({ message: 'Viewer role has read-only access' });
      return;
    }
    if (entry) {
      setEditingEntry(entry);
      setLogForm({
        type: entry.type || 'income',
        amount: entry.amount.toString(),
        clientOrProject: entry.clientOrProject || '',
        category: entry.category || (entry.type === 'expense' ? 'Software & SaaS' : 'Services'),
        clientId: entry.clientId || '',
        projectId: entry.projectId || '',
        status: entry.status,
        date: entry.date,
        invoiceNumber: entry.invoiceNumber || '',
        receiptReference: entry.receiptReference || '',
        notes: entry.notes || '',
      });
    } else {
      setEditingEntry(null);
      setLogForm({
        type: defaultType,
        amount: '',
        clientOrProject: '',
        category: defaultType === 'expense' ? 'Software & SaaS' : 'Services',
        clientId: filterClientId,
        projectId: filterProjectId,
        status: 'Paid',
        date: getTodayDateStr(),
        invoiceNumber: '',
        receiptReference: '',
        notes: '',
      });
    }
    setLogSheetOpen(true);
  };

  const handleSaveLog = () => {
    if (isViewer) {
      showToast({ message: 'Viewer role has read-only access' });
      return;
    }

    const parsedAmount = parseFloat(logForm.amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      showToast({ message: 'Please enter a valid amount greater than 0' });
      return;
    }

    const entryData = {
      type: logForm.type,
      amount: parsedAmount,
      category: logForm.category,
      clientOrProject: logForm.clientOrProject || (logForm.type === 'expense' ? 'General Expense' : 'General Revenue'),
      clientId: logForm.clientId || undefined,
      projectId: logForm.projectId || undefined,
      status: logForm.status,
      date: logForm.date || getTodayDateStr(),
      invoiceNumber: logForm.invoiceNumber || undefined,
      receiptReference: logForm.receiptReference || undefined,
      notes: logForm.notes || undefined,
    };

    if (editingEntry) {
      const res = updateRevenue(editingEntry.id, entryData);
      if (!res.success) {
        showToast({ message: res.error || 'Failed to update record' });
        return;
      }
      showToast({ message: `${logForm.type === 'expense' ? 'Expense' : 'Revenue'} updated` });
    } else {
      const res = addRevenue(entryData);
      if (!res.success) {
        showToast({ message: res.error || 'Failed to record entry' });
        return;
      }
      showToast({
        message: `${logForm.type === 'expense' ? 'Expense recorded' : 'Revenue logged'}`,
        actionLabel: 'Log another',
        onAction: () => handleOpenLogSheet(undefined, logForm.type),
      });
    }
    setLogSheetOpen(false);
  };

  const handleDeleteEntry = () => {
    if (isViewer) {
      showToast({ message: 'Viewer role has read-only access' });
      return;
    }
    if (editingEntry) {
      deleteRevenue(editingEntry.id);
      setDeleteConfirmOpen(false);
      setLogSheetOpen(false);
      showToast({ message: 'Financial record deleted' });
    }
  };

  const handleSaveGoal = () => {
    if (isViewer) {
      showToast({ message: 'Viewer role has read-only access' });
      return;
    }
    const parsedGoal = parseFloat(goalForm.amount);
    if (isNaN(parsedGoal) || parsedGoal <= 0) {
      showToast({ message: 'Please enter a valid goal greater than 0' });
      return;
    }
    setYearlyGoal(parsedGoal);
    setGoalSheetOpen(false);
    showToast({ message: 'Annual target updated' });
  };

  const handleExportCSV = () => {
    const clientsMap: Record<string, string> = {};
    clients.forEach((c) => (clientsMap[c.id] = c.name));
    const projectsMap: Record<string, string> = {};
    projects.forEach((p) => (projectsMap[p.id] = p.name));

    const csvData = exportLedgerCSV(clientsMap, projectsMap, preferences.currency);
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', `menkir-financial-ledger-${getTodayDateStr()}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast({ message: 'Financial ledger CSV exported' });
  };

  // Yearly Goal Pacing
  const earnedPct = Math.min(100, Math.round((ledgerMetrics.realizedIncome / (yearlyGoal || 1)) * 100));
  const remainingPct = 100 - earnedPct;

  return (
    <div className="absolute inset-0 bg-canvas z-50 flex flex-col overflow-y-auto no-scrollbar pb-16">
      <Header
        leftIcon={
          <button
            onClick={onDismiss}
            className="w-11 h-11 rounded-full bg-surface-neutral flex items-center justify-center text-tx-primary hover:bg-surface-hover active:opacity-80 transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        }
        title="Finance & Budget Ledger"
        rightIcon={
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="w-11 h-11 rounded-full bg-surface-neutral flex items-center justify-center text-tx-primary hover:bg-surface-hover transition-colors"
              aria-label="Export Ledger CSV"
              title="Export Ledger to CSV"
            >
              <Download size={18} />
            </button>
            <button
              onClick={() => handleOpenLogSheet(undefined, 'income')}
              disabled={isViewer}
              className={`w-11 h-11 rounded-full bg-tx-primary text-tx-inverse flex items-center justify-center shadow-xs transition-transform active:scale-95 ${
                isViewer ? 'opacity-40 cursor-not-allowed' : 'hover:opacity-90'
              }`}
              aria-label="Log revenue"
              title="Record Revenue or Expense"
            >
              <Plus size={20} />
            </button>
          </div>
        }
      />

      {/* Honest Regulatory Compliance Disclaimer Banner */}
      <div className="mx-5 mb-5 p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-2xl flex items-start gap-2.5 text-xs text-amber-950 dark:text-amber-200">
        <Info size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-semibold">Operational Tracking Notice:</span> MenkR- provides operational project billing, time-based cost estimates, and internal revenue tracking. It does not replace a certified general ledger accounting system, statutory tax preparation, or payroll compliance software.
        </div>
      </div>

      {/* Active Filter Scope Bar */}
      <div className="px-5 mb-5">
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-canvas-card border border-bd-subtle rounded-2xl shadow-xs text-xs">
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-tx-muted" />
            <span className="font-medium text-tx-primary">{dateRangeLabel}</span>
            <span className="text-tx-muted">•</span>
            <span className="font-mono text-tx-secondary font-semibold">
              Currency: {preferences.currency} ({getCurrencySymbol(preferences.currency)})
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <select
              value={dateRangePreset}
              onChange={(e) => setDateRangePreset(e.target.value as any)}
              className="bg-surface-neutral border border-bd-subtle rounded-lg px-2.5 py-1 text-xs text-tx-primary outline-none font-medium"
            >
              <option value="all">All Dates</option>
              <option value="this-month">This Month</option>
              <option value="last-month">Last Month</option>
              <option value="this-quarter">This Quarter</option>
              <option value="this-year">This Year</option>
              <option value="custom">Custom Date Range</option>
            </select>

            {dateRangePreset === 'custom' && (
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-surface-neutral border border-bd-subtle rounded-lg px-2 py-1 text-[11px] text-tx-primary outline-none"
                />
                <span className="text-tx-muted">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-surface-neutral border border-bd-subtle rounded-lg px-2 py-1 text-[11px] text-tx-primary outline-none"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <div className="px-5 mb-6">
        <div className="flex bg-surface-neutral p-1 rounded-2xl border border-bd-subtle overflow-x-auto no-scrollbar gap-1">
          {[
            { id: 'ledger', label: 'Ledger Records' },
            { id: 'summary-project', label: 'By Project' },
            { id: 'summary-client', label: 'By Client' },
            { id: 'budgets-wip', label: 'Budgets & Projections' },
            { id: 'audit', label: 'Audit History' },
          ].map((tabItem) => (
            <button
              key={tabItem.id}
              onClick={() => setMainView(tabItem.id as FinanceMainTab)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition-all ${
                mainView === tabItem.id
                  ? 'bg-canvas text-tx-primary shadow-xs border border-bd-subtle/50'
                  : 'text-tx-muted hover:text-tx-primary'
              }`}
            >
              {tabItem.label}
            </button>
          ))}
        </div>
      </div>

      {/* Actual Cash KPI Dashboard Banner */}
      <div className="px-5 mb-8">
        <div className="bg-tx-primary rounded-3xl p-6 text-tx-inverse border border-tx-primary/80 shadow-md relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-accent-primary" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <div className="text-xs uppercase tracking-wider font-semibold text-tx-inverse/60 mb-1">
                Net Operating Margin (Realized)
              </div>
              <div className="text-3xl md:text-4xl font-light font-mono tabular-nums text-tx-inverse leading-none">
                {formatCurrency(ledgerMetrics.netOperatingMargin, preferences.currency)}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => handleOpenLogSheet(undefined, 'income')}
                disabled={isViewer}
                className="px-3 py-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 hover:bg-emerald-500/30 transition-colors"
              >
                <ArrowDownLeft size={14} /> Log Revenue
              </button>
              <button
                onClick={() => handleOpenLogSheet(undefined, 'expense')}
                disabled={isViewer}
                className="px-3 py-2 bg-orange-500/20 text-orange-300 border border-orange-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 hover:bg-orange-500/30 transition-colors"
              >
                <ArrowUpRight size={14} /> Log Expense
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-tx-inverse/10 text-xs">
            <div>
              <span className="text-tx-inverse/60 block mb-0.5">Realized Revenue</span>
              <span className="font-mono tabular-nums text-emerald-400 font-semibold text-base">
                {formatCurrency(ledgerMetrics.realizedIncome, preferences.currency)}
              </span>
            </div>
            <div>
              <span className="text-tx-inverse/60 block mb-0.5">Realized Expenses</span>
              <span className="font-mono tabular-nums text-orange-400 font-semibold text-base">
                {formatCurrency(ledgerMetrics.realizedExpenses, preferences.currency)}
              </span>
            </div>
            <div>
              <span className="text-tx-inverse/60 block mb-0.5">Pending Invoices</span>
              <span className="font-mono tabular-nums text-tx-inverse font-semibold text-base">
                {formatCurrency(ledgerMetrics.pendingIncome, preferences.currency)}
              </span>
            </div>
            <div>
              <span className="text-tx-inverse/60 block mb-0.5">Overdue Receivables</span>
              <span className="font-mono tabular-nums text-red-400 font-semibold text-base">
                {formatCurrency(ledgerMetrics.overdueIncome, preferences.currency)}
              </span>
            </div>
          </div>

          {/* Monthly trend bars */}
          <div className="mt-6 pt-5 border-t border-tx-inverse/10">
            <div className="text-[11px] font-semibold text-tx-inverse/60 uppercase tracking-wider mb-3">
              Recent Cash Flow Trends
            </div>
            <div className="flex flex-col gap-2.5">
              {monthlyStats.map((mStat, idx) => {
                const incomeWidth = Math.max(8, Math.round((mStat.total / maxMonthly) * 100));
                return (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-12 text-xs font-mono text-tx-inverse/60">{mStat.month}</div>
                    <div className="flex-1 flex items-center gap-2">
                      <div
                        className="h-7 rounded-lg bg-accent-primary text-tx-primary px-2.5 flex items-center text-xs font-mono font-semibold"
                        style={{ width: `${incomeWidth}%`, minWidth: '80px' }}
                      >
                        +{formatCurrencyCompact(mStat.total, preferences.currency)}
                      </div>
                      {mStat.overduePct > 0 && (
                        <span className="text-[11px] text-red-300 font-mono">
                          {mStat.overduePct}% overdue
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* VIEW 1: Ledger Records */}
      {mainView === 'ledger' && (
        <div className="px-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-tx-primary tracking-tight">Financial Ledger</h3>
              <span className="text-xs font-mono tabular-nums text-tx-muted">
                ({effectiveRevenues.length} records)
              </span>
            </div>

            {/* Filter by Record Type */}
            <div className="inline-flex bg-surface-neutral p-1 rounded-xl border border-bd-subtle text-xs">
              {(['all', 'income', 'expense'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setRecordTypeFilter(t)}
                  className={`px-3 py-1.5 rounded-lg capitalize font-medium transition-all ${
                    recordTypeFilter === t
                      ? 'bg-canvas text-tx-primary font-bold shadow-xs'
                      : 'text-tx-muted hover:text-tx-primary'
                  }`}
                >
                  {t === 'all' ? 'All Ledger' : t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            {effectiveRevenues.map((r) => {
              const isExpense = r.type === 'expense';
              const p = projects.find((x) => x.id === r.projectId);
              const c = clients.find((x) => x.id === r.clientId);

              return (
                <button
                  key={r.id}
                  onClick={() => handleOpenLogSheet(r)}
                  className="bg-canvas-card hover:bg-surface-hover border border-bd-subtle rounded-2xl px-4 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 transition-all text-left group shadow-xs"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-base font-semibold font-mono tabular-nums ${
                          isExpense ? 'text-orange-600' : 'text-emerald-700'
                        }`}
                      >
                        {isExpense ? '-' : '+'}
                        {formatCurrency(r.amount, preferences.currency)}
                      </span>

                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider border ${
                          isExpense
                            ? 'bg-orange-500/10 text-orange-700 border-orange-500/20'
                            : 'bg-emerald-500/10 text-emerald-800 border-emerald-500/20'
                        }`}
                      >
                        {r.type || 'income'}
                      </span>

                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-surface-neutral text-tx-secondary border border-bd-subtle font-medium">
                        {r.category || 'General'}
                      </span>
                    </div>

                    <div className="text-xs text-tx-muted flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="font-semibold text-tx-primary">{r.clientOrProject}</span>
                      {p && <span className="text-tx-secondary">• Project: {p.name}</span>}
                      {c && <span className="text-tx-muted">• Client: {c.name}</span>}
                      <span className="font-mono tabular-nums text-tx-muted">• {r.date}</span>
                      {(r.invoiceNumber || r.receiptReference) && (
                        <span className="font-mono text-[11px] bg-surface-neutral px-1.5 py-0.5 rounded border border-bd-subtle">
                          Ref: {r.invoiceNumber || r.receiptReference}
                        </span>
                      )}
                    </div>

                    {r.notes && <p className="text-xs text-tx-muted mt-1 italic line-clamp-1">{r.notes}</p>}
                  </div>

                  <div className="self-end md:self-center shrink-0">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold tracking-wide uppercase border ${
                        r.status === 'Paid'
                          ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
                          : r.status === 'Overdue'
                          ? 'bg-red-500/10 text-red-600 border-red-500/20'
                          : 'bg-surface-neutral text-tx-muted border-bd-subtle'
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                </button>
              );
            })}

            {effectiveRevenues.length === 0 && (
              <div className="text-center text-sm text-tx-muted py-12 bg-canvas-card rounded-2xl border border-dashed border-bd-subtle">
                No financial records match the current filters.
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: Summary by Project */}
      {mainView === 'summary-project' && (
        <div className="px-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-tx-primary tracking-tight">Project Financial Summaries</h3>
              <p className="text-xs text-tx-muted">
                Budgets, realized revenues, logged expenses, and calculated unbilled work.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {projectSummaries.map((ps) => (
              <div
                key={ps.project.id}
                className="bg-canvas-card border border-bd-subtle rounded-2xl p-4 shadow-xs"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-3">
                  <div>
                    <h4 className="text-sm font-bold text-tx-primary flex items-center gap-1.5">
                      <Briefcase size={14} className="text-tx-muted" />
                      {ps.project.name}
                    </h4>
                    <span className="text-xs text-tx-muted">Client: {ps.clientName}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {ps.hourlyRate > 0 ? (
                      <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-surface-neutral border border-bd-subtle text-tx-secondary">
                        Standard Rate: {formatCurrency(ps.hourlyRate, preferences.currency)}/h
                      </span>
                    ) : (
                      <span className="text-xs font-mono text-tx-muted">No hourly rate configured</span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-surface-neutral/40 rounded-xl p-3 text-xs mb-3">
                  <div>
                    <span className="text-tx-muted block">Project Budget</span>
                    <span className="font-mono font-semibold text-tx-primary text-sm">
                      {ps.budget > 0 ? formatCurrency(ps.budget, preferences.currency) : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-tx-muted block">Realized Income</span>
                    <span className="font-mono font-semibold text-emerald-600 text-sm">
                      {formatCurrency(ps.paidIncome, preferences.currency)}
                    </span>
                  </div>
                  <div>
                    <span className="text-tx-muted block">Logged Expenses</span>
                    <span className="font-mono font-semibold text-orange-600 text-sm">
                      {formatCurrency(ps.paidExpenses, preferences.currency)}
                    </span>
                  </div>
                  <div>
                    <span className="text-tx-muted block">Unbilled WIP (Projection)</span>
                    <span className="font-mono font-semibold text-tx-primary text-sm">
                      {formatCurrency(ps.calculatedWIPAmount, preferences.currency)}
                    </span>
                  </div>
                </div>

                {ps.budget > 0 && ps.budgetVariance !== null && (
                  <div className="pt-2 border-t border-bd-subtle/60 flex items-center justify-between text-xs font-mono">
                    <span className="text-tx-muted">
                      Budget Utilization: <span className="font-semibold text-tx-primary">{ps.budgetUtilizationPct}%</span>
                    </span>
                    <span className={ps.budgetVariance >= 0 ? 'text-emerald-600 font-semibold' : 'text-red-500 font-semibold'}>
                      Remaining: {formatCurrency(ps.budgetVariance, preferences.currency)}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 3: Summary by Client */}
      {mainView === 'summary-client' && (
        <div className="px-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-tx-primary tracking-tight">Client Financial Breakdown</h3>
              <p className="text-xs text-tx-muted">
                Aggregated billing, outstanding receivables, and tracked effort per client.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {clientSummaries.map((cs) => (
              <div
                key={cs.client.id}
                className="bg-canvas-card border border-bd-subtle rounded-2xl p-4 shadow-xs"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-bold text-tx-primary flex items-center gap-1.5">
                      <User size={14} className="text-tx-muted" />
                      {cs.client.name}
                    </h4>
                    <span className="text-xs text-tx-muted">
                      {cs.client.company || 'Private Account'} • {cs.projectsCount} project(s)
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-surface-neutral/40 rounded-xl p-3 text-xs font-mono">
                  <div>
                    <span className="text-tx-muted block text-[11px]">Realized Revenue</span>
                    <span className="font-semibold text-emerald-600 text-sm">
                      {formatCurrency(cs.paidIncome, preferences.currency)}
                    </span>
                  </div>
                  <div>
                    <span className="text-tx-muted block text-[11px]">Outstanding Invoices</span>
                    <span className="font-semibold text-tx-primary text-sm">
                      {formatCurrency(cs.pendingIncome, preferences.currency)}
                    </span>
                  </div>
                  <div>
                    <span className="text-tx-muted block text-[11px]">Total Tracked Hours</span>
                    <span className="font-semibold text-tx-secondary text-sm">
                      {cs.trackedHours} hrs
                    </span>
                  </div>
                  <div>
                    <span className="text-tx-muted block text-[11px]">Accrued WIP Projection</span>
                    <span className="font-semibold text-tx-primary text-sm">
                      {formatCurrency(cs.wipValue, preferences.currency)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 4: Budgets & Projections (Cleanly separated from actual records) */}
      {mainView === 'budgets-wip' && (
        <div className="px-5 space-y-6">
          {/* Annual Target Section */}
          <div className="bg-canvas-card rounded-2xl p-6 border border-bd-subtle shadow-xs">
            <div className="flex justify-between items-center mb-1.5">
              <div className="text-xs font-semibold text-tx-muted uppercase tracking-wider">
                Annual Realized Target (Estimate / Goal)
              </div>
              {!isViewer && (
                <button
                  onClick={() => {
                    setGoalForm({ ...goalForm, amount: yearlyGoal.toString() });
                    setGoalSheetOpen(true);
                  }}
                  className="text-xs text-tx-muted hover:text-tx-primary flex items-center gap-1 transition-colors"
                  aria-label="Set yearly goal"
                >
                  <span>Edit Target</span>
                  <ChevronDown size={14} />
                </button>
              )}
            </div>

            <div className="text-3xl font-light font-mono tabular-nums text-tx-primary leading-none mb-5">
              {formatCurrency(yearlyGoal, preferences.currency)}
            </div>

            <ProgressBar progress={earnedPct} tone="lime" />

            <div className="flex justify-between items-center mt-3 text-xs font-mono tabular-nums">
              <span className="text-tx-primary font-medium">
                Pacing: <span className="font-semibold">{earnedPct}% achieved</span>
              </span>
              <span className="text-tx-muted">{remainingPct}% remaining</span>
            </div>
          </div>

          {/* Unbilled Work in Progress (Calculated Projection) */}
          <div className="bg-canvas-card rounded-2xl p-6 border border-bd-subtle shadow-xs">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={16} className="text-accent-primary" />
              <h4 className="text-sm font-bold text-tx-primary uppercase tracking-wider">
                Unbilled Work in Progress (Projection)
              </h4>
            </div>
            <p className="text-xs text-tx-muted mb-4 leading-relaxed">
              Calculated dynamically from eligible billable time entries linked to projects with configured standard hourly rates. Kept strictly distinct from recognized cash revenue.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {projectSummaries
                .filter((p) => p.calculatedWIPAmount > 0)
                .map((ps) => (
                  <div key={ps.project.id} className="p-3 bg-surface-neutral/40 rounded-xl border border-bd-subtle">
                    <div className="font-semibold text-xs text-tx-primary truncate">{ps.project.name}</div>
                    <div className="text-[11px] text-tx-muted mt-0.5">{ps.billableHours} billable hrs @ {formatCurrency(ps.hourlyRate, preferences.currency)}/h</div>
                    <div className="text-base font-mono font-semibold text-tx-primary mt-2">
                      {formatCurrency(ps.calculatedWIPAmount, preferences.currency)}
                    </div>
                  </div>
                ))}
              {projectSummaries.filter((p) => p.calculatedWIPAmount > 0).length === 0 && (
                <div className="col-span-3 text-center text-xs text-tx-muted py-6">
                  No unbilled work in progress with configured hourly rates found.
                </div>
              )}
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-canvas-card rounded-2xl p-5 border border-bd-subtle shadow-xs">
              <h4 className="text-xs font-bold uppercase tracking-wider text-tx-muted mb-3">
                Revenue by Category
              </h4>
              <div className="space-y-2">
                {Object.entries(categoryBreakdown.incomeCats).map(([cat, amt]) => (
                  <div key={cat} className="flex justify-between text-xs font-mono py-1 border-b border-bd-subtle/40 last:border-0">
                    <span className="text-tx-secondary">{cat}</span>
                    <span className="font-semibold text-emerald-600">{formatCurrency(amt, preferences.currency)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-canvas-card rounded-2xl p-5 border border-bd-subtle shadow-xs">
              <h4 className="text-xs font-bold uppercase tracking-wider text-tx-muted mb-3">
                Expenses by Category
              </h4>
              <div className="space-y-2">
                {Object.entries(categoryBreakdown.expenseCats).map(([cat, amt]) => (
                  <div key={cat} className="flex justify-between text-xs font-mono py-1 border-b border-bd-subtle/40 last:border-0">
                    <span className="text-tx-secondary">{cat}</span>
                    <span className="font-semibold text-orange-600">{formatCurrency(amt, preferences.currency)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 5: Audit History */}
      {mainView === 'audit' && (
        <div className="px-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-tx-primary tracking-tight">Audit Trail: Sensitive Edits</h3>
              <p className="text-xs text-tx-muted">
                Immutable server-side audit logs for financial record creations, updates, and deletions.
              </p>
            </div>
          </div>

          {loadingAudit ? (
            <div className="text-center py-10 text-xs text-tx-muted font-mono">Loading audit events...</div>
          ) : auditEvents.length === 0 ? (
            <div className="text-center py-12 bg-canvas-card rounded-2xl border border-dashed border-bd-subtle p-6">
              <History size={32} className="mx-auto text-tx-muted mb-2 opacity-50" />
              <div className="text-sm font-semibold text-tx-primary mb-1">No recorded audit events</div>
              <p className="text-xs text-tx-muted max-w-xs mx-auto">
                Actions affecting financial records and project budgets are logged here automatically.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {auditEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="bg-canvas-card border border-bd-subtle rounded-xl p-3.5 text-xs shadow-xs"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono font-bold text-tx-primary uppercase">{evt.action}</span>
                    <span className="text-[11px] text-tx-muted font-mono">
                      {new Date(evt.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-tx-secondary text-[11px] font-mono">
                    ID: {evt.entityId || 'N/A'} • IP: {evt.ipAddress || 'Internal'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bottom Sheet: Log/Edit Financial Record */}
      <BottomSheet
        isOpen={isLogSheetOpen}
        onClose={() => setLogSheetOpen(false)}
        title={editingEntry ? 'Edit Financial Record' : 'Record Transaction'}
        onSave={handleSaveLog}
      >
        {/* Type Toggle: Income vs Expense */}
        <BottomSheetField label="Transaction Type">
          <div className="flex bg-surface-neutral rounded-xl p-1 w-full">
            {(['income', 'expense'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setLogForm((f) => ({
                    ...f,
                    type: t,
                    category: t === 'expense' ? 'Software & SaaS' : 'Services',
                  }));
                }}
                className={`flex-1 py-2 text-center text-xs font-semibold rounded-lg capitalize transition-all ${
                  logForm.type === t
                    ? 'bg-canvas text-tx-primary shadow-xs font-bold'
                    : 'text-tx-muted hover:text-tx-primary'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </BottomSheetField>

        <BottomSheetField label="Amount">
          <div className="flex items-center text-[28px] font-light text-tx-primary">
            <span className="text-tx-muted mr-1">{getCurrencySymbol(preferences.currency)}</span>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={logForm.amount}
              onChange={(e) => setLogForm({ ...logForm, amount: e.target.value })}
              className="w-full bg-transparent outline-none py-2 font-mono"
              autoFocus
            />
          </div>
        </BottomSheetField>

        <BottomSheetField label="Category">
          <select
            value={logForm.category}
            onChange={(e) => setLogForm({ ...logForm, category: e.target.value })}
            className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none text-[15px] outline-none"
          >
            {(logForm.type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </BottomSheetField>

        <BottomSheetField label="Description / Payee">
          <input
            type="text"
            placeholder={logForm.type === 'expense' ? 'e.g. AWS Cloud Hosting' : 'e.g. Q4 Consulting Retainer'}
            value={logForm.clientOrProject}
            onChange={(e) => setLogForm({ ...logForm, clientOrProject: e.target.value })}
            className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none text-[15px] outline-none"
          />
        </BottomSheetField>

        <div className="grid grid-cols-2 gap-3">
          <BottomSheetField label="Client (Optional)">
            <select
              value={logForm.clientId}
              onChange={(e) => setLogForm({ ...logForm, clientId: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none text-[14px] outline-none"
            >
              <option value="">No Client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </BottomSheetField>

          <BottomSheetField label="Project (Optional)">
            <select
              value={logForm.projectId}
              onChange={(e) => setLogForm({ ...logForm, projectId: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none text-[14px] outline-none"
            >
              <option value="">No Project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </BottomSheetField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <BottomSheetField label="Status">
            <select
              value={logForm.status}
              onChange={(e) => setLogForm({ ...logForm, status: e.target.value as any })}
              className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none text-[14px] outline-none"
            >
              <option value="Paid">Paid</option>
              <option value="Pending">Pending</option>
              {logForm.type === 'income' && <option value="Overdue">Overdue</option>}
            </select>
          </BottomSheetField>

          <BottomSheetField label="Date">
            <input
              type="date"
              value={logForm.date}
              onChange={(e) => setLogForm({ ...logForm, date: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none text-[14px] outline-none"
            />
          </BottomSheetField>
        </div>

        <BottomSheetField label={logForm.type === 'expense' ? 'Receipt / Reference #' : 'Invoice Number'}>
          <input
            type="text"
            placeholder={logForm.type === 'expense' ? 'REC-2026-081' : 'INV-2026-001'}
            value={logForm.invoiceNumber || logForm.receiptReference}
            onChange={(e) => {
              if (logForm.type === 'expense') {
                setLogForm({ ...logForm, receiptReference: e.target.value, invoiceNumber: '' });
              } else {
                setLogForm({ ...logForm, invoiceNumber: e.target.value, receiptReference: '' });
              }
            }}
            className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none text-[15px] outline-none"
          />
        </BottomSheetField>

        <BottomSheetField label="Notes (Optional)">
          <textarea
            placeholder="Additional context..."
            value={logForm.notes}
            onChange={(e) => setLogForm({ ...logForm, notes: e.target.value })}
            className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none text-[15px] outline-none h-18 resize-none"
          />
        </BottomSheetField>

        {editingEntry && (
          <button
            onClick={() => setDeleteConfirmOpen(true)}
            className="w-full py-3 mt-4 rounded-xl border border-red-500/20 text-red-500 font-medium text-[15px] flex justify-center items-center gap-2 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 size={18} />
            Delete Entry
          </button>
        )}
      </BottomSheet>

      {/* Goal Edit Sheet */}
      <BottomSheet
        isOpen={isGoalSheetOpen}
        onClose={() => setGoalSheetOpen(false)}
        title="Edit Annual Target"
        onSave={handleSaveGoal}
      >
        <BottomSheetField label="Annual Target Amount">
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
      </BottomSheet>

      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteEntry}
        title="Delete Financial Record"
        body="Are you sure you want to permanently delete this financial record? This cannot be undone."
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
