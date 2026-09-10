export function getRecentMonths(count: number = 3): { label: string, year: number, month: number, isCurrent: boolean }[] {
  const months = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      label: d.toLocaleString('default', { month: 'long' }),
      year: d.getFullYear(),
      month: d.getMonth(),
      isCurrent: i === 0
    });
  }
  return months;
}

export function getMonthsForYear(year: number): { label: string, year: number, month: number, isCurrent: boolean }[] {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(year, i, 1);
    months.push({
      label: d.toLocaleString('default', { month: 'short' }),
      year: d.getFullYear(),
      month: d.getMonth(),
      isCurrent: d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    });
  }
  return months;
}
export function getTodayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatMonthYear(date: Date): string {
  return date.toLocaleString('default', { month: 'long', year: 'numeric' });
}

export interface DayObj {
  dateStr: string; // YYYY-MM-DD
  day: number;
  isCurrentMonth: boolean;
}

export function getMonthGrid(year: number, month: number): DayObj[] {
  const grid: DayObj[] = [];
  const firstDay = new Date(year, month, 1);
  const startDayOfWeek = firstDay.getDay(); // 0 is Sunday
  
  // Backfill previous month
  const prevMonthDays = new Date(year, month, 0).getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const date = new Date(year, month - 1, d);
    grid.push({
      dateStr: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      day: d,
      isCurrentMonth: false,
    });
  }

  // Current month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let i = 1; i <= daysInMonth; i++) {
    const date = new Date(year, month, i);
    grid.push({
      dateStr: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      day: i,
      isCurrentMonth: true,
    });
  }

  // Forward-fill next month to complete 6 rows (42 days)
  const remainingDays = 42 - grid.length;
  for (let i = 1; i <= remainingDays; i++) {
    const date = new Date(year, month + 1, i);
    grid.push({
      dateStr: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      day: i,
      isCurrentMonth: false,
    });
  }

  return grid;
}
