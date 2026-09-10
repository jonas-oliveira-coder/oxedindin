import { describe, it, expect } from 'vitest';
import {
  cn,
  formatMoney,
  parseMoney,
  getMonthKey,
  addMonths,
  getMonthName,
  isOverdue,
  daysUntil,
  getStatusColor,
  getTransactionTypeColor,
  getFrequencyLabel,
  getAccountTypeLabel,
  getCardBrandLabel,
  getDebtTypeLabel,
} from './utils';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('a', 'b')).toBe('a b');
    expect(cn('a', false && 'b', 'c')).toBe('a c');
  });
});

describe('formatMoney', () => {
  it('formats cents as BRL currency', () => {
    expect(formatMoney(12345)).toContain('123,45');
    expect(formatMoney(100)).toContain('1,00');
  });
});

describe('parseMoney', () => {
  it('parses "R$ 1.234,56" into cents', () => {
    expect(parseMoney('R$ 1.234,56')).toBe(123456);
  });

  it('parses "10,50" into 1050', () => {
    expect(parseMoney('10,50')).toBe(1050);
  });

  it('returns 0 for invalid input', () => {
    expect(parseMoney('abc')).toBe(0);
  });
});

describe('month helpers', () => {
  it('creates a month key', () => {
    expect(getMonthKey(new Date(2024, 0, 15))).toBe('2024-01');
    expect(getMonthKey(new Date(2024, 11, 1))).toBe('2024-12');
  });

  it('adds months across year boundaries', () => {
    const d = addMonths(new Date(2024, 10, 30), 3);
    expect(d.getFullYear()).toBe(2025);
    expect(d.getMonth()).toBe(1);
  });

  it('formats a month key label', () => {
    expect(getMonthName('2024-01')).toMatch(/janeiro/i);
    expect(getMonthName('2024-01')).toContain('2024');
  });
});

describe('date helpers', () => {
  it('detects overdue dates', () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    expect(isOverdue(past)).toBe(true);
    expect(isOverdue(future)).toBe(false);
  });

  it('computes days until a future date', () => {
    const target = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    expect(daysUntil(target)).toBe(3);
  });
});

describe('label/color helpers', () => {
  it('returns color classes for known statuses and a fallback', () => {
    expect(getStatusColor('PAID')).toContain('success');
    expect(getStatusColor('UNKNOWN')).toContain('muted');
  });

  it('returns txn type colors', () => {
    expect(getTransactionTypeColor('EXPENSE')).toBe('text-destructive');
    expect(getTransactionTypeColor('NOPE')).toBe('text-foreground');
  });

  it('maps labels to Portuguese', () => {
    expect(getFrequencyLabel('MONTHLY')).toBe('Mensal');
    expect(getAccountTypeLabel('CHECKING')).toBe('Conta Corrente');
    expect(getCardBrandLabel('VISA')).toBe('Visa');
    expect(getDebtTypeLabel('PERSONAL_LOAN')).toBe('Empréstimo Pessoal');
    expect(getFrequencyLabel('WEIRDLY')).toBe('WEIRDLY');
  });
});