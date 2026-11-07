import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { RevenueEntry, FinancialRecordType } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { generateId } from '../utils/id';

export interface FinancialSummary {
  realizedIncome: number;
  pendingIncome: number;
  overdueIncome: number;
  totalIncome: number;
  realizedExpenses: number;
  pendingExpenses: number;
  totalExpenses: number;
  netRealizedOperatingMargin: number;
}

export interface RevenueContextType {
  revenues: RevenueEntry[];
  yearlyGoal: number;
  addRevenue: (revenue: Omit<RevenueEntry, 'id'>) => { success: boolean; id?: string; error?: string };
  updateRevenue: (id: string, updates: Partial<RevenueEntry>) => { success: boolean; error?: string };
  deleteRevenue: (id: string) => void;
  setYearlyGoal: (amount: number) => void;
  summary: FinancialSummary;
  exportLedgerCSV: (clientsMap?: Record<string, string>, projectsMap?: Record<string, string>, currency?: string) => string;
}

const RevenueContext = createContext<RevenueContextType | undefined>(undefined);

export function RevenueProvider({ children }: { children: ReactNode }) {
  const [revenues, setRevenues] = useLocalStorage<RevenueEntry[]>('menkir-revenue', []);
  const [yearlyGoal, setYearlyGoal] = useLocalStorage<number>('menkir-yearly-goal', 8367);

  // Normalize legacy records to have type and category if missing
  React.useEffect(() => {
    let migrated = false;
    const normalized = revenues.map((r: any) => {
      let changed = false;
      const copy = { ...r };
      if (!copy.type) {
        copy.type = 'income';
        changed = true;
      }
      if (!copy.category) {
        copy.category = copy.type === 'expense' ? 'Software' : 'Services';
        changed = true;
      }
      if (changed) migrated = true;
      return copy;
    });
    if (migrated) {
      setRevenues(normalized);
    }
  }, [revenues, setRevenues]);

  const addRevenue = (revenue: Omit<RevenueEntry, 'id'>) => {
    const amount = typeof revenue.amount === 'number' ? revenue.amount : parseFloat(revenue.amount as any);
    if (isNaN(amount) || amount <= 0) {
      return { success: false, error: 'Amount must be greater than 0.' };
    }
    if (!revenue.date || isNaN(Date.parse(revenue.date))) {
      return { success: false, error: 'A valid transaction date is required.' };
    }

    const id = generateId();
    const newRecord: RevenueEntry = {
      ...revenue,
      id,
      amount: Math.round(amount * 100) / 100,
      type: revenue.type || 'income',
      category: revenue.category || (revenue.type === 'expense' ? 'Other' : 'Services'),
      clientOrProject: revenue.clientOrProject || 'General',
      status: revenue.status || 'Pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setRevenues((prev) => [newRecord, ...prev]);

    // Asynchronously log audit event
    try {
      const token = localStorage.getItem('menkir-auth-token') || sessionStorage.getItem('menkir-auth-token');
      const orgId = localStorage.getItem('menkir-active-org-id');
      if (token && orgId) {
        fetch('/api/audit-events', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            'x-organization-id': orgId,
          },
          body: JSON.stringify({
            action: 'financial_record.created',
            entityType: 'financial_record',
            entityId: id,
            metadata: {
              type: newRecord.type,
              amount: newRecord.amount,
              category: newRecord.category,
              status: newRecord.status,
            },
          }),
        }).catch(() => {});
      }
    } catch {
      // ignore
    }

    return { success: true, id };
  };

  const updateRevenue = (id: string, updates: Partial<RevenueEntry>) => {
    if (updates.amount !== undefined) {
      const amount = typeof updates.amount === 'number' ? updates.amount : parseFloat(updates.amount as any);
      if (isNaN(amount) || amount <= 0) {
        return { success: false, error: 'Amount must be greater than 0.' };
      }
      updates.amount = Math.round(amount * 100) / 100;
    }
    if (updates.date !== undefined && (!updates.date || isNaN(Date.parse(updates.date)))) {
      return { success: false, error: 'A valid transaction date is required.' };
    }

    setRevenues((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r
      )
    );

    // Asynchronously log audit event
    try {
      const token = localStorage.getItem('menkir-auth-token') || sessionStorage.getItem('menkir-auth-token');
      const orgId = localStorage.getItem('menkir-active-org-id');
      if (token && orgId) {
        fetch('/api/audit-events', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            'x-organization-id': orgId,
          },
          body: JSON.stringify({
            action: 'financial_record.updated',
            entityType: 'financial_record',
            entityId: id,
            metadata: updates,
          }),
        }).catch(() => {});
      }
    } catch {
      // ignore
    }

    return { success: true };
  };

  const deleteRevenue = (id: string) => {
    const target = revenues.find(r => r.id === id);
    setRevenues((prev) => prev.filter((r) => r.id !== id));

    // Asynchronously log audit event
    try {
      const token = localStorage.getItem('menkir-auth-token') || sessionStorage.getItem('menkir-auth-token');
      const orgId = localStorage.getItem('menkir-active-org-id');
      if (token && orgId && target) {
        fetch('/api/audit-events', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            'x-organization-id': orgId,
          },
          body: JSON.stringify({
            action: 'financial_record.deleted',
            entityType: 'financial_record',
            entityId: id,
            metadata: {
              type: target.type,
              amount: target.amount,
              category: target.category,
            },
          }),
        }).catch(() => {});
      }
    } catch {
      // ignore
    }
  };

  // Computes precise financial summary
  const summary = useMemo<FinancialSummary>(() => {
    let realizedIncome = 0;
    let pendingIncome = 0;
    let overdueIncome = 0;
    let realizedExpenses = 0;
    let pendingExpenses = 0;

    for (const r of revenues) {
      const amt = Number(r.amount) || 0;
      const isExpense = r.type === 'expense';

      if (!isExpense) {
        if (r.status === 'Paid') {
          realizedIncome += amt;
        } else if (r.status === 'Overdue') {
          overdueIncome += amt;
        } else {
          pendingIncome += amt;
        }
      } else {
        if (r.status === 'Paid') {
          realizedExpenses += amt;
        } else {
          pendingExpenses += amt;
        }
      }
    }

    return {
      realizedIncome: Math.round(realizedIncome * 100) / 100,
      pendingIncome: Math.round(pendingIncome * 100) / 100,
      overdueIncome: Math.round(overdueIncome * 100) / 100,
      totalIncome: Math.round((realizedIncome + pendingIncome + overdueIncome) * 100) / 100,
      realizedExpenses: Math.round(realizedExpenses * 100) / 100,
      pendingExpenses: Math.round(pendingExpenses * 100) / 100,
      totalExpenses: Math.round((realizedExpenses + pendingExpenses) * 100) / 100,
      netRealizedOperatingMargin: Math.round((realizedIncome - realizedExpenses) * 100) / 100,
    };
  }, [revenues]);

  const exportLedgerCSV = (
    clientsMap: Record<string, string> = {},
    projectsMap: Record<string, string> = {},
    currency = 'USD'
  ): string => {
    const headers = [
      'Date',
      'Type',
      'Category',
      'Client',
      'Project',
      'Description / Payee',
      'Status',
      'Invoice / Ref',
      'Amount',
      'Currency',
      'Notes'
    ];

    const rows = revenues.map((r) => {
      const clientName = (r.clientId && clientsMap[r.clientId]) || '';
      const projectName = (r.projectId && projectsMap[r.projectId]) || '';
      const ref = r.invoiceNumber || r.receiptReference || '';
      const notes = (r.notes || '').replace(/"/g, '""');
      const desc = (r.clientOrProject || '').replace(/"/g, '""');

      return [
        `"${r.date}"`,
        `"${(r.type || 'income').toUpperCase()}"`,
        `"${r.category || 'General'}"`,
        `"${clientName}"`,
        `"${projectName}"`,
        `"${desc}"`,
        `"${r.status}"`,
        `"${ref}"`,
        r.amount.toFixed(2),
        `"${currency}"`,
        `"${notes}"`
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  };

  return (
    <RevenueContext.Provider
      value={{
        revenues,
        yearlyGoal,
        addRevenue,
        updateRevenue,
        deleteRevenue,
        setYearlyGoal,
        summary,
        exportLedgerCSV,
      }}
    >
      {children}
    </RevenueContext.Provider>
  );
}

export function useRevenue() {
  const context = useContext(RevenueContext);
  if (!context) {
    throw new Error('useRevenue must be used within a RevenueProvider');
  }
  return context;
}
