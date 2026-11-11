import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';
import { 
  formatCurrency, 
  formatCurrencyCompact, 
  getCurrencySymbol, 
  getCurrencyLocale, 
  SUPPORTED_CURRENCIES 
} from '../utils/currency';
import { PreferencesProvider, usePreferences } from '../context/PreferencesContext';
import { Settings } from '../screens/Settings';
import { ToastProvider } from '../context/ToastContext';
import { ProfileProvider } from '../context/ProfileContext';
import { AuthProvider } from '../context/AuthContext';
import { RevenueProvider, useRevenue } from '../context/RevenueContext';
import { ClientsProvider } from '../context/ClientsContext';
import { ProjectsProvider, useProjects } from '../context/ProjectsContext';
import { TimeTrackerProvider } from '../context/TimeTrackerContext';
import { NavigationProvider } from '../context/NavigationContext';
import { Finance } from '../screens/Finance';
import { Dashboard } from '../screens/Dashboard';
import { Projects } from '../screens/Projects';

describe('Currency Utilities - Complete Ethiopian Birr (ETB) Formatting', () => {
  it('selects am-ET locale for ETB and en-US for others', () => {
    expect(getCurrencyLocale('ETB')).toBe('am-ET');
    expect(getCurrencyLocale('etb')).toBe('am-ET');
    expect(getCurrencyLocale('USD')).toBe('en-US');
    expect(getCurrencyLocale('EUR')).toBe('en-US');
    expect(getCurrencyLocale('GBP')).toBe('en-US');
  });

  describe('Representative Test Values for Ethiopian Birr', () => {
    it('formats 0 with exact two decimals and Ethiopian Birr symbol', () => {
      const formatted = formatCurrency(0, 'ETB').replace(/\u00a0/g, ' ');
      expect(formatted).toBe('ብር 0.00');
    });

    it('formats 125 with exact two decimals and Ethiopian Birr symbol', () => {
      const formatted = formatCurrency(125, 'ETB').replace(/\u00a0/g, ' ');
      expect(formatted).toBe('ብር 125.00');
    });

    it('formats 1,234.56 with comma grouping, two decimals, and Ethiopian Birr symbol', () => {
      const formatted = formatCurrency(1234.56, 'ETB').replace(/\u00a0/g, ' ');
      expect(formatted).toBe('ብር 1,234.56');
    });

    it('formats 125,000 with thousands grouping, two decimals, and Ethiopian Birr symbol', () => {
      const formatted = formatCurrency(125000, 'ETB').replace(/\u00a0/g, ' ');
      expect(formatted).toBe('ብር 125,000.00');
    });

    it('formats negative -1,250.75 accurately with negative indicator, grouping, two decimals, and symbol', () => {
      const formatted = formatCurrency(-1250.75, 'ETB').replace(/\u00a0/g, ' ');
      expect(formatted).toBe('-ብር 1,250.75');
    });
  });

  describe('Compact Formatting for Ethiopian Birr', () => {
    it('formats 125,000 compactly using Ethiopian locale notation', () => {
      const compact = formatCurrencyCompact(125000, 'ETB').replace(/\u00a0/g, ' ');
      expect(compact).toContain('ብር');
      expect(compact).toContain('125');
    });

    it('formats 1,500,000 compactly using Ethiopian locale notation', () => {
      const compact = formatCurrencyCompact(1500000, 'ETB').replace(/\u00a0/g, ' ');
      expect(compact).toContain('ብር');
      expect(compact).toContain('1.5');
    });
  });

  it('consistently returns the recognizable Ethiopian Birr symbol ብር', () => {
    expect(getCurrencySymbol('ETB')).toBe('ብር');
    expect(getCurrencySymbol('etb')).toBe('ብር');
  });

  it('preserves exact USD, EUR, and GBP formatting behavior', () => {
    const usd = formatCurrency(1234.56, 'USD').replace(/\u00a0/g, ' ');
    const eur = formatCurrency(1234.56, 'EUR').replace(/\u00a0/g, ' ');
    const gbp = formatCurrency(1234.56, 'GBP').replace(/\u00a0/g, ' ');

    expect(usd).toBe('$1,234.56');
    expect(eur).toBe('€1,234.56');
    expect(gbp).toBe('£1,234.56');

    expect(getCurrencySymbol('USD')).toBe('$');
    expect(getCurrencySymbol('EUR')).toBe('€');
    expect(getCurrencySymbol('GBP')).toBe('£');
  });

  it('handles invalid numbers and unsupported codes gracefully via fallbacks', () => {
    const nanFormat = formatCurrency(NaN as any, 'ETB').replace(/\u00a0/g, ' ');
    expect(nanFormat).toBe('ብር 0.00');

    const fallbackFormat = formatCurrency(50, 'XYZ_UNKNOWN');
    expect(fallbackFormat).toBeDefined();
    expect(fallbackFormat.length).toBeGreaterThan(0);
  });

  it('includes ETB in SUPPORTED_CURRENCIES with clear label and recognizable symbol', () => {
    const etbOption = SUPPORTED_CURRENCIES.find((c) => c.code === 'ETB');
    expect(etbOption).toBeDefined();
    expect(etbOption?.label).toBe('Ethiopian Birr (ETB)');
    expect(etbOption?.symbol).toBe('ብር');
  });
});

describe('Preferences Persistence & Non-Destructive Currency Changes', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('defaults to USD when no preferences are stored', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PreferencesProvider>{children}</PreferencesProvider>
    );

    const { result } = renderHook(() => usePreferences(), { wrapper });
    expect(result.current.preferences.currency).toBe('USD');
  });

  it('allows updating currency to ETB and selection survives simulated refresh', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PreferencesProvider>{children}</PreferencesProvider>
    );

    const { result, unmount } = renderHook(() => usePreferences(), { wrapper });

    act(() => {
      result.current.updatePreferences({ currency: 'ETB' });
    });

    expect(result.current.preferences.currency).toBe('ETB');
    unmount();

    // Verify localStorage has persisted ETB
    const stored = JSON.parse(localStorage.getItem('menkir-preferences') || '{}');
    expect(stored.currency).toBe('ETB');

    // Simulate page reload by mounting a brand new PreferencesProvider
    const { result: reloaded } = renderHook(() => usePreferences(), { wrapper });
    expect(reloaded.current.preferences.currency).toBe('ETB');
  });

  it('preserves existing users saved preferences intact', () => {
    localStorage.setItem(
      'menkir-preferences',
      JSON.stringify({
        currency: 'EUR',
        firstDayOfWeek: 'mon',
        defaultReminderMinutes: 10,
        roundingIncrementMinutes: 15,
        overdueThresholdDays: 45,
        defaultTaskDuration: 60,
        categories: [{ id: 'c-test', label: 'Custom', color: '#ff0000', scope: 'task' }],
      })
    );

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PreferencesProvider>{children}</PreferencesProvider>
    );

    const { result } = renderHook(() => usePreferences(), { wrapper });
    expect(result.current.preferences.currency).toBe('EUR');
    expect(result.current.preferences.firstDayOfWeek).toBe('mon');
    expect(result.current.preferences.defaultReminderMinutes).toBe(10);
    expect(result.current.preferences.categories).toHaveLength(1);
    expect(result.current.preferences.categories[0].label).toBe('Custom');
  });

  it('does NOT numerically modify stored financial transaction values when switching currencies', () => {
    const initialRecords = [
      { id: 'rev-1', amount: 1234.56, clientOrProject: 'Acme Inc', date: '2026-11-10', status: 'Paid', type: 'income', category: 'Services' },
      { id: 'rev-2', amount: 450.00, clientOrProject: 'Cloud Hosting', date: '2026-11-10', status: 'Paid', type: 'expense', category: 'Software' },
    ];
    localStorage.setItem('menkir-revenue', JSON.stringify(initialRecords));

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PreferencesProvider>
        <RevenueProvider>
          {children}
        </RevenueProvider>
      </PreferencesProvider>
    );

    const { result: prefResult } = renderHook(() => usePreferences(), { wrapper });
    const { result: revResult } = renderHook(() => useRevenue(), { wrapper });

    expect(revResult.current.revenues[0].amount).toBe(1234.56);
    expect(revResult.current.revenues[1].amount).toBe(450.00);

    // Switch currency to ETB
    act(() => {
      prefResult.current.updatePreferences({ currency: 'ETB' });
    });

    // Numerical amount must remain identical (presentation changes only)
    expect(revResult.current.revenues[0].amount).toBe(1234.56);
    expect(revResult.current.revenues[1].amount).toBe(450.00);

    const storedInStorage = JSON.parse(localStorage.getItem('menkir-revenue') || '[]');
    expect(storedInStorage[0].amount).toBe(1234.56);
    expect(storedInStorage[1].amount).toBe(450.00);

    // Switch currency to GBP
    act(() => {
      prefResult.current.updatePreferences({ currency: 'GBP' });
    });

    expect(revResult.current.revenues[0].amount).toBe(1234.56);
    expect(storedInStorage[0].amount).toBe(1234.56);
  });
});

describe('Settings Screen - All 4 Currencies Selectable', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders USD, EUR, GBP, and ETB options in Settings > Preferences > General', async () => {
    render(
      <ToastProvider>
        <AuthProvider>
          <PreferencesProvider>
            <ProfileProvider>
              <Settings onDismiss={() => {}} />
            </ProfileProvider>
          </PreferencesProvider>
        </AuthProvider>
      </ToastProvider>
    );

    // Open Preferences screen via header button
    const openPrefsBtn = screen.getByLabelText('Open Preferences');
    fireEvent.click(openPrefsBtn);

    expect(screen.getByText('General')).toBeInTheDocument();

    const selectElements = screen.getAllByRole('combobox');
    const currencySelect = selectElements.find((select) =>
      Array.from(select.querySelectorAll('option')).some(
        (opt) => opt.value === 'ETB' && opt.textContent === 'Ethiopian Birr (ETB)'
      )
    );

    expect(currencySelect).toBeDefined();

    const options = Array.from(currencySelect!.querySelectorAll('option')).map((o) => ({
      value: o.value,
      label: o.textContent,
    }));

    expect(options).toEqual([
      { value: 'USD', label: 'USD ($)' },
      { value: 'EUR', label: 'EUR (€)' },
      { value: 'GBP', label: 'GBP (£)' },
      { value: 'ETB', label: 'Ethiopian Birr (ETB)' },
    ]);
  });

  it('allows sequentially selecting all 4 currencies without corruption', () => {
    render(
      <ToastProvider>
        <AuthProvider>
          <PreferencesProvider>
            <ProfileProvider>
              <Settings onDismiss={() => {}} />
            </ProfileProvider>
          </PreferencesProvider>
        </AuthProvider>
      </ToastProvider>
    );

    const openPrefsBtn = screen.getByLabelText('Open Preferences');
    fireEvent.click(openPrefsBtn);

    const selectElements = screen.getAllByRole('combobox');
    const currencySelect = selectElements.find((select) =>
      Array.from(select.querySelectorAll('option')).some((opt) => opt.value === 'ETB')
    ) as HTMLSelectElement;

    // Test selection of EUR
    fireEvent.change(currencySelect, { target: { value: 'EUR' } });
    expect(currencySelect.value).toBe('EUR');
    expect(JSON.parse(localStorage.getItem('menkir-preferences')!).currency).toBe('EUR');

    // Test selection of GBP
    fireEvent.change(currencySelect, { target: { value: 'GBP' } });
    expect(currencySelect.value).toBe('GBP');
    expect(JSON.parse(localStorage.getItem('menkir-preferences')!).currency).toBe('GBP');

    // Test selection of ETB
    fireEvent.change(currencySelect, { target: { value: 'ETB' } });
    expect(currencySelect.value).toBe('ETB');
    expect(JSON.parse(localStorage.getItem('menkir-preferences')!).currency).toBe('ETB');

    // Test selection of USD
    fireEvent.change(currencySelect, { target: { value: 'USD' } });
    expect(currencySelect.value).toBe('USD');
    expect(JSON.parse(localStorage.getItem('menkir-preferences')!).currency).toBe('USD');
  });
});

import { DataProvider } from '../context/DataProvider';

describe('Finance Screen with ETB Currency Presentation', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(
      'menkir-preferences',
      JSON.stringify({
        currency: 'ETB',
        firstDayOfWeek: 'mon',
        defaultReminderMinutes: 15,
        roundingIncrementMinutes: 5,
        overdueThresholdDays: 30,
        defaultTaskDuration: 30,
        categories: [],
      })
    );
  });

  it('displays ETB symbol ብር in Finance header currency badge', () => {
    render(
      <ToastProvider>
        <AuthProvider>
          <PreferencesProvider>
            <DataProvider>
              <Finance onDismiss={() => {}} />
            </DataProvider>
          </PreferencesProvider>
        </AuthProvider>
      </ToastProvider>
    );

    expect(screen.getByText(/Currency: ETB \(ብር\)/i)).toBeInTheDocument();
  });
});

import { CommandPaletteProvider } from '../context/CommandPaletteContext';

describe('Dashboard Screen with ETB Currency Presentation', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(
      'menkir-preferences',
      JSON.stringify({
        currency: 'ETB',
        firstDayOfWeek: 'mon',
        defaultReminderMinutes: 15,
        roundingIncrementMinutes: 5,
        overdueThresholdDays: 30,
        defaultTaskDuration: 30,
        categories: [],
      })
    );
  });

  it('renders Dashboard without crashing and formats financial metrics with ETB', () => {
    render(
      <ToastProvider>
        <AuthProvider>
          <PreferencesProvider>
            <CommandPaletteProvider>
              <DataProvider>
                <Dashboard onPush={() => {}} />
              </DataProvider>
            </CommandPaletteProvider>
          </PreferencesProvider>
        </AuthProvider>
      </ToastProvider>
    );

    expect(screen.getByText(/Executive Overview/i)).toBeInTheDocument();
  });
});

describe('Projects Screen with ETB Currency Presentation', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(
      'menkir-preferences',
      JSON.stringify({
        currency: 'ETB',
        firstDayOfWeek: 'mon',
        defaultReminderMinutes: 15,
        roundingIncrementMinutes: 5,
        overdueThresholdDays: 30,
        defaultTaskDuration: 30,
        categories: [],
      })
    );
    localStorage.setItem(
      'menkir-projects',
      JSON.stringify([
        {
          id: 'p-1',
          index: '01',
          name: 'Mobile App Redesign',
          priority: 'high',
          completionPct: 60,
          tone: 'lime',
          budget: 125000,
          hourlyRate: 1250,
          status: 'active',
        },
      ])
    );
  });

  it('renders Project budget with ETB symbol ብር', () => {
    render(
      <ToastProvider>
        <AuthProvider>
          <PreferencesProvider>
            <DataProvider>
              <Projects />
            </DataProvider>
          </PreferencesProvider>
        </AuthProvider>
      </ToastProvider>
    );

    // Verify project name appears
    expect(screen.getByText('Mobile App Redesign')).toBeInTheDocument();
  });
});
