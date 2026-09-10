import { describe, it, expect } from 'vitest';
import {
  registerSchema,
  loginSchema,
  createAccountSchema,
  createCardSchema,
  createTransactionSchema,
  settingsSchema,
} from './validation';

describe('registerSchema', () => {
  it('accepts valid input', () => {
    const result = registerSchema.safeParse({ email: 'a@b.com', password: 'long-enough-pass', name: 'Ana' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = registerSchema.safeParse({ email: 'not-an-email', password: 'long-enough-pass', name: 'Ana' });
    expect(result.success).toBe(false);
  });

  it('rejects short passwords', () => {
    const result = registerSchema.safeParse({ email: 'a@b.com', password: 'short', name: 'Ana' });
    expect(result.success).toBe(false);
  });

  it('rejects empty names', () => {
    const result = registerSchema.safeParse({ email: 'a@b.com', password: 'long-enough-pass', name: '' });
    expect(result.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('accepts valid credentials', () => {
    const result = loginSchema.safeParse({ email: 'a@b.com', password: 'x' });
    expect(result.success).toBe(true);
  });
});

describe('createAccountSchema', () => {
  it('defaults initialBalance to 0', () => {
    const result = createAccountSchema.safeParse({ name: 'Nubank', institution: 'Nubank', type: 'DIGITAL' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.initialBalance).toBe(0);
  });

  it('rejects invalid account type', () => {
    const result = createAccountSchema.safeParse({ name: 'Nubank', institution: 'Nubank', type: 'NOPE' });
    expect(result.success).toBe(false);
  });
});

describe('createCardSchema', () => {
  it('accepts a valid card', () => {
    const result = createCardSchema.safeParse({
      name: 'Visa Platinum',
      institution: 'Nubank',
      brand: 'VISA',
      last4: '1234',
      limit: 100000,
      closingDay: 5,
      dueDay: 10,
    });
    expect(result.success).toBe(true);
  });

  it('requires exactly 4 digits for last4', () => {
    const result = createCardSchema.safeParse({
      name: 'Visa Platinum',
      institution: 'Nubank',
      brand: 'VISA',
      last4: '123',
      limit: 100000,
      closingDay: 5,
      dueDay: 10,
    });
    expect(result.success).toBe(false);
  });
});

describe('createTransactionSchema', () => {
  it('accepts a valid transaction', () => {
    const result = createTransactionSchema.safeParse({
      description: 'Supermercado',
      amount: 10050,
      type: 'EXPENSE',
      date: new Date().toISOString(),
      paymentMethod: 'PIX',
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-positive amounts', () => {
    const result = createTransactionSchema.safeParse({
      description: 'Supermercado',
      amount: 0,
      type: 'EXPENSE',
      date: new Date().toISOString(),
      paymentMethod: 'PIX',
    });
    expect(result.success).toBe(false);
  });
});

describe('settingsSchema', () => {
  it('accepts a first day of week of 0 or 1', () => {
    expect(settingsSchema.safeParse({ firstDayOfWeek: 0 }).success).toBe(true);
    expect(settingsSchema.safeParse({ firstDayOfWeek: 1 }).success).toBe(true);
    expect(settingsSchema.safeParse({ firstDayOfWeek: 2 }).success).toBe(false);
  });
});

describe('uuid id fields', () => {
  const uuid = 'a1b2c3d4-1234-5678-9abc-def012345678';

  it('createCardSchema accepts a UUID accountId', () => {
    const result = createCardSchema.safeParse({
      name: 'Visa Platinum',
      institution: 'Nubank',
      brand: 'VISA',
      last4: '1234',
      limit: 100000,
      closingDay: 5,
      dueDay: 10,
      accountId: uuid,
    });
    expect(result.success).toBe(true);
  });

  it('createCardSchema rejects a non-UUID accountId', () => {
    const result = createCardSchema.safeParse({
      name: 'Visa Platinum',
      institution: 'Nubank',
      brand: 'VISA',
      last4: '1234',
      limit: 100000,
      closingDay: 5,
      dueDay: 10,
      accountId: 'ckwxyz1234567890abcdef',
    });
    expect(result.success).toBe(false);
  });

  it('createTransactionSchema accepts UUID references', () => {
    const result = createTransactionSchema.safeParse({
      description: 'Supermercado',
      amount: 10050,
      type: 'EXPENSE',
      date: new Date().toISOString(),
      paymentMethod: 'PIX',
      accountId: uuid,
      cardId: uuid,
      categoryId: uuid,
    });
    expect(result.success).toBe(true);
  });

  it('createTransactionSchema rejects a non-UUID accountId', () => {
    const result = createTransactionSchema.safeParse({
      description: 'Supermercado',
      amount: 10050,
      type: 'EXPENSE',
      date: new Date().toISOString(),
      paymentMethod: 'PIX',
      accountId: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });
});