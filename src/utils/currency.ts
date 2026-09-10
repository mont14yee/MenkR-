export function formatCurrency(amount: number, currencyCode: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatCurrencyCompact(amount: number, currencyCode: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    notation: 'compact',
    compactDisplay: 'short',
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(amount);
}

export function getCurrencySymbol(currencyCode: string = 'USD'): string {
  const parts = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
  }).formatToParts(0);
  return parts.find(p => p.type === 'currency')?.value || '$';
}
