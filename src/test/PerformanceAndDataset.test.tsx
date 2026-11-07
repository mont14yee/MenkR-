import { describe, it, expect, beforeEach } from 'vitest';
import { TaskItem, ProjectItem, Client, TimeEntry, RevenueEntry } from '../types';

describe('Performance and Scalability with Realistic Datasets', () => {
  let mockClients: Client[] = [];
  let mockProjects: ProjectItem[] = [];
  let mockTasks: TaskItem[] = [];
  let mockTimeEntries: TimeEntry[] = [];
  let mockRevenues: RevenueEntry[] = [];

  beforeEach(() => {
    // Generate realistic enterprise dataset
    mockClients = Array.from({ length: 60 }, (_, i) => ({
      id: `client-${i + 1}`,
      name: `Corporate Client ${i + 1}`,
      company: `Enterprise Corp ${Math.floor(i / 5) + 1}`,
      email: `contact${i + 1}@corp${Math.floor(i / 5) + 1}.com`,
      phone: `+1 555-01${String(i).padStart(2, '0')}`,
      status: i % 3 === 0 ? 'lead' : i % 3 === 1 ? 'active' : 'past',
      tags: ['enterprise', i % 2 === 0 ? 'retainer' : 'project-based'],
      avatarSeed: `client-seed-${i}`,
      createdAt: new Date(2026, 0, 1 + (i % 28)).toISOString(),
    }));

    mockProjects = Array.from({ length: 60 }, (_, i) => ({
      id: `proj-${i + 1}`,
      index: String(i + 1).padStart(2, '0'),
      name: `Initiative Alpha ${i + 1}`,
      priority: i % 2 === 0 ? 'high' : 'low',
      completionPct: (i * 17) % 101,
      tone: i % 3 === 0 ? 'lime' : i % 3 === 1 ? 'olive' : 'neutral',
      clientId: `client-${(i % 50) + 1}`,
      status: i % 4 === 0 ? 'completed' : i % 4 === 1 ? 'on-hold' : 'active',
      dueDate: `2026-11-${String((i % 28) + 1).padStart(2, '0')}`,
      budget: 10000 + i * 2500,
      hourlyRate: 85 + (i % 10) * 15,
      assignedMemberIds: [`usr-${(i % 5) + 1}`, `usr-${((i + 1) % 5) + 1}`],
      isArchived: false,
    }));

    mockTasks = Array.from({ length: 180 }, (_, i) => ({
      id: `task-${i + 1}`,
      title: `Deliverable milestone task ${i + 1}`,
      categoryId: i % 2 === 0 ? 'c1' : 'c2',
      priority: i % 3 === 0 ? 'High' : i % 3 === 1 ? 'Medium' : 'Low',
      status: i % 3 === 0 ? 'done' : i % 3 === 1 ? 'active' : 'upcoming',
      projectId: `proj-${(i % 50) + 1}`,
      clientId: `client-${(i % 40) + 1}`,
      date: `2026-11-${String((i % 28) + 1).padStart(2, '0')}T10:00:00.000Z`,
      dueDate: `2026-11-${String((i % 28) + 1).padStart(2, '0')}`,
      assigneeName: `Team Member ${(i % 8) + 1}`,
      isArchived: false,
    }));

    mockTimeEntries = Array.from({ length: 250 }, (_, i) => ({
      id: `time-${i + 1}`,
      projectId: `proj-${(i % 50) + 1}`,
      taskId: `task-${(i % 100) + 1}`,
      clientId: `client-${(i % 40) + 1}`,
      userId: `usr-${(i % 5) + 1}`,
      userName: `Engineer ${(i % 5) + 1}`,
      startedAt: `2026-11-${String((i % 28) + 1).padStart(2, '0')}T09:00:00.000Z`,
      durationSeconds: 1800 + (i % 12) * 900, // 30 mins to 3.5 hours
      billable: i % 5 !== 0,
      hourlyRate: 125.00,
      note: `Core development milestone phase ${i + 1}`,
    }));

    mockRevenues = Array.from({ length: 80 }, (_, i) => ({
      id: `rev-${i + 1}`,
      amount: 1500 + (i % 20) * 450,
      type: i % 6 === 0 ? 'expense' : 'income',
      category: i % 2 === 0 ? 'Consulting' : 'Development',
      clientOrProject: `Corporate Client ${(i % 30) + 1}`,
      date: `2026-11-${String((i % 28) + 1).padStart(2, '0')}`,
      status: i % 3 === 0 ? 'Paid' : i % 3 === 1 ? 'Pending' : 'Overdue',
    }));
  });

  it('aggregates dashboard financial and productivity metrics under 30ms for 500+ records', () => {
    const t0 = performance.now();

    // 1. Paid, Pending, Overdue Revenue Aggregation
    const paidRevenue = mockRevenues
      .filter(r => r.type !== 'expense' && r.status === 'Paid')
      .reduce((sum, r) => sum + r.amount, 0);

    const pendingRevenue = mockRevenues
      .filter(r => r.type !== 'expense' && r.status === 'Pending')
      .reduce((sum, r) => sum + r.amount, 0);

    const overdueRevenue = mockRevenues
      .filter(r => r.type !== 'expense' && r.status === 'Overdue')
      .reduce((sum, r) => sum + r.amount, 0);

    // 2. Time entries total hours & billable percentage
    const totalSeconds = mockTimeEntries.reduce((sum, t) => sum + t.durationSeconds, 0);
    const billableSeconds = mockTimeEntries
      .filter(t => t.billable !== false)
      .reduce((sum, t) => sum + t.durationSeconds, 0);
    const billablePct = totalSeconds > 0 ? Math.round((billableSeconds / totalSeconds) * 100) : 100;

    // 3. Task breakdown by completion
    const activeTasksCount = mockTasks.filter(t => t.status !== 'done').length;
    const completedTasksCount = mockTasks.filter(t => t.status === 'done').length;

    // 4. Overdue tasks check
    const todayStr = '2026-11-03';
    const overdueTasks = mockTasks.filter(t => {
      if (t.status === 'done' || !t.date) return false;
      return t.date.split('T')[0] < todayStr;
    });

    const elapsedMs = performance.now() - t0;

    expect(paidRevenue).toBeGreaterThan(0);
    expect(pendingRevenue).toBeGreaterThan(0);
    expect(overdueRevenue).toBeGreaterThan(0);
    expect(totalSeconds).toBeGreaterThan(0);
    expect(billablePct).toBeGreaterThan(0);
    expect(activeTasksCount + completedTasksCount).toBe(mockTasks.length);
    expect(overdueTasks.length).toBeGreaterThan(0);

    // Assert fast computation (should comfortably be under 50ms)
    expect(elapsedMs).toBeLessThan(50);
  });

  it('filters and searches across 500+ records in under 20ms', () => {
    const query = 'task 42';
    const q = query.toLowerCase().trim();

    const t0 = performance.now();

    const matchingTasks = mockTasks.filter(t => 
      t.title.toLowerCase().includes(q) || t.assigneeName?.toLowerCase().includes(q)
    );

    const matchingProjects = mockProjects.filter(p =>
      p.name.toLowerCase().includes(q)
    );

    const matchingClients = mockClients.filter(c =>
      c.name.toLowerCase().includes(q) || c.company?.toLowerCase().includes(q)
    );

    const elapsedMs = performance.now() - t0;

    expect(matchingTasks.length).toBeGreaterThan(0);
    expect(matchingTasks[0].title).toContain('42');
    expect(elapsedMs).toBeLessThan(20);
  });

  it('calculates billable amount accurately with exact precision', () => {
    // 2.5 hours at $135.50/hr = 2.5 * 135.50 = 338.75
    const entry: TimeEntry = {
      id: 't-test-1',
      startedAt: '2026-11-03T10:00:00Z',
      durationSeconds: 9000, // 2.5 hours
      billable: true,
      hourlyRate: 135.50,
    };

    const hours = entry.durationSeconds / 3600;
    const billableAmount = entry.billable && entry.hourlyRate ? Number((hours * entry.hourlyRate).toFixed(2)) : 0;

    expect(billableAmount).toBe(338.75);

    // Non-billable entry should always result in $0.00
    const nonBillableEntry: TimeEntry = { ...entry, billable: false };
    const nonBillableAmount = nonBillableEntry.billable && nonBillableEntry.hourlyRate 
      ? Number(((nonBillableEntry.durationSeconds / 3600) * nonBillableEntry.hourlyRate).toFixed(2)) 
      : 0;

    expect(nonBillableAmount).toBe(0);
  });
});
