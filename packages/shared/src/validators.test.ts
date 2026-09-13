import { describe, it, expect } from 'vitest';
import {
  isValidCpf,
  formatCpf,
  normalizeCpf,
  isValidCnpj,
  formatCnpj,
  normalizeCnpj,
  isValidPhone,
  formatPhone,
  normalizePhone,
  isValidCep,
  formatCep,
  normalizeCep,
} from './brazil.js';
import { normalizeEmail, isValidEmail } from './email.js';
import { parseMoneyToCents, formatMoneyCents, money, formatMoney } from './money.js';
import { isValidCivilDate, addMonthsCivil, toCivilDate } from './date.js';
import { splitAmountCents } from './installments.js';
import { cpfSchema, cnpjSchema, phoneSchema, cepSchema, emailSchema, civilDateSchema, positiveMoneyCentsSchema } from './schemas.js';

describe('CPF', () => {
  it('validates a real CPF', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('52998224725')).toBe(true);
  });

  it('rejects all-equal CPF', () => {
    expect(isValidCpf('111.111.111-11')).toBe(false);
    expect(isValidCpf('00000000000')).toBe(false);
  });

  it('rejects invalid check digits', () => {
    expect(isValidCpf('529.982.247-24')).toBe(false);
  });

  it('formats and normalizes', () => {
    expect(formatCpf('12345678909')).toBe('123.456.789-09');
    expect(normalizeCpf('123.456.789-09')).toBe('12345678909');
  });
});

describe('CNPJ', () => {
  it('validates a real CNPJ', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true);
    expect(isValidCnpj('11222333000181')).toBe(true);
  });

  it('rejects all-equal CNPJ', () => {
    expect(isValidCnpj('00.000.000/0000-00')).toBe(false);
  });

  it('formats and normalizes', () => {
    expect(formatCnpj('11222333000181')).toBe('11.222.333/0001-81');
    expect(normalizeCnpj('11.222.333/0001-81')).toBe('11222333000181');
  });
});

describe('Phone', () => {
  it('accepts 10 and 11 digits', () => {
    expect(isValidPhone('8299999999')).toBe(true);
    expect(isValidPhone('(82) 99999-9999')).toBe(true);
    expect(isValidPhone('123')).toBe(false);
  });

  it('formats and normalizes', () => {
    expect(formatPhone('82999999999')).toBe('(82) 99999-9999');
    expect(formatPhone('8299999999')).toBe('(82) 9999-9999');
    expect(normalizePhone('(82) 99999-9999')).toBe('82999999999');
  });
});

describe('CEP', () => {
  it('validates and formats', () => {
    expect(isValidCep('57000-000')).toBe(true);
    expect(isValidCep('5700')).toBe(false);
    expect(formatCep('57000000')).toBe('57000-000');
    expect(normalizeCep('57000-000')).toBe('57000000');
  });
});

describe('Email', () => {
  it('normalizes trim + lowercase', () => {
    expect(normalizeEmail('  Usuario@EMAIL.com  ')).toBe('usuario@email.com');
    expect(isValidEmail('Usuario@EMAIL.com')).toBe(true);
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidEmail('  a@b.com  ')).toBe(true);
  });

  it('schema normalizes on parse', () => {
    const parsed = emailSchema.parse('  Usuario@EMAIL.com ');
    expect(parsed).toBe('usuario@email.com');
  });
});

describe('Money', () => {
  it('parses Brazilian currency strings to cents', () => {
    expect(parseMoneyToCents('R$ 1.250,50')).toBe(125050);
    expect(parseMoneyToCents('1250.50')).toBe(125050);
    expect(parseMoneyToCents('10,50')).toBe(1050);
  });

  it('rejects NaN / Infinity / malformed', () => {
    expect(parseMoneyToCents('abc')).toBeNull();
    expect(parseMoneyToCents('')).toBeNull();
    expect(parseMoneyToCents(Infinity)).toBeNull();
  });

  it('formats cents', () => {
    expect(formatMoneyCents(125050)).toContain('1.250,50');
    expect(formatMoney(money(12345))).toContain('123,45');
  });

  it('schema rejects negative / non-integer', () => {
    expect(positiveMoneyCentsSchema.safeParse(-1).success).toBe(false);
    expect(positiveMoneyCentsSchema.safeParse(10.5).success).toBe(false);
    expect(positiveMoneyCentsSchema.safeParse(100).success).toBe(true);
  });
});

describe('Civil dates', () => {
  it('validates calendar dates', () => {
    expect(isValidCivilDate('2024-01-15')).toBe(true);
    expect(isValidCivilDate('2024-13-01')).toBe(false);
    expect(isValidCivilDate('15/01/2024')).toBe(false);
    expect(civilDateSchema.safeParse('2024-01-15').success).toBe(true);
    expect(civilDateSchema.safeParse('2024-01-15T00:00:00.000Z').success).toBe(false);
  });

  it('adds months clamping day', () => {
    expect(addMonthsCivil('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonthsCivil('2024-03-15', -2)).toBe('2024-01-15');
  });

  it('round-trips a UTC-midnight Date to a civil date string', () => {
    expect(toCivilDate(new Date('2024-01-15'))).toBe('2024-01-15');
  });
});

describe('Installments', () => {
  it('splits an amount distributing the remainder', () => {
    expect(splitAmountCents(1000, 3)).toEqual([334, 333, 333]);
    expect(splitAmountCents(100, 4)).toEqual([25, 25, 25, 25]);
    expect(splitAmountCents(101, 3)).toEqual([34, 34, 33]);
  });

  it('throws on invalid input', () => {
    expect(() => splitAmountCents(-1, 3)).toThrow();
    expect(() => splitAmountCents(100, 0)).toThrow();
  });
});

describe('Schema transforms (normalization)', () => {
  it('cpfSchema normalizes masked input', () => {
    expect(cpfSchema.parse('529.982.247-25')).toBe('52998224725');
  });

  it('cnpjSchema normalizes masked input', () => {
    expect(cnpjSchema.parse('11.222.333/0001-81')).toBe('11222333000181');
  });

  it('phoneSchema / cepSchema normalize', () => {
    expect(phoneSchema.parse('(82) 99999-9999')).toBe('82999999999');
    expect(cepSchema.parse('57000-000')).toBe('57000000');
  });
});