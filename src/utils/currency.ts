export interface CurrencyOption {
  code: string;
  label: string;
  symbol: string;
}

export const SUPPORTED_CURRENCIES: CurrencyOption[] = [
  { code: 'USD', label: 'USD ($)', symbol: '$' },
  { code: 'EUR', label: 'EUR (€)', symbol: '€' },
  { code: 'GBP', label: 'GBP (£)', symbol: '£' },
  { code: 'ETB', label: 'Ethiopian Birr (ETB)', symbol: 'ብር' },
];

/**
 * Returns the appropriate BCP 47 locale for the selected currency.
 * For ETB, 'am-ET' is the standard locale for Ethiopian Birr presentation.
 * For other supported currencies, 'en-US' preserves existing formatting.
 */
export function getCurrencyLocale(currencyCode: string = 'USD'): string {
  const code = (currencyCode || 'USD').toUpperCase();
  if (code === 'ETB') {
    return 'am-ET';
  }
  return 'en-US';
}

/**
 * Formats a numeric monetary amount using Intl.NumberFormat.
 * For ETB, formats with am-ET locale (e.g., "ብር 1,250.00", "-ብር 450.50", "ብር 0.00").
 * Preserves USD, EUR, and GBP standard formatting.
 * Includes graceful runtime fallbacks if the locale is not supported.
 */
export function formatCurrency(amount: number, currencyCode: string = 'USD'): string {
  const num = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  const code = (currencyCode || 'USD').toUpperCase();
  const locale = getCurrencyLocale(code);

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    // Fallback if specific locale is not supported in the runtime environment
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: code,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(num);
    } catch {
      const symbol = code === 'ETB' ? 'ብር' : code;
      const formattedNum = Math.abs(num).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return num < 0 ? `-${symbol} ${formattedNum}` : `${symbol} ${formattedNum}`;
    }
  }
}

/**
 * Formats a monetary amount compactly (e.g. for metric cards, charts, and summaries).
 * For ETB, uses am-ET compact notation (e.g., "ብር 1.5 ሚ", "ብር 2.5 ሺ").
 */
export function formatCurrencyCompact(amount: number, currencyCode: string = 'USD'): string {
  const num = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  const code = (currencyCode || 'USD').toUpperCase();
  const locale = getCurrencyLocale(code);

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
      notation: 'compact',
      compactDisplay: 'short',
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(num);
  } catch {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: code,
        notation: 'compact',
        compactDisplay: 'short',
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
      }).format(num);
    } catch {
      const symbol = code === 'ETB' ? 'ብር' : code;
      return `${symbol} ${num}`;
    }
  }
}

/**
 * Returns a recognizable currency symbol for labels, badges, and input prefixes.
 * Consistently returns "ብር" for ETB.
 */
export function getCurrencySymbol(currencyCode: string = 'USD'): string {
  const code = (currencyCode || 'USD').toUpperCase();
  if (code === 'ETB') {
    return 'ብር';
  }

  const locale = getCurrencyLocale(code);
  try {
    const parts = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
    }).formatToParts(0);
    const found = parts.find((p) => p.type === 'currency')?.value;
    if (found) return found;
  } catch {
    // ignore
  }

  if (code === 'USD') return '$';
  if (code === 'EUR') return '€';
  if (code === 'GBP') return '£';
  return code || '$';
}
