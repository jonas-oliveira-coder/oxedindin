import { describe, it, expect } from 'vitest';
import {
  registerSchema,
  loginSchema,
  createAccountSchema,
  createCardSchema,
  createTransactionSchema,
  createInstallmentPlanSchema,
  createBillSchema,
  createRecurringBillSchema,
  createDebtSchema,
  createPersonSchema,
  createCategorySchema,
  updateCategorySchema,
  shareDebtSchema,
  passwordGeneratorSchema,
  notificationPreferencesSchema,
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
      date: '2024-01-15',
      paymentMethod: 'PIX',
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-positive amounts', () => {
    const result = createTransactionSchema.safeParse({
      description: 'Supermercado',
      amount: 0,
      type: 'EXPENSE',
      date: '2024-01-15',
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
      date: '2024-01-15',
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
      date: '2024-01-15',
      paymentMethod: 'PIX',
      accountId: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });
});

describe('createBillSchema', () => {
  it('accepts a valid bill', () => {
    const result = createBillSchema.safeParse({
      description: 'Conta de luz',
      amount: 15000,
      dueDate: '2024-01-15',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a non-positive amount', () => {
    const result = createBillSchema.safeParse({
      description: 'Conta de luz',
      amount: 0,
      dueDate: '2024-01-15',
    });
    expect(result.success).toBe(false);
  });
});

describe('createRecurringBillSchema', () => {
  it('accepts a valid recurring bill and defaults dateType', () => {
    const result = createRecurringBillSchema.safeParse({
      description: 'Netflix',
      amount: 3990,
      frequency: 'MONTHLY',
      dueDay: 10,
      startDate: '2024-01-15',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.dateType).toBe('FIXED');
  });

  it('rejects an invalid frequency', () => {
    const result = createRecurringBillSchema.safeParse({
      description: 'Netflix',
      amount: 3990,
      frequency: 'YEARLY',
      dueDay: 10,
      startDate: '2024-01-15',
    });
    expect(result.success).toBe(false);
  });
});

describe('createDebtSchema', () => {
  it('accepts a valid debt', () => {
    const result = createDebtSchema.safeParse({
      description: 'Empréstimo',
      totalAmount: 100000,
      dueDate: '2024-01-15',
      type: 'PERSONAL_LOAN',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid debt type', () => {
    const result = createDebtSchema.safeParse({
      description: 'Empréstimo',
      totalAmount: 100000,
      dueDate: '2024-01-15',
      type: 'MORTGAGE',
    });
    expect(result.success).toBe(false);
  });
});

describe('createPersonSchema', () => {
  it('accepts a valid person and defaults type', () => {
    const result = createPersonSchema.safeParse({ name: 'Maria' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.type).toBe('INDIVIDUAL');
  });

  it('rejects an invalid email', () => {
    expect(createPersonSchema.safeParse({ name: 'Maria', email: 'nope' }).success).toBe(false);
  });
});

describe('createInstallmentPlanSchema', () => {
  it('accepts a valid plan with a UUID cardId', () => {
    const result = createInstallmentPlanSchema.safeParse({
      description: 'Notebook',
      totalAmount: 300000,
      installmentsCount: 10,
      startDate: '2024-01-15',
      firstInvoiceDate: '2024-01-15',
      cardId: 'a1b2c3d4-1234-5678-9abc-def012345678',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid cardId', () => {
    const result = createInstallmentPlanSchema.safeParse({
      description: 'Notebook',
      totalAmount: 300000,
      installmentsCount: 10,
      startDate: '2024-01-15',
      firstInvoiceDate: '2024-01-15',
      cardId: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });
});

describe('category schemas', () => {
  it('accepts a valid category with a valid hex color', () => {
    expect(createCategorySchema.safeParse({ name: 'Alimentação', color: '#EF4444' }).success).toBe(true);
  });

  it('rejects an invalid color', () => {
    expect(createCategorySchema.safeParse({ name: 'Alimentação', color: 'red' }).success).toBe(false);
  });

  it('allows nullable fields on update', () => {
    expect(updateCategorySchema.safeParse({ color: null, icon: null }).success).toBe(true);
  });
});

describe('shareDebtSchema', () => {
  it('accepts a valid email', () => {
    expect(shareDebtSchema.safeParse({ email: 'a@b.com' }).success).toBe(true);
  });

  it('rejects an invalid email', () => {
    expect(shareDebtSchema.safeParse({ email: 'nope' }).success).toBe(false);
  });
});

describe('passwordGeneratorSchema', () => {
  it('defaults to length 16 with all types enabled', () => {
    const result = passwordGeneratorSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.length).toBe(16);
  });

  it('rejects a length below 8', () => {
    expect(passwordGeneratorSchema.safeParse({ length: 4 }).success).toBe(false);
  });
});

describe('notificationPreferencesSchema', () => {
  it('accepts a partial update', () => {
    expect(notificationPreferencesSchema.safeParse({ emailEnabled: true }).success).toBe(true);
    expect(notificationPreferencesSchema.safeParse({}).success).toBe(true);
  });
});