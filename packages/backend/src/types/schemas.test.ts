import { describe, it, expect } from 'vitest';
import {
  idParamSchema,
  createAccountSchema,
  createCardSchema,
  createTransactionSchema,
  createInstallmentPlanSchema,
  createRecurringBillSchema,
  createBillSchema,
  createDebtSchema,
  createPersonSchema,
  registerSchema,
} from './schemas.js';

const UUID_A = 'a1b2c3d4-1234-5678-9abc-def012345678';
const UUID_B = 'b5e6f7a8-9876-5432-1fed-cba987654321';

const validEmail = 'test@example.com';
const validDate = '2024-01-15';

describe('idParamSchema', () => {
  it('accepts a UUID', () => {
    expect(idParamSchema.safeParse({ id: UUID_A }).success).toBe(true);
  });

  it('rejects a cuid-style id', () => {
    expect(idParamSchema.safeParse({ id: 'ckwxyz1234567890abcdef' }).success).toBe(false);
  });

  it('rejects a non-id string', () => {
    expect(idParamSchema.safeParse({ id: 'not-an-id' }).success).toBe(false);
    expect(idParamSchema.safeParse({ id: '' }).success).toBe(false);
  });
});

describe('schemas with entity id fields', () => {
  it('createAccountSchema accepts a body with a valid payload', () => {
    const result = createAccountSchema.safeParse({
      body: { name: 'Nubank', institution: 'Nubank', type: 'DIGITAL' },
    });
    expect(result.success).toBe(true);
  });

  it('createCardSchema accepts UUID accountId', () => {
    const result = createCardSchema.safeParse({
      body: {
        name: 'Visa Platinum',
        institution: 'Nubank',
        brand: 'VISA',
        last4: '1234',
        limit: 100000,
        closingDay: 5,
        dueDay: 10,
        accountId: UUID_A,
      },
    });
    expect(result.success).toBe(true);
  });

  it('createCardSchema rejects non-UUID accountId', () => {
    const result = createCardSchema.safeParse({
      body: {
        name: 'Visa Platinum',
        institution: 'Nubank',
        brand: 'VISA',
        last4: '1234',
        limit: 100000,
        closingDay: 5,
        dueDay: 10,
        accountId: 'ckwxyz1234567890abcdef',
      },
    });
    expect(result.success).toBe(false);
  });

  it('createTransactionSchema accepts UUID references', () => {
    const result = createTransactionSchema.safeParse({
      body: {
        description: 'Supermercado',
        amount: 10050,
        type: 'EXPENSE',
        date: validDate,
        paymentMethod: 'PIX',
        accountId: UUID_A,
        cardId: UUID_B,
        categoryId: UUID_A,
      },
    });
    expect(result.success).toBe(true);
  });

  it('createInstallmentPlanSchema accepts UUID cardId', () => {
    const result = createInstallmentPlanSchema.safeParse({
      body: {
        description: 'Notebook',
        totalAmount: 300000,
        installmentsCount: 10,
        startDate: validDate,
        firstInvoiceDate: validDate,
        cardId: UUID_A,
        categoryId: UUID_B,
      },
    });
    expect(result.success).toBe(true);
  });

  it('createRecurringBillSchema accepts UUID references', () => {
    const result = createRecurringBillSchema.safeParse({
      body: {
        description: 'Netflix',
        amount: 3990,
        frequency: 'MONTHLY',
        dueDay: 10,
        startDate: validDate,
        accountId: UUID_A,
        cardId: UUID_B,
        categoryId: UUID_A,
      },
    });
    expect(result.success).toBe(true);
  });

  it('createBillSchema accepts UUID references', () => {
    const result = createBillSchema.safeParse({
      body: {
        description: 'Energia',
        amount: 15000,
        dueDate: validDate,
        accountId: UUID_A,
        categoryId: UUID_B,
      },
    });
    expect(result.success).toBe(true);
  });

  it('createDebtSchema accepts UUID relatedPersonId', () => {
    const result = createDebtSchema.safeParse({
      body: {
        description: 'Empréstimo',
        totalAmount: 100000,
        dueDate: validDate,
        type: 'PERSONAL_LOAN',
        relatedPersonId: UUID_A,
      },
    });
    expect(result.success).toBe(true);
  });

  it('createPersonSchema accepts a valid payload', () => {
    const result = createPersonSchema.safeParse({
      body: { name: 'João', email: validEmail, type: 'INDIVIDUAL' },
    });
    expect(result.success).toBe(true);
  });

  it('registerSchema rejects short passwords and invalid email', () => {
    expect(registerSchema.safeParse({ body: { email: 'x', password: 'short', name: 'Ana' } }).success).toBe(false);
    expect(registerSchema.safeParse({ body: { email: validEmail, password: 'long-enough-pass', name: 'Ana' } }).success).toBe(true);
  });
});