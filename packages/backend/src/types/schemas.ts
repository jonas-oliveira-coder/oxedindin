import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const moneySchema = z.object({
  cents: z.number().int(),
  currency: z.literal('BRL'),
});

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).max(100),
  avatarUrl: z.string().url().nullable().optional(),
  emailVerified: z.boolean(),
  twoFactorEnabled: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8).max(128),
    name: z.string().min(1).max(100),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).max(128),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email(),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1),
    password: z.string().min(8).max(128),
  }),
});

export const bankAccountSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1).max(100),
  institution: z.string().min(1).max(100),
  type: z.enum(['CHECKING', 'SAVINGS', 'DIGITAL', 'SALARY', 'OTHER']),
  number: z.string().max(20).nullable().optional(),
  agency: z.string().max(10).nullable().optional(),
  balanceCents: z.number().int(),
  initialBalanceCents: z.number().int(),
  status: z.enum(['ACTIVE', 'INACTIVE']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  notes: z.string().nullable().optional(),
});

export const createAccountSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    institution: z.string().min(1).max(100),
    type: z.enum(['CHECKING', 'SAVINGS', 'DIGITAL', 'SALARY', 'OTHER']),
    number: z.string().max(20).optional(),
    agency: z.string().max(10).optional(),
    initialBalance: z.number().int().default(0),
    notes: z.string().max(500).optional(),
  }),
});

export const updateAccountSchema = z.object({
  params: idParamSchema,
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    institution: z.string().min(1).max(100).optional(),
    type: z.enum(['CHECKING', 'SAVINGS', 'DIGITAL', 'SALARY', 'OTHER']).optional(),
    number: z.string().max(20).nullable().optional(),
    agency: z.string().max(10).nullable().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
    notes: z.string().max(500).nullable().optional(),
  }),
});

export const creditCardSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  accountId: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(100),
  institution: z.string().min(1).max(100),
  brand: z.enum(['VISA', 'MASTERCARD', 'AMEX', 'ELO', 'HIPERCARD', 'OTHER']),
  last4: z.string().length(4),
  limitCents: z.number().int(),
  availableLimitCents: z.number().int(),
  closingDay: z.number().int().min(1).max(31),
  dueDay: z.number().int().min(1).max(31),
  status: z.enum(['ACTIVE', 'INACTIVE']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  notes: z.string().nullable().optional(),
});

export const createCardSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    institution: z.string().min(1).max(100),
    brand: z.enum(['VISA', 'MASTERCARD', 'AMEX', 'ELO', 'HIPERCARD', 'OTHER']),
    last4: z.string().length(4),
    limit: z.number().int().positive(),
    closingDay: z.number().int().min(1).max(31),
    dueDay: z.number().int().min(1).max(31),
    accountId: z.string().uuid().optional(),
    notes: z.string().max(500).optional(),
  }),
});

export const updateCardSchema = z.object({
  params: idParamSchema,
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    institution: z.string().min(1).max(100).optional(),
    brand: z.enum(['VISA', 'MASTERCARD', 'AMEX', 'ELO', 'HIPERCARD', 'OTHER']).optional(),
    last4: z.string().length(4).optional(),
    limit: z.number().int().positive().optional(),
    closingDay: z.number().int().min(1).max(31).optional(),
    dueDay: z.number().int().min(1).max(31).optional(),
    accountId: z.string().uuid().nullable().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
    notes: z.string().max(500).nullable().optional(),
  }),
});

export const invoiceSchema = z.object({
  id: z.string().uuid(),
  cardId: z.string().uuid(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  closingDate: z.string().datetime(),
  dueDate: z.string().datetime(),
  totalCents: z.number().int(),
  paidCents: z.number().int(),
  remainingCents: z.number().int(),
  status: z.enum(['OPEN', 'CLOSED', 'PAID', 'PARTIALLY_PAID', 'OVERDUE']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const categorySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1).max(50),
  icon: z.string().nullable().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  isDefault: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1).max(50),
    icon: z.string().max(50).optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  }),
});

export const transactionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  accountId: z.string().uuid().nullable().optional(),
  cardId: z.string().uuid().nullable().optional(),
  installmentPlanId: z.string().uuid().nullable().optional(),
  description: z.string().min(1).max(200),
  amountCents: z.number().int(),
  type: z.enum(['EXPENSE', 'INCOME', 'TRANSFER']),
  categoryId: z.string().uuid().nullable().optional(),
  date: z.string().datetime(),
  paymentMethod: z.enum(['CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'PIX', 'BANK_TRANSFER', 'BOLETO', 'OTHER']),
  notes: z.string().max(500).nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createTransactionSchema = z.object({
  body: z.object({
    description: z.string().min(1).max(200),
    amount: z.number().int(),
    type: z.enum(['EXPENSE', 'INCOME', 'TRANSFER']),
    categoryId: z.string().uuid().optional(),
    date: z.string().datetime(),
    paymentMethod: z.enum(['CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'PIX', 'BANK_TRANSFER', 'BOLETO', 'OTHER']),
    accountId: z.string().uuid().optional(),
    cardId: z.string().uuid().optional(),
    notes: z.string().max(500).optional(),
  }),
});

export const installmentPlanSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  cardId: z.string().uuid(),
  description: z.string().min(1).max(200),
  totalAmountCents: z.number().int(),
  installmentsCount: z.number().int().positive(),
  installmentValueCents: z.number().int(),
  startDate: z.string().datetime(),
  firstInvoiceDate: z.string().datetime(),
  categoryId: z.string().uuid().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createInstallmentPlanSchema = z.object({
  body: z.object({
    description: z.string().min(1).max(200),
    totalAmount: z.number().int().positive(),
    installmentsCount: z.number().int().positive().max(60),
    startDate: z.string().datetime(),
    firstInvoiceDate: z.string().datetime(),
    cardId: z.string().uuid(),
    categoryId: z.string().uuid().optional(),
  }),
});

export const installmentSchema = z.object({
  id: z.string().uuid(),
  planId: z.string().uuid(),
  invoiceId: z.string().uuid().nullable().optional(),
  number: z.number().int().positive(),
  amountCents: z.number().int(),
  dueDate: z.string().datetime(),
  status: z.enum(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED']),
  paidAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const recurringBillSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  accountId: z.string().uuid().nullable().optional(),
  cardId: z.string().uuid().nullable().optional(),
  description: z.string().min(1).max(200),
  amountCents: z.number().int(),
  categoryId: z.string().uuid().nullable().optional(),
  frequency: z.enum(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL']),
  dueDay: z.number().int().min(1).max(31),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ENDED']),
  nextDueDate: z.string().datetime(),
  dateType: z.enum(['FIXED', 'ADJUSTABLE']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createRecurringBillSchema = z.object({
  body: z.object({
    description: z.string().min(1).max(200),
    amount: z.number().int().positive(),
    categoryId: z.string().uuid().optional(),
    frequency: z.enum(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL']),
    dueDay: z.number().int().min(1).max(31),
    startDate: z.string().datetime(),
    endDate: z.string().datetime().optional(),
    accountId: z.string().uuid().optional(),
    cardId: z.string().uuid().optional(),
    dateType: z.enum(['FIXED', 'ADJUSTABLE']).default('FIXED'),
  }),
});

export const billSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  accountId: z.string().uuid().nullable().optional(),
  recurringBillId: z.string().uuid().nullable().optional(),
  description: z.string().min(1).max(200),
  amountCents: z.number().int(),
  categoryId: z.string().uuid().nullable().optional(),
  dueDate: z.string().datetime(),
  paymentMethod: z.enum(['CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'PIX', 'BANK_TRANSFER', 'BOLETO', 'OTHER']).nullable().optional(),
  status: z.enum(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED']),
  paidAt: z.string().datetime().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createBillSchema = z.object({
  body: z.object({
    description: z.string().min(1).max(200),
    amount: z.number().int().positive(),
    categoryId: z.string().uuid().optional(),
    dueDate: z.string().datetime(),
    paymentMethod: z.enum(['CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'PIX', 'BANK_TRANSFER', 'BOLETO', 'OTHER']).optional(),
    accountId: z.string().uuid().optional(),
    notes: z.string().max(500).optional(),
  }),
});

export const debtSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  description: z.string().min(1).max(200),
  totalAmountCents: z.number().int(),
  paidAmountCents: z.number().int(),
  remainingAmountCents: z.number().int(),
  dueDate: z.string().datetime(),
  type: z.enum(['PERSONAL_LOAN', 'CREDIT_CARD', 'PURCHASE', 'BORROWED_MONEY', 'OTHER']),
  relatedPersonId: z.string().uuid().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  status: z.enum(['ACTIVE', 'PAID', 'OVERDUE', 'CANCELLED', 'RENEGOTIATED']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createDebtSchema = z.object({
  body: z.object({
    description: z.string().min(1).max(200),
    totalAmount: z.number().int().positive(),
    dueDate: z.string().datetime(),
    type: z.enum(['PERSONAL_LOAN', 'CREDIT_CARD', 'PURCHASE', 'BORROWED_MONEY', 'OTHER']),
    relatedPersonId: z.string().uuid().optional(),
    notes: z.string().max(500).optional(),
  }),
});

export const personSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1).max(100),
  email: z.string().email().nullable().optional(),
  type: z.enum(['INDIVIDUAL', 'COMPANY']),
  phone: z.string().max(20).nullable().optional(),
  document: z.string().max(20).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createPersonSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    email: z.string().email().optional(),
    type: z.enum(['INDIVIDUAL', 'COMPANY']).default('INDIVIDUAL'),
    phone: z.string().max(20).optional(),
    document: z.string().max(20).optional(),
    notes: z.string().max(500).optional(),
  }),
});

export const sharedDebtSchema = z.object({
  id: z.string().uuid(),
  debtId: z.string().uuid(),
  debtorUserId: z.string().uuid(),
  creditorUserId: z.string().uuid(),
  status: z.enum(['PENDING', 'ACCEPTED', 'REJECTED', 'PAID', 'CANCELLED', 'DISPUTED']),
  notifiedAt: z.string().datetime().nullable().optional(),
  acceptedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const shareDebtSchema = z.object({
  body: z.object({
    email: z.string().email(),
  }),
});

export const notificationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  type: z.enum([
    'INVOICE_DUE_SOON',
    'INVOICE_OVERDUE',
    'BILL_DUE_SOON',
    'BILL_OVERDUE',
    'INSTALLMENT_DUE_SOON',
    'DEBT_DUE_SOON',
    'SHARED_DEBT_ADDED',
    'SHARED_DEBT_UPDATED',
    'PAYMENT_RECEIVED',
    'SHARED_DEBT_PAYMENT',
    'SECURITY_ALERT',
  ]),
  title: z.string(),
  message: z.string(),
  read: z.boolean(),
  relatedEntityType: z.string().nullable().optional(),
  relatedEntityId: z.string().nullable().optional(),
  channels: z.array(z.enum(['IN_APP', 'EMAIL', 'PUSH'])),
  createdAt: z.string().datetime(),
});

export const notificationPreferencesSchema = z.object({
  userId: z.string().uuid(),
  invoiceDueSoon: z.boolean(),
  invoiceOverdue: z.boolean(),
  billDueSoon: z.boolean(),
  billOverdue: z.boolean(),
  installmentDueSoon: z.boolean(),
  debtDueSoon: z.boolean(),
  sharedDebtAdded: z.boolean(),
  sharedDebtUpdated: z.boolean(),
  paymentReceived: z.boolean(),
  securityAlert: z.boolean(),
  emailEnabled: z.boolean(),
  pushEnabled: z.boolean(),
  inAppEnabled: z.boolean(),
  updatedAt: z.string().datetime(),
});

export const updateNotificationPreferencesSchema = z.object({
  body: z.object({
    invoiceDueSoon: z.boolean().optional(),
    invoiceOverdue: z.boolean().optional(),
    billDueSoon: z.boolean().optional(),
    billOverdue: z.boolean().optional(),
    installmentDueSoon: z.boolean().optional(),
    debtDueSoon: z.boolean().optional(),
    sharedDebtAdded: z.boolean().optional(),
    sharedDebtUpdated: z.boolean().optional(),
    paymentReceived: z.boolean().optional(),
    securityAlert: z.boolean().optional(),
    emailEnabled: z.boolean().optional(),
    pushEnabled: z.boolean().optional(),
    inAppEnabled: z.boolean().optional(),
  }),
});

export const passkeySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  credentialId: z.string(),
  publicKey: z.string(),
  counter: z.number().int(),
  name: z.string(),
  createdAt: z.string().datetime(),
  lastUsedAt: z.string().datetime().nullable().optional(),
});

export const sessionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  tokenHash: z.string(),
  ip: z.string().nullable().optional(),
  userAgent: z.string().nullable().optional(),
  deviceName: z.string().nullable().optional(),
  expiresAt: z.string().datetime(),
  revokedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
});

export const auditLogSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  oldData: z.record(z.unknown()).nullable().optional(),
  newData: z.record(z.unknown()).nullable().optional(),
  ip: z.string().nullable().optional(),
  userAgent: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
});

export const dashboardSummarySchema = z.object({
  totalBalance: moneySchema,
  accountsBalance: z.array(z.object({
    accountId: z.string().uuid(),
    name: z.string(),
    balance: moneySchema,
  })),
  totalExpensesMonth: moneySchema,
  totalIncomeMonth: moneySchema,
  pendingBillsTotal: moneySchema,
  debtsTotal: moneySchema,
  owedTotal: moneySchema,
  currentInvoices: z.array(z.object({
    cardId: z.string().uuid(),
    name: z.string(),
    total: moneySchema,
    dueDate: z.string().datetime(),
  })),
  upcomingInvoices: z.array(z.object({
    cardId: z.string().uuid(),
    name: z.string(),
    estimatedTotal: moneySchema,
    dueDate: z.string().datetime(),
  })),
  upcomingBills: z.array(z.object({
    id: z.string().uuid(),
    description: z.string(),
    amount: moneySchema,
    dueDate: z.string().datetime(),
  })),
  upcomingInstallments: z.array(z.object({
    planId: z.string().uuid(),
    description: z.string(),
    amount: moneySchema,
    dueDate: z.string().datetime(),
  })),
  fixedExpenses: moneySchema,
  cashflowProjection: z.array(z.object({
    month: z.string(),
    bills: moneySchema,
    installments: moneySchema,
    cards: moneySchema,
    totalCommitted: moneySchema,
  })),
});

export const reportFiltersSchema = z.object({
  query: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    categoryIds: z.string().optional().transform((v) => v?.split(',')),
    accountIds: z.string().optional().transform((v) => v?.split(',')),
    cardIds: z.string().optional().transform((v) => v?.split(',')),
    transactionTypes: z.string().optional().transform((v) => v?.split(',') as any),
  }),
});