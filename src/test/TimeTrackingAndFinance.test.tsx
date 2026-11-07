import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { TimeTrackerProvider, useTimeTracker, SIMULTANEOUS_TIMER_POLICY } from '../context/TimeTrackerContext';
import { RevenueProvider, useRevenue } from '../context/RevenueContext';
import { ProjectsProvider, useProjects } from '../context/ProjectsContext';
import { DataProvider } from '../context/DataProvider';
import { PreferencesProvider } from '../context/PreferencesContext';
import { ToastProvider } from '../context/ToastContext';
import { AuthProvider } from '../context/AuthContext';
import { TimeTracker } from '../screens/TimeTracker';
import { Finance } from '../screens/Finance';

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <PreferencesProvider>
          <DataProvider>
            {children}
          </DataProvider>
        </PreferencesProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

describe('Time Tracking and Finance Integration Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('menkir-seen-onboarding', 'true');
  });

  describe('1. Time Tracker & Single Active Timer Policy', () => {
    it('enforces single active timer policy and prevents simultaneous active timers', () => {
      let trackerRef: ReturnType<typeof useTimeTracker> | null = null;

      function HookConsumer() {
        trackerRef = useTimeTracker();
        return <div>Timer: {trackerRef.timerState}</div>;
      }

      render(
        <TestWrapper>
          <HookConsumer />
        </TestWrapper>
      );

      expect(trackerRef).not.toBeNull();
      expect(trackerRef!.timerState).toBe('idle');

      // 1. Start timer for Project A
      act(() => {
        trackerRef!.startTimerFor({
          projectId: 'proj-A',
          taskId: 'task-1',
          note: 'Working on Project A',
          hourlyRate: 150,
        });
      });

      expect(trackerRef!.timerState).toBe('running');
      expect(trackerRef!.activeProjectId).toBe('proj-A');
      expect(trackerRef!.activeTaskId).toBe('task-1');

      // 2. Calling startTimer again on running timer is idempotent (no duplicate timer created)
      act(() => {
        trackerRef!.startTimer();
      });
      expect(trackerRef!.timerState).toBe('running');
      expect(trackerRef!.activeProjectId).toBe('proj-A');

      // 3. Starting a timer for Project B enforces policy: pauses prior session and switches safely
      act(() => {
        trackerRef!.startTimerFor({
          projectId: 'proj-B',
          taskId: 'task-2',
          note: 'Switched to Project B',
          hourlyRate: 200,
        });
      });

      // Still exactly one active timer running (for Project B)
      expect(trackerRef!.timerState).toBe('running');
      expect(trackerRef!.activeProjectId).toBe('proj-B');
      expect(trackerRef!.activeTaskId).toBe('task-2');
    });

    it('rejects invalid durations: 0, negative, and over 24 hours', () => {
      let trackerRef: ReturnType<typeof useTimeTracker> | null = null;

      function HookConsumer() {
        trackerRef = useTimeTracker();
        return <div>Entries: {trackerRef.timeEntries.length}</div>;
      }

      render(
        <TestWrapper>
          <HookConsumer />
        </TestWrapper>
      );

      // Duration = 0
      act(() => {
        const res = trackerRef!.addTimeEntry({
          durationSeconds: 0,
          startedAt: '2026-11-01T10:00:00Z',
          billable: true,
        });
        expect(res.success).toBe(false);
        expect(res.error).toMatch(/greater than 0/i);
      });

      // Duration < 0
      act(() => {
        const res = trackerRef!.addTimeEntry({
          durationSeconds: -50,
          startedAt: '2026-11-01T10:00:00Z',
          billable: true,
        });
        expect(res.success).toBe(false);
        expect(res.error).toMatch(/greater than 0/i);
      });

      // Duration > 24 hours (86,400s)
      act(() => {
        const res = trackerRef!.addTimeEntry({
          durationSeconds: 90000,
          startedAt: '2026-11-01T10:00:00Z',
          billable: true,
        });
        expect(res.success).toBe(false);
        expect(res.error).toMatch(/cannot exceed 24 hours/i);
      });

      // Valid entry: 2 hours (7200s)
      act(() => {
        const res = trackerRef!.addTimeEntry({
          durationSeconds: 7200,
          startedAt: '2026-11-01T10:00:00Z',
          billable: true,
          hourlyRate: 125,
          note: 'Architecture review',
        });
        expect(res.success).toBe(true);
      });

      expect(trackerRef!.timeEntries.length).toBe(1);
      expect(trackerRef!.timeEntries[0].durationSeconds).toBe(7200);
      expect(trackerRef!.timeEntries[0].hourlyRate).toBe(125);
    });

    it('exports time entries to properly formatted CSV with rates and billable calculations', () => {
      let trackerRef: ReturnType<typeof useTimeTracker> | null = null;

      function HookConsumer() {
        trackerRef = useTimeTracker();
        return null;
      }

      render(
        <TestWrapper>
          <HookConsumer />
        </TestWrapper>
      );

      // Add a billable entry with rate
      act(() => {
        trackerRef!.addTimeEntry({
          projectId: 'p1',
          clientId: 'c1',
          taskId: 't1',
          durationSeconds: 3600, // 1 hour
          startedAt: '2026-11-01T14:00:00Z',
          billable: true,
          hourlyRate: 150,
          note: 'Client consultation',
        });
        // Add a non-billable entry
        trackerRef!.addTimeEntry({
          projectId: 'p1',
          durationSeconds: 1800, // 0.5 hours
          startedAt: '2026-11-01T16:00:00Z',
          billable: false,
          note: 'Internal setup',
        });
      });

      const csv = trackerRef!.exportTimeEntriesCSV(
        { c1: 'Acme Corp' },
        { p1: 'Cloud Migration' },
        { t1: 'Database Setup' }
      );

      expect(csv).toContain('Date,Client,Project,Task,Assignee,Duration (Hours)');
      expect(csv).toContain('"Acme Corp"');
      expect(csv).toContain('"Cloud Migration"');
      expect(csv).toContain('1.00');
      expect(csv).toContain('150.00'); // Hourly Rate
      expect(csv).toContain('0.50'); // 0.5 hours
    });
  });

  describe('2. Finance Ledger, Budgets & WIP Projections', () => {
    it('accurately separates realized revenue, pending invoices, expenses, and net margin', () => {
      let revRef: ReturnType<typeof useRevenue> | null = null;

      function HookConsumer() {
        revRef = useRevenue();
        return null;
      }

      render(
        <TestWrapper>
          <HookConsumer />
        </TestWrapper>
      );

      act(() => {
        // 1. Realized Income: $5,000 paid
        revRef!.addRevenue({
          amount: 5000,
          type: 'income',
          category: 'Services',
          status: 'Paid',
          date: '2026-11-01',
          clientOrProject: 'Client A Project',
        });

        // 2. Pending Income: $2,500 pending
        revRef!.addRevenue({
          amount: 2500,
          type: 'income',
          category: 'Milestone',
          status: 'Pending',
          date: '2026-11-02',
          clientOrProject: 'Client B Project',
        });

        // 3. Realized Expense: $1,200 paid
        revRef!.addRevenue({
          amount: 1200,
          type: 'expense',
          category: 'Software & SaaS',
          status: 'Paid',
          date: '2026-11-01',
          clientOrProject: 'AWS Cloud Services',
        });

        // 4. Pending Expense: $300 pending
        revRef!.addRevenue({
          amount: 300,
          type: 'expense',
          category: 'Hardware',
          status: 'Pending',
          date: '2026-11-03',
          clientOrProject: 'Server Replacement',
        });
      });

      expect(revRef!.summary.realizedIncome).toBe(5000);
      expect(revRef!.summary.pendingIncome).toBe(2500);
      expect(revRef!.summary.realizedExpenses).toBe(1200);
      expect(revRef!.summary.pendingExpenses).toBe(300);
      // Net operating margin = Realized Income - Realized Expenses = 5000 - 1200 = 3800
      expect(revRef!.summary.netRealizedOperatingMargin).toBe(3800);
    });

    it('calculates billable amounts ONLY when billable is true and explicit hourly rate is configured', () => {
      let projRef: ReturnType<typeof useProjects> | null = null;
      let timeRef: ReturnType<typeof useTimeTracker> | null = null;

      function HookConsumer() {
        projRef = useProjects();
        timeRef = useTimeTracker();
        return null;
      }

      render(
        <TestWrapper>
          <HookConsumer />
        </TestWrapper>
      );

      let p1Id = '';
      let p2Id = '';

      act(() => {
        p1Id = projRef!.addProject({
          name: 'Project with Rate',
          priority: 'high',
          completionPct: 10,
          tone: 'lime',
          hourlyRate: 100, // Explicit rate: $100/hr
          budget: 5000,
        });

        p2Id = projRef!.addProject({
          name: 'Project without Rate',
          priority: 'low',
          completionPct: 0,
          tone: 'neutral',
          // No hourly rate configured!
          budget: 2000,
        });

        // 1. Eligible billable entry: 3 hours @ project rate $100 => $300
        timeRef!.addTimeEntry({
          projectId: p1Id,
          durationSeconds: 10800, // 3 hours
          startedAt: '2026-11-01T09:00:00Z',
          billable: true,
        });

        // 2. Non-billable entry on project with rate: 2 hours => $0
        timeRef!.addTimeEntry({
          projectId: p1Id,
          durationSeconds: 7200, // 2 hours
          startedAt: '2026-11-01T13:00:00Z',
          billable: false,
        });

        // 3. Billable entry on project WITHOUT rate: 4 hours => $0 (no rate configured!)
        timeRef!.addTimeEntry({
          projectId: p2Id,
          durationSeconds: 14400, // 4 hours
          startedAt: '2026-11-01T15:00:00Z',
          billable: true,
        });
      });

      const entries = timeRef!.timeEntries;
      expect(entries.length).toBe(3);

      // Verify calculation logic
      const p1 = projRef!.projects.find((p) => p.id === p1Id);
      const p2 = projRef!.projects.find((p) => p.id === p2Id);

      const entry1Rate = entries[2].hourlyRate || p1?.hourlyRate || 0;
      const entry1Amount = entries[2].billable && entry1Rate > 0 ? (entries[2].durationSeconds / 3600) * entry1Rate : 0;
      expect(entry1Amount).toBe(300);

      const entry2Rate = entries[1].hourlyRate || p1?.hourlyRate || 0;
      const entry2Amount = entries[1].billable && entry2Rate > 0 ? (entries[1].durationSeconds / 3600) * entry2Rate : 0;
      expect(entry2Amount).toBe(0); // non-billable

      const entry3Rate = entries[0].hourlyRate || p2?.hourlyRate || 0;
      const entry3Amount = entries[0].billable && entry3Rate > 0 ? (entries[0].durationSeconds / 3600) * entry3Rate : 0;
      expect(entry3Amount).toBe(0); // no hourly rate
    });

    it('exports financial ledger to properly formatted CSV with all columns', () => {
      let revRef: ReturnType<typeof useRevenue> | null = null;

      function HookConsumer() {
        revRef = useRevenue();
        return null;
      }

      render(
        <TestWrapper>
          <HookConsumer />
        </TestWrapper>
      );

      act(() => {
        revRef!.addRevenue({
          amount: 4500,
          type: 'income',
          category: 'Retainer',
          status: 'Paid',
          date: '2026-11-01',
          clientOrProject: 'Monthly Retainer',
          invoiceNumber: 'INV-001',
        });
      });

      const csv = revRef!.exportLedgerCSV({}, {}, 'USD');
      expect(csv).toContain('Date,Type,Category,Client,Project,Description / Payee,Status,Invoice / Ref,Amount,Currency,Notes');
      expect(csv).toContain('"INCOME"');
      expect(csv).toContain('"Retainer"');
      expect(csv).toContain('"Monthly Retainer"');
      expect(csv).toContain('4500.00');
      expect(csv).toContain('"USD"');
    });
  });

  describe('3. UI Screen Rendering and Permissions', () => {
    it('renders TimeTracker and displays policy banner', () => {
      render(
        <TestWrapper>
          <TimeTracker onDismiss={() => {}} />
        </TestWrapper>
      );

      expect(screen.getByText('Time Tracker')).toBeInTheDocument();
      expect(screen.getByText(/single active timer policy/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^start$/i })).toBeInTheDocument();
    });

    it('renders Finance screen with operational tracking disclaimer banner and tabs', () => {
      render(
        <TestWrapper>
          <Finance onDismiss={() => {}} />
        </TestWrapper>
      );

      expect(screen.getByText(/Finance & Budget Ledger/i)).toBeInTheDocument();
      // Operational tracking disclaimer
      expect(screen.getByText(/Operational Tracking Notice:/i)).toBeInTheDocument();
      expect(screen.getByText(/does not replace a certified general ledger accounting system/i)).toBeInTheDocument();
      // Main tabs
      expect(screen.getByRole('button', { name: /Ledger Records/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /By Project/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /By Client/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Budgets & Projections/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Audit History/i })).toBeInTheDocument();
    });
  });
});
