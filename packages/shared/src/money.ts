export interface Money {
  cents: number;
  currency: 'BRL';
}

export const MAX_SAFE_CENTS = 999_999_999_999; // R$ 9.999.999.999,99

export function money(cents: number): Money {
  return { cents, currency: 'BRL' };
}

export function moneyFromReais(reais: number): Money {
  return { cents: Math.round(reais * 100), currency: 'BRL' };
}

export function moneyToReais(value: Money): number {
  return value.cents / 100;
}

export function addMoney(a: Money, b: Money): Money {
  return { cents: a.cents + b.cents, currency: a.currency };
}

export function subtractMoney(a: Money, b: Money): Money {
  return { cents: a.cents - b.cents, currency: a.currency };
}

export function multiplyMoney(value: Money, factor: number): Money {
  return { cents: Math.round(value.cents * factor), currency: value.currency };
}

export function formatMoney(value: Money, locale = 'pt-BR'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: value.currency,
  }).format(value.cents / 100);
}

export function formatMoneyCents(cents: number, locale = 'pt-BR'): string {
  return formatMoney(money(cents), locale);
}

function isSafeIntegerCents(cents: number): boolean {
  return Number.isSafeInteger(cents) && Number.isFinite(cents);
}

/**
 * Parses a Brazilian-formatted currency string (e.g. "R$ 1.250,50", "1.250,50",
 * "1250.50", "1 250,50") into integer cents. Returns null when the input cannot
 * be safely represented as cents (NaN, Infinity or malformed input).
 */
export function parseMoneyToCents(value: string | number): number | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    const cents = Math.round(value * 100);
    return isSafeIntegerCents(cents) ? cents : null;
  }

  if (typeof value !== 'string') return null;

  let normalized = value.trim();
  if (normalized.length === 0) return null;

  const isBrazilianFormat = /,\d{2}$/.test(normalized);
  if (isBrazilianFormat) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else {
    normalized = normalized.replace(/,/g, '');
  }

  normalized = normalized.replace(/[^\d.\-]/g, '');

  if (normalized === '' || normalized === '-' || normalized === '.') return null;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;

  const cents = Math.round(parsed * 100);
  return isSafeIntegerCents(cents) ? cents : null;
}

export function isValidMoneyCents(cents: number): boolean {
  return isSafeIntegerCents(cents) && cents >= 0 && cents <= MAX_SAFE_CENTS;
}